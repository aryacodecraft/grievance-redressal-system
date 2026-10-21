"""Environment-driven settings and lazily-initialised optional clients."""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from urllib.parse import urlsplit

from dotenv import load_dotenv

# Search for .env in standard locations (backend/.env or repo root .env)
_env_paths = [
    os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    "backend/.env",
    ".env",
]
for _p in _env_paths:
    if os.path.exists(_p):
        load_dotenv(_p)
        break
else:
    load_dotenv()

logger = logging.getLogger("grievance-api")


def _clean_origin(raw: str) -> str:
    raw = raw.strip()
    if not raw or raw == "*":
        return raw
    parsed = urlsplit(raw)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return raw.rstrip("/")


# --- Server ---------------------------------------------------------------
PORT = int(os.getenv("PORT", "10000"))
CORS_ORIGINS = [
    _clean_origin(origin)
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
# Optional custom DNS nameservers for MongoDB SRV resolution (default empty uses system DNS).
MONGO_DNS_SERVERS = os.getenv("MONGO_DNS_SERVERS", "").strip()

# Diagnostic only: skips initialization writes, not writes from API endpoints.
# Use process-local overrides; leave disabled in normal deployments.
DIAGNOSTIC_SKIP_INITIALIZATION_WRITES = (
    os.getenv("DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", "false").lower() == "true"
)

# --- Cloudinary -----------------------------------------------------------
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# --- Authentication -------------------------------------------------------
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
# Seeds one admin account at startup (no-op if the account already exists).
SEED_ADMIN_EMAIL = os.getenv("SEED_ADMIN_EMAIL", "")
SEED_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "")
SEED_SUPERADMIN_EMAIL = os.getenv("SEED_SUPERADMIN_EMAIL", "")
SEED_SUPERADMIN_PASSWORD = os.getenv("SEED_SUPERADMIN_PASSWORD", "")
ALLOW_DEMO_SUBMIT = os.getenv("ALLOW_DEMO_SUBMIT", "true").lower() == "true"
# Testing-phase accounts: when true, startup seeds one MANAGER (ADMIN) and one
# EMPLOYEE (RESOLVER) per grievance department plus default superadmin/citizen
# (all idempotent — existing emails are left untouched). Keep false in production.
SEED_TEST_ACCOUNTS = os.getenv("SEED_TEST_ACCOUNTS", "false").lower() == "true"
# Shared dev password for the per-department test accounts. Empty means the
# documented built-in defaults are used (see seed_test_accounts.py / README).
SEED_TEST_PASSWORD = os.getenv("SEED_TEST_PASSWORD", "")
# Google OAuth (optional)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
# URL where the Next.js frontend is hosted (used for OAuth redirects)
FRONTEND_URL = _clean_origin(os.getenv("FRONTEND_URL", "http://localhost:3000"))

# --- Face authentication (opt-in; DEC-024) ----------------------------------
# Master switch. When false every /auth/face route answers 404 and the UI
# hides every face option.
FACE_AUTH_ENABLED = os.getenv("FACE_AUTH_ENABLED", "false").lower() == "true"
# Fernet key for embeddings at rest. Startup fails if the flag is on and this
# is missing/invalid.
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FACE_EMBED_KEY = os.getenv("FACE_EMBED_KEY", "")
# insightface model pack (buffalo_s ships 2d106det landmarks required for
# liveness). Stored per template; a mismatch forces re-enrollment.
FACE_MODEL_NAME = os.getenv("FACE_MODEL_NAME", "buffalo_s")
# Root directory for InsightFace model packs. Empty -> ~/.insightface.
# Render sets this to a path inside the repo so the build-time download in
# backend/scripts/prepare_face_model.py survives into the runtime.
FACE_MODEL_ROOT = os.getenv("FACE_MODEL_ROOT") or os.path.expanduser("~/.insightface")
# ONNX Runtime intra-op threads for face inference. Empty -> min(4, CPU count).
# Render free (0.1 CPU) should set 1; more threads only add contention.
FACE_ORT_THREADS = max(
    1,
    int(os.getenv("FACE_ORT_THREADS") or min(4, os.cpu_count() or 1)),
)
# Cosine similarity threshold for 1:1 template matching.
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.45"))
# Pairwise cosine similarity threshold across frontal frames.
FACE_CONSISTENCY_THRESHOLD = float(os.getenv("FACE_CONSISTENCY_THRESHOLD", "0.30"))
# Cosine similarity binding threshold between liveness action frame and frontal face (0..1).
FACE_BINDING_THRESHOLD = float(os.getenv("FACE_BINDING_THRESHOLD", "0.25"))
# Optional Silent-Face-Anti-Spoofing ONNX model; empty disables the check.
FACE_ANTISPOOF_MODEL_PATH = os.getenv("FACE_ANTISPOOF_MODEL_PATH", "")
# Liveness/quality thresholds — defaults tuned against synthetic frames; tune
# per webcam when capture fails closed (read at call time, no code change).
FACE_TURN_MIN_DEGREES = float(os.getenv("FACE_TURN_MIN_DEGREES", "15.0"))
FACE_BLINK_EAR_DROP = float(os.getenv("FACE_BLINK_EAR_DROP", "0.7"))
FACE_SMILE_MOUTH_WIDEN = float(os.getenv("FACE_SMILE_MOUTH_WIDEN", "1.08"))
FACE_MIN_BLUR_VARIANCE = float(os.getenv("FACE_MIN_BLUR_VARIANCE", "30.0"))
FACE_MIN_FACE_PX = int(os.getenv("FACE_MIN_FACE_PX", "80"))
# Input size for the SCRFD detector (square; min 320 for speed).
FACE_DET_SIZE = max(320, int(os.getenv("FACE_DET_SIZE", "320")))
# Local debug metrics logged per attempt (local only; never logs embeddings).
FACE_DEBUG = os.getenv("FACE_DEBUG", "false").lower() == "true"
FACE_CHALLENGES = [
    c.strip()
    for c in os.getenv("FACE_CHALLENGES", "turn_left,turn_right,blink,smile").split(",")
    if c.strip()
] or ["turn_left", "turn_right", "blink", "smile"]

# Citizen SMS. `dry-run` logs metadata only, `off` disables SMS entirely,
# `twilio` delivers via the Twilio Messaging Service below. `twilio` refuses
# to send until the SID, token, and messaging-service SID are all set, so a
# fresh clone cannot accidentally emit messages.
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "dry-run").strip().lower()
OTP_DEBUG_RETURN_CODE = os.getenv("OTP_DEBUG_RETURN_CODE", "false").lower() == "true"
OTP_HASH_SECRET = os.getenv("OTP_HASH_SECRET", "") or JWT_SECRET_KEY
SMS_RATE_LIMIT_PER_USER_HOUR = int(os.getenv("SMS_RATE_LIMIT_PER_USER_HOUR", "4"))
SMS_RATE_LIMIT_PER_GRIEVANCE_DAY = int(os.getenv("SMS_RATE_LIMIT_PER_GRIEVANCE_DAY", "3"))
# Live Twilio delivery (TODO §13 Phase 6). Secrets live in `backend/.env` or
# the deploy dashboard only — never in git. Empty by default.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
# Indian DLT registration, recorded for traceability. Carriers enforce these:
# a body that drifts from the registered template is dropped before delivery.
DLT_ENTITY_ID = os.getenv("DLT_ENTITY_ID", "")
DLT_TEMPLATE_ID_STAGE = os.getenv("DLT_TEMPLATE_ID_STAGE", "")
DLT_TEMPLATE_ID_OTP = os.getenv("DLT_TEMPLATE_ID_OTP", "")

# --- Voice-assisted complaints (DEC-032) -------------------------------------
# Off until explicitly enabled by operator.
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_STT_MODEL = os.getenv("SARVAM_STT_MODEL", "saaras:v4")
TRANSCRIPTION_ENABLED = os.getenv("TRANSCRIPTION_ENABLED", "false").lower() == "true"
TRANSCRIPTION_MAX_FILE_BYTES = int(os.getenv("TRANSCRIPTION_MAX_FILE_BYTES", "1048576"))
TRANSCRIPTION_MAX_REQUEST_BYTES = int(os.getenv("TRANSCRIPTION_MAX_REQUEST_BYTES", "2097152"))
TRANSCRIPTION_MAX_SECONDS = float(os.getenv("TRANSCRIPTION_MAX_SECONDS", "30"))
TRANSCRIPTION_USER_MINUTE_LIMIT = int(os.getenv("TRANSCRIPTION_USER_MINUTE_LIMIT", "3"))
TRANSCRIPTION_USER_HOUR_LIMIT = int(os.getenv("TRANSCRIPTION_USER_HOUR_LIMIT", "10"))
TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT = int(os.getenv("TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT", "20"))
TRANSCRIPTION_MAX_CONCURRENT = int(os.getenv("TRANSCRIPTION_MAX_CONCURRENT", "2"))
TRANSCRIPTION_IDEMPOTENCY_TTL_SECONDS = int(os.getenv("TRANSCRIPTION_IDEMPOTENCY_TTL_SECONDS", "300"))
TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS = float(os.getenv("TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS", "15"))
SARVAM_TIMEOUT_SECONDS = float(os.getenv("SARVAM_TIMEOUT_SECONDS", "45"))

# --- Proxy -------------------------------------------------------------------
# When true, honour X-Forwarded-Proto when deciding whether a request is HTTPS.
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").lower() == "true"


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
