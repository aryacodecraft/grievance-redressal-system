import os
import re
import json
import logging
import time
from dotenv import load_dotenv
from groq import Groq

logger = logging.getLogger("grievance-api")
_LLM_TOTAL_BUDGET_SECONDS = 20.0
_LLM_CALL_TIMEOUT_SECONDS = 8.0
_ALLOWED_CATEGORIES = {
    "water", "roads", "electricity", "sanitation", "health",
    "transport", "governance", "other",
}

# Auto-load environment variables from backend/.env or .env
_env_paths = [
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
    os.path.join(os.path.dirname(__file__), "..", ".env")
]
for _p in _env_paths:
    if os.path.exists(_p):
        load_dotenv(_p)
        break

# Singleton Groq client
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please set it in your environment.")
    _groq_client = Groq(api_key=api_key)
    return _groq_client

# Canonical category keys (lowercase) for Firestore
CATEGORY_CANONICAL_MAP = {
    'electricity': 'electricity',
    'water': 'water',
    'road': 'roads',
    'roads': 'roads',
    'sanitation': 'sanitation',
    'health': 'health',
    'transport': 'transport',
    'governance': 'governance',
    'other': 'other',
    'Electricity': 'electricity',
    'Water': 'water',
    'Road': 'roads',
    'Roads': 'roads',
    'Sanitation': 'sanitation',
    'Health': 'health',
    'Transport': 'transport',
    'Governance': 'governance',
    'Other': 'other',
    'Healthcare': 'health',
}

def canonicalize_category(cat: str) -> str:
    if not cat:
        return 'other'
    c = str(cat).strip()
    # direct lower lookup
    if c.lower() in CATEGORY_CANONICAL_MAP:
        return CATEGORY_CANONICAL_MAP[c.lower()] if c.lower() in ['electricity','water','roads','road','sanitation','health','transport','governance','other'] else CATEGORY_CANONICAL_MAP.get(c, c.lower())
    return CATEGORY_CANONICAL_MAP.get(c, c.lower())

def llm_classify(text: str, model_name: str = "openai/gpt-oss-20b") -> dict:
    """
    Classifies a complaint using Groq LLM API.
    Returns dict with category (lowercase canonical), priority (High/Medium/Low), reason.
    """
    client = get_groq_client()

    prompt = f"""Classify the complaint into one category:
[water, roads, electricity, sanitation, health, transport, governance, other]

Also determine:
- priority (low, medium, high) — low=minor, medium=significant inconvenience, high=danger/life-risk or severe disruption
- short reason (1 sentence)

Complaint: "{text}"

Return ONLY valid JSON with lowercase values:
{{
  "category": "water|roads|electricity|sanitation|health|transport|governance|other",
  "priority": "low|medium|high",
  "reason": "..."
}}"""

    # Valid Groq models in priority order; the groq/compound* models retired
    # on 2026-09-21 were removed from the cascade.
    models_to_try = [
        model_name,
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
    ]
    # deduplicate preserving order
    seen = set()
    models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

    last_exception = None
    started = time.monotonic()
    bounded_client = client.with_options(max_retries=0)
    for target_model in models_to_try:
        remaining = _LLM_TOTAL_BUDGET_SECONDS - (time.monotonic() - started)
        if remaining <= 1.0:
            logger.warning("Legacy Groq fallback budget exhausted; skipping remaining models")
            break
        try:
            call_started = time.monotonic()
            response = bounded_client.chat.completions.create(
                model=target_model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=300,
                timeout=min(_LLM_CALL_TIMEOUT_SECONDS, remaining),
            )

            content = response.choices[0].message.content.strip()

            # Remove thinking blocks if present in reasoning models
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

            # Clean markdown code block wrappers if returned by LLM
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Find JSON substring between { and }
            start_idx = content.find('{')
            end_idx = content.rfind('}')
            if start_idx != -1 and end_idx != -1:
                content = content[start_idx:end_idx + 1]

            parsed = json.loads(content)
            if not isinstance(parsed, dict):
                raise ValueError("Groq returned a non-object response")
            # Normalize, then validate against the actual taxonomy. Never
            # propagate an unsupported provider label into the application.
            category = canonicalize_category(parsed.get("category", "other"))
            if category not in _ALLOWED_CATEGORIES:
                logger.warning("Legacy Groq fallback returned unsupported category")
                category = "other"
                parsed["reason"] = "Unsupported model category; left as Other for human review."
            parsed["category"] = category
            if "priority" in parsed:
                # keep capitalized for backward compat but also allow lower
                p = str(parsed["priority"]).strip().lower()
                if p in ["high", "medium", "low"]:
                    parsed["priority"] = p.capitalize()  # High/Medium/Low
                else:
                    parsed["priority"] = "Medium"
            usage = getattr(response, "usage", None)
            total_tokens = getattr(usage, "total_tokens", None) if usage else None
            logger.info(
                "Legacy Groq fallback succeeded model=%s latency_ms=%d total_tokens=%s",
                target_model, int((time.monotonic() - call_started) * 1000), total_tokens,
            )
            return parsed
        except Exception as err:
            last_exception = err
            logger.warning(
                "Legacy Groq fallback failed model=%s latency_ms=%d error_type=%s",
                target_model,
                int((time.monotonic() - call_started) * 1000) if "call_started" in locals() else 0,
                type(err).__name__,
            )
            continue

    raise last_exception if last_exception else RuntimeError("All Groq models failed")


def derive_priority_from_text(text: str) -> str:
    """
    Derives complaint priority (High, Medium, Low) from text using keyword detection
    when using the primary ML model prediction. Handles Hinglish via normalization.
    """
    # Kept lazy on purpose: `grievance_model` pulls in pandas/sklearn, and the
    # Groq fallback must still work when those aren't installed.
    try:
        from .grievance_model import normalize_hinglish
        normalized = normalize_hinglish(text.lower())
    except Exception:
        normalized = text.lower()
    text_lower = normalized

    high_keywords = [
        "urgent", "emergency", "danger", "hazard", "fire", "short circuit",
        "burst", "severe", "accident", "shock", "flood", "electrocution",
        "collapse", "sewage overflow", "contamination", "outbreak",
        "2 din", "3 din", "nahi hai", "electricity", "transformer",
    ]
    low_keywords = ["request", "suggestion", "inquiry", "query", "minor", "info"]

    if any(kw in text_lower for kw in high_keywords):
        return "High"
    elif any(kw in text_lower for kw in low_keywords):
        return "Low"
    return "Medium"


def predict_with_fallback(model, text: str) -> dict:
    """
    Backwards-compatible adapter around the shared category cascade.

    New serving code should call ``classification.classify_category`` directly.
    This adapter preserves the historical return shape while ensuring older
    callers use the same scope, Water-context, and provider-failure policy.
    """
    from .classification import classification_budget, classify_category

    with classification_budget(seconds=_LLM_TOTAL_BUDGET_SECONDS):
        result = classify_category(text, model=model)
    return {
        "category": result.get("category", "other"),
        "priority": derive_priority_from_text(text),
        "confidence": float(result.get("confidence", 0.0)),
        "source": result.get("source", "uncertain"),
        "reason": result.get("reason", ""),
        "categoryOutcome": result.get("categoryOutcome", "uncertain"),
        "categoryConfidenceSemantics": result.get(
            "categoryConfidenceSemantics", "unavailable"
        ),
    }
