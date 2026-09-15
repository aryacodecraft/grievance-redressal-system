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


def llm_classify(text: str, model_name: str = "mixtral-8x7b-32768") -> dict:
    """
    Classifies a complaint using Groq LLM API.

    Parameters:
        text (str): The complaint text to classify.
        model_name (str): Groq model identifier (default: mixtral-8x7b-32768).

    Returns:
        dict: Standardized JSON dictionary containing:
              {
                  "category": str,
                  "priority": str,
                  "reason": str
              }
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please set it in your environment.")

    client = Groq(api_key=api_key)

    # Exact prompt required by specification
    prompt = f"""Classify the complaint into one category:
[Electricity, Water, Road, Sanitation, Health, Other]

Also determine:
- priority (Low, Medium, High)
- short reason

Complaint: "{text}"

Return ONLY valid JSON:
{{
  "category": "...",
  "priority": "...",
  "reason": "..."
}}"""

    # Model try order: primary model required by prompt, followed by active production Groq models
    models_to_try = [
        model_name,
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "qwen/qwen3.6-27b"
    ]

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

            return json.loads(content)
        except Exception as err:
            last_exception = err
            continue

    raise last_exception


def derive_priority_from_text(text: str) -> str:
    """
    Derives complaint priority (High, Medium, Low) from text using keyword detection
    when using the primary ML model prediction.
    """
    text_lower = text.lower()
    high_keywords = [
        "urgent", "emergency", "danger", "hazard", "fire", "short circuit",
        "burst", "severe", "accident", "shock", "flood", "2 din", "3 din", "nahi hai"
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
    Falls back to Groq LLM if confidence < 0.5 or category is 'Other'.

    Parameters:
        model: Instance of GrievanceModel with a predict(text) method.
        text (str): Complaint text to classify.

    Returns:
        dict: Result matching ML model format or LLM fallback format.
    """
    # Step 1: Call existing ML model
    result = model.predict(text)

    # Step 2: Check fallback condition: confidence < 0.5 OR category == "Other"
    if result.get("confidence", 0.0) < 0.5 or result.get("category") == "Other":
        # Step 3: Trigger LLM Fallback
        llm_result = llm_classify(text)

        # Step 4: Return LLM result format
        return {
            "category": llm_result["category"],
            "priority": llm_result["priority"],
            "confidence": result["confidence"],
            "source": "llm_fallback",
            "reason": llm_result["reason"]
        }

    # Step 4: Return ML result format
    return {
        "category": result["category"],
        "priority": derive_priority_from_text(text),
        "confidence": result["confidence"],
        "source": "ml_model",
        "reason": result["reason"]
    }
