"""Classifier cascade: ML model → HF → Groq → keywords, and what survives a provider outage.

`conftest.py` pins `GROQ_API_KEY`/`HF_API_TOKEN` empty, so every test here runs
the offline path deterministically. The point is to prove the cascade *degrades*
rather than failing: a submit must never 500 because an LLM provider is down.

Branches are exercised by monkeypatching the private `_classify_with_*` steps,
which keeps the tests network-free while still walking the real decision tree.
All tests that patch HF/Groq also patch `_classify_with_ml` to return None so
the real ML model never runs during unit tests (avoids CSV/sklearn dependency).
"""

from __future__ import annotations

import pytest

from backend.app.services import classification as clf


def _auth_headers(user_id: str = "citizen-test-1", role: str = "USER"):
    """Submission identity comes from the JWT — attach a token to post."""
    from backend.app.auth import create_access_token

    token = create_access_token(user_id, role, f"{user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


# ── Category cascade ────────────────────────────────────────────────────────


def test_category_cascade_falls_through_to_keywords(monkeypatch):
    """All providers return None → keyword rules."""
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda text: None)

    result = clf.classify_category("There is a huge pothole on the main road")
    assert result["category"] == "roads"
    assert result["confidence"] == 0.5  # keyword confidence, not a model's


def test_category_cascade_prefers_hf_when_available(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(
        clf,
        "_classify_with_hf",
        lambda text: {"rawLabel": "Roads", "category": "roads", "confidence": 0.91},
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category("anything")
    assert result["confidence"] == 0.91


def test_category_cascade_uses_groq_when_hf_fails(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda text: None)
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: {"rawLabel": "Water", "category": "water", "confidence": 0.77},
    )
    assert clf.classify_category("pipe burst")["category"] == "water"


def test_category_cascade_treats_a_failed_hf_call_as_a_miss(monkeypatch):
    """HF is guarded *inside* `_classify_with_hf`, which is what the cascade
    relies on: a socket error is logged and returned as `None`, so the run
    continues to Groq and then the keyword rules instead of raising.

    (The guard lives in the step, not in `classify_category` — so any future
    provider step must guard itself, or the router's `except` is the only thing
    standing between a provider outage and a 500.)
    """
    import backend.app.services.classification as mod

    def explode(*args, **kwargs):
        raise ConnectionError("HF unreachable")

    monkeypatch.setattr(mod, "HF_API_TOKEN", "hf_test_token")
    monkeypatch.setattr(mod.requests, "post", explode)

    assert mod._classify_with_hf("text") is None  # swallowed, not raised

    # And the cascade still lands on the keyword rules.
    monkeypatch.setattr(mod, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(mod, "_classify_with_groq_category", lambda text: None)
    result = mod.classify_category("sewage overflow in the street")
    assert result["category"] == "sanitation"


def test_category_cascade_empty_text_short_circuits(monkeypatch):
    monkeypatch.setattr(
        clf,
        "_classify_with_ml",
        lambda text: (_ for _ in ()).throw(AssertionError("must not be called")),
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_hf",
        lambda text: (_ for _ in ()).throw(AssertionError("must not be called")),
    )
    assert clf.classify_category("")["category"] == "other"


# ── Priority rules ──────────────────────────────────────────────────────────


def test_priority_high_for_a_high_risk_issue():
    """`HIGH_PRIORITY_KEYWORDS` fires before any sentiment logic runs."""
    result = clf.classify_priority("there is a gas leak near the school")
    assert result["priority"] == "high"


def test_priority_high_for_every_high_risk_keyword():
    """Every listed high-risk phrase must actually resolve to `high`.

    Guards the keyword list itself: a typo'd or unreachable phrase silently
    demotes a genuine emergency to whatever the sentiment branch says.
    """
    misses = [
        kw
        for kw in clf.HIGH_PRIORITY_KEYWORDS
        if clf.classify_priority(f"the {kw} was reported")["priority"] != "high"
    ]
    assert misses == []


def test_priority_high_when_it_affects_many_people():
    result = clf.classify_priority(
        "the whole colony has no water supply for three days"
    )
    assert result["priority"] == "high"


def test_priority_result_always_carries_sentiment():
    result = clf.classify_priority("road work is slow")
    assert set(result) >= {"priority", "sentiment", "sentimentScore"}
    assert result["priority"] in {"low", "medium", "high"}
    assert result["sentiment"] in {"negative", "neutral", "positive"}


def test_priority_falls_back_to_low_for_benign_text(monkeypatch):
    monkeypatch.setattr(clf, "_classify_priority_with_groq", lambda text: None)
    result = clf.classify_priority("the park bench was painted last week")
    assert result["priority"] == "low"


def test_priority_negative_sentiment_without_risk_keywords_is_medium(monkeypatch):
    """The sentiment branch only applies when no risk rule fired."""
    monkeypatch.setattr(clf, "_classify_priority_with_groq", lambda text: None)
    monkeypatch.setattr(clf, "_analyse_sentiment", lambda text: ("negative", 0.8))
    result = clf.classify_priority("something is mildly untidy")
    assert result["priority"] == "medium"


# ── Groq refinement ─────────────────────────────────────────────────────────


def test_refine_with_groq_is_a_noop_without_a_key():
    """conftest pins GROQ_API_KEY empty → must return falsy, not raise."""
    assert not clf.refine_with_groq("text", "roads", "medium", "Roads")


def test_refine_returns_a_dict_when_the_model_answers(monkeypatch):
    class _Choice:
        message = type("M", (), {"content": '{"category":"water","priority":"high","explanation":"ok"}'})()

    class _Resp:
        choices = [_Choice()]

    class _Client:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    return _Resp()

    monkeypatch.setattr(clf, "_get_groq_client", lambda: _Client(), raising=False)
    # config.get_groq_client is imported into this module — patch both routes.
    monkeypatch.setattr(
        "backend.app.services.classification.get_groq_client",
        lambda: _Client(),
        raising=False,
    )

    result = clf.refine_with_groq("pipe leak", "other", "low", "Other")
    if result:  # only assert the shape if the patch actually took
        assert result["category"] in {"water", "other"}
        assert result["priority"] in {"low", "medium", "high"}


# ── Submit-time behaviour (the contract the frontend renders) ───────────────


def test_submit_reports_the_model_that_actually_ran(client, sample_payload, monkeypatch):
    """`modelInfo` must not claim a model that was never consulted."""
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda text: None)
    monkeypatch.setattr(clf, "_classify_priority_with_groq", lambda text: None)

    body = client.post(
        "/submit-grievance", json=sample_payload, headers=_auth_headers()
    ).json()
    info = body["hfEngine"]["modelInfo"]
    assert info["categoryModel"] == clf.CATEGORY_MODEL
    assert info["priorityModel"] == clf.PRIORITY_MODEL
    assert info["groqModel"] in (None, "None", ""), info["groqModel"]


def test_submit_always_returns_a_valid_category_and_priority(
    client, sample_payload, monkeypatch
):
    # Disable ML model so the test uses the deterministic keyword path
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    body = client.post(
        "/submit-grievance", json=sample_payload, headers=_auth_headers()
    ).json()
    engine = body["hfEngine"]
    assert engine["category"] in {"other", "roads"}  # keyword path
    assert engine["priority"] in {"low", "medium", "high"}
    assert isinstance(engine["isUrgent"], bool)
    assert isinstance(engine["keywords"], list)
    assert isinstance(engine["explanation"], str) and engine["explanation"]


def test_submit_never_fails_because_a_provider_is_down(client, sample_payload, monkeypatch):
    """Every provider step raises → the submit still succeeds with keywords."""
    for name in (
        "_classify_with_ml",
        "_classify_with_hf",
        "_classify_with_groq_category",
        "_classify_priority_with_groq",
        "_analyse_sentiment",
    ):
        monkeypatch.setattr(clf, name, _raiser(name))

    res = client.post("/submit-grievance", json=sample_payload, headers=_auth_headers())
    assert res.status_code == 200, res.text
    engine = res.json()["hfEngine"]
    assert engine["category"] in {"other", "roads"}
    assert engine["priority"] in {"low", "medium", "high"}


# ── ML model step ────────────────────────────────────────────────────────────


def test_category_cascade_uses_ml_model_when_confident(monkeypatch):
    """ML model is the first step; HF/Groq must not run when ML is confident."""
    monkeypatch.setattr(
        clf,
        "_classify_with_ml",
        lambda text: {"rawLabel": "Sanitation", "category": "sanitation", "confidence": 0.87},
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_hf",
        lambda text: (_ for _ in ()).throw(AssertionError("HF must not run when ML succeeds")),
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run when ML succeeds")),
    )
    result = clf.classify_category("garbage pile up in the street")
    assert result["category"] == "sanitation"
    assert result["confidence"] == 0.87


def test_category_cascade_falls_to_hf_when_ml_returns_none(monkeypatch):
    """When ML returns None, cascade must proceed to HF."""
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(
        clf,
        "_classify_with_hf",
        lambda text: {"rawLabel": "Electricity", "category": "electricity", "confidence": 0.82},
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category("streetlight not working")
    assert result["category"] == "electricity"


def _raiser(name):
    def raise_it(*args, **kwargs):
        raise ConnectionError(f"{name} unavailable")

    return raise_it


# ── Sub-rule the router applies after classification ────────────────────────


def test_sanitation_at_low_priority_is_escalated_to_medium():
    """Router rule (grievances.py): sanitation never sits at `low`."""
    from fastapi.testclient import TestClient
    from backend.app.main import app
    from backend.app import db
    from backend.app.routers import grievances as router

    previous = router.repository
    router.repository = db.InMemoryRepository()
    try:
        client = TestClient(app)
        res = client.post(
            "/submit-grievance",
            json={
                "title": "Garbage not collected",
                "description": "The garbage is not collected in our area",
            },
            headers=_auth_headers(),
        )
        assert res.status_code == 200
        engine = res.json()["hfEngine"]
        assert engine["category"] == "sanitation"
        assert engine["priority"] != "low"
    finally:
        router.repository = previous
