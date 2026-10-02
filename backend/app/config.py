"""Environment-driven settings and lazily-initialised optional clients."""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("grievance-api")

# --- Server ---------------------------------------------------------------
PORT = int(os.getenv("PORT", "10000"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]

# --- Classification / LLM -------------------------------------------------
HF_API_TOKEN = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACE_API_TOKEN")
HF_BASE_URL = "https://router.huggingface.co/hf-inference"

# NB: the previous default, `llama-3.3-70b-versatile`, was decommissioned by
# Groq and 404s (verified 2026-09-11 against this project's key), which silently
# degraded classification to the keyword fallback. `openai/gpt-oss-20b` is the
# model confirmed to work here; override via GROQ_MODEL if your key differs.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
# Multimodal model used by services/image.py for the vision half of image
# validation. Previously read here but never consumed (image.py hardcoded it).
LLAVA_MODEL = os.getenv("LLAVA_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
IMAGE_LLM_THRESHOLD = float(os.getenv("IMAGE_LLM_THRESHOLD", "60.0"))

# --- Storage (Phase 3 wires MongoDB to this) ------------------------------
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB = os.getenv("MONGODB_DB", "grievance")

# --- Cloudinary -----------------------------------------------------------
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")


@lru_cache(maxsize=1)
def get_groq_client():
    """Cached Groq client. Returns None when unavailable (classification
    gracefully falls back to keywords)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set; LLM calls disabled.")
        return None

    try:
        from groq import Groq
    except Exception:
        logger.error("GROQ_API_KEY set but the `groq` SDK is not installed.")
        return None

    try:
        return Groq(api_key=api_key)
    except Exception:
        logger.exception("Failed to initialise Groq client")
        return None
