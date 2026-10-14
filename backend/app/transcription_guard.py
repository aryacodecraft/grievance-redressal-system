"""Bound the complete audio request before multipart parsing/spooling."""

import asyncio

from starlette.responses import JSONResponse

from . import config


class TranscriptionGuard:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (scope.get("type") != "http" or scope.get("method") != "POST"
                or scope.get("path", "").rstrip("/") != "/transcribe"):
            return await self.app(scope, receive, send)

        async def reply(status, message):
            await JSONResponse({"error": message}, status_code=status)(scope, receive, send)

        if not config.TRANSCRIPTION_ENABLED:
            return await reply(503, "Transcription is disabled")
        cap = min(config.TRANSCRIPTION_MAX_REQUEST_BYTES, 2 * 1024 * 1024)
        headers = dict(scope.get("headers", []))
        length = headers.get(b"content-length", b"")
        if length.isdigit() and int(length) > cap:
            return await reply(413, "Transcription request is too large")
        body = bytearray()
        try:
            async with asyncio.timeout(config.TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS):
                while True:
                    message = await receive()
                    if message["type"] != "http.request":
                        return
                    chunk = message.get("body", b"")
                    if len(body) + len(chunk) > cap:
                        return await reply(413, "Transcription request is too large")
                    body.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await reply(408, "Audio upload timed out")
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
