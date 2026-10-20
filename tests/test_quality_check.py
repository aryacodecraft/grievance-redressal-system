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


def test_submit_flags_suspicious_grievance_and_stores_in_admin(client):
    """When a grievance is detected as non-civic/fake (DEC-049):
    1. Returns status 200 with reference ID (never rejected/dropped silently)
    2. Response includes flagged=True and flagReason
    3. Stored document has qualityFlag='suspicious' and appears in admin view
    """
    from tests.test_endpoints import _admin_headers, _auth_headers

    fake_json = '{"is_genuine": false, "reason": "Query is a math question, not a civic grievance."}'
    with patch("backend.app.services.quality_check._groq_complete", return_value=fake_json):
        res = client.post(
            "/submit-grievance",
            json={"title": "Math query", "description": "what is the answer of 1+2?"},
            headers=_auth_headers("citizen-101"),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["flagged"] is True
        assert "math question" in body["flagReason"]
        gid = body["grievanceId"]

        # Admin must see this grievance with the qualityFlag attached
        stored = client.get(f"/grievances/{gid}", headers=_admin_headers()).json()
        assert stored["qualityFlag"] == "suspicious"
        assert stored["qualityReason"] == "Query is a math question, not a civic grievance."

        # Admin listing must also include it
        admin_list = client.get("/grievances", headers=_admin_headers()).json()
        match = next((item for item in admin_list if item["id"] == gid), None)
        assert match is not None
        assert match["qualityFlag"] == "suspicious"

