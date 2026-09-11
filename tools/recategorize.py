# tools/recategorize.py
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the backend directory to the path to import helper functions
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
try:
    from server import (
        classify_category, classify_priority, refine_with_groq,
        infer_category_from_keywords, find_urgent_matches, extract_keywords,
        normalize_sentiment,
        CATEGORY_MODEL, PRIORITY_MODEL, GROQ_MODEL,
        HF_API_TOKEN, GROQ_API_KEY
    )
except ImportError as e:
    logger.error(f"Failed to import functions from backend/server.py: {e}")
    sys.exit(1)


# --- PATH SETUP ---
dotenv_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

if not HF_API_TOKEN:
  logger.error("❌ HF_API_TOKEN / HUGGINGFACE_API_TOKEN not set")
  
if not GROQ_API_KEY:
  logger.error("❌ GROQ_API_KEY not set")


# --- Firebase Admin init ---
try:
    service_account_path = os.path.join(os.path.dirname(__file__), "..", "backend", "serviceAccountKey.json")
    if os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
    else:
        cred = credentials.ApplicationDefault()

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    logger.error(f"❌ Failed to initialize Firebase Admin: {e}")
    sys.exit(1)


# --- MAIN RE-CATEGORIZATION ---
def recategorize_all():
    logger.info("🔄 Fetching all grievances...")
    try:
        snapshot = db.collection("grievances").stream()
    except Exception as e:
        logger.error(f"❌ Failed to fetch documents: {e}")
        return

    docs_to_reprocess = list(snapshot)
    logger.info(f"📌 Found {len(docs_to_reprocess)} documents\n")

    for doc_snap in docs_to_reprocess:
        data = doc_snap.to_dict()
        doc_id = doc_snap.id
        text = f"{data.get('title', '')}\n{data.get('description', '')}".strip()

        # ⭐️ NEW: Retrieve latitude and longitude from the document data
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        logger.info(f"➡ Reprocessing {doc_id}")

        if not text:
            logger.warning(f"   ⚠️ Skipping {doc_id}: No title or description.")
            continue

        try:
            # 1. HF/Rule-based Classification (FIRST LOGIC PASS)
            cat_res = classify_category(text)
            pri_res = classify_priority(text)

            # Apply logic from server.py (Existing HF/Keyword logic for comparison)
            
            hf_priority = pri_res.get("priority", "low")
            sentiment_raw = pri_res.get("sentiment", "neutral")
            score = pri_res.get("sentimentScore", 0.0)
            sentiment_norm = normalize_sentiment(sentiment_raw)
            urgent_matches = find_urgent_matches(text)

            hf_category = cat_res.get("category", "other")
            keyword_category = infer_category_from_keywords(text)
            if keyword_category:
                hf_category = keyword_category
            
            if hf_category == "sanitation" and hf_priority == "low":
                hf_priority = "medium"
                
            hf_raw_label = cat_res.get("rawLabel", "other")
            
            # 2. LLM Refinement (SECOND LOGIC PASS / WRAPPER)
            groq_res = refine_with_groq(text, hf_category, hf_priority, hf_raw_label)

            # 3. FINAL CLASSIFICATION (Prioritizes Groq refinement)
            if groq_res:
                priority = groq_res.get("priority", hf_priority)
                category = groq_res.get("category", hf_category)
                ai_explanation = groq_res.get("explanation", "Refined by Groq LLM.")
            else:
                # Fallback to the existing logic results
                priority = hf_priority
                category = hf_category
                ai_explanation = (
                    f"Category '{category}' predicted from '{hf_raw_label}' "
                    f"(score: {float(cat_res.get('confidence', 0.0)):.2f}), "
                    f"Priority '{priority}' determined using sentiment ('{sentiment_raw}', "
                    f"score: {float(score):.2f}) and urgency keywords."
                )

            keywords = extract_keywords(text)

            hf_engine = {
                "category": category,
                "priority": priority,
                "isUrgent": priority == "high",
                "keywords": keywords,
                "explanation": ai_explanation,
                
                # Keep all model data for diagnostics
                "rawCategoryLabel": hf_raw_label,
                "categoryConfidence": float(cat_res.get("confidence", 0.0)),
                "urgentMatches": urgent_matches,
                "modelInfo": {
                    "categoryModel": CATEGORY_MODEL,
                    "priorityModel": PRIORITY_MODEL,
                    "sentimentLabel": sentiment_raw,
                    "sentimentScore": float(score),
                    "groqModel": GROQ_MODEL if groq_res else "None",
                    "hfCategory": hf_category,
                    "hfPriority": hf_priority,
                },
            }

            # ⭐️ NEW: Prepare update payload
            update_data = {
                "hfEngine": hf_engine
            }
            
            # ⭐️ NEW: Conditionally include location data in the update payload
            if latitude is not None:
                update_data['latitude'] = latitude
            if longitude is not None:
                update_data['longitude'] = longitude

            # Use the update_data payload with merge=True
            doc_snap.reference.set(update_data, merge=True)
            logger.info(f"   ✅ Updated: {doc_id} (Category: {category}, Priority: {priority})\n")

        except Exception as e:
            logger.error(f"   ❌ Failed for {doc_id}: {e}")

    logger.info("\n🎉 Re-categorization complete!")


if __name__ == "__main__":
    recategorize_all()