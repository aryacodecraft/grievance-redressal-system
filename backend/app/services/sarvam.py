"""Sarvam STT REST integration. Never retry or log audio, text, or credentials."""

import asyncio
import json

import httpx
from fastapi import HTTPException

from .. import config

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
LANGUAGES = {"en-IN", "hi-IN", "mr-IN"}
MAX_RESPONSE_BYTES = 64 * 1024


def make_client() -> httpx.AsyncClient:
    # No SDK retry policy, redirects or environment proxy forwarding.
    return httpx.AsyncClient(
        timeout=httpx.Timeout(config.SARVAM_TIMEOUT_SECONDS, connect=5),
        follow_redirects=False,
        trust_env=False,
    )


async def transcribe(audio: bytes, language: str) -> dict:
    try:
        async with asyncio.timeout(config.SARVAM_TIMEOUT_SECONDS):
            async with make_client() as client:
                async with client.stream(
                    "POST", SARVAM_STT_URL,
                    headers={"api-subscription-key": config.SARVAM_API_KEY},
                    data={"model": config.SARVAM_STT_MODEL, "mode": "transcribe", "language_code": language},
                    files={"file": ("recording.wav", audio, "audio/wav")},
                ) as response:
                    if response.status_code in (402, 403, 429):
                        raise HTTPException(503, "Transcription provider unavailable; contact the operator")
                    if response.status_code != 200:
                        raise HTTPException(502, "Transcription provider failed")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                            raise HTTPException(502, "Invalid transcription provider response")
                        body.extend(chunk)
                    raw = json.loads(body)
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, "Transcription timed out; this attempt may have consumed credits") from None
    except (httpx.RequestError, ValueError, RecursionError):
        raise HTTPException(502, "Transcription provider unavailable or returned invalid data") from None
    if not isinstance(raw, dict):
        raise HTTPException(502, "Invalid transcription provider response")
    text = raw.get("transcript")
    detected = raw.get("language_code")
    request_id = raw.get("request_id")
    if (not isinstance(text, str) or not text.strip() or len(text) > 16000
            or (detected is not None and (not isinstance(detected, str) or detected not in LANGUAGES))
            or (request_id is not None and (not isinstance(request_id, str) or len(request_id) > 200))):
        raise HTTPException(502, "Invalid transcription provider response")
    result = {"transcript": text, "language_code": detected}
    if request_id is not None:
        result["request_id"] = request_id
    return result
