#!/usr/bin/env python3
"""Re-run AI classification over every stored grievance (MongoDB edition).

Replaces the Firestore batch job; the classifier cascade now lives in
`backend/app/services/classification.py`.

Usage:
    python tools/recategorize.py             # classify and apply updates
    python tools/recategorize.py --dry-run   # classify and report only
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("recategorize")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")

# Load backend/.env before the app config module reads it.
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.app.config import MONGODB_DB, MONGODB_URI  # noqa: E402
from backend.app.services.classification import (  # noqa: E402
    CATEGORY_MODEL,
    GROQ_MODEL,
    PRIORITY_MODEL,
    classify_category,
    classify_priority,
    extract_keywords,
    find_urgent_matches,
    infer_category_from_keywords,
    refine_with_groq,
)


def classify(text: str) -> dict:
    """One classification pass — mirrors the /submit-grievance cascade."""
    try:
        cat_res = classify_category(text)
    except Exception:
        logger.exception("category classification failed")
        cat_res = {"rawLabel": "", "category": "other", "confidence": 0.0}
    try:
        pri_res = classify_priority(text)
    except Exception:
        logger.exception("priority classification failed")
        pri_res = {"sentiment": "neutral", "sentimentScore": 0.0, "priority": "low"}

    hf_priority = pri_res.get("priority", "low")
    sentiment_raw = pri_res.get("sentiment", "neutral")
    sentiment_score = pri_res.get("sentimentScore", 0.0)
    urgent_matches = find_urgent_matches(text)

    hf_category = cat_res.get("category", "other")
    keyword_category = infer_category_from_keywords(text)
    if keyword_category:
        hf_category = keyword_category
    if hf_category == "sanitation" and hf_priority == "low":
        hf_priority = "medium"

    hf_raw_label = cat_res.get("rawLabel", "")
    keywords = extract_keywords(text)

    try:
        groq_res = refine_with_groq(text, hf_category, hf_priority, hf_raw_label)
    except Exception:
        groq_res = None

    if groq_res:
        priority = groq_res.get("priority", hf_priority)
        category = groq_res.get("category", hf_category)
        explanation = groq_res.get("explanation", "Refined by Groq LLM.")
    else:
        priority = hf_priority
        category = hf_category
        explanation = (
            f"Category '{category}' predicted from '{hf_raw_label}' "
            f"(score: {float(cat_res.get('confidence', 0.0)):.2f}), "
            f"Priority '{priority}' determined using sentiment ('{sentiment_raw}', "
            f"score: {float(sentiment_score):.2f}) and urgency keywords."
        )

    return {
        "category": category,
        "priority": priority,
        "isUrgent": priority == "high",
        "keywords": keywords,
        "explanation": explanation,
        "rawCategoryLabel": hf_raw_label,
        "categoryConfidence": float(cat_res.get("confidence", 0.0)),
        "urgentMatches": urgent_matches,
        "modelInfo": {
            "categoryModel": CATEGORY_MODEL,
            "priorityModel": PRIORITY_MODEL,
            "sentimentLabel": sentiment_raw,
            "sentimentScore": float(sentiment_score),
            "groqModel": GROQ_MODEL if groq_res else "None",
            "hfCategory": hf_category,
            "hfPriority": hf_priority,
        },
    }


def recategorize_all(dry_run: bool = False) -> int:
    if not MONGODB_URI:
        logger.error("MONGODB_URI is not set — export it or add it to backend/.env")
        return 1

    from pymongo import MongoClient

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    collection = client[MONGODB_DB]["grievances"]

    docs = list(collection.find({}, {"_id": 1, "id": 1, "title": 1, "description": 1}))
    logger.info("Found %d documents", len(docs))

    updated = 0
    for data in docs:
        text = f"{data.get('title', '')}\n{data.get('description', '')}".strip()
        if not text:
            logger.warning("Skipping %s: no title/description", data.get("id"))
            continue

        try:
            hf_engine = classify(text)
        except Exception as exc:
            logger.error("Failed for %s: %s", data.get("id"), exc)
            continue

        logger.info(
            "%s -> %s / %s",
            data.get("id"),
            hf_engine["category"],
            hf_engine["priority"],
        )

        if dry_run:
            updated += 1
            continue

        collection.update_one(
            {"_id": data["_id"]},
            {
                "$set": {
                    "hfEngine": hf_engine,
                    "category": hf_engine["category"],
                    "priority": hf_engine["priority"],
                }
            },
        )
        updated += 1

    logger.info(
        "%s %d of %d documents",
        "Would update" if dry_run else "Updated",
        updated,
        len(docs),
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-run AI classification over stored grievances."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Classify and log, but do not write anything",
    )
    args = parser.parse_args()
    raise SystemExit(recategorize_all(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
