"""POST /grievance-intake/extract — auth, validation, normalization, failures.

The real LLM is never called: conftest pins ``GROQ_API_KEY=""`` (so the
unconfigured path is exercised for real), and every other test monkeypatches
``grievance_intake._call_llm`` or the Groq client factory.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from backend.app.auth import create_access_token
from backend.app.services import grievance_intake

GOOD = "The streetlight outside my house has been dark for three days and it is unsafe at night."


def auth(user="intake-user"):
    return {"Authorization": "Bearer " + create_access_token(user, "USER")}


def body(**overrides):
    payload = {"utterances": [GOOD], "language": "en-IN"}
    payload.update(overrides)
    return payload


def post(client, **overrides):
    return client.post("/grievance-intake/extract", json=body(**overrides), headers=auth())


def stub_llm(monkeypatch, reply):
    """Patch the LLM transport. ``reply`` is a raw string or callable(prompt)."""
    captured = {}

    def fake(prompt):
        captured["prompt"] = prompt
        return reply(prompt) if callable(reply) else reply

    monkeypatch.setattr(grievance_intake, "_call_llm", fake)
    return captured


def stub_client(monkeypatch, exc):
    class Completions:
        def create(self, **kwargs):
            raise exc

    fake = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    monkeypatch.setattr(grievance_intake.config, "get_groq_client", lambda: fake)


# --- Auth -------------------------------------------------------------------

def test_requires_auth(client):
    assert client.post("/grievance-intake/extract", json=body()).status_code == 401


def test_rejects_invalid_token(client):
    response = client.post(
        "/grievance-intake/extract", json=body(),
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert response.status_code == 401


def test_llm_not_configured(client):
    # conftest pins GROQ_API_KEY="" → the real transport reports 503.
    response = post(client)
    assert response.status_code == 503
    assert response.json() == {"error": "Complaint understanding is not configured"}


# --- Extraction and normalization -------------------------------------------

def test_extracts_and_normalizes_fields(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({
        "title": "  Streetlight   dark for three days ",
        "description": "The streetlight outside the house has been dark for three days; it is unsafe at night.",
        "location_text": "Sector 9, Rohini",
        "category": "Streetlight",
        "priority": "HIGH",
        "question_kind": "Landmark",
        "ignored_extra": {"nested": True},
    }))
    response = post(client)
    assert response.status_code == 200
    assert response.json() == {
        "title": "Streetlight dark for three days",
        "description": "The streetlight outside the house has been dark for three days; it is unsafe at night.",
        "location_text": "Sector 9, Rohini",
        "category": "electricity",
        "priority": "high",
        "question_kind": "landmark",
    }


def test_parses_fenced_json_and_keeps_verbatim_description(client, monkeypatch):
    stub_llm(monkeypatch, "Sure!\n```json\n{\"title\": \"Water supply off\", \"category\": \"water\"}\n```")
    data = post(client).json()
    assert data["title"] == "Water supply off"
    assert data["category"] == "water"
    # No description from the model → the citizen's own words are kept.
    assert data["description"] == GOOD


def test_unstated_or_invalid_values_are_dropped(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({
        "title": None,
        "description": "Flickering light near the park.",
        "location_text": None,
        "category": "space program",
        "priority": "urgent",
        "question_kind": None,
    }))
    data = post(client).json()
    assert data["title"] is None
    assert data["location_text"] is None
    assert data["category"] is None
    assert data["priority"] is None
    assert data["question_kind"] is None


def test_non_string_values_are_dropped(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({
        "title": {"a": 1}, "category": ["water"], "priority": 5,
        "location_text": "   ", "question_kind": ["location"],
    }))
    data = post(client).json()
    assert data["title"] is None
    assert data["category"] is None
    assert data["priority"] is None
    assert data["location_text"] is None
    assert data["question_kind"] is None
    assert data["description"] == GOOD


def test_garbage_llm_reply_is_a_502(client, monkeypatch):
    stub_llm(monkeypatch, "not json at all")
    response = post(client)
    assert response.status_code == 502
    assert response.json() == {"error": "Complaint understanding failed"}


def test_overlong_fields_are_truncated_not_rejected(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({
        "title": "T" * 400, "description": "D" * 5000,
        "location_text": "L" * 400,
    }))
    data = post(client).json()
    assert len(data["title"]) == 120
    assert len(data["description"]) == 4000
    assert len(data["location_text"]) == 200


def test_repeated_question_kind_is_dropped(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({"description": GOOD, "question_kind": "location"}))
    data = post(client, asked_questions=["location"]).json()
    assert data["question_kind"] is None


def test_unknown_question_kind_becomes_null(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({"description": GOOD, "question_kind": "what colour is it"}))
    assert post(client).json()["question_kind"] is None


def test_question_kind_aliases_are_normalized(client, monkeypatch):
    for raw, expected in [
        ("Where", "location"), ("how_often", "frequency"),
        ("Date", "when"), ("Safety", "danger"), ("who", "affected"),
    ]:
        stub_llm(monkeypatch, json.dumps({"description": GOOD, "question_kind": raw}))
        assert post(client).json()["question_kind"] == expected


def test_every_declared_question_kind_round_trips(client, monkeypatch):
    for kind in grievance_intake.QUESTION_KINDS:
        stub_llm(monkeypatch, json.dumps({"description": GOOD, "question_kind": kind}))
        assert post(client).json()["question_kind"] == kind


def test_asked_questions_only_accept_kinds(client, monkeypatch):
    captured = stub_llm(monkeypatch, json.dumps({"description": GOOD}))
    post(client, asked_questions=["location", "Where exactly is it?", "details"])
    prompt = captured["prompt"]
    assert "- location" in prompt
    assert "- details" in prompt
    assert "Where exactly is it?" not in prompt


def test_verbatim_description_fallback_joins_utterances(client, monkeypatch):
    stub_llm(monkeypatch, json.dumps({"title": "Light dark"}))
    data = post(client, utterances=[GOOD, "It is next to the water tank."]).json()
    assert data["description"] == GOOD + " It is next to the water tank."


# --- Request validation -----------------------------------------------------

@pytest.mark.parametrize("payload", [
    {"utterances": []},
    {"utterances": ["   ", "\n"]},
    {"utterances": ["x"] * 9},
    {"utterances": ["x" * 1001]},
    {"utterances": ["y" * 2000, "z" * 2001]},
    {"utterances": [GOOD], "language": "fr-FR"},
])
def test_rejects_bad_input_with_400(client, payload):
    response = client.post("/grievance-intake/extract", json=payload, headers=auth())
    assert response.status_code == 400
    assert response.json()["error"]


def test_utterances_must_be_a_list(client):
    response = client.post(
        "/grievance-intake/extract",
        json={"utterances": "hello", "language": "en-IN"}, headers=auth(),
    )
    assert response.status_code == 400


# --- Provider failures ------------------------------------------------------

def test_provider_timeout_maps_to_504(client, monkeypatch):
    stub_client(monkeypatch, TimeoutError("request timed out"))
    assert post(client).status_code == 504


def test_provider_error_maps_to_502(client, monkeypatch):
    stub_client(monkeypatch, RuntimeError("boom"))
    assert post(client).status_code == 502


# --- Prompt plumbing --------------------------------------------------------

def test_prompt_carries_language_draft_and_capped_questions(client, monkeypatch):
    captured = stub_llm(monkeypatch, json.dumps({"description": "पाणी बंद आहे."}))
    post(
        client,
        language="mr-IN",
        utterances=["पाणी बंद आहे.", "शाळेजवळ कचरा आहे."],
        asked_questions=["details", "location", "when", "frequency"],
        draft={"title": "Water issue", "description": "No water since Monday"},
    )
    prompt = captured["prompt"]
    assert "Marathi" in prompt
    assert "पाणी बंद आहे." in prompt
    assert "Water issue" in prompt
    assert "No water since Monday" in prompt
    assert "- details" not in prompt           # only the last 3 kinds are kept
    assert "- location" in prompt
    assert "- when" in prompt
    assert "- frequency" in prompt


def test_prompt_never_asks_the_model_for_free_text_question(client, monkeypatch):
    captured = stub_llm(monkeypatch, json.dumps({"description": GOOD}))
    post(client)
    prompt = captured["prompt"]
    assert "question_kind" in prompt
    assert '"question"' not in prompt
    for kind in grievance_intake.QUESTION_KINDS:
        assert kind in prompt
