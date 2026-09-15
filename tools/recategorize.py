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

# Add root and backend directories to sys.path
base_dir = os.path.dirname(__file__)
sys.path.append(os.path.abspath(os.path.join(base_dir, '..')))
sys.path.append(os.path.abspath(os.path.join(base_dir, '..', 'backend')))

# --- PATH SETUP & ENV LOADING ---
dotenv_path = os.path.join(base_dir, "..", "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

from grievance_model import GrievanceModel
from llm_fallback import predict_with_fallback

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("[WARNING] GROQ_API_KEY not set in backend/.env. LLM Fallback might fail if triggered.")

# --- Firebase Admin init ---
try:
    service_account_path = os.path.join(base_dir, "..", "backend", "serviceAccountKey.json")
    if os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
    else:
        cred = credentials.ApplicationDefault()

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    logger.error(f"[ERROR] Failed to initialize Firebase Admin: {e}")
    sys.exit(1)


# --- MAIN RE-CATEGORIZATION ---
def recategorize_all():
    logger.info("[INFO] Initializing & Training GrievanceModel...")
    model = GrievanceModel()
    model.train()

    logger.info("[INFO] Fetching all grievances from Firestore...")
    try:
        snapshot = db.collection("grievances").stream()
    except Exception as e:
        logger.error(f"[ERROR] Failed to fetch documents: {e}")
        return

    docs_to_reprocess = list(snapshot)
    logger.info(f"[INFO] Found {len(docs_to_reprocess)} documents\n")

    for doc_snap in docs_to_reprocess:
        data = doc_snap.to_dict()
        doc_id = doc_snap.id
        text = f"{data.get('title', '')}\n{data.get('description', '')}".strip()

        latitude = data.get('latitude')
        longitude = data.get('longitude')

        logger.info(f"Reprocessing {doc_id}")

        if not text:
            logger.warning(f"   [WARNING] Skipping {doc_id}: No title or description.")
            continue

        try:
            # Run prediction with Groq LLM fallback wrapper
            classification = predict_with_fallback(model, text)

            category = classification["category"]
            priority = classification["priority"]
            confidence = classification["confidence"]
            source = classification["source"]
            reason = classification["reason"]

            hf_engine = {
                "category": category,
                "priority": priority,
                "isUrgent": priority.lower() == "high",
                "confidence": confidence,
                "source": source,
                "explanation": reason,
                "modelInfo": {
                    "mlModel": "GrievanceModel (TF-IDF + LogisticRegression)",
                    "fallbackModel": "Groq LLM (mixtral-8x7b-32768 / llama3-70b-8192)",
                    "usedSource": source
                }
            }

            update_data = {
                "category": category,
                "priority": priority,
                "hfEngine": hf_engine
            }

            if latitude is not None:
                update_data['latitude'] = latitude
            if longitude is not None:
                update_data['longitude'] = longitude

            # Update document in Firestore
            doc_snap.reference.set(update_data, merge=True)
            logger.info(f"   [OK] Updated: {doc_id} -> Category: {category}, Priority: {priority} (Source: {source})\n")

        except Exception as e:
            logger.error(f"   [ERROR] Failed for {doc_id}: {e}")

    logger.info("\n[SUCCESS] Re-categorization complete!")


if __name__ == "__main__":
    recategorize_all()