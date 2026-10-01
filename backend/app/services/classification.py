"""Civic grievance classification: category, priority and urgency.

Ported from the legacy Flask `backend/server.py` (~lines 264-668) so behaviour
is unchanged. Cascade: HuggingFace zero-shot → Groq LLM → keyword fallback.
"""

from __future__ import annotations

import json
import logging
import re

import requests

from ..config import GROQ_MODEL, HF_API_TOKEN, HF_BASE_URL, get_groq_client

logger = logging.getLogger("grievance-api")

CATEGORY_LABELS = [
    "Issues related to water supply, water pressure, contamination, or no water",
    "Issues related to roads, potholes, footpaths, traffic, or road damage",
    "Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working",
    "Issues related to sanitation, garbage, sewage, drainage, or public cleanliness",
    "Issues related to health services, hospitals, clinics, medicines, or public health",
    "Issues related to governance, staff behavior, corruption, permissions, or government service delays",
    "Other issues not matching the above categories",
]
CATEGORY_KEYS = [
    "water",
    "roads",
    "electricity",
    "sanitation",
    "health",
    "governance",
    "other",
]
PRIORITY_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
CATEGORY_MODEL = "MoritzLaurer/deberta-v3-large-zeroshot-v2.0"

URGENT_KEYWORDS = [
    "urgent", "emergency", "immediately", "immediate action", "critical",
    "serious", "danger", "dangerous", "life threatening", "high risk",
    "unsafe", "asap",
    "fire", "smoke", "explosion", "blast", "gas leak", "building collapse",
    "collapsed", "collapse", "wall collapse", "flood", "flooding", "landslide",
    "electrocution", "electric shock", "live wire", "hanging wire", "sparking",
    "short circuit", "electrical hazard", "high voltage", "transformer blast",
    "transformer fire", "exposed cable",
    "sewage", "overflowing sewage", "sewage overflow", "blocked drain",
    "choked drain", "drain overflow", "water contamination",
    "contaminated water", "dirty water", "waterborne disease", "health hazard",
    "sanitation hazard", "stagnant water", "open manhole",
    "manhole cover missing",
    "major accident", "fatal accident", "sinkhole", "road cave in",
    "bridge collapse", "huge pothole", "deep pothole",
    "disease outbreak", "epidemic", "infection spread", "medical emergency",
    "no water", "no electricity", "power outage", "complete blackout",
]

SANITATION_KEYWORDS = [
    "garbage", "waste", "trash", "dustbin", "sewage", "sewer",
    "drainage", "drain", "litter", "dirty", "filth",
    "smell", "stink", "stray animals", "dump",
    "waste collection", "garbage collection",
]

ALL_KEYWORD_LISTS = {
    "water": [
        "water", "leak", "contamination", "pipeline", "pressure", "supply",
        "pipe", "borewell",
    ],
    "roads": [
        "road", "pothole", "footpath", "traffic", "tar", "asphalt",
        "cracks", "pavement",
    ],
    "electricity": [
        "electricity", "power", "cut", "voltage", "streetlight", "wire",
        "cable", "blackout", "transformer", "sparking",
    ],
    "sanitation": SANITATION_KEYWORDS,
    "health": [
        "hospital", "clinic", "medicine", "health", "doctor", "disease",
        "outbreak", "epidemic", "infection",
    ],
    "governance": [
        "governance", "corruption", "bribe", "behavior", "delay", "staff",
        "permission", "office", "officer",
    ],
    "urgent": URGENT_KEYWORDS,
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
    "no water",
]

MEDIUM_PRIORITY_KEYWORDS = [
    "water leakage", "leak", "leaking", "blocked drain",
    "garbage pile", "streetlight",
    "power outage", "pothole",
    "drain overflow", "damaged road",
    "overflowing sewage",
]

LOW_PRIORITY_KEYWORDS = [
    "minor crack", "cleanliness issue",
    "small pothole", "cosmetic damage",
]


def _matches(text_lower: str, keyword: str) -> bool:
    """Phrase containment for multi-word keywords, word-boundary for singles."""
    if " " in keyword:
        return keyword in text_lower
    return re.search(rf"\b{re.escape(keyword)}", text_lower) is not None


def _extract_json(raw: str):
    """Parse a JSON object out of an LLM reply, tolerating extra prose."""
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = None
    if isinstance(parsed, dict):
        return parsed
    match = re.search(r"\{[\s\S]*\}", raw or "")
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None
    return None


def normalize_sentiment(sentiment) -> str:
    if not sentiment:
        return "neutral"
    s = str(sentiment).lower().strip()
    if "neg" in s:
        return "negative"
    if "pos" in s:
        return "positive"
    return "neutral"


def find_urgent_matches(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    return [kw for kw in URGENT_KEYWORDS if _matches(text_lower, kw)]


def extract_keywords(text: str) -> list[str]:
    if not text:
        return []
    text_lower = text.lower()
    found: set[str] = set()
    for _cat, kws in ALL_KEYWORD_LISTS.items():
        for kw in kws:
            if _matches(text_lower, kw):
                found.add(kw)
    return list(found)


def infer_category_from_keywords(text: str) -> str | None:
    if not text:
        return None
    text_lower = text.lower()
    counts = {cat: 0 for cat in CATEGORY_KEYS if cat != "other"}

    for cat, kws in ALL_KEYWORD_LISTS.items():
        if cat not in counts:
            continue
        for kw in kws:
            if _matches(text_lower, kw):
                counts[cat] += 1

    max_cat = None
    max_count = 0
    for cat, count in counts.items():
        if count > max_count:
            max_count = count
            max_cat = cat

    return max_cat if max_count > 0 else None


def _classify_with_hf(text: str) -> dict | None:
    if not HF_API_TOKEN:
        return None
    for model in [CATEGORY_MODEL, "facebook/bart-large-mnli"]:
        try:
            url = f"{HF_BASE_URL}/models/{model}"
            headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
            payload = {"inputs": text, "parameters": {"candidate_labels": CATEGORY_LABELS}}
            response = requests.post(url, headers=headers, json=payload, timeout=5)
            if response.status_code != 200:
                continue
            res_data = response.json()
            if not isinstance(res_data, dict):
                continue
            labels = res_data.get("labels")
            scores = res_data.get("scores")
            if labels and scores:
                best_label = labels[0]
                best_score = float(scores[0])
                if best_score > 0.4 and best_label in CATEGORY_LABELS:
                    idx = CATEGORY_LABELS.index(best_label)
                    return {
                        "rawLabel": best_label,
                        "category": CATEGORY_KEYS[idx],
                        "confidence": best_score,
                    }
        except Exception as exc:
            logger.error("HF category API call failed for model %s: %s", model, exc)
    return None


def _classify_with_groq_category(text: str) -> dict | None:
    groq_client = get_groq_client()
    if not groq_client:
        return None
    prompt = (
        "You are an expert civic grievance classifier.\n"
        "Classify the grievance into exactly one of the allowed categories.\n\n"
        "Grievance text:\n"
        f'"""\n{text}\n"""\n\n'
        "Allowed Category Keys and Descriptions:\n"
        "- water: Issues related to water supply, water pressure, contamination, or no water\n"
        "- roads: Issues related to roads, potholes, footpaths, traffic, or road damage\n"
        "- electricity: Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working\n"
        "- sanitation: Issues related to sanitation, garbage, sewage, drainage, or public cleanliness\n"
        "- health: Issues related to health services, hospitals, clinics, medicines, or public health\n"
        "- governance: Issues related to governance, staff behavior, corruption, permissions, or government service delays\n"
        "- other: Other issues not matching the above categories\n\n"
        "Return JSON only:\n"
        '{\n  "category": "water|roads|electricity|sanitation|health|governance|other",\n'
        '  "reason": "short explanation"\n}\n'
    )
    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=150,
        )
        raw = res.choices[0].message.content.strip()
        parsed = _extract_json(raw)
        if parsed and "category" in parsed:
            cat_key = str(parsed.get("category")).lower().strip()
            if cat_key in CATEGORY_KEYS:
                idx = CATEGORY_KEYS.index(cat_key)
                return {
                    "rawLabel": CATEGORY_LABELS[idx],
                    "category": cat_key,
                    "confidence": 0.95,
                }
    except Exception as exc:
        logger.error("Groq category classification fallback failed: %s", exc)
    return None


def classify_category(text: str) -> dict:
    if not text:
        return {
            "rawLabel": "Other issues not matching the above categories",
            "category": "other",
            "confidence": 0.0,
        }

    result = _classify_with_hf(text)
    if result:
        return result

    result = _classify_with_groq_category(text)
    if result:
        return result

    # Rule/keyword-based final fallback
    raw_label = "Other issues not matching the above categories"
    category = "other"
    confidence = 0.0
    keyword_cat = infer_category_from_keywords(text)
    if keyword_cat and keyword_cat in CATEGORY_KEYS:
        idx = CATEGORY_KEYS.index(keyword_cat)
        raw_label = CATEGORY_LABELS[idx]
        category = keyword_cat
        confidence = 0.5

    return {"rawLabel": raw_label, "category": category, "confidence": confidence}


def contains_high_risk_issue(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    return any(_matches(text_lower, kw) for kw in HIGH_PRIORITY_KEYWORDS)


def contains_medium_risk_issue(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    return any(_matches(text_lower, kw) for kw in MEDIUM_PRIORITY_KEYWORDS)


def affects_many_people(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    phrases = [
        "entire area", "whole colony", "many people", "entire street",
        "complete blackout", "whole locality", "for several days",
        "for many days",
    ]
    return any(phrase in text_lower for phrase in phrases)


def _analyse_sentiment(text: str) -> tuple[str, float]:
    if not HF_API_TOKEN:
        return "neutral", 0.0
    try:
        url = f"{HF_BASE_URL}/models/{PRIORITY_MODEL}"
        headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
        response = requests.post(
            url, headers=headers, json={"inputs": text}, timeout=10
        )
        if response.status_code == 200:
            res_data = response.json()
            if isinstance(res_data, list) and len(res_data) > 0:
                items = res_data[0] if isinstance(res_data[0], list) else res_data
                best_item = max(items, key=lambda x: x.get("score", 0.0))
                return (
                    normalize_sentiment(best_item.get("label", "neutral")),
                    float(best_item.get("score", 0.0)),
                )
    except Exception as exc:
        logger.error("HF priority sentiment API call failed: %s", exc)
    return "neutral", 0.0


def _classify_priority_with_groq(text: str) -> str | None:
    groq_client = get_groq_client()
    if not groq_client:
        return None
    prompt = (
        "You are an expert civic grievance classifier.\n"
        "Classify the grievance priority.\n\n"
        "Grievance text:\n"
        f'"""\n{text}\n"""\n\n'
        "Rules:\n"
        "* HIGH: danger to life, public safety risk, severe service disruption affecting many citizens.\n"
        "* MEDIUM: significant inconvenience or service disruption affecting some citizens.\n"
        "* LOW: minor inconvenience, cosmetic issue, isolated non-urgent complaint.\n\n"
        "Return JSON only:\n"
        '{\n  "priority": "high|medium|low",\n  "reason": "short explanation"\n}\n'
    )
    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=150,
        )
        raw = res.choices[0].message.content.strip()
        parsed = _extract_json(raw)
        if parsed and "priority" in parsed:
            p = str(parsed.get("priority")).lower().strip()
            if p in ("high", "medium", "low"):
                return p
    except Exception as exc:
        logger.error("Groq priority classification failed: %s", exc)
    return None


def classify_priority(text: str) -> dict:
    sentiment, sentiment_score = _analyse_sentiment(text)

    priority: str | None = None
    if contains_high_risk_issue(text):
        priority = "high"
    elif affects_many_people(text):
        priority = "high"
    elif contains_medium_risk_issue(text):
        priority = "medium"
    else:
        priority = _classify_priority_with_groq(text)
        if not priority:
            priority = "medium" if (sentiment == "negative" and sentiment_score > 0.35) else "low"

    return {
        "priority": priority,
        "sentiment": sentiment,
        "sentimentScore": sentiment_score,
    }


def refine_with_groq(
    text: str, hf_category: str, hf_priority: str, hf_raw_label: str
) -> dict | None:
    groq_client = get_groq_client()
    if not groq_client:
        logger.warning("Groq client not initialized; skipping refinement.")
        return None

    prompt = (
        "You are an AI assistant verifying and refining grievance classifications.\n"
        f'Grievance Text:\n"""\n{text}\n"""\n\n'
        "Hugging Face models predicted:\n"
        f"Category: {hf_category} (raw label: {hf_raw_label})\n"
        f"Priority: {hf_priority}\n\n"
        f"Allowed categories: {CATEGORY_KEYS}\n"
        'Allowed priorities: ["low", "medium", "high"]\n\n'
        "Please verify if the classification is correct. If needed, refine it based on the grievance text.\n"
        "Respond ONLY with a valid JSON object containing exactly these keys:\n"
        f"  - category: one of {CATEGORY_KEYS}\n"
        '  - priority: one of ["low", "medium", "high"]\n'
        "  - explanation: a concise explanation of the decision (max 2 sentences).\n\n"
        "Do NOT include markdown formatting or backticks around the JSON. Return raw JSON text."
    )

    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=300,
        )
        raw = res.choices[0].message.content.strip()
        parsed = _extract_json(raw)
        if parsed and "category" in parsed and "priority" in parsed:
            if parsed.get("category") not in CATEGORY_KEYS:
                parsed["category"] = hf_category
            if parsed.get("priority") not in ("low", "medium", "high"):
                parsed["priority"] = hf_priority
            if "explanation" not in parsed:
                parsed["explanation"] = "Refined by Groq LLM."
            return parsed
    except Exception as exc:
        logger.error("Groq refinement failed: %s", exc)

    return None
