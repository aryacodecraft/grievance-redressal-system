"""Offline regression coverage for the pre-persistence civic relevance gate."""

from __future__ import annotations

import pytest

from backend.app.services.classification import is_clearly_out_of_scope


def _auth_headers():
    from backend.app.auth import create_access_token

    token = create_access_token("relevance-citizen", "USER", "citizen@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    ("title", "description", "expected_status"),
    [
        ("Math question", "What is 1+2?", 422),
        ("Joke", "Tell me a joke.", 422),
        ("Cricket", "Who won yesterday's cricket match?", 422),
        ("Science", "Explain photosynthesis.", 422),
        ("Hello", "Hello", 422),
        ("Test", "asdfghjkl", 422),
        ("!!!", "!!!@@@###", 400),
    ],
)
def test_clearly_irrelevant_submission_has_no_side_effects(
    client, monkeypatch, title, description, expected_status
):
    from backend.app.routers import grievances as router

    def unexpected(*_args, **_kwargs):
        pytest.fail("rejected text reached grievance processing")

    monkeypatch.setattr(router, "llm_image_confidence", unexpected)
    monkeypatch.setattr(router, "classify_category", unexpected)
    monkeypatch.setattr(router, "classify_priority", unexpected)
    monkeypatch.setattr(router, "check_quality", unexpected)
    monkeypatch.setattr(router.repository, "create", unexpected)
    monkeypatch.setattr(router.notif_repository, "create", unexpected)

    response = client.post(
        "/submit-grievance",
        json={
            "title": title,
            "description": description,
            # Relevance rejection must precede the optional image provider.
            "imageUrl": "https://example.invalid/irrelevant.jpg",
        },
        headers=_auth_headers(),
    )

    assert response.status_code == expected_status
    assert "grievanceId" not in response.json()
    if expected_status == 422:
        assert "public service or civic issue" in response.json()["error"]
    assert router.repository.list() == []
    assert client.get("/notifications", headers=_auth_headers()).json() == []


@pytest.mark.parametrize(
    "text",
    [
        "There are deep potholes on my street.",
        "Paani ki supply nahi aa rahi hai.",
        "Our area has had no electricity since last night.",
        "Garbage has not been collected for five days.",
        "The public hospital has no doctor available.",
        "Buses are frequently cancelled in my area.",
        "A burst water pipe has flooded the road.",
        "The streetlight near the public bus stop is broken.",
    ],
)
def test_civic_complaints_still_enter_existing_review_workflow(
    client, monkeypatch, text
):
    from backend.app.routers import grievances as router
    from backend.app.services import classification

    # Exercise the dependency-free local fallback and category/review behavior.
    monkeypatch.setattr(classification, "_get_ml_model", lambda: None)
    response = client.post(
        "/submit-grievance",
        json={"title": text[:60], "description": text},
        headers=_auth_headers(),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["grievanceId"].startswith("GRV-")
    stored = router.repository.get(body["grievanceId"])
    assert stored is not None
    assert stored["state"] == "PENDING_ASSIGNMENT"
    assert stored["category"] in classification.CATEGORY_KEYS


@pytest.mark.parametrize(
    "text",
    [
        "Road problem.",
        "Water issue.",
        "The municipal office is not responding.",
        "Paani nahi aa raha.",
        "There are pothols on my street.",
        "Potholes are deep and the drain is blocked.",
    ],
)
def test_ambiguous_or_misspelled_civic_text_is_not_rejected(text):
    assert not is_clearly_out_of_scope(text)


def test_civic_words_do_not_turn_general_information_into_a_complaint():
    assert is_clearly_out_of_scope("What is electricity?")
    assert is_clearly_out_of_scope("What does electricity mean?")
    assert is_clearly_out_of_scope("I am writing an essay about roads and buses.")
    assert not is_clearly_out_of_scope("What is the problem with the water supply?")
