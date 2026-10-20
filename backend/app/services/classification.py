"""Civic grievance classification: category, priority and urgency.

Ported from the legacy Flask `backend/server.py` and extended for the FastAPI
serving path: explicit out-of-scope gate → local GrievanceModel → local civic
signal/keyword checks → Hugging Face zero-shot → Groq. Providers run only for
in-scope complaints that remain uncertain after local classification.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
import time
from contextlib import contextmanager

import requests

from ..config import GROQ_MODEL, HF_API_TOKEN, HF_BASE_URL, get_groq_client

logger = logging.getLogger("grievance-api")

# Hard latency bound for every Groq call in the submit path. These calls run
# inline while the citizen waits, and the SDK's default retries could multiply
# a stalled provider into minutes. `classification_budget` caps their combined
# time for one classification pass (category → priority → refinement).
GROQ_CALL_TIMEOUT_SECONDS = 8.0
GROQ_TOTAL_BUDGET_SECONDS = 20.0
_groq_deadline: contextvars.ContextVar[float] = contextvars.ContextVar(
    "groq_deadline", default=0.0
)


@contextmanager
def classification_budget(seconds: float = GROQ_TOTAL_BUDGET_SECONDS):
    """Bound the combined wall time of Groq calls made inside the block."""
    token = _groq_deadline.set(time.monotonic() + seconds)
    try:
        yield
    finally:
        _groq_deadline.reset(token)


def _groq_complete(prompt: str, max_tokens: int) -> str | None:
    """One bounded Groq completion: no SDK retries, per-call timeout.

    Returns None (instead of raising) when the client is unconfigured, the
    shared budget is exhausted, or the provider fails — every caller treats
    None as "fall through to the next cascade step".
    """
    client = get_groq_client()
    if not client:
        return None
    deadline = _groq_deadline.get()
    remaining = (
        deadline - time.monotonic() if deadline else GROQ_CALL_TIMEOUT_SECONDS
    )
    if remaining <= 1.0:
        logger.warning("Groq budget exhausted; skipping classification call")
        return None
    bounded = client.with_options(max_retries=0)
    started = time.monotonic()
    try:
        res = bounded.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=max_tokens,
            timeout=min(GROQ_CALL_TIMEOUT_SECONDS, remaining),
        )
    except Exception:
        logger.warning(
            "Groq classification call failed model=%s latency_ms=%d",
            GROQ_MODEL, int((time.monotonic() - started) * 1000), exc_info=True,
        )
        raise
    usage = getattr(res, "usage", None)
    total_tokens = getattr(usage, "total_tokens", None) if usage else None
    logger.info(
        "Groq classification call completed model=%s latency_ms=%d total_tokens=%s",
        GROQ_MODEL, int((time.monotonic() - started) * 1000), total_tokens,
    )
    return res.choices[0].message.content


# ---------------------------------------------------------------------------
# Lazy ML model singleton (GrievanceModel + predict_with_fallback from main).
# Loaded on first call; stays None if sklearn/pandas or the training CSV are
# absent so the cascade degrades gracefully without crashing the server.
# ---------------------------------------------------------------------------
_ml_model = None  # set to the trained GrievanceModel or False (failed) at runtime


def _get_ml_model():
    """Return the trained GrievanceModel, or None if unavailable."""
    global _ml_model
    if _ml_model is False:
        return None          # already tried and failed — don't retry every call
    if _ml_model is not None:
        return _ml_model
    try:
        from .grievance_model import GrievanceModel
        model = GrievanceModel().train()
        if model.is_trained:
            _ml_model = model
            logger.info("GrievanceModel trained and ready.")
        else:
            logger.warning("GrievanceModel.train() completed but is_trained=False; ML step disabled.")
            _ml_model = False
    except Exception as exc:
        logger.warning("GrievanceModel unavailable (will skip ML step): %s", exc)
        _ml_model = False
    return _ml_model if _ml_model is not False else None


def _classify_with_ml(text: str) -> dict | None:
    """First cascade step: TF-IDF + LogisticRegression model.

    Low-probability model predictions and 'other' fall through to the next
    cascade step. Decisive domain overrides are accepted with confidence 0.0:
    the rule provides a category, not a calibrated probability.
    """
    model = _get_ml_model()
    if model is None:
        return None
    try:
        from .llm_fallback import canonicalize_category
        result = model.predict(text)
        raw_cat = result.get("category", "other")
        ml_cat = canonicalize_category(raw_cat)
        confidence = float(result.get("confidence", 0.0))
        source = result.get("source")

        # Reject weak probabilities, but preserve decisive rule-based matches.
        if (confidence < 0.5 and source != "domain_override") or ml_cat == "other":
            return None

        if ml_cat not in CATEGORY_KEYS:
            return None

        idx = CATEGORY_KEYS.index(ml_cat)
        return {
            "rawLabel": CATEGORY_LABELS[idx],
            "category": ml_cat,
            "confidence": confidence,
            "source": source or "ml_model",
        }
    except Exception as exc:
        logger.error("ML model classification failed: %s", exc)
        return None

CATEGORY_LABELS = [
    "Issues related to water supply, water pressure, contamination, or no water",
    "Issues related to roads, potholes, footpaths, traffic, or road damage",
    "Issues related to public transport, buses, metro, rail, stops, or schedules",
    "Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working",
    "Issues related to sanitation, garbage, sewage, drainage, or public cleanliness",
    "Issues related to health services, hospitals, clinics, medicines, or public health",
    "Issues related to governance, staff behavior, corruption, permissions, or government service delays",
    "Other issues not matching the above categories",
]
CATEGORY_KEYS = [
    "water",
    "roads",
    "transport",
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
        "water supply", "no water", "water nahi", "paani nahi", "water pressure",
        "drinking water", "water leak", "water leakage", "water contamination",
        "contaminated water", "pipeline", "pipe burst", "pipe leak", "pipe leakage",
        "borewell", "water tanker", "tap water",
    ],
    "roads": [
        "road", "pothole", "footpath", "traffic", "tar", "asphalt",
        "cracks", "pavement",
    ],
    "transport": [
        "bus", "bus stop", "bus stand", "metro", "train", "railway",
        "station", "timetable", "commute",
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

    max_count = max(counts.values(), default=0)
    if max_count == 0:
        return None
    winners = [cat for cat, count in counts.items() if count == max_count]
    # A tie is ambiguous evidence. Do not let category declaration order turn
    # an incidental Water mention into a Water prediction.
    return winners[0] if len(winners) == 1 else None


def _has_civic_category_signal(text: str) -> bool:
    """Conservative local scope check before paid category fallbacks.

    This is only a provider gate: it never assigns a category. A confident
    model prediction is accepted first; unsupported text is otherwise left
    uncertain instead of being sent to HF/Groq blindly.
    """
    text_lower = text.lower()
    if any(
        _matches(text_lower, keyword)
        for category, keywords in ALL_KEYWORD_LISTS.items()
        if category != "urgent"
        for keyword in keywords
    ):
        return True
    return any(
        _matches(text_lower, phrase)
        for phrase in (
            "municipal", "municipality", "municipal corporation", "civic service",
            "ward office", "public service", "government office", "government service",
            "civic issue", "public facility", "public infrastructure",
        )
    )


_CLEARLY_OUT_OF_SCOPE_PATTERNS = tuple(re.compile(pattern) for pattern in (
    r"\b(?:what is|calculate|solve|answer of)\b[^\n]{0,80}\d\s*[+*/=-]\s*\d",
    r"\b(?:tell me|share)\s+(?:a\s+)?joke\b",
    r"\bwrite\s+(?:a\s+)?(?:poem|essay|story|song)\b",
    r"\b(?:recipe for|capital of|who won the)\b",
))


def _is_clearly_out_of_scope(text: str) -> bool:
    return any(pattern.search(text.lower()) for pattern in _CLEARLY_OUT_OF_SCOPE_PATTERNS)


def _classify_with_hf(text: str) -> dict | None:
    if not HF_API_TOKEN:
        return None
    for model in [CATEGORY_MODEL, "facebook/bart-large-mnli"]:
        try:
            url = f"{HF_BASE_URL}/models/{model}"
            headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
            payload = {"inputs": text, "parameters": {"candidate_labels": CATEGORY_LABELS}}
            started = time.monotonic()
            response = requests.post(url, headers=headers, json=payload, timeout=5)
            elapsed_ms = int((time.monotonic() - started) * 1000)
            if response.status_code != 200:
                logger.warning(
                    "HF category fallback failed model=%s status=%s latency_ms=%d",
                    model, response.status_code, elapsed_ms,
                )
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
                    logger.info(
                        "HF category fallback succeeded model=%s latency_ms=%d",
                        model, elapsed_ms,
                    )
                    return {
                        "rawLabel": best_label,
                        "category": CATEGORY_KEYS[idx],
                        "confidence": best_score,
                        "source": "hf_zero_shot",
                    }
        except Exception as exc:
            logger.error("HF category API call failed for model %s: %s", model, exc)
    return None


def _classify_with_groq_category(text: str) -> dict | None:
    prompt = (
        "You are an expert civic grievance classifier.\n"
        "Classify the grievance into exactly one of the allowed categories.\n\n"
        "Grievance text:\n"
        f'"""\n{text}\n"""\n\n'
        "Allowed Category Keys and Descriptions:\n"
        "- water: Issues related to water supply, water pressure, contamination, or no water\n"
        "- roads: Issues related to roads, potholes, footpaths, traffic, or road damage\n"
        "- transport: Issues related to public transport, buses, metro, rail, stops, or schedules\n"
        "- electricity: Issues related to electricity, power cuts, voltage fluctuations, or streetlights not working\n"
        "- sanitation: Issues related to sanitation, garbage, sewage, drainage, or public cleanliness\n"
        "- health: Issues related to health services, hospitals, clinics, medicines, or public health\n"
        "- governance: Issues related to governance, staff behavior, corruption, permissions, or government service delays\n"
        "- other: Other issues not matching the above categories\n\n"
        "Return JSON only:\n"
        '{"category": "' + "|".join(CATEGORY_KEYS) + '",\n'
        '  "reason": "short explanation"\n}\n'
    )
    try:
        raw = _groq_complete(prompt, max_tokens=150)
        if raw is None:
            return None
        parsed = _extract_json(raw.strip())
        if parsed and "category" in parsed:
            cat_key = str(parsed.get("category")).lower().strip()
            if cat_key in CATEGORY_KEYS:
                idx = CATEGORY_KEYS.index(cat_key)
                return {
                    "rawLabel": CATEGORY_LABELS[idx],
                    "category": cat_key,
                    # A generative answer is not a calibrated probability.
                    "confidence": 0.0,
                    "source": "groq_fallback",
                }
            logger.warning("Groq category fallback returned unsupported category")
        else:
            logger.warning("Groq category fallback returned malformed or empty JSON")
    except Exception as exc:
        logger.error("Groq category classification fallback failed: %s", exc)
    return None


def classify_category(text: str) -> dict:
    if not isinstance(text, str) or not text.strip():
        return {
            "rawLabel": "Other issues not matching the above categories",
            "category": "other",
            "confidence": 0.0,
            "source": "invalid_input",
            "reason": "empty or invalid complaint text",
        }

    if _is_clearly_out_of_scope(text):
        logger.info("category classification source=scope_gate category=other")
        return {
            "rawLabel": "Other issues not matching the above categories",
            "category": "other",
            "confidence": 0.0,
            "source": "scope_gate",
            "reason": "Request is clearly unrelated to municipal services; category is uncertain.",
        }

    # Step 1: Existing local TF-IDF + LogisticRegression model.
    result = _classify_with_ml(text)
    if result:
        logger.info("category classification source=%s category=%s", result.get("source", "ml_model"), result.get("category"))
        return result

    # Do not spend provider calls classifying clearly unsupported or unusable
    # text. In-scope but uncertain complaints still use the bounded cascade.
    if not _has_civic_category_signal(text):
        logger.info("category classification source=scope_gate category=other")
        return {
            "rawLabel": "Other issues not matching the above categories",
            "category": "other",
            "confidence": 0.0,
            "source": "scope_gate",
            "reason": "No supported civic-service signal; category is uncertain.",
        }

    # A unique, specific local keyword match is a deterministic fallback and
    # does not need an external classifier. Ties abstain in the helper above.
    keyword_cat = infer_category_from_keywords(text)
    if keyword_cat and keyword_cat in CATEGORY_KEYS:
        logger.info("category classification source=keyword_fallback category=%s", keyword_cat)
        idx = CATEGORY_KEYS.index(keyword_cat)
        return {
            "rawLabel": CATEGORY_LABELS[idx],
            "category": keyword_cat,
            # Deterministic keyword evidence is not a calibrated probability.
            "confidence": 0.0,
            "source": "keyword_fallback",
        }

    # Step 2: HuggingFace zero-shot, only for in-scope uncertainty.
    result = _classify_with_hf(text)
    if result:
        logger.info("category classification source=hf_zero_shot category=%s", result.get("category"))
        return result

    # Step 3: Groq LLM
    result = _classify_with_groq_category(text)
    if result:
        logger.info("category classification source=groq_fallback category=%s", result.get("category"))
        return result

    logger.info("category classification source=uncertain category=other")
    return {
        "rawLabel": "Other issues not matching the above categories",
        "category": "other",
        "confidence": 0.0,
        "source": "uncertain",
    }


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
        raw = _groq_complete(prompt, max_tokens=150)
        if raw is None:
            return None
        parsed = _extract_json(raw.strip())
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
    source = "keyword_rules"
    if contains_high_risk_issue(text):
        priority = "high"
    elif affects_many_people(text):
        priority = "high"
    elif contains_medium_risk_issue(text):
        priority = "medium"
    else:
        priority = _classify_priority_with_groq(text)
        if priority:
            source = "groq_fallback"
        else:
            priority = "medium" if (sentiment == "negative" and sentiment_score > 0.35) else "low"
            source = "sentiment_fallback"

    return {
        "priority": priority,
        "sentiment": sentiment,
        "sentimentScore": sentiment_score,
        "source": source,
    }


def refine_with_groq(
    text: str, hf_category: str, hf_priority: str, hf_raw_label: str
) -> dict | None:
    if not get_groq_client():
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
        raw = _groq_complete(prompt, max_tokens=300)
        if raw is None:
            return None
        parsed = _extract_json(raw.strip())
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
