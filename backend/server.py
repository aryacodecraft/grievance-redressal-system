#!/usr/bin/env python3
"""
server.py — LLM-only image validation (reject if LLM confidence < IMAGE_LLM_THRESHOLD)
Also exposes an optional Cloudinary signing endpoint for private images:
  POST /sign-cloudinary  { "public_id": "...", "resource_type": "image", "transform": "f_auto,q_auto,w_900" }
Returns { "signedUrl": "..." } or an error.

Env:
 - FIREBASE_SERVICE_ACCOUNT (JSON string) or serviceAccountKey.json beside this file
 - GROQ_API_KEY (required for LLM image checks) — optional if you don't use image LLM checks
 - HF_API_TOKEN (optional, used for text classification only)
 - IMAGE_LLM_THRESHOLD (default 60)
 - CLOUDINARY_CLOUD_NAME (optional)
 - CLOUDINARY_API_KEY (optional)
 - CLOUDINARY_API_SECRET (optional)  # required for signed URLs
 - PORT (default 10000)
"""
import os
import json as json_lib
import logging
import base64
from io import BytesIO
from collections import Counter
import re

import numpy as np
import requests
from PIL import Image, ImageStat

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

try:
    from grievance_model import GrievanceModel
    from llm_fallback import predict_with_fallback
    ml_fallback_model = GrievanceModel().train()
except Exception as _e:
    ml_fallback_model = None

# Firebase admin SDK
import firebase_admin
from firebase_admin import credentials, firestore

# optional Groq client (LLM)
try:
    from groq import Groq
except Exception:
    Groq = None

# Optional Cloudinary SDK (for signed URL generation)
try:
    import cloudinary
    from cloudinary.utils import cloudinary_url
except Exception:
    cloudinary = None
    cloudinary_url = None

# -------------------------
# Logging
# -------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("grievance-server")

# -------------------------
# Load .env
# -------------------------
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# -------------------------
# Flask init
# -------------------------
app = Flask(__name__)
CORS(app)

# -------------------------
# Firebase init
# -------------------------
db = None
try:
    firebase_key_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if firebase_key_json:
        # If env var contains JSON string ensure it's valid; otherwise fall back.
        try:
            cred = credentials.Certificate(json_lib.loads(firebase_key_json))
            logger.info("Using FIREBASE_SERVICE_ACCOUNT from env")
        except Exception:
            logger.exception("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON from env; will try local file.")
            cred = None
    else:
        cred = None

    if not cred:
        service_account_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            logger.info("Using local serviceAccountKey.json")
        else:
            raise FileNotFoundError("Firebase credentials not found in env or local file.")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    logger.info("Firebase initialized")
except Exception:
    logger.exception("Firebase initialization failed; continuing without DB (db will be None).")
    db = None

# -------------------------
# Groq (LLM) init — required for image validation
# -------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = None
if GROQ_API_KEY:
    if Groq is None:
        logger.error("GROQ_API_KEY set but Groq SDK is not installed. Install `groq` package.")
    else:
        try:
            groq_client = Groq(api_key=GROQ_API_KEY)
            logger.info("Groq client initialized")
        except Exception:
            logger.exception("Failed to initialize Groq client; image LLM validation will be unavailable.")
            groq_client = None
else:
    logger.warning("GROQ_API_KEY not set. LLM image validation disabled until GROQ_API_KEY is provided.")

LLAVA_MODEL = os.getenv("LLAVA_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
IMAGE_LLM_THRESHOLD = float(os.getenv("IMAGE_LLM_THRESHOLD", "60.0"))

# -------------------------
# (Optional) HuggingFace text config used for text classification only
# -------------------------
HF_API_TOKEN = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACE_API_TOKEN")
HF_BASE_URL = "https://router.huggingface.co/hf-inference"

# -------------------------
# Cloudinary config (optional)
# -------------------------
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if cloudinary and CLOUDINARY_CLOUD_NAME:
    try:
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )
        logger.info("Cloudinary configured")
    except Exception:
        logger.exception("Failed to configure Cloudinary")

# -------------------------
# helper utilities (kept for submit endpoint)
# -------------------------
CATEGORY_LABELS = [
    "Issues related to water supply, water pressure, contamination, or no water",
    "Issues related to roads, potholes, footpaths, traffic, or road damage",
    "Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working",
    "Issues related to sanitation, garbage, sewage, drainage, or public cleanliness",
    "Issues related to health services, hospitals, clinics, medicines, or public health",
    "Issues related to governance, staff behavior, corruption, permissions, or government service delays",
    "Other issues not matching the above categories",
]
CATEGORY_KEYS = ["water", "roads", "electricity", "sanitation", "health", "governance", "other"]
PRIORITY_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"

URGENT_KEYWORDS = [
    # General urgency
    "urgent",
    "emergency",
    "immediately",
    "immediate action",
    "critical",
    "serious",
    "danger",
    "dangerous",
    "life threatening",
    "high risk",
    "unsafe",
    "asap",

    # Fire & Disaster
    "fire",
    "smoke",
    "explosion",
    "blast",
    "gas leak",
    "building collapse",
    "collapsed",
    "collapse",
    "wall collapse",
    "flood",
    "flooding",
    "landslide",

    # Electricity hazards
    "electrocution",
    "electric shock",
    "live wire",
    "hanging wire",
    "sparking",
    "short circuit",
    "electrical hazard",
    "high voltage",
    "transformer blast",
    "transformer fire",
    "exposed cable",

    # Water & Sanitation emergencies
    "sewage",
    "overflowing sewage",
    "sewage overflow",
    "blocked drain",
    "choked drain",
    "drain overflow",
    "water contamination",
    "contaminated water",
    "dirty water",
    "waterborne disease",
    "health hazard",
    "sanitation hazard",
    "stagnant water",
    "open manhole",
    "manhole cover missing",

    # Road safety
    "major accident",
    "fatal accident",
    "sinkhole",
    "road cave in",
    "bridge collapse",
    "huge pothole",
    "deep pothole",

    # Health emergencies
    "disease outbreak",
    "epidemic",
    "infection spread",
    "medical emergency",

    # Utility failures affecting many people
    "no water",
    "no electricity",
    "power outage",
    "complete blackout"
]


SANITATION_KEYWORDS = [
    "garbage", "waste", "trash", "dustbin", "sewage", "sewer",
    "drainage", "drain", "litter", "dirty", "filth",
    "smell", "stink", "stray animals", "dump",
    "waste collection", "garbage collection"
]

CATEGORY_MODEL = "MoritzLaurer/deberta-v3-large-zeroshot-v2.0"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

ALL_KEYWORD_LISTS = {
    "water": ["water", "leak", "contamination", "pipeline", "pressure", "supply", "pipe", "borewell"],
    "roads": ["road", "pothole", "footpath", "traffic", "tar", "asphalt", "cracks", "pavement"],
    "electricity": ["electricity", "power", "cut", "voltage", "streetlight", "wire", "cable", "blackout", "transformer", "sparking"],
    "sanitation": SANITATION_KEYWORDS,
    "health": ["hospital", "clinic", "medicine", "health", "doctor", "disease", "outbreak", "epidemic", "infection"],
    "governance": ["governance", "corruption", "bribe", "behavior", "delay", "staff", "permission", "office", "officer"],
    "urgent": URGENT_KEYWORDS
}

def normalize_sentiment(sentiment):
    if not sentiment:
        return "neutral"
    s = sentiment.lower().strip()
    if "neg" in s:
        return "negative"
    if "pos" in s:
        return "positive"
    return "neutral"

def find_urgent_matches(text):
    if not text:
        return []
    text_lower = text.lower()
    matches = []
    for keyword in URGENT_KEYWORDS:
        if " " in keyword:
            if keyword in text_lower:
                matches.append(keyword)
        else:
            pattern = rf"\b{re.escape(keyword)}"
            if re.search(pattern, text_lower):
                matches.append(keyword)
    return matches

def extract_keywords(text):
    if not text:
        return []
    text_lower = text.lower()
    found = set()
    for cat, kws in ALL_KEYWORD_LISTS.items():
        for kw in kws:
            if " " in kw:
                if kw in text_lower:
                    found.add(kw)
            else:
                pattern = rf"\b{re.escape(kw)}"
                if re.search(pattern, text_lower):
                    found.add(kw)
    return list(found)

def infer_category_from_keywords(text):
    if not text:
        return None
    text_lower = text.lower()
    counts = {cat: 0 for cat in CATEGORY_KEYS if cat != "other"}
    
    for cat, kws in ALL_KEYWORD_LISTS.items():
        if cat in counts:
            for kw in kws:
                if " " in kw:
                    if kw in text_lower:
                        counts[cat] += 1
                else:
                    pattern = rf"\b{re.escape(kw)}"
                    if re.search(pattern, text_lower):
                        counts[cat] += 1
                        
    max_cat = None
    max_count = 0
    for cat, count in counts.items():
        if count > max_count:
            max_count = count
            max_cat = cat
            
    if max_count > 0:
        return max_cat
    return None

def classify_category(text):
    if not text:
        return {
            "rawLabel": "Other issues not matching the above categories",
            "category": "other",
            "confidence": 0.0
        }
        
    raw_label = "Other issues not matching the above categories"
    category = "other"
    confidence = 0.0

    # Try HF zero-shot first
    if HF_API_TOKEN:
        models = [CATEGORY_MODEL, "facebook/bart-large-mnli"]
        for model in models:
            try:
                url = f"{HF_BASE_URL}/models/{model}"
                headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
                payload = {
                    "inputs": text,
                    "parameters": {
                        "candidate_labels": CATEGORY_LABELS
                    }
                }
                response = requests.post(url, headers=headers, json=payload, timeout=5)
                if response.status_code == 200:
                    res_data = response.json()
                    if isinstance(res_data, dict) and "labels" in res_data and "scores" in res_data:
                        labels = res_data["labels"]
                        scores = res_data["scores"]
                        if labels and scores:
                            best_label = labels[0]
                            best_score = float(scores[0])
                            
                            # Only accept if confidence is reasonably high (> 0.4)
                            if best_score > 0.4 and best_label in CATEGORY_LABELS:
                                idx = CATEGORY_LABELS.index(best_label)
                                return {
                                    "rawLabel": best_label,
                                    "category": CATEGORY_KEYS[idx],
                                    "confidence": best_score
                                }
            except Exception as e:
                logger.error(f"HF category API call failed for model {model}: {e}")
                
    # Fallback to Groq LLM for categorization if HF fails or is low confidence
    if groq_client:
        prompt = (
            "You are an expert civic grievance classifier.\n"
            "Classify the grievance into exactly one of the allowed categories.\n\n"
            "Grievance text:\n"
            f"\"\"\"\n{text}\n\"\"\"\n\n"
            "Allowed Category Keys and Descriptions:\n"
            "- water: Issues related to water supply, water pressure, contamination, or no water\n"
            "- roads: Issues related to roads, potholes, footpaths, traffic, or road damage\n"
            "- electricity: Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working\n"
            "- sanitation: Issues related to sanitation, garbage, sewage, drainage, or public cleanliness\n"
            "- health: Issues related to health services, hospitals, clinics, medicines, or public health\n"
            "- governance: Issues related to governance, staff behavior, corruption, permissions, or government service delays\n"
            "- other: Other issues not matching the above categories\n\n"
            "Return JSON only:\n"
            "{\n"
            "  \"category\": \"water|roads|electricity|sanitation|health|governance|other\",\n"
            "  \"reason\": \"short explanation\"\n"
            "}\n"
        )
        try:
            res = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=150
            )
            raw = res.choices[0].message.content.strip()
            parsed = None
            try:
                parsed = json_lib.loads(raw)
            except Exception:
                import re as _re
                m = _re.search(r'\{[\s\S]*\}', raw)
                if m:
                    try:
                        parsed = json_lib.loads(m.group(0))
                    except Exception:
                        pass
            if parsed and isinstance(parsed, dict) and "category" in parsed:
                cat_key = parsed.get("category").lower().strip()
                if cat_key in CATEGORY_KEYS:
                    idx = CATEGORY_KEYS.index(cat_key)
                    return {
                        "rawLabel": CATEGORY_LABELS[idx],
                        "category": cat_key,
                        "confidence": 0.95
                    }
        except Exception as e:
            logger.error(f"Groq category classification fallback failed: {e}")
            
    # Rule/keyword-based final fallback
    keyword_cat = infer_category_from_keywords(text)
    if keyword_cat and keyword_cat in CATEGORY_KEYS:
        idx = CATEGORY_KEYS.index(keyword_cat)
        raw_label = CATEGORY_LABELS[idx]
        category = keyword_cat
        confidence = 0.5
        
    return {
        "rawLabel": raw_label,
        "category": category,
        "confidence": confidence
    }

HIGH_PRIORITY_KEYWORDS = [
    "fire", "smoke", "explosion", "gas leak",
    "electrocution", "electric shock",
    "live wire", "hanging wire", "sparking",
    "transformer blast", "transformer fire",
    "building collapse", "bridge collapse",
    "sinkhole", "major accident",
    "fatal accident", "open manhole",
    "manhole cover missing", "sewage overflow",
    "flood", "flooding", "water contamination",
    "disease outbreak", "epidemic",
    "complete blackout", "no electricity",
    "no water"
]

MEDIUM_PRIORITY_KEYWORDS = [
    "water leakage", "leak", "leaking", "blocked drain",
    "garbage pile", "streetlight",
    "power outage", "pothole",
    "drain overflow", "damaged road",
    "overflowing sewage"
]

LOW_PRIORITY_KEYWORDS = [
    "minor crack", "cleanliness issue",
    "small pothole", "cosmetic damage"
]

def contains_high_risk_issue(text):
    if not text:
        return False
    text_lower = text.lower()
    for kw in HIGH_PRIORITY_KEYWORDS:
        if " " in kw:
            if kw in text_lower:
                return True
        else:
            if re.search(rf"\b{re.escape(kw)}", text_lower):
                return True
    return False

def contains_medium_risk_issue(text):
    if not text:
        return False
    text_lower = text.lower()
    for kw in MEDIUM_PRIORITY_KEYWORDS:
        if " " in kw:
            if kw in text_lower:
                return True
        else:
            if re.search(rf"\b{re.escape(kw)}", text_lower):
                return True
    return False

def affects_many_people(text):
    if not text:
        return False
    text_lower = text.lower()
    phrases = [
        "entire area",
        "whole colony",
        "many people",
        "entire street",
        "complete blackout",
        "whole locality",
        "for several days",
        "for many days"
    ]
    for phrase in phrases:
        if phrase in text_lower:
            return True
    return False

def classify_priority(text):
    # Sentiment Analysis (for analytics and fallback priority)
    sentiment = "neutral"
    sentiment_score = 0.0
    if HF_API_TOKEN:
        try:
            url = f"{HF_BASE_URL}/models/{PRIORITY_MODEL}"
            headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
            payload = {"inputs": text}
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            if response.status_code == 200:
                res_data = response.json()
                if isinstance(res_data, list) and len(res_data) > 0:
                    items = res_data[0] if isinstance(res_data[0], list) else res_data
                    best_item = max(items, key=lambda x: x.get("score", 0.0))
                    sentiment = normalize_sentiment(best_item.get("label", "neutral"))
                    sentiment_score = float(best_item.get("score", 0.0))
        except Exception as e:
            logger.error(f"HF priority sentiment API call failed: {e}")

    priority = None
    
    # Step 1: HIGH_PRIORITY_KEYWORDS
    if contains_high_risk_issue(text):
        priority = "high"
    # Step 2: affects_many_people
    elif affects_many_people(text):
        priority = "high"
    # Step 3: MEDIUM_PRIORITY_KEYWORDS
    elif contains_medium_risk_issue(text):
        priority = "medium"
    # Step 4: Call Groq LLM for final classification
    else:
        if groq_client:
            prompt = (
                "You are an expert civic grievance classifier.\n"
                "Classify the grievance priority.\n\n"
                "Grievance text:\n"
                f"\"\"\"\n{text}\n\"\"\"\n\n"
                "Rules:\n"
                "* HIGH: danger to life, public safety risk, severe service disruption affecting many citizens.\n"
                "* MEDIUM: significant inconvenience or service disruption affecting some citizens.\n"
                "* LOW: minor inconvenience, cosmetic issue, isolated non-urgent complaint.\n\n"
                "Return JSON only:\n"
                "{\n"
                "  \"priority\": \"high|medium|low\",\n"
                "  \"reason\": \"short explanation\"\n"
                "}\n"
            )
            try:
                res = groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    max_tokens=150
                )
                raw = res.choices[0].message.content.strip()
                parsed = None
                try:
                    parsed = json_lib.loads(raw)
                except Exception:
                    import re as _re
                    m = _re.search(r'\{[\s\S]*\}', raw)
                    if m:
                        try:
                            parsed = json_lib.loads(m.group(0))
                        except Exception:
                            pass
                if parsed and isinstance(parsed, dict) and "priority" in parsed:
                    p = parsed.get("priority").lower().strip()
                    if p in ["high", "medium", "low"]:
                        priority = p
            except Exception as e:
                logger.error(f"Groq priority classification failed: {e}")
        
        # Fallback to sentiment estimation on Groq parser/API failure
        if not priority:
            if sentiment == "negative" and sentiment_score > 0.35:
                priority = "medium"
            else:
                priority = "low"

    return {
        "priority": priority,
        "sentiment": sentiment,
        "sentimentScore": sentiment_score
    }

def refine_with_groq(text, hf_category, hf_priority, hf_raw_label):
    if not groq_client:
        logger.warning("Groq client not initialized; skipping refinement.")
        return None
        
    prompt = (
        f"You are an AI assistant verifying and refining grievance classifications.\n"
        f"Grievance Text:\n\"\"\"\n{text}\n\"\"\"\n\n"
        f"Hugging Face models predicted:\n"
        f"Category: {hf_category} (raw label: {hf_raw_label})\n"
        f"Priority: {hf_priority}\n\n"
        f"Allowed categories: {CATEGORY_KEYS}\n"
        f"Allowed priorities: [\"low\", \"medium\", \"high\"]\n\n"
        f"Please verify if the classification is correct. If needed, refine it based on the grievance text.\n"
        f"Respond ONLY with a valid JSON object containing exactly these keys:\n"
        f"  - category: one of {CATEGORY_KEYS}\n"
        f"  - priority: one of [\"low\", \"medium\", \"high\"]\n"
        f"  - explanation: a concise explanation of the decision (max 2 sentences).\n\n"
        f"Do NOT include markdown formatting or backticks around the JSON. Return raw JSON text."
    )
    
    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=300
        )
        raw = res.choices[0].message.content.strip()
        
        parsed = None
        try:
            parsed = json_lib.loads(raw)
        except Exception:
            import re as _re
            m = _re.search(r'\{[\s\S]*\}', raw)
            if m:
                try:
                    parsed = json_lib.loads(m.group(0))
                except Exception:
                    pass
                    
        if parsed and isinstance(parsed, dict) and "category" in parsed and "priority" in parsed:
            cat = parsed.get("category")
            if cat not in CATEGORY_KEYS:
                parsed["category"] = hf_category
            pri = parsed.get("priority")
            if pri not in ["low", "medium", "high"]:
                parsed["priority"] = hf_priority
            if "explanation" not in parsed:
                parsed["explanation"] = "Refined by Groq LLM."
            return parsed
            
    except Exception as e:
        logger.error(f"Groq refinement failed: {e}")
        
    return None

# -------------------------
# simple image quality scoring (kept optional — we will NOT use it for final decision)
# -------------------------
def compute_image_quality_score(pil_img):
    img = pil_img.convert("RGB")
    width, height = img.size
    ref_area = 1024 * 768
    area = max(1, width * height)
    res_score = min(1.0, area / ref_area)
    gray = img.convert("L")
    stat = ImageStat.Stat(gray)
    mean_brightness = stat.mean[0] if stat.mean else 0
    bright_score = (mean_brightness - 30) / (200 - 30)
    bright_score = max(0.0, min(1.0, bright_score))
    arr = np.asarray(gray).astype(np.int32)
    if arr.shape[0] < 3 or arr.shape[1] < 3:
        sharpness_score = 0.0
    else:
        dyy = arr[2:, 1:-1] - 2 * arr[1:-1, 1:-1] + arr[:-2, 1:-1]
        dxx = arr[1:-1, 2:] - 2 * arr[1:-1, 1:-1] + arr[1:-1, :-2]
        lap = dyy + dxx
        var = float(np.var(lap))
        sharpness_score = (var - 20.0) / (2000.0 - 20.0)
        sharpness_score = max(0.0, min(1.0, sharpness_score))
    final_score = (sharpness_score * 0.5 + res_score * 0.3 + bright_score * 0.2) * 100.0
    return {
        "score": round(final_score, 2),
        "components": {
            "sharpness_score": round(sharpness_score * 100, 2),
            "resolution_score": round(res_score * 100, 2),
            "brightness_score": round(bright_score * 100, 2),
            "width": width,
            "height": height,
        }
    }

# -------------------------
# LLM image validation — returns a dict: { score: float(0-100), explanation: str, raw: str }
# Uses OpenRouter Vision LLM (openai/gpt-4o-mini) with server-side base64 normalization.
# -------------------------
def llm_image_confidence(image_url):
    """
    Validate an image using OpenRouter multimodal vision model.
    Downloads image server-side and converts to base64 Data URI to prevent CDN/header issues.
    Returns: {"score": float(0-100), "explanation": str, "raw": str}.
    """
    if not image_url:
        return {"score": 0.0, "explanation": "No image URL provided", "raw": ""}

    # Step 1: Download & normalize image to JPEG base64 Data URI server-side if HTTP URL
    data_uri = image_url
    if not image_url.startswith("data:image/"):
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            r = requests.get(image_url, headers=headers, timeout=12)
            r.raise_for_status()
            pil_img = Image.open(BytesIO(r.content)).convert("RGB")
            buffer = BytesIO()
            pil_img.save(buffer, format="JPEG", quality=85)
            base64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            data_uri = f"data:image/jpeg;base64,{base64_str}"
        except Exception as e:
            logger.warning(f"Failed to download and process image URL {image_url}: {e}")
            return {
                "score": 0.0,
                "explanation": f"Unable to download or process image file: {str(e)}",
                "raw": "image_download_error"
            }

    # Step 2: Query OpenRouter Vision AI (openai/gpt-4o-mini)
    openrouter_key = os.getenv("OPEN_ROUTER_API_KEY")
    if openrouter_key:
        prompt = (
            "You are an image validation AI for a public civic grievance portal.\n"
            "Analyze the image and determine if it shows a public infrastructure complaint "
            "(e.g., potholes, broken roads, garbage dumps, water leakage, damaged electrical poles/wires, street flooding, fallen trees, broken streetlights).\n"
            "REJECT non-grievance images (selfies, human faces, memes, indoor food, screenshots of text/chat, personal documents, animals, clean indoor rooms).\n"
            "Return ONLY a valid JSON object:\n"
            "{\n"
            "  \"score\": integer 0-100 (70-100 for valid public grievance, 0-30 for invalid/selfie/meme/document),\n"
            "  \"explanation\": \"1-2 sentence concise reason\"\n"
            "}"
        )

        for model in ["openai/gpt-4o-mini", "google/gemini-2.5-flash"]:
            try:
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model,
                    "max_tokens": 250,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": data_uri}}
                            ]
                        }
                    ]
                }
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()

                    # Extract JSON object
                    start_idx = content.find('{')
                    end_idx = content.rfind('}')
                    if start_idx != -1 and end_idx != -1:
                        parsed = json_lib.loads(content[start_idx:end_idx + 1])
                        score = float(parsed.get("score", 0.0))
                        explanation = str(parsed.get("explanation", ""))
                        return {
                            "score": round(max(0.0, min(100.0, score)), 2),
                            "explanation": explanation,
                            "raw": content
                        }
            except Exception as ex:
                logger.warning(f"Vision model {model} check failed: {ex}")
                continue

    # Step 3: Reject if Vision AI is unavailable
    return {
        "score": 0.0,
        "explanation": "Image validation service was unable to verify public infrastructure content.",
        "raw": "validation_unavailable"
    }


# -------------------------
# validate-image route (improved error detail, uses fallback when Groq missing)
# -------------------------
@app.route("/validate-image", methods=["POST"])
def validate_image():
    try:
        payload = request.get_json() or {}
        image_url = payload.get("imageUrl") or payload.get("image_url") or payload.get("url")
        public_id = payload.get("public_id")
        public_url = payload.get("public_url")

        if not image_url:
            return jsonify({"error": "imageUrl required"}), 400

        if not groq_client:
            # If you intentionally want fallback-only mode, comment this out and allow heuristics
            # return jsonify({"error": "LLM validation unavailable: set GROQ_API_KEY and install groq SDK."}), 500
            logger.warning("Groq not configured; using heuristic fallback only.")
        try:
            llm_res = llm_image_confidence(image_url)
            print("LLM RESULT:", llm_res)
        except Exception as e:
            logger.exception("LLM image check failed for url: %s", image_url)
            return jsonify({
                "error": "LLM image validation failed",
                "detail": str(e),
                "hint": "Check GROQ_API_KEY/LLAVA_MODEL and Groq SDK compatibility. See server logs for raw LLM reply."
            }), 500

        llm_score = float(llm_res.get("score", 0.0))
        explanation = llm_res.get("explanation", "")
        raw = llm_res.get("raw", "")
        ok = llm_score >= IMAGE_LLM_THRESHOLD

        result = {"ok": ok, "llm_score": llm_score, "explanation": explanation, "raw": raw, "threshold": float(IMAGE_LLM_THRESHOLD)}

        # If rejected AND Cloudinary configured AND client provided public_id (or url), attempt deletion
        if not ok and cloudinary and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET and (public_id or public_url):
            try:
                # extract public_id from public_url if needed
                pid = public_id
                if not pid and public_url:
                    m = re.search(r'/upload/(?:v\d+/)?(.+)$', public_url)
                    if m:
                        pid = re.sub(r'\.[a-zA-Z0-9]{2,5}$', '', m.group(1))
                if pid:
                    from cloudinary import uploader
                    del_res = uploader.destroy(pid, resource_type="image")
                    logger.info("Cloudinary delete requested for %s => %s", pid, del_res)
                    result["deleted"] = del_res
                else:
                    logger.warning("No public_id extracted; skipping server-side delete")
            except Exception as e:
                logger.exception("cloudinary delete attempt failed")
                result["delete_error"] = str(e)

        return jsonify(result), 200

    except Exception:
        logger.exception("validate-image internal error")
        return jsonify({"error": "internal error"}), 500


# API: /delete-cloudinary
@app.route("/delete-cloudinary", methods=["POST"])
def delete_cloudinary():
    
    """
    POST { "public_id": "folder/file", "resource_type": "image" }
    Accepts either:
      - public_id: "folder/file"
      - or public_url: "https://res.cloudinary.com/<cloud>/image/upload/v123/.../file.png"
    Returns JSON { deleted: {...} } or clear error message.
    """
    payload = request.get_json() or {}
    public_id = payload.get("public_id")
    public_url = payload.get("public_url")
    resource_type = payload.get("resource_type", "image")


    # allow full url and extract public_id
    if not public_id and public_url:
        try:
            # Attempt to extract portion after /upload/
            m = re.search(r'/upload/(?:v\d+/)?(.+)$', public_url)
            if m:
                candidate = m.group(1)
                candidate = re.sub(r'\.[a-zA-Z0-9]{2,5}$', '', candidate)
                public_id = candidate
        except Exception:
            public_id = None

    if not public_id:
        return jsonify({"error": "public_id or public_url required"}), 400

    # verify Cloudinary is configured
    if not cloudinary:
        return jsonify({"error": "Cloudinary SDK not installed on server"}), 500

    if not (CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET and CLOUDINARY_CLOUD_NAME):
        return jsonify({"error": "Cloudinary not configured on server. Set CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME."}), 500

    try:
        from cloudinary import uploader
        logger.info("Attempting to delete Cloudinary asset: %s (resource_type=%s)", public_id, resource_type)
        res = uploader.destroy(public_id, resource_type=resource_type)
        logger.info("Cloudinary delete response: %s", res)
        return jsonify({"deleted": res}), 200
    except Exception as e:
        logger.exception("cloudinary delete failed for %s", public_id)
        return jsonify({"error": "cloudinary delete failed", "detail": str(e)}), 500

# -------------------------
# API: /submit-grievance (uses LLM-only image check if image provided)
# -------------------------
@app.route("/submit-grievance", methods=["POST"])
def submit_grievance():
    if db is None:
        return jsonify({"error": "Firebase not initialized"}), 500

    payload = request.get_json() or {}
    title = payload.get("title")
    description = payload.get("description")
    user_id = payload.get("userId")
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    image_url = payload.get("imageUrl")

    if not title or not description or not user_id:
        return jsonify({"error": "Missing required fields (title, description, userId)"}), 400

    image_validation_result = None
    if image_url:
        try:
            llm_res = llm_image_confidence(image_url)
            llm_score = float(llm_res.get("score", 0.0))
            explanation = llm_res.get("explanation", "")
            image_validation_result = {"llm_score": llm_score, "explanation": explanation, "raw": llm_res.get("raw", "")}
            if llm_score < IMAGE_LLM_THRESHOLD:
                return jsonify({
                    "error": "Image rejected by LLM validation (score below threshold)",
                    "imageValidation": image_validation_result,
                    "threshold": float(IMAGE_LLM_THRESHOLD)
                }), 400
        except Exception as e:
            logger.exception("LLM image validation failed during submit")
            return jsonify({"error": "LLM image validation failed", "detail": str(e)}), 500

    new_doc = {"title": title, "description": description, "userId": user_id, "status": "open", "createdAt": firestore.SERVER_TIMESTAMP}
    if image_url:
        new_doc["imageUrl"] = image_url
        if image_validation_result:
            new_doc["imageValidation"] = image_validation_result

    try:
        if latitude is not None and longitude is not None:
            new_doc["latitude"] = float(latitude)
            new_doc["longitude"] = float(longitude)
    except Exception:
        pass

    try:
        write_time, doc_ref = db.collection("grievances").add(new_doc)
        doc_id = doc_ref.id
    except Exception:
        logger.exception("Failed to create grievance document")
        return jsonify({"error": "Failed to save grievance"}), 500

    full_text = f"{title}\n{description}"
    if ml_fallback_model is not None:
        try:
            res_fb = predict_with_fallback(ml_fallback_model, full_text)
            category = res_fb["category"]
            priority = res_fb["priority"]
            confidence = res_fb["confidence"]
            source = res_fb["source"]
            reason = res_fb["reason"]

            hf_engine = {
                "category": category,
                "priority": priority,
                "isUrgent": priority.lower() == "high",
                "confidence": confidence,
                "source": source,
                "explanation": reason,
                "modelInfo": {
                    "mlModel": "GrievanceModel (TF-IDF + LogisticRegression)",
                    "fallbackModel": "Groq LLM",
                    "usedSource": source
                }
            }
        except Exception as e:
            logger.exception("ML Fallback prediction failed, reverting to default logic")
            cat_res = {"category": "Other", "confidence": 0.0}
            pri_res = {"priority": "Low"}
            category = "Other"
            priority = "Low"
            hf_engine = {"category": category, "priority": priority, "explanation": str(e)}
    else:
        try:
            cat_res = classify_category(full_text)
        except Exception:
            cat_res = {"rawLabel": "", "category": "other", "confidence": 0.0}
        try:
            pri_res = classify_priority(full_text)
        except Exception:
            pri_res = {"sentiment": "neutral", "sentimentScore": 0.0, "priority": "low"}

        hf_priority = pri_res.get("priority", "low")
        sentiment_raw = pri_res.get("sentiment", "neutral")
        score = pri_res.get("sentimentScore", 0.0)
        urgent_matches = find_urgent_matches(full_text)

        hf_category = cat_res.get("category", "other")
        keyword_category = infer_category_from_keywords(full_text)
        if keyword_category:
            hf_category = keyword_category

        if hf_category == "sanitation" and hf_priority == "low":
            hf_priority = "medium"

        hf_raw_label = cat_res.get("rawLabel", "")
        keywords = extract_keywords(full_text)

        try:
            groq_res = refine_with_groq(full_text, hf_category, hf_priority, hf_raw_label)
        except Exception:
            groq_res = None

        if groq_res:
            priority = groq_res.get("priority", hf_priority)
            category = groq_res.get("category", hf_category)
            ai_explanation = groq_res.get("explanation", "Refined by Groq LLM.")
        else:
            priority = hf_priority
            category = hf_category
            ai_explanation = f"Category '{category}' predicted."

        hf_engine = {
            "category": category,
            "priority": priority,
            "isUrgent": priority == "high",
            "keywords": keywords,
            "explanation": ai_explanation,
        }

    try:
        db.collection("grievances").document(doc_id).set({"hfEngine": hf_engine, "category": category, "priority": priority}, merge=True)
    except Exception:
        logger.exception("Failed to write hfEngine to document")

    return jsonify({"message": "Grievance submitted successfully", "grievanceId": doc_id, "hfEngine": hf_engine}), 200

# -------------------------
# Cloudinary signing endpoint (optional)
# -------------------------
@app.route("/sign-cloudinary", methods=["POST"])
def sign_cloudinary():
    """
    POST { "public_id": "folder/file.jpg", "resource_type": "image", "transform": "f_auto,q_auto,w_900" }
    If CLOUDINARY_API_SECRET present and cloudinary package installed, returns a signed URL:
      { "signedUrl": "https://res.cloudinary.com/..." }
    Otherwise returns the original unsigned preview URL (still useful for public images).
    """
    payload = request.get_json() or {}
    public_id = payload.get("public_id")
    transform = payload.get("transform", "f_auto,q_auto,w_900")
    resource_type = payload.get("resource_type", "image")

    if not public_id:
        return jsonify({"error": "public_id required"}), 400

    if cloudinary and CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY:
        try:
            signed_url, options = cloudinary_url(public_id, resource_type=resource_type, sign_url=bool(CLOUDINARY_API_SECRET), secure=True, transformation=transform)
            return jsonify({"signedUrl": signed_url, "signed": bool(CLOUDINARY_API_SECRET)}), 200
        except Exception:
            logger.exception("cloudinary signing failed")
            return jsonify({"error": "cloudinary signing failed"}), 500

    if CLOUDINARY_CLOUD_NAME:
        try:
            unsigned = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/{resource_type}/upload/{transform}/{public_id}"
            return jsonify({"signedUrl": unsigned, "signed": False}), 200
        except Exception:
            pass

    return jsonify({"error": "Cloudinary not configured on server"}), 500

# -------------------------
# Health / Test
# -------------------------
@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/test")
def test():
    return "Flask running."

# -------------------------
# Run
# -------------------------
if __name__ == "__main__":
    PORT = int(os.getenv("PORT", "10000"))
    app.run(host="0.0.0.0", port=PORT, debug=False)
