"""Real app integration with mock-only Sarvam transport; no paid calls."""

import asyncio
import io
import wave

import httpx
import pytest

from backend.app import config
from backend.app.auth import create_access_token
from backend.app.routers import transcription as route
from backend.app.services import sarvam
from backend.app.services.transcription_limits import TranscriptionLimits
from backend.app.transcription_guard import TranscriptionGuard


def wav_bytes(frames=160):
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        wav.writeframes(b"\0\0" * frames)
    return out.getvalue()


@pytest.fixture(autouse=True)
def mock_sarvam(monkeypatch):
    monkeypatch.setattr(config, "TRANSCRIPTION_ENABLED", True)
    # Synthetic placeholder, never read the operator's key into fixtures.
    monkeypatch.setattr(config, "SARVAM_API_KEY", "mock-only")
    monkeypatch.setattr(config, "SARVAM_STT_MODEL", "saaras:v4")
    monkeypatch.setattr(route, "transcription_limits", TranscriptionLimits())
    calls = []
    state = {"body": {"transcript": "A water supply complaint", "language_code": "en-IN", "request_id": "mock-id"}, "status": 200}
    def handler(request):
        calls.append(request)
        if "exception" in state:
            raise state["exception"]
        if "raw" in state:
            return httpx.Response(state["status"], content=state["raw"])
        return httpx.Response(state["status"], json=state["body"])
    clients = []
    def make_client():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        clients.append(client)
        return client
    monkeypatch.setattr(sarvam, "make_client", make_client)
    return state, calls, clients


def headers(user="voice-user", key=None):
    result = {"Authorization": "Bearer " + create_access_token(user, "USER")}
    if key:
        result["Idempotency-Key"] = key
    return result


def upload(client, audio=None, language="en-IN", auth=None):
    return client.post("/transcribe", headers=headers() if auth is None else auth,
                       data={"language_code": language},
                       files={"file": ("recording.wav", wav_bytes() if audio is None else audio, "audio/wav")})


@pytest.mark.parametrize("enabled", [True, False])
def test_voice_cors_preflight(client, mock_sarvam, monkeypatch, enabled):
    monkeypatch.setattr(config, "TRANSCRIPTION_ENABLED", enabled)
    response = client.options("/transcribe", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,idempotency-key,content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert not mock_sarvam[1]


def test_voice_cors_rejects_unlisted_preflight(client, mock_sarvam):
    response = client.options("/transcribe", headers={
        "Origin": "http://unlisted.invalid", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,idempotency-key",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    assert not mock_sarvam[1]


@pytest.mark.parametrize("case,status", [("success", 200), ("disabled", 503), ("auth", 401), ("invalid", 415), ("oversize", 413)])
def test_voice_cors_headers_on_success_and_errors(client, mock_sarvam, monkeypatch, case, status):
    monkeypatch.setattr(config, "TRANSCRIPTION_ENABLED", case != "disabled")
    auth = {"Origin": "http://localhost:3000"}
    if case != "auth":
        auth.update(headers())
    audio = b"not WAV" if case == "invalid" else b"x" * 2097153 if case == "oversize" else wav_bytes()
    response = upload(client, audio=audio, auth=auth)
    assert response.status_code == status
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "origin" in response.headers["vary"].lower()
    assert len(mock_sarvam[1]) == (1 if case == "success" else 0)


@pytest.mark.parametrize("language,text", [("en-IN", "There is no water supply."), ("hi-IN", "पानी की आपूर्ति बंद है।"), ("mr-IN", "पाणीपुरवठा बंद आहे.")])
def test_transcript_preserved(client, mock_sarvam, language, text, caplog):
    state, calls, clients = mock_sarvam
    state["body"].update(transcript=text, language_code=language)
    response = upload(client, language=language)
    assert response.status_code == 200
    assert response.json() == state["body"]
    assert len(calls) == 1
    request = calls[0]
    assert str(request.url) == sarvam.SARVAM_STT_URL
    assert request.headers["api-subscription-key"] == "mock-only"
    assert b"saaras:v4" in request.content and b"transcribe" in request.content
    assert b"recording.wav" in request.content
    assert all(c.is_closed for c in clients)
    assert text not in caplog.text and "mock-only" not in caplog.text


@pytest.mark.parametrize("auth", [{}, {"Authorization": "Bearer invalid"}])
def test_auth_required(client, mock_sarvam, auth):
    assert upload(client, auth=auth).status_code == 401
    assert not mock_sarvam[1]


@pytest.mark.parametrize("setting,value", [("TRANSCRIPTION_ENABLED", False), ("SARVAM_API_KEY", "")])
def test_unavailable_configuration(client, mock_sarvam, monkeypatch, setting, value):
    monkeypatch.setattr(config, setting, value)
    response = upload(client)
    assert response.status_code == 503
    assert set(response.json()) == {"error"}
    assert not mock_sarvam[1]


@pytest.mark.parametrize("audio,status", [(b"", 400), (b"webm", 415), (wav_bytes()[:-1], 400), (b"x" * (1048576 + 1), 413), (wav_bytes(480001), 400)], ids=["empty", "webm", "truncated", "oversized", "over-duration"])
def test_bad_audio_rejected(client, mock_sarvam, audio, status):
    assert upload(client, audio=audio).status_code == status
    assert not mock_sarvam[1]


def test_exact_30_seconds(client):
    assert upload(client, wav_bytes(480000)).status_code == 200


@pytest.mark.parametrize("language", ["", "unknown", "ta-IN"])
def test_invalid_language(client, mock_sarvam, language):
    assert upload(client, language=language).status_code == 400
    assert not mock_sarvam[1]


def test_missing_and_extra_fields(client, mock_sarvam):
    assert client.post("/transcribe", headers=headers(), json={}).status_code == 400
    assert client.post("/transcribe", headers=headers(), files={"file": ("x.wav", wav_bytes())}).status_code == 400
    assert client.post("/transcribe", headers=headers(), data={"language_code": "en-IN", "extra": "x"}, files={"file": ("x.wav", wav_bytes())}).status_code == 400
    assert not mock_sarvam[1]


def test_body_size_guard(client, mock_sarvam):
    assert upload(client, b"x" * 2097153).status_code == 413
    assert not mock_sarvam[1]


def test_streamed_body_guard_without_length():
    called = []
    messages = iter([{"type": "http.request", "body": b"x" * 1048576, "more_body": True}] * 3)
    async def app(*args):
        called.append(True)
    async def receive():
        return next(messages)
    sent = []
    async def send(message):
        sent.append(message)
    asyncio.run(TranscriptionGuard(app)({"type": "http", "method": "POST", "path": "/transcribe", "headers": []}, receive, send))
    assert not called
    assert sent[0]["status"] == 413


def test_idempotent_replay_and_conflict(client, mock_sarvam):
    auth = headers(key="same-recording")
    first = upload(client, auth=auth)
    assert upload(client, auth=auth).json() == first.json()
    assert upload(client, language="hi-IN", auth=auth).status_code == 409
    assert len(mock_sarvam[1]) == 1


@pytest.mark.parametrize("status", [402, 403, 429, 500, 503, 422, 302])
def test_provider_errors_safe_and_no_retry(client, mock_sarvam, status, caplog):
    state, calls, clients = mock_sarvam
    state.update(status=status, body={"error": "sensitive provider details"})
    auth = headers(key="failure")
    response = upload(client, auth=auth)
    assert response.status_code == (503 if status in (402, 403, 429) else 502)
    assert "sensitive" not in response.text + caplog.text
    assert upload(client, auth=auth).status_code == 409
    assert len(calls) == 1
    assert all(c.is_closed for c in clients)
    assert not route.transcription_limits._attempts[("voice-user", "failure")].active


def test_timeout_cleanup(client, mock_sarvam):
    state, calls, clients = mock_sarvam
    state["exception"] = httpx.ReadTimeout("sensitive detail")
    assert upload(client).status_code == 504
    assert len(calls) == 1 and all(c.is_closed for c in clients)


@pytest.mark.parametrize("body", [{}, {"transcript": None}, {"transcript": 123}, {"transcript": " "}, {"transcript": "x", "language_code": []}, []])
def test_invalid_provider_response(client, mock_sarvam, body):
    mock_sarvam[0]["body"] = body
    assert upload(client).status_code == 502


def test_invalid_json_and_large_provider_response(client, mock_sarvam):
    mock_sarvam[0]["raw"] = b"not json"
    assert upload(client).status_code == 502
    mock_sarvam[0]["raw"] = b"x" * 65537
    assert upload(client).status_code == 502


def test_file_closed_after_provider_failure(client, mock_sarvam, monkeypatch):
    from starlette.datastructures import UploadFile
    closed = []
    original = UploadFile.close
    async def close(self):
        await original(self)
        closed.append(self.file.closed)
    monkeypatch.setattr(UploadFile, "close", close)
    mock_sarvam[0]["status"] = 500
    assert upload(client).status_code == 502
    assert closed and all(closed)


def test_pending_token_cannot_transcribe(client, mock_sarvam):
    from backend.app.auth import create_pending_token
    auth = {"Authorization": "Bearer " + create_pending_token("voice-user", "USER")}
    assert upload(client, auth=auth).status_code == 401
    assert not mock_sarvam[1]


def test_endpoint_throttle_rejects_before_provider(client, mock_sarvam):
    for _ in range(3):
        assert upload(client).status_code == 200
    response = upload(client)
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    assert len(mock_sarvam[1]) == 3


def test_global_budget_counts_provider_failure(client, mock_sarvam, monkeypatch):
    monkeypatch.setattr(config, "TRANSCRIPTION_GLOBAL_ATTEMPT_LIMIT", 1)
    mock_sarvam[0]["status"] = 500
    assert upload(client).status_code == 502
    assert upload(client, auth=headers("other-user")).status_code == 503
    assert len(mock_sarvam[1]) == 1


def test_duplicate_fields_and_invalid_key(client, mock_sarvam):
    response = client.post("/transcribe", headers=headers(), files=[
        ("file", ("x.wav", wav_bytes(), "audio/wav")),
        ("language_code", (None, "en-IN")),
        ("language_code", (None, "mr-IN")),
    ])
    assert response.status_code == 400
    assert upload(client, auth=headers(key="bad key")).status_code == 400
    assert not mock_sarvam[1]


def test_network_failure_cleanup(client, mock_sarvam):
    mock_sarvam[0]["exception"] = httpx.ConnectError("private error")
    response = upload(client)
    assert response.status_code == 502 and "private" not in response.text
    assert all(c.is_closed for c in mock_sarvam[2])


def test_upload_deadline(monkeypatch):
    monkeypatch.setattr(config, "TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS", 0.01)
    sent = []
    async def app(*args):
        pytest.fail("Timed out body must not reach parser")
    async def receive():
        await asyncio.sleep(0.1)
    async def send(message):
        sent.append(message)
    asyncio.run(TranscriptionGuard(app)({"type": "http", "method": "POST", "path": "/transcribe", "headers": []}, receive, send))
    assert sent[0]["status"] == 408


def test_cancelled_provider_releases_reservation(monkeypatch):
    # Endpoint cancellation is tested through a lightweight Request double:
    # it must release attempts even for BaseException, not just HTTP errors.
    from starlette.datastructures import FormData, UploadFile
    upload_file = UploadFile(io.BytesIO(wav_bytes()), filename="recording.wav")
    class FormContext:
        async def __aenter__(self):
            return FormData({"file": upload_file, "language_code": "en-IN"})
        async def __aexit__(self, *args):
            await upload_file.close()
    class FakeRequest:
        headers = {"content-type": "multipart/form-data", "idempotency-key": "cancelled"}
        def form(self, **kwargs):
            return FormContext()
    async def cancelled(*args):
        raise asyncio.CancelledError()
    monkeypatch.setattr(sarvam, "transcribe", cancelled)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(route.transcribe(FakeRequest(), {"user_id": "voice-user"}))
    assert upload_file.file.closed
    assert not route.transcription_limits._attempts[("voice-user", "cancelled")].active


def test_concurrent_endpoint_calls(app, monkeypatch):
    async def scenario():
        entered = asyncio.Queue()
        release = asyncio.Event()
        async def delayed_provider(audio, language):
            entered.put_nowait(True)
            await release.wait()
            return {"transcript": "mock result", "language_code": language}
        monkeypatch.setattr(sarvam, "transcribe", delayed_provider)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            async def send(user, key):
                return await client.post("/transcribe", headers=headers(user, key),
                                         data={"language_code": "en-IN"},
                                         files={"file": ("x.wav", wav_bytes(), "audio/wav")})
            first = asyncio.create_task(send("a", "first"))
            await asyncio.wait_for(entered.get(), 2)
            assert (await send("a", "first")).status_code == 409
            assert (await send("a", "second")).status_code == 429
            second = asyncio.create_task(send("b", "first"))
            await asyncio.wait_for(entered.get(), 2)
            assert (await send("c", "first")).status_code == 429
            release.set()
            responses = await asyncio.gather(first, second)
            assert all(r.status_code == 200 for r in responses)
    asyncio.run(scenario())


def test_invalid_deep_json_is_sanitized(client, mock_sarvam):
    mock_sarvam[0]["raw"] = b"[" * 2000 + b"0" + b"]" * 2000
    assert upload(client).status_code == 502


def test_transcription_does_not_create_grievance(client):
    from backend.app.db import repository
    assert repository.list() == []
    assert upload(client).status_code == 200
    assert repository.list() == []


def test_openapi_documents_multipart(app):
    operation = app.openapi()["paths"]["/transcribe"]["post"]
    fields = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
    assert fields["required"] == ["file", "language_code"]
    assert operation["security"]
