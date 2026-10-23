"""Local-first classifier, scoped provider fallbacks, and outage behavior.

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
    assert result["confidence"] == 0.0  # keyword match is not calibrated
    assert result["source"] == "keyword_fallback"


def test_category_cascade_prefers_hf_when_available(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(
        clf,
        "_classify_with_hf",
        lambda text: {
            "rawLabel": "Roads", "category": "roads", "confidence": 0.91,
            "source": "hf_zero_shot",
        },
    )
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category("municipal issue needs review")
    assert result["confidence"] == 0.91
    assert result["categoryConfidenceSemantics"] == "uncalibrated_zero_shot_score"


def test_category_cascade_uses_groq_when_hf_fails(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda text: None)
    monkeypatch.setattr(clf, "infer_category_from_keywords", lambda text: None)
    monkeypatch.setattr(
        clf,
        "_classify_with_groq_category",
        lambda text: {"rawLabel": "Water", "category": "water", "confidence": 0.77},
    )
    result = clf.classify_category("water supply is irregular in my ward")
    assert result["category"] == "water"
    assert result["categoryOutcome"] == "categorized"


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


@pytest.mark.parametrize("text", [
    "what is the answer of 1+2?",
    "asdf qwer zxcv",
    "tell me a joke",
])
def test_clearly_unsupported_text_skips_paid_category_fallbacks(monkeypatch, text):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: None)
    monkeypatch.setattr(
        clf, "_classify_with_hf",
        lambda text: (_ for _ in ()).throw(AssertionError("HF must not run")),
    )
    monkeypatch.setattr(
        clf, "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category(text)
    assert result["category"] == "other"
    assert result["source"] == "scope_gate"
    assert result["confidence"] == 0.0


def test_explicit_math_request_is_rejected_before_local_or_provider_classification(monkeypatch):
    monkeypatch.setattr(
        clf, "_classify_with_ml",
        lambda text: (_ for _ in ()).throw(AssertionError("local model must not run")),
    )
    monkeypatch.setattr(
        clf, "_classify_with_hf",
        lambda text: (_ for _ in ()).throw(AssertionError("HF must not run")),
    )
    monkeypatch.setattr(
        clf, "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category("what is the answer of 1+2?")
    assert result["category"] == "other"
    assert result["source"] == "scope_gate"
    assert result["categoryOutcome"] == "out_of_scope"
    assert result["categoryConfidenceSemantics"] == "unavailable"


def test_no_signal_text_is_uncertain_not_explicitly_out_of_scope(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: None)

    result = clf.classify_category("The date is next week")

    assert result["category"] == "other"
    assert result["categoryOutcome"] == "uncertain"


@pytest.mark.parametrize("text", [
    "%%%% !!!! ???",
    "asdfasdfasdfasdfasdf",
    "The date is next week",
    "Repair please",
    "No watter since yesterdy",
])
def test_weak_or_unrecognized_text_abstains_without_provider_calls(monkeypatch, text):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: (_ for _ in ()).throw(
        AssertionError("unsupported text must not use HF")
    ))
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: (_ for _ in ()).throw(
        AssertionError("unsupported text must not use Groq")
    ))

    result = clf.classify_category(text)

    assert result["category"] == "other"
    assert result["categoryOutcome"] == "uncertain"
    assert result["categoryConfidenceSemantics"] == "unavailable"


def test_water_versus_sanitation_context_selects_sanitation_without_provider(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: None)

    result = clf.classify_category(
        "Sewage is overflowing and stagnant water is spreading near homes"
    )

    assert result["category"] == "sanitation"
    assert result["source"] == "keyword_fallback"


@pytest.mark.parametrize("text", [
    "No drinking water in our neighborhood for two days",
    "Water is leaking from the pipeline into the street",
    "Burst water main flooding the lane",
])
def test_clear_water_complaint_remains_water_without_provider(monkeypatch, text):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: None)

    result = clf.classify_category(text)

    assert result["category"] == "water"
    assert result["categoryOutcome"] == "categorized"


def test_water_mention_in_road_complaint_does_not_override_road(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: None)

    result = clf.classify_category(
        "The road has deep potholes; a water pipe runs nearby but is not leaking"
    )

    assert result["category"] == "roads"


def test_water_provider_result_without_water_issue_evidence_is_rejected(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: None)
    monkeypatch.setattr(clf, "infer_category_from_keywords", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: {
        "rawLabel": "Water", "category": "water", "confidence": 0.99,
        "source": "hf_zero_shot",
    })
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: {
        "rawLabel": "Water", "category": "water", "confidence": 0.0,
        "source": "groq_fallback",
    })

    result = clf.classify_category("Municipal office information is unclear")

    assert result["category"] == "other"
    assert result["categoryOutcome"] == "uncertain"


def test_water_model_result_without_water_issue_evidence_is_rejected(monkeypatch):
    class OverconfidentModel:
        def predict(self, _text):
            return {"category": "water", "confidence": 0.99, "source": "ml_model"}

    monkeypatch.setattr(clf, "_get_ml_model", lambda: OverconfidentModel())
    monkeypatch.setattr(clf, "infer_category_from_keywords", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_hf", lambda _text: None)
    monkeypatch.setattr(clf, "_classify_with_groq_category", lambda _text: None)

    result = clf.classify_category("Municipal office information is unclear")

    assert result["category"] == "other"
    assert result["categoryOutcome"] == "uncertain"


def test_classifier_scores_include_uncalibrated_probability_semantics(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda _text: {
        "category": "roads", "confidence": 0.72, "source": "ml_model",
    })

    result = clf.classify_category("Potholes on the road")

    assert result["categoryOutcome"] == "categorized"
    assert result["categoryConfidenceSemantics"] == "uncalibrated_model_probability"


def test_confident_local_category_skips_hf_and_groq(monkeypatch):
    monkeypatch.setattr(clf, "_classify_with_ml", lambda text: {
        "rawLabel": "Roads", "category": "roads", "confidence": 0.86,
        "source": "ml_model",
    })
    monkeypatch.setattr(
        clf, "_classify_with_hf",
        lambda text: (_ for _ in ()).throw(AssertionError("HF must not run")),
    )
    monkeypatch.setattr(
        clf, "_classify_with_groq_category",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = clf.classify_category("Potholes on the road")
    assert result["category"] == "roads"
    assert result["source"] == "ml_model"


def test_decisive_domain_match_is_accepted_without_fake_probability(monkeypatch):
    class DomainModel:
        def predict(self, text):
            return {
                "category": "water", "confidence": 0.0,
                "source": "domain_override",
            }

    monkeypatch.setattr(clf, "_get_ml_model", lambda: DomainModel())
    result = clf._classify_with_ml("water supply stopped")
    assert result["category"] == "water"
    assert result["confidence"] == 0.0
    assert result["source"] == "domain_override"


def test_groq_category_result_does_not_claim_calibrated_confidence(monkeypatch):
    monkeypatch.setattr(clf, "_groq_complete", lambda *args, **kwargs: '{"category":"water"}')
    result = clf._classify_with_groq_category("municipal infrastructure issue")
    assert result["category"] == "water"
    assert result["confidence"] == 0.0


def test_groq_category_rejects_unsupported_provider_label(monkeypatch):
    monkeypatch.setattr(
        clf, "_groq_complete", lambda *args, **kwargs: '{"category":"water_supply"}'
    )
    assert clf._classify_with_groq_category("water supply is unavailable") is None


def test_legacy_fallback_scope_gate_skips_groq_for_unrelated_text(monkeypatch):
    from backend.app.services import llm_fallback

    class UncertainModel:
        def predict(self, text):
            return {"category": "other", "confidence": 0.2}

    monkeypatch.setattr(
        llm_fallback, "llm_classify",
        lambda text: (_ for _ in ()).throw(AssertionError("Groq must not run")),
    )
    result = llm_fallback.predict_with_fallback(UncertainModel(), "what is 1+2?")
    assert result["category"] == "other"
    assert result["source"] == "scope_gate"


def test_legacy_fallback_delegates_to_shared_cascade(monkeypatch):
    from backend.app.services import llm_fallback
    from backend.app.services import classification

    model = object()
    calls = {}

    def classify(text, *, model, allow_providers=True):
        calls.update(text=text, model=model, allow_providers=allow_providers)
        return {
            "category": "other", "confidence": 0.0, "source": "uncertain",
            "categoryOutcome": "uncertain",
            "categoryConfidenceSemantics": "unavailable",
        }

    monkeypatch.setattr(classification, "classify_category", classify)
    result = llm_fallback.predict_with_fallback(
        model, "Municipal infrastructure concern"
    )
    assert calls == {
        "text": "Municipal infrastructure concern",
        "model": model,
        "allow_providers": True,
    }
    assert result["category"] == "other"
    assert result["priority"] == "Medium"
    assert result["confidence"] == 0.0
    assert result["categoryOutcome"] == "uncertain"


def test_notebook_uses_grouped_four_model_validation_without_holdout_tuning():
    import json
    from pathlib import Path

    notebook = (
        Path(__file__).resolve().parents[1]
        / "notebooks"
        / "grievance_ml_experiments.ipynb"
    )
    cells = json.loads(notebook.read_text(encoding="utf-8"))["cells"]
    code = "\n".join(
        "".join(cell["source"])
        for cell in cells
        if cell["cell_type"] == "code"
    )

    assert "SEED = 20261023" in code
    assert "StratifiedGroupKFold" in code
    assert "similarity_group" in code
    assert "GridSearchCV" in code
    assert "SVC(kernel='linear'" in code
    assert "LogisticRegression" in code
    assert "MultinomialNB" in code
    assert "RandomForestClassifier" in code
    assert "validation_predictions" in code
    assert "grievance_holdout_test_120.csv" in code
    assert "holdout = pd.read_csv(HOLDOUT_PATH)" in code
    assert "Independent final holdout evaluation: PENDING." in code
    for cell in cells:
        if cell["cell_type"] == "code":
            compile("".join(cell["source"]), str(notebook), "exec")

def test_serving_model_loads_configured_artifact_without_training(monkeypatch, tmp_path):
    from backend.app.services import classification as classification_service
    from backend.app.services import grievance_model as model_module

    calls = {}
    artifact_path = tmp_path / "model.joblib"

    class StubModel:
        is_trained = False

        @classmethod
        def load_artifact(cls, path):
            calls["path"] = path
            model = cls()
            model.is_trained = True
            return model

        def train(self, **kwargs):
            raise AssertionError("The serving loader must not train")

    monkeypatch.setenv("GRIEVANCE_MODEL_ARTIFACT", str(artifact_path))
    monkeypatch.setattr(model_module, "GrievanceModel", StubModel)
    monkeypatch.setattr(classification_service, "_ml_model", None)

    model = classification_service._get_ml_model()

    assert isinstance(model, StubModel)
    assert calls == {"path": artifact_path}


def test_checked_in_candidate_artifact_loads_and_predicts():
    from pathlib import Path
    from backend.app.services.grievance_model import GrievanceModel

    artifact = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "models"
        / "grievance_classifier_synthetic_research_simple_candidate_20261024.joblib"
    )
    model = GrievanceModel.load_artifact(artifact)
    result = model.predict("Electricity power outage in the ward")

    assert model.is_trained
    assert set(model.clf.classes_) == {
        "Electricity", "Health", "Other", "Road", "Sanitation", "Transport", "Water"
    }
    assert result["category"] == "electricity"
    assert result["source"] == "domain_override"
    assert result["confidence"] == 0.0


def test_loaded_artifact_empty_and_malformed_text_remains_reviewable():
    from pathlib import Path
    from backend.app.services.grievance_model import GrievanceModel

    artifact = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "models"
        / "grievance_classifier_synthetic_research_simple_candidate_20261024.joblib"
    )
    model = GrievanceModel.load_artifact(artifact)
    empty = model.predict("")
    malformed = model.predict(None)

    assert empty["category"] == "other"
    assert malformed["category"] == "other"
    assert 0.0 <= empty["confidence"] <= 1.0
    assert 0.0 <= malformed["confidence"] <= 1.0


def test_new_candidate_is_the_default_serving_artifact(monkeypatch):
    from pathlib import Path
    from backend.app.services import classification as classification_service

    expected = (
        Path(__file__).resolve().parents[1]
        / "backend"
        / "models"
        / "grievance_classifier_synthetic_research_simple_candidate_20261024.joblib"
    )
    try:
        monkeypatch.delenv("GRIEVANCE_MODEL_ARTIFACT", raising=False)
        monkeypatch.setattr(classification_service, "_ml_model", None)
        model = classification_service._get_ml_model()
        assert model is not None and model.is_trained
        assert model.clf.classes_.tolist() == [
            "Electricity", "Health", "Other", "Road", "Sanitation", "Transport", "Water"
        ]
        assert expected.is_file()
    finally:
        monkeypatch.setattr(classification_service, "_ml_model", None)


def test_domain_gate_ignores_incidental_water_but_keeps_real_supply_issue():
    from backend.app.services.grievance_model import clean_text, detect_domain

    incidental, _, _ = detect_domain(clean_text("road work paused while workers discussed water"))
    legitimate, _, _ = detect_domain(clean_text("water supply stopped in our lane"))
    hindi, _, _ = detect_domain(clean_text("पानी सप्लाई का समय बदल दिया गया"))
    assert incidental is None
    assert legitimate == "Water"
    assert hindi == "Water"


def test_generic_water_pipe_mention_is_not_a_water_domain_override():
    from backend.app.services.grievance_model import clean_text, detect_domain

    category, _, _ = detect_domain(clean_text("The water pipe was installed near my home"))
    assert category is None


def test_hinglish_water_supply_phrase_is_recognized():
    from backend.app.services.grievance_model import clean_text, detect_domain

    category, _, _ = detect_domain(
        clean_text("Peene ke paani ki supply teen din se band hai")
    )
    assert category == "Water"


def test_incidental_pipe_does_not_override_competing_road_complaint():
    from backend.app.services.grievance_model import clean_text, detect_domain

    category, _, scores = detect_domain(
        clean_text("The road is damaged and a water pipe is nearby")
    )
    assert category is None
    assert scores["Road"] > 0
    assert scores["Water"] > scores["Road"]


def test_completed_water_pipeline_does_not_override_road_complaint():
    from backend.app.services.grievance_model import clean_text, detect_domain

    category, _, _ = detect_domain(
        clean_text("Road damage remains; water pipeline repair was completed")
    )
    assert category is None


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
        def with_options(self, **_kwargs):
            return self

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
    assert result
    assert result["category"] in {"water", "other"}
    assert result["priority"] in {"low", "medium", "high"}


def test_groq_completion_is_bounded_retry_free_and_logs_usage(monkeypatch, caplog):
    """Submit-path Groq calls must not let the SDK retry a stalled provider."""
    caplog.set_level("INFO", logger="grievance-api")
    calls = {}

    class _Choice:
        message = type("M", (), {"content": '{"category":"water"}'})()

    class _Resp:
        choices = [_Choice()]
        usage = type("U", (), {"total_tokens": 17})()

    class _Client:
        def with_options(self, **kwargs):
            calls["options"] = kwargs
            return self

        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    calls["create"] = kwargs
                    return _Resp()

    monkeypatch.setattr(
        "backend.app.services.classification.get_groq_client",
        lambda: _Client(),
        raising=False,
    )

    raw = clf._groq_complete("prompt", max_tokens=42, stage="category")

    assert raw == '{"category":"water"}'
    assert calls["options"] == {"max_retries": 0}
    assert calls["create"]["timeout"] == clf.GROQ_CALL_TIMEOUT_SECONDS
    assert calls["create"]["max_tokens"] == 42
    assert "stage=category" in caplog.text
    assert "total_tokens=17" in caplog.text


def test_classification_budget_skips_groq_calls_once_spent(monkeypatch):
    """A spent shared budget falls through to keywords instead of calling Groq."""
    calls = []

    class _Client:
        def with_options(self, **_kwargs):
            return self

        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    calls.append(kwargs)
                    raise AssertionError("Groq must not be called once the budget is spent")

    monkeypatch.setattr(
        "backend.app.services.classification.get_groq_client",
        lambda: _Client(),
        raising=False,
    )

    with clf.classification_budget(seconds=0):
        assert clf._groq_complete("prompt", max_tokens=10) is None

    assert calls == []


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
    result = clf.classify_category("municipal electrical concern")
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
