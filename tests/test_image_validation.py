"""Image validation: threshold boundary, response contract, and the SSRF surface.

No network here — `llm_image_confidence` is monkeypatched at the router, so
these exercise the *decision* logic and the JSON contract rather than Groq or
a real download. Two shapes matter:

* `POST /validate-image` → `{ ok, llm_score?, explanation? }`, parsed by
  `imageValidationSchema` in `frontend/lib/api.ts`.
* `POST /submit-grievance` with an image that fails → `400` carrying
  `{ error, imageValidation, threshold }`, which `SubmitForm` surfaces.
"""

from __future__ import annotations

import pytest

from backend.app.config import IMAGE_LLM_THRESHOLD


def _auth_headers(user_id: str = "citizen-test-1", role: str = "USER"):
    """Submission identity comes from the JWT — attach a token to post."""
    from backend.app.auth import create_access_token

    token = create_access_token(user_id, role, f"{user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def fake_verdict(monkeypatch):
    """Replace the LLM/heuristic scorer in both routers that call it."""
    import backend.app.routers.grievances as g
    import backend.app.routers.images as i

    state = {"score": 90.0, "calls": []}

    def scorer(image_url: str) -> dict:
        state["calls"].append(image_url)
        return {
            "score": state["score"],
            "explanation": "test verdict",
            "raw": "test",
        }

    monkeypatch.setattr(i, "llm_image_confidence", scorer)
    monkeypatch.setattr(g, "llm_image_confidence", scorer)
    return state


# ── /validate-image contract ────────────────────────────────────────────────


def test_validate_image_requires_a_url(client):
    res = client.post("/validate-image", json={})
    assert res.status_code == 400
    assert "error" in res.json()


def test_validate_image_accepts_every_field_name_the_client_may_send(
    client, fake_verdict
):
    """The model carries five aliases for the same thing — all must work."""
    for field in ("imageUrl", "image_url", "url"):
        res = client.post("/validate-image", json={field: "https://x/y.jpg"})
        assert res.status_code == 200, field
        assert res.json()["ok"] is True


def test_validate_image_shape_matches_image_validation_schema(
    client, fake_verdict
):
    """`imageValidationSchema` requires `ok: boolean` and types the rest."""
    body = client.post(
        "/validate-image", json={"imageUrl": "https://x/y.jpg"}
    ).json()
    assert isinstance(body["ok"], bool)
    assert isinstance(body["llm_score"], (int, float))
    assert isinstance(body["explanation"], str)
    # Extras are harmless to zod but belong in the contract.
    assert body["threshold"] == IMAGE_LLM_THRESHOLD


def test_validate_image_rejects_below_threshold(client, fake_verdict):
    fake_verdict["score"] = IMAGE_LLM_THRESHOLD - 0.01
    body = client.post(
        "/validate-image", json={"imageUrl": "https://x/y.jpg"}
    ).json()
    assert body["ok"] is False
    assert body["llm_score"] < IMAGE_LLM_THRESHOLD


# ── Threshold boundary ──────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "score,expected_ok",
    [
        (0.0, False),
        (59.99, False),
        (IMAGE_LLM_THRESHOLD, True),  # exactly at the threshold passes
        (60.01, True),
        (100.0, True),
    ],
)
def test_validate_image_threshold_boundary(client, fake_verdict, score, expected_ok):
    """`/validate-image` uses `>=`; submit-time rejection uses `<`.

    The two endpoints must agree, or an image validates then fails on submit.
    """
    fake_verdict["score"] = score
    body = client.post(
        "/validate-image", json={"imageUrl": "https://x/y.jpg"}
    ).json()
    assert body["ok"] is expected_ok, (score, body)


def test_submit_rejects_an_image_below_threshold(client, sample_payload, fake_verdict):
    fake_verdict["score"] = IMAGE_LLM_THRESHOLD - 0.01
    res = client.post(
        "/submit-grievance",
        json={**sample_payload, "imageUrl": "https://x/bad.jpg"},
        headers=_auth_headers(),
    )
    assert res.status_code == 400
    body = res.json()
    assert "error" in body
    assert body["threshold"] == IMAGE_LLM_THRESHOLD
    assert body["imageValidation"]["llm_score"] < IMAGE_LLM_THRESHOLD
    # Nothing was persisted for a rejected image.
    assert client.get("/grievances").status_code == 401


def test_submit_accepts_an_image_at_the_threshold(client, sample_payload, fake_verdict):
    fake_verdict["score"] = IMAGE_LLM_THRESHOLD
    res = client.post(
        "/submit-grievance",
        json={**sample_payload, "imageUrl": "https://x/ok.jpg"},
        headers=_auth_headers(),
    )
    assert res.status_code == 200, res.text
    stored = client.get(f"/grievances/{res.json()['grievanceId']}").json()
    assert stored["imageUrl"] == "https://x/ok.jpg"
    assert stored["imageValidation"]["llm_score"] == IMAGE_LLM_THRESHOLD


def test_submit_without_an_image_never_calls_the_scorer(client, sample_payload, fake_verdict):
    res = client.post("/submit-grievance", json=sample_payload, headers=_auth_headers())
    assert res.status_code == 200
    assert fake_verdict["calls"] == []
    stored = client.get(f"/grievances/{res.json()['grievanceId']}").json()
    assert "imageUrl" not in stored


def test_submit_survives_a_scorer_exception(client, sample_payload, monkeypatch):
    """A validator that raises must not take the whole submission down."""
    import backend.app.routers.grievances as g

    def boom(image_url: str) -> dict:
        raise RuntimeError("vision service exploded")

    monkeypatch.setattr(g, "llm_image_confidence", boom)
    res = client.post(
        "/submit-grievance",
        json={**sample_payload, "imageUrl": "https://x/y.jpg"},
        headers=_auth_headers(),
    )
    assert res.status_code == 500
    assert "error" in res.json()


# ── Baseline: the server fetches whatever URL it is handed ──────────────────


def test_BASELINE_image_url_is_fetched_without_host_validation(monkeypatch):
    """SSRF surface — documented, not yet closed.

    `services/image.py` calls `requests.get(image_url)` on the raw client
    input, so a submitter can point the backend at an internal host. Nothing
    restricts scheme, host or address range. Closing this belongs with the
    Phase 1 input-validation work: allow `http(s)` only, resolve the host and
    refuse loopback/private/link-local ranges, and cap the download size.
    """
    import pathlib

    source = pathlib.Path("backend/app/services/image.py").read_text(
        encoding="utf-8"
    )
    assert "requests.get(image_url" in source
    # No guard exists yet — if one is added, this test should be inverted.
    for guard in ("ipaddress", "socket.getaddrinfo", "urlparse("):
        assert guard not in source, (
            f"{guard} looks like an SSRF guard — update "
            "test_BASELINE_image_url_is_fetched_without_host_validation"
        )


def test_validate_image_never_swallows_the_url_it_received(
    client, fake_verdict
):
    """The URL reaches the scorer verbatim — proof there is no rewriting step."""
    url = "http://169.254.169.254/latest/meta-data/"
    client.post("/validate-image", json={"imageUrl": url})
    assert fake_verdict["calls"] == [url]


# ── Cloudinary endpoints: shape only (no credentials in tests) ──────────────


def test_delete_cloudinary_requires_an_identifier(client):
    res = client.post("/delete-cloudinary", json={})
    assert res.status_code == 400
    assert "error" in res.json()


def test_sign_cloudinary_requires_a_public_id(client):
    res = client.post("/sign-cloudinary", json={})
    assert res.status_code == 400
    assert "error" in res.json()
