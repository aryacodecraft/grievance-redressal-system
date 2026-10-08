#!/usr/bin/env python3
"""Backfill missing department assignments from existing grievance categories."""
from __future__ import annotations
import argparse, logging, os, sys
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT, "backend", ".env"))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from backend.app.config import MONGODB_DB, MONGODB_URI  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill-departments")

def run(dry_run: bool = False) -> int:
    if not MONGODB_URI:
        logger.error("MONGODB_URI is not configured")
        return 1
    from pymongo import MongoClient
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    collection = client[MONGODB_DB]["grievances"]
    query = {"$or": [{"departmentId": {"$exists": False}}, {"departmentId": None}, {"departmentId": ""}]}
    docs = list(collection.find(query, {"_id": 1, "id": 1, "category": 1, "hfEngine.category": 1}))
    logger.info("Found %d grievances missing departmentId", len(docs))
    changed = 0
    for doc in docs:
        department = str(doc.get("category") or (doc.get("hfEngine") or {}).get("category") or "other").strip().lower()
        if not department:
            logger.warning("Skipping %s: no category available", doc.get("id", "unknown"))
            continue
        logger.info("%s -> departmentId=%s", doc.get("id", "unknown"), department)
        if not dry_run:
            collection.update_one({"_id": doc["_id"]}, {"$set": {"departmentId": department}})
        changed += 1
    logger.info("%s %d records", "Would update" if dry_run else "Updated", changed)
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    raise SystemExit(run(parser.parse_args().dry_run))
