"""Loopback HTTP: actual React/API/WAV path -> actual app -> mocked provider.

Opt-in only: this starts an in-process uvicorn server and a Node/jsdom/React
subprocess, which is too heavy for constrained dev machines. Run it with
`VOICE_E2E=1 pytest tests/test_voice_e2e.py`; the default suite skips it and
keeps the backend transcription/intake and frontend unit coverage.

The test-only wrapper/flags never modify deployment configuration. Neither real
credentials nor audio recordings are used; external socket connections fail.
"""
import io
import os
from pathlib import Path
import shutil
import socket
import subprocess
import threading
import time
from email.parser import BytesParser
from email.policy import default
from urllib.parse import parse_qs
import wave

import httpx
import pytest
from starlette.datastructures import UploadFile
from starlette.responses import JSONResponse
import uvicorn

if os.environ.get("VOICE_E2E") != "1":
    pytest.skip(
        "Set VOICE_E2E=1 to run the loopback cross-stack voice E2E "
        "(starts an in-process server and a Node/jsdom subprocess).",
        allow_module_level=True,
    )


def test_mocked_voice_end_to_end(app, monkeypatch):
    root = Path(__file__).resolve().parents[1]
    node = shutil.which("node")
    if not node or not (root / "frontend/node_modules/jsdom/package.json").exists():
        pytest.skip("Install frontend dependencies and Node to run the cross-stack test")
    from backend.app import config, db
    from backend.app.auth import create_access_token
    from backend.app.routers import transcription
    from backend.app.services import sarvam
    from backend.app.services.transcription_limits import TranscriptionLimits

    state = {"scenario": "success", "posts": 0, "options": 0, "provider": 0, "extractions": 0}
    closed_uploads = []
    transcripts = {
        "en-IN": "The water supply has been interrupted since yesterday.",
        "hi-IN": "पानी की आपूर्ति कल से बंद है। कृपया सहायता करें।",
        "mr-IN": "कालपासून पाणीपुरवठा बंद आहे. कृपया मदत करा.",
    }
    monkeypatch.setattr(config, "SARVAM_API_KEY", "mock-only")
    monkeypatch.setattr(config, "SARVAM_STT_MODEL", "saaras:v4")
    monkeypatch.setattr(config, "TRANSCRIPTION_ENABLED", True)

    def provider(request):
        # Inspect the actual validated WAV forwarded by the production service.
        state["provider"] += 1
        assert str(request.url) == sarvam.SARVAM_STT_URL
        assert request.headers["api-subscription-key"] == "mock-only"
        message = BytesParser(policy=default).parsebytes(
            b"Content-Type: " + request.headers["content-type"].encode() + b"\r\n\r\n" + request.content
        )
        parts = {part.get_param("name", header="content-disposition"): part.get_payload(decode=True)
                 for part in message.iter_parts()}
        assert parts["model"] == b"saaras:v4" and parts["mode"] == b"transcribe"
        language = parts["language_code"].decode()
        with wave.open(io.BytesIO(parts["file"]), "rb") as wav:
            assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 16000)
            assert wav.getnframes() == 1600
            assert any(wav.readframes(1600)), "Actual processor must generate nonzero PCM"
        if state["scenario"] == "timeout":
            raise httpx.ReadTimeout("Mock timeout")
        if state["scenario"] == "failure":
            return httpx.Response(500, json={"error": "Mock failure"})
        if state["scenario"] == "invalid_response":
            return httpx.Response(200, json={"transcript": None})
        return httpx.Response(200, json={"transcript": transcripts[language], "language_code": language, "request_id": "stage6-mock"})

    monkeypatch.setattr(sarvam, "make_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(provider)))
    original_close = UploadFile.close

    async def close(upload):
        temporary_name = getattr(upload.file, "name", None)
        await original_close(upload)
        closed_uploads.append(upload.file.closed)
        if isinstance(temporary_name, str):
            assert not Path(temporary_name).exists(), "Upload spool must be removed after close"

    monkeypatch.setattr(UploadFile, "close", close)

    def no_grievance(*args, **kwargs):
        pytest.fail("Transcription attempted to create a grievance")

    monkeypatch.setattr(db.repository, "create", no_grievance)
    assert db.repository.list() == []
    original_connect = socket.socket.connect

    def loopback_only(sock, address):
        if isinstance(address, tuple) and address[0] not in ("127.0.0.1", "::1", "localhost"):
            raise AssertionError("External network is forbidden in voice E2E")
        return original_connect(sock, address)

    monkeypatch.setattr(socket.socket, "connect", loopback_only)

    async def harness(scope, receive, send):
        if scope.get("type") == "http" and scope.get("path") == "/__voice_test/browser_origin":
            from starlette.middleware.cors import CORSMiddleware
            origin = parse_qs(scope.get("query_string", b"").decode())["origin"][0]
            assert origin.startswith("http://localhost:")
            middleware = app.middleware_stack
            while not isinstance(middleware, CORSMiddleware):
                middleware = middleware.app
            monkeypatch.setattr(middleware, "allow_origins", [origin])
            monkeypatch.setattr(middleware, "allow_all_origins", False)
            await JSONResponse({"ok": True})(scope, receive, send)
            return
        if scope.get("type") == "http" and scope.get("path") == "/__voice_test/scenario":
            scenario = parse_qs(scope.get("query_string", b"").decode()).get("mode", ["success"])[0]
            assert scenario in {"success", "disabled", "failure", "timeout", "invalid_response"}
            state["scenario"] = scenario
            config.TRANSCRIPTION_ENABLED = scenario != "disabled"  # mock test process only
            transcription.transcription_limits = TranscriptionLimits()
            await JSONResponse({"ok": True})(scope, receive, send)
            return
        if scope.get("type") == "http" and scope.get("path") == "/__voice_test/stats":
            await JSONResponse({"posts": state["posts"], "options": state["options"], "provider": state["provider"],
                                "extractions": state["extractions"]})(scope, receive, send)
            return
        if scope.get("type") == "http" and scope.get("path") == "/grievance-intake/extract":
            # Canned extraction: the intake UI crosses the real HTTP boundary so
            # the dashboard/planner logic is exercised, but no LLM is involved.
            state["extractions"] += 1
            await JSONResponse({
                "title": "Water supply interrupted",
                "description": "The water supply has been interrupted since yesterday.",
                "location_text": None,
                "category": "water",
                "priority": "high",
                "question_kind": None,
            })(scope, receive, send)
            return
        if scope.get("type") == "http" and scope.get("path") == "/transcribe":
            if scope.get("method") == "POST":
                state["posts"] += 1
            elif scope.get("method") == "OPTIONS":
                state["options"] += 1
        await app(scope, receive, send)

    # Reserve a random port; do not disturb the owner's running 3000/10000 services.
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(harness, host="127.0.0.1", port=port, log_level="error", access_log=False))
    original_limits = transcription.transcription_limits
    monkeypatch.setattr(transcription, "transcription_limits", TranscriptionLimits())
    thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 15
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started, "Mock-only loopback server did not start"
        environment = dict(os.environ)
        environment.update({"VOICE_E2E_URL": f"http://127.0.0.1:{port}",
                            "NEXT_PUBLIC_API_URL": f"http://127.0.0.1:{port}",
                            "VOICE_E2E_TOKEN": create_access_token("stage6-citizen", "USER")})
        result = subprocess.run(
            [node, "--test", "--test-reporter=spec", "scripts/voice-e2e.test.mjs"],
            cwd=root / "frontend", env=environment, capture_output=True, encoding="utf-8", timeout=120,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert "pass 9" in result.stdout
        print("Voice intake E2E: all 9 Node cross-stack scenarios passed")
        assert state["provider"] == 7  # 3 spoken languages + transcribe + 3 provider failures
        assert state["posts"] == 8
        assert state["extractions"] == 5  # 3 language flows + 2 in the review flow
        assert closed_uploads and all(closed_uploads)
        assert db.repository.list() == []
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        transcription.transcription_limits = original_limits
        assert not thread.is_alive(), "Temporary integration server must stop"
