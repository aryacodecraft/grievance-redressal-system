"""Authenticated transcription only; no grievance or database mutations."""

import hashlib
import math
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.datastructures import UploadFile

from .. import config
from ..auth import get_current_user
from ..services import sarvam
from ..services.audio_validation import validate_wav
from ..services.transcription_limits import transcription_limits

router = APIRouter(tags=["transcription"])


@router.post("/transcribe", openapi_extra={
    "requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
        "type": "object", "required": ["file", "language_code"],
        "additionalProperties": False,
        "properties": {
            "file": {"type": "string", "format": "binary", "description": "Mono 16-bit 16 kHz PCM WAV, at most 30 seconds/1 MiB"},
            "language_code": {"type": "string", "enum": ["en-IN", "hi-IN", "mr-IN"]},
        },
    }}}},
    "parameters": [{"name": "Idempotency-Key", "in": "header", "required": False,
                    "schema": {"type": "string", "pattern": "^[A-Za-z0-9_-]{1,128}$"}}],
})
async def transcribe(
    request: Request,
    current: Annotated[dict, Depends(get_current_user)],
):
    if not config.TRANSCRIPTION_ENABLED:
        raise HTTPException(503, "Transcription is disabled")
    if not config.SARVAM_API_KEY or config.SARVAM_STT_MODEL != "saaras:v4":
        raise HTTPException(503, "Transcription is not configured")
    settings = (
        config.TRANSCRIPTION_MAX_FILE_BYTES, config.TRANSCRIPTION_MAX_REQUEST_BYTES,
        config.TRANSCRIPTION_MAX_SECONDS, config.TRANSCRIPTION_USER_MINUTE_LIMIT,
        config.TRANSCRIPTION_USER_HOUR_LIMIT, config.TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT,
        config.TRANSCRIPTION_MAX_CONCURRENT, config.TRANSCRIPTION_IDEMPOTENCY_TTL_SECONDS,
        config.TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS, config.SARVAM_TIMEOUT_SECONDS,
    )
    if any(not math.isfinite(value) or value <= 0 for value in settings):
        raise HTTPException(503, "Invalid transcription configuration")
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "multipart/form-data":
        raise HTTPException(400, "Multipart audio file and language_code are required")
    key = request.headers.get("idempotency-key")
    if key is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", key):
        raise HTTPException(400, "Invalid Idempotency-Key")
    key = key or uuid.uuid4().hex
    # The context closes all UploadFiles, including validation/provider failures.
    async with request.form(max_files=1, max_fields=1, max_part_size=1024) as form:
        items = form.multi_items()
        if len(items) != 2 or set(form) != {"file", "language_code"}:
            raise HTTPException(400, "Exactly one file and language_code are required")
        upload = form["file"]
        language = form["language_code"]
        if not isinstance(upload, UploadFile) or not isinstance(language, str) or language not in sarvam.LANGUAGES:
            raise HTTPException(400, "WAV file and language_code (en-IN, hi-IN, mr-IN) are required")
        cap = min(config.TRANSCRIPTION_MAX_FILE_BYTES, 1024 * 1024)
        data = await upload.read(cap + 1)
        if len(data) > cap:
            raise HTTPException(413, "Audio file is too large")
        if not data:
            raise HTTPException(400, "Audio file is empty")
        audio = validate_wav(data, config.TRANSCRIPTION_MAX_SECONDS)
        fingerprint = hashlib.sha256(language.encode() + audio).hexdigest()
        user = current["user_id"]
        cached = transcription_limits.reserve(user, key, fingerprint)
        if cached is not None:
            return cached
        result = None
        try:
            result = await sarvam.transcribe(audio, language)
            return result
        finally:
            transcription_limits.finish(user, key, result)
