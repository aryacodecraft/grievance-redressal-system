import os
import re
import json
from dotenv import load_dotenv
from groq import Groq

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

    # Valid Groq models in priority order (verified 2026-05-14)
    models_to_try = [
        model_name,
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "groq/compound-mini",
        "groq/compound",
    ]
    # deduplicate preserving order
    seen = set()
    models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

    last_exception = None
    for target_model in models_to_try:
        try:
            response = client.chat.completions.create(
                model=target_model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                max_tokens=300
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
            # Normalize to canonical lowercase
            if "category" in parsed:
                parsed["category"] = canonicalize_category(parsed["category"])
            if "priority" in parsed:
                # keep capitalized for backward compat but also allow lower
                p = str(parsed["priority"]).strip().lower()
                if p in ["high", "medium", "low"]:
                    parsed["priority"] = p.capitalize()  # High/Medium/Low
                else:
                    parsed["priority"] = "Medium"
            return parsed
        except Exception as err:
            last_exception = err
            continue

    raise last_exception if last_exception else RuntimeError("All Groq models failed")


def derive_priority_from_text(text: str) -> str:
    """
    Derives complaint priority (High, Medium, Low) from text using keyword detection
    when using the primary ML model prediction. Handles Hinglish via normalization.
    """
    # Lazy import to avoid circular at top
    try:
        from grievance_model import normalize_hinglish
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
    Predicts grievance category and details using the ML model first.
    Falls back to Groq LLM if confidence < 0.5 or category is 'other'.
    Returns dict with canonical lowercase category and capitalized priority.
    """
    # Step 1: Call existing ML model
    result = model.predict(text)
    raw_cat = result.get("category", "other")
    # Normalize ML category to canonical lowercase
    ml_cat = canonicalize_category(raw_cat)
    confidence = float(result.get("confidence", 0.0))

    # Step 2: Check fallback condition: confidence < 0.5 OR category == "other"
    is_low_conf = confidence < 0.5
    is_other = ml_cat.lower() == "other"
    if is_low_conf or is_other:
        # Step 3: Trigger LLM Fallback
        llm_result = llm_classify(text)

        llm_cat = canonicalize_category(llm_result.get("category", "other"))
        llm_priority = llm_result.get("priority", "Medium")
        # Normalize priority capitalization
        if isinstance(llm_priority, str):
            llm_priority = llm_priority.strip().capitalize()
            if llm_priority.lower() not in ["high", "medium", "low"]:
                llm_priority = "Medium"
        else:
            llm_priority = "Medium"

        # Step 4: Return LLM result with proper confidence (LLM is high confidence)
        return {
            "category": llm_cat,
            "priority": llm_priority,
            "confidence": 0.95,
            "source": "llm_fallback",
            "reason": llm_result.get("reason", "LLM classification")
        }

    # Step 4: Return ML result format with canonical category
    return {
        "category": ml_cat,
        "priority": derive_priority_from_text(text),
        "confidence": confidence,
        "source": "ml_model",
        "reason": result.get("reason", "")
    }
