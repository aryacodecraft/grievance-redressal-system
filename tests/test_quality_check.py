"""Unit tests for the grievance quality check service (DEC-049)."""

from unittest.mock import patch

from backend.app.services.quality_check import check_quality


def test_quality_check_genuine_complaint():
    fake_json = '{"is_genuine": true, "reason": "Potholes on public roads are a standard civic issue."}'
    with patch("backend.app.services.quality_check._groq_complete", return_value=fake_json):
        res = check_quality("Broken road near market", "There are big potholes causing traffic and accidents.")
        assert res["is_genuine"] is True
        assert "Potholes" in res["reason"]


def test_quality_check_fake_math_question():
    fake_json = '{"is_genuine": false, "reason": "This is a basic arithmetic query, not a civic issue."}'
    with patch("backend.app.services.quality_check._groq_complete", return_value=fake_json):
        res = check_quality("Math query", "what is the answer of 1+2?")
        assert res["is_genuine"] is False
        assert "arithmetic" in res["reason"]


def test_quality_check_groq_unavailable_fails_safe():
    with patch("backend.app.services.quality_check._groq_complete", return_value=None):
        res = check_quality("Random title", "Random description")
        # Fail-safe: must never block or false-reject when LLM is unavailable
        assert res["is_genuine"] is True
        assert "skipped" in res["reason"]


def test_quality_check_malformed_json_fails_safe():
    with patch("backend.app.services.quality_check._groq_complete", return_value="invalid json string"):
        res = check_quality("Title", "Description")
        assert res["is_genuine"] is True
        assert "failed" in res["reason"] or "fallback" in res["reason"]


def test_quality_check_parses_string_false_as_false():
    with patch(
        "backend.app.services.quality_check._groq_complete",
        return_value='{"is_genuine": "false", "reason": "Not a civic complaint."}',
    ):
        res = check_quality("Title", "Description")
    assert res["is_genuine"] is False


def test_explicit_quality_rejection_prevents_all_grievance_side_effects(client, monkeypatch):
    from backend.app.routers import grievances as router
    from tests.test_endpoints import _auth_headers

    def unexpected(*_args, **_kwargs):
        raise AssertionError("explicitly non-genuine text reached downstream processing")

    monkeypatch.setattr(router, "check_quality", lambda *_args: {
        "is_genuine": False, "reason": "This is not a real service complaint."
    })
    monkeypatch.setattr(router, "classify_category", unexpected)
    monkeypatch.setattr(router, "classify_priority", unexpected)
    monkeypatch.setattr(router, "llm_image_confidence", unexpected)
    monkeypatch.setattr(router.repository, "create", unexpected)
    monkeypatch.setattr(router.notif_repository, "create", unexpected)

    res = client.post(
        "/submit-grievance",
        json={
            "title": "A fictional issue",
            "description": "This is not a real complaint.",
            "imageUrl": "https://example.invalid/photo.jpg",
        },
        headers=_auth_headers("quality-reject-citizen"),
    )

    assert res.status_code == 422
    assert "genuine" in res.json()["error"].lower()
    assert "grievanceId" not in res.json()
    assert router.repository.list() == []
    assert client.get(
        "/notifications", headers=_auth_headers("quality-reject-citizen")
    ).json() == []


def test_submit_rejects_clear_non_civic_text_before_quality_provider(client, monkeypatch):
    """A local clear-relevance rejection must not reach the optional Groq check."""
    from tests.test_endpoints import _auth_headers

    def unexpected(*_args, **_kwargs):
        raise AssertionError("quality provider must not run for clear rejection")

    monkeypatch.setattr("backend.app.services.quality_check._groq_complete", unexpected)
    res = client.post(
        "/submit-grievance",
        json={"title": "Math query", "description": "what is the answer of 1+2?"},
        headers=_auth_headers("citizen-101"),
    )
    assert res.status_code == 422
    assert "public service or civic issue" in res.json()["error"]
    assert client.get("/grievances", headers=_auth_headers("citizen-101")).json() == []
