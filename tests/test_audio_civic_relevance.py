"""Offline regression suite for civic relevance validation on audio complaints.

Verifies that manual and audio complaints share the exact same civic relevance
gate before any grievance creation, reference ID generation, department
assignment, notifications, or other grievance side effects.
"""

from __future__ import annotations

import io
import json
import wave

import httpx
import pytest

from backend.app import config
from backend.app.auth import create_access_token
from backend.app.routers import grievances as grievance_router
from backend.app.routers import transcription as transcription_route
from backend.app.services import classification, grievance_intake, sarvam
from backend.app.services.transcription_limits import TranscriptionLimits


def _auth_headers(user: str = "audio-citizen", role: str = "USER") -> dict[str, str]:
    token = create_access_token(user, role, f"{user}@example.com")
    return {"Authorization": f"Bearer {token}"}


def _wav_bytes(frames: int = 160) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        wav.writeframes(b"\0\0" * frames)
    return out.getvalue()


@pytest.fixture
def mock_stt(monkeypatch):
    """Mock Sarvam STT provider for offline execution."""
    monkeypatch.setattr(config, "TRANSCRIPTION_ENABLED", True)
    monkeypatch.setattr(config, "SARVAM_API_KEY", "mock-key")
    monkeypatch.setattr(config, "SARVAM_STT_MODEL", "saaras:v4")
    monkeypatch.setattr(transcription_route, "transcription_limits", TranscriptionLimits())

    state = {
        "status": 200,
        "body": {
            "transcript": "There are potholes on my street.",
            "language_code": "en-IN",
            "request_id": "req-mock-1",
        },
    }

    def handler(request):
        if "exception" in state:
            raise state["exception"]
        return httpx.Response(state["status"], json=state["body"])

    monkeypatch.setattr(sarvam, "make_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return state


# 1. Audio transcribes to "Tell me a joke" -> rejected; no grievance created.
def test_audio_transcribes_to_joke_rejected(client, mock_stt, monkeypatch):
    mock_stt["body"]["transcript"] = "Tell me a joke"

    trans_res = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert trans_res.status_code == 200
    transcript = trans_res.json()["transcript"]
    assert transcript == "Tell me a joke"

    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [transcript], "language": "en-IN"},
    )
    assert intake_res.status_code == 422
    assert "public service or civic issue" in intake_res.json()["error"]

    assert grievance_router.repository.list() == []
    assert client.get("/notifications", headers=_auth_headers()).json() == []


# 2. Audio transcribes to "What is 1+2?" -> rejected; no grievance created.
@pytest.mark.parametrize("math_text", ["What is 1+2?", "What is one plus two?"])
def test_audio_transcribes_to_math_rejected(client, mock_stt, math_text):
    mock_stt["body"]["transcript"] = math_text

    trans_res = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert trans_res.status_code == 200
    transcript = trans_res.json()["transcript"]

    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [transcript], "language": "en-IN"},
    )
    assert intake_res.status_code == 422
    assert "public service or civic issue" in intake_res.json()["error"]

    assert grievance_router.repository.list() == []
    assert client.get("/notifications", headers=_auth_headers()).json() == []


# 3. Audio transcribes to a valid road complaint -> accepted.
def test_audio_transcribes_to_valid_road_complaint_accepted(client, mock_stt, monkeypatch):
    road_text = "There are deep potholes on my street damaging vehicles."
    mock_stt["body"]["transcript"] = road_text

    monkeypatch.setattr(
        grievance_intake,
        "_call_llm",
        lambda _p: json.dumps({
            "title": "Deep potholes on street",
            "description": road_text,
            "category": "roads",
            "priority": "medium",
            "location_text": "MG Road",
            "question_kind": None,
        }),
    )

    trans_res = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert trans_res.status_code == 200

    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [road_text], "language": "en-IN"},
    )
    assert intake_res.status_code == 200
    fields = intake_res.json()
    assert fields["title"] == "Deep potholes on street"

    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={
            "title": fields["title"],
            "description": fields["description"],
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )
    assert sub_res.status_code == 200
    body = sub_res.json()
    assert body["grievanceId"].startswith("GRV-")

    stored = grievance_router.repository.get(body["grievanceId"])
    assert stored is not None
    assert stored["state"] == "PENDING_ASSIGNMENT"
    assert stored["category"] == "roads"


# 4. Audio transcribes to a valid Hindi/Hinglish water complaint -> accepted.
def test_audio_transcribes_to_hindi_water_complaint_accepted(client, mock_stt, monkeypatch):
    hindi_text = "Paani ki supply nahi aa rahi hai teen din se."
    mock_stt["body"]["transcript"] = hindi_text
    mock_stt["body"]["language_code"] = "hi-IN"

    monkeypatch.setattr(
        grievance_intake,
        "_call_llm",
        lambda _p: json.dumps({
            "title": "पानी की समस्या",
            "description": hindi_text,
            "category": "water",
            "priority": "high",
            "location_text": "वार्ड 12",
            "question_kind": None,
        }),
    )

    trans_res = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "hi-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert trans_res.status_code == 200

    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [hindi_text], "language": "hi-IN"},
    )
    assert intake_res.status_code == 200
    fields = intake_res.json()

    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={
            "title": fields["title"],
            "description": fields["description"],
            "latitude": 28.6139,
            "longitude": 77.2090,
        },
    )
    assert sub_res.status_code == 200
    body = sub_res.json()
    assert body["grievanceId"].startswith("GRV-")

    stored = grievance_router.repository.get(body["grievanceId"])
    assert stored is not None
    assert stored["category"] == "water"


# 5. Empty transcription -> recoverable validation error; no grievance created.
def test_empty_transcription_recoverable_error(client, mock_stt):
    # Empty audio payload
    res = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert res.status_code == 400
    assert "empty" in res.json()["error"].lower()

    # Empty utterances list to intake
    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [], "language": "en-IN"},
    )
    assert intake_res.status_code == 400

    # Utterance with no letters (punctuation or numbers only)
    symbol_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": ["... ??? !!! 123"], "language": "en-IN"},
    )
    assert symbol_res.status_code == 400
    assert "punctuation or symbols alone are not enough" in symbol_res.json()["error"]

    assert grievance_router.repository.list() == []


# 6. Transcription provider timeout/failure -> controlled error; no grievance created.
def test_transcription_provider_failure_controlled_error(client, mock_stt):
    # Timeout
    mock_stt["exception"] = TimeoutError("Sarvam timed out")
    res_timeout = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert res_timeout.status_code == 504
    assert "timed out" in res_timeout.json()["error"].lower()

    # Provider 500 error
    del mock_stt["exception"]
    mock_stt["status"] = 500
    mock_stt["body"] = {"error": "Internal server error"}
    res_fail = client.post(
        "/transcribe",
        headers=_auth_headers(),
        data={"language_code": "en-IN"},
        files={"file": ("speech.wav", _wav_bytes(), "audio/wav")},
    )
    assert res_fail.status_code == 502
    assert "failed" in res_fail.json()["error"].lower()

    assert grievance_router.repository.list() == []


# 7. Unclear but plausible civic complaint -> follows the documented uncertainty policy.
def test_unclear_plausible_civic_complaint_enters_review(client, monkeypatch):
    ambiguous_text = "The municipal office is not responding to our requests."

    monkeypatch.setattr(
        grievance_intake,
        "_call_llm",
        lambda _p: json.dumps({
            "title": "Office not responding",
            "description": ambiguous_text,
            "category": "governance",
            "priority": "low",
            "location_text": None,
            "question_kind": None,
        }),
    )

    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [ambiguous_text], "language": "en-IN"},
    )
    assert intake_res.status_code == 200

    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={
            "title": "Office not responding",
            "description": ambiguous_text,
            "latitude": 19.0760,
            "longitude": 72.8777,
        },
    )
    assert sub_res.status_code == 200
    body = sub_res.json()
    assert body["grievanceId"].startswith("GRV-")

    stored = grievance_router.repository.get(body["grievanceId"])
    assert stored is not None
    assert stored["state"] == "PENDING_ASSIGNMENT"


# 8. Edited transcript changes from irrelevant to civic -> final text is revalidated.
def test_edited_transcript_irrelevant_to_civic_accepted(client):
    # User's initial transcript was irrelevant
    assert classification.is_clearly_out_of_scope("Tell me a joke")

    # User edits it in the form before submission to a valid civic complaint
    edited_title = "Overflowing garbage bin"
    edited_description = "The garbage bin near our gate has been overflowing for five days."

    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={
            "title": edited_title,
            "description": edited_description,
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )
    assert sub_res.status_code == 200
    body = sub_res.json()
    assert body["grievanceId"].startswith("GRV-")

    stored = grievance_router.repository.get(body["grievanceId"])
    assert stored is not None
    assert stored["category"] == "sanitation"


# 9. Edited transcript changes from civic to irrelevant -> final text is rejected.
def test_edited_transcript_civic_to_irrelevant_rejected(client):
    # User edits draft to an irrelevant joke request
    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={
            "title": "Tell me a joke",
            "description": "Tell me a funny joke.",
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )
    assert sub_res.status_code == 422
    assert "public service or civic issue" in sub_res.json()["error"]

    assert grievance_router.repository.list() == []
    assert client.get("/notifications", headers=_auth_headers()).json() == []


# 10. Direct requests to any audio-related grievance creation endpoint cannot bypass the gate.
@pytest.mark.parametrize(
    "utterance",
    [
        "Tell me a joke",
        "What is 1+2?",
        "Who won yesterday's football match?",
        "Write a poem about nature",
        "asdfghjkl",
        "efjbrjsfbjrfbr wefu,eafnwoifjrgml.gemreklgmkreag",
        "Teach me Python. Explain Python loops with examples.",
    ],
)
def test_direct_requests_cannot_bypass_relevance_gate(client, utterance):
    # Direct call to voice intake extract
    intake_res = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers(),
        json={"utterances": [utterance], "language": "en-IN"},
    )
    assert intake_res.status_code == 422
    assert "public service or civic issue" in intake_res.json()["error"]

    # Direct call to submit grievance
    sub_res = client.post(
        "/submit-grievance",
        headers=_auth_headers(),
        json={"title": utterance[:50], "description": utterance},
    )
    assert sub_res.status_code == 422
    assert "public service or civic issue" in sub_res.json()["error"]

    assert grievance_router.repository.list() == []


# 11. Existing manual submission and audio submission tests remain compatible.
def test_manual_and_audio_compatibility(client, monkeypatch):
    monkeypatch.setattr(classification, "_get_ml_model", lambda: None)

    # Valid manual submission succeeds
    manual_res = client.post(
        "/submit-grievance",
        headers=_auth_headers("manual-user"),
        json={"title": "Streetlight broken", "description": "Streetlight on 2nd cross has been dark."},
    )
    assert manual_res.status_code == 200
    assert manual_res.json()["grievanceId"].startswith("GRV-")

    # Irrelevant manual submission rejected with identical 422 message
    manual_reject = client.post(
        "/submit-grievance",
        headers=_auth_headers("manual-user"),
        json={"title": "Joke", "description": "Tell me a joke."},
    )
    assert manual_reject.status_code == 422
    assert "public service or civic issue" in manual_reject.json()["error"]

    # Irrelevant audio intake rejected with identical 422 message
    audio_reject = client.post(
        "/grievance-intake/extract",
        headers=_auth_headers("audio-user"),
        json={"utterances": ["Tell me a joke."], "language": "en-IN"},
    )
    assert audio_reject.status_code == 422
    assert audio_reject.json()["error"] == manual_reject.json()["error"]
