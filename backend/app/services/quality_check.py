"""Quality check: is the grievance text a genuine civic complaint?

Uses a fast Groq call bounded by the shared classification budget.
Returns a dict: { "is_genuine": bool | None, "reason": str }

Design constraints (AGENTS.md / DEC-049):
  - An unavailable or unusable answer is indeterminate; the caller must not
    persist the submission without a positive relevance result.
  - The result is a relevance filter, not an administrative decision.
  - Shares the classification_budget() context so its wall time is counted
    against the same 20 s budget as category / priority / refinement calls.
"""

from __future__ import annotations

import logging

from .classification import _extract_json, _groq_complete

logger = logging.getLogger("grievance-api")

_PROMPT = """\
You are a quality filter for a government civic grievance portal in India.
The citizen submitted the following text as a public complaint:

\"\"\"
{text}
\"\"\"

Determine if this is a genuine civic or public-service grievance (e.g. broken
road, water supply failure, garbage not collected, electricity outage, health
hazard, encroachment, noise, drainage, sanitation, transport, governance issue).

A submission is NOT genuine if it is clearly:
- A math question, riddle, or general knowledge query
- A test / dummy / hello-world / lorem-ipsum submission
- Pure gibberish or random characters
- A personal or private matter with no public-service dimension
- Spam, profanity, or content wholly unrelated to civic services

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "is_genuine": true or false,
  "reason": "one concise sentence"
}}"""


def check_quality(title: str, description: str) -> dict:
    """Return true, false, or indeterminate for civic relevance.

    Indeterminate results must fail closed at the submission boundary.
    """
    text = f"{title}\n{description}".strip()[:2000]
    try:
        raw = _groq_complete(
            _PROMPT.format(text=text), max_tokens=120, stage="quality_check"
        )
        if raw is None:
            return {"is_genuine": None, "reason": "quality check unavailable"}
        parsed = _extract_json(raw.strip())
        if isinstance(parsed, dict) and type(parsed.get("is_genuine")) is bool:
            return {
                "is_genuine": parsed["is_genuine"],
                "reason": str(parsed.get("reason", "")),
            }
        logger.warning("quality_check: unexpected LLM response type=%s", type(parsed).__name__)
    except Exception as exc:  # noqa: BLE001
        logger.warning("quality_check failed error_type=%s", type(exc).__name__)
    return {"is_genuine": None, "reason": "quality check returned no usable result"}
