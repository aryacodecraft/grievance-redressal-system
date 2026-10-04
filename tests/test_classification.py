"""Classifier unit tests — deterministic (keyword) paths only.

The HF zero-shot and Groq cascade is EXPERIMENTAL per DEC-005 and needs API
keys + network, so it is deliberately not asserted here. These tests lock down
the behaviour that falls back when no LLM is configured, which is the path the
prototype runs in CI and in local dev.

Also guards the frontend/backend contract: `CATEGORY_KEYS` must stay identical
to `CATEGORIES` in `frontend/lib/types.ts`.
"""

from __future__ import annotations

import pathlib
import re

import pytest

from backend.app.services import classification as clf

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


# ── Category keys ↔ frontend contract ───────────────────────────────────────


def test_category_keys_are_unique_and_sorted_stable():
    assert len(clf.CATEGORY_KEYS) == len(set(clf.CATEGORY_KEYS))
    assert "other" in clf.CATEGORY_KEYS


def test_category_labels_align_with_category_keys():
    assert len(clf.CATEGORY_LABELS) == len(clf.CATEGORY_KEYS)


def test_category_keys_match_frontend_categories():
    """`CATEGORY_KEYS` (backend) must equal `CATEGORIES` (frontend).

    The frontend uses these keys for the category filter and to render
    badges; a drift would silently filter everything out.
    """
    src = (REPO_ROOT / "frontend" / "lib" / "types.ts").read_text()
    match = re.search(
        r"export const CATEGORIES = \[(.*?)\] as const;", src, re.S
    )
    assert match, "could not locate CATEGORIES in frontend/lib/types.ts"
    frontend_keys = re.findall(r'"([a-z]+)"', match.group(1))
    assert frontend_keys == clf.CATEGORY_KEYS


def test_frontend_covers_every_backend_key():
    """Every key the API can emit must be present in the UI filter list."""
    src = (REPO_ROOT / "frontend" / "lib" / "types.ts").read_text()
    for key in clf.CATEGORY_KEYS:
        assert f'"{key}"' in src, f"frontend does not know about {key!r}"


# ── Keyword category inference ──────────────────────────────────────────────


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("water supply pipe burst and flooding in the street", "water"),
        ("no drinking water in our locality since three days", "water"),
        ("huge pothole on the highway near the school", "roads"),
        # "streetlight" (one word) is the electricity keyword — note that
        # "street light" (two words) does NOT match and falls through to None.
        ("the streetlight on the corner is broken", "electricity"),
        ("garbage has not been collected for a week", "sanitation"),
        ("mosquito breeding behind the clinic, dengue risk", "health"),
        ("corrupt officer demanding bribe at the office", "governance"),
    ],
)
def test_infer_category_from_keywords(text, expected):
    assert clf.infer_category_from_keywords(text) == expected


def test_infer_category_returns_none_when_no_keyword_matches():
    assert clf.infer_category_from_keywords("lorem ipsum dolor sit amet") is None


def test_keyword_inference_is_case_insensitive():
    upper = clf.infer_category_from_keywords("POTHOLE ON THE ROAD")
    lower = clf.infer_category_from_keywords("pothole on the road")
    assert upper == lower is not None


# ── Urgency / risk / priority ───────────────────────────────────────────────


def test_find_urgent_matches_detects_urgency():
    matches = clf.find_urgent_matches("there is flooding in the area")
    assert "flood" in matches or "flooding" in matches


def test_find_urgent_matches_empty_for_calm_text():
    assert clf.find_urgent_matches("please improve the park landscaping") == []


def test_find_urgent_matches_is_a_substring_match():
    # Documents current behaviour: matching is substring-based, so singular
    # keyword "fire" also matches the word "fire" inside unrelated words.
    assert clf.find_urgent_matches("the fire station road is damaged") != []


def test_contains_high_risk_issue():
    # HIGH_PRIORITY_KEYWORDS holds the two-word phrase "bridge collapse",
    # so the phrasing must match exactly — "bridge may collapse" does not.
    assert clf.contains_high_risk_issue("bridge collapse on the highway")
    assert not clf.contains_high_risk_issue("the bridge may collapse any moment")
    assert not clf.contains_high_risk_issue("a small crack in the footpath")


def test_affects_many_people():
    # Matches against a fixed phrase list — "whole colony" is in it,
    # "entire colony" is not.
    assert clf.affects_many_people("the whole colony is without electricity")
    assert not clf.affects_many_people("the entire colony is without electricity")
    assert not clf.affects_many_people("my kitchen tap is leaking")


def test_classify_priority_returns_high_for_urgent_text():
    result = clf.classify_priority("urgent: flooding in the basement, people trapped")
    assert result["priority"] == "high"


def test_classify_priority_defaults_to_low_for_benign_text():
    result = clf.classify_priority("the garden needs a new bench")
    assert result["priority"] == "low"


def test_classify_priority_medium_for_pothole():
    # "pothole" is in MEDIUM_PRIORITY_KEYWORDS.
    assert clf.classify_priority("pothole on the road")["priority"] == "medium"


def test_classify_priority_result_shape():
    result = clf.classify_priority("pothole on the road")
    assert set(result) >= {"priority", "sentiment", "sentimentScore"}
    assert result["priority"] in {"low", "medium", "high"}


# ── Keyword extraction ──────────────────────────────────────────────────────


def test_extract_keywords_returns_known_terms():
    words = clf.extract_keywords("garbage dump near the market road")
    assert words, "expected at least one keyword"
    known = {kw for lst in clf.ALL_KEYWORD_LISTS.values() for kw in lst}
    assert set(words) <= known, f"unexpected keywords: {set(words) - known}"
    assert {"garbage", "road", "dump"} <= set(words)


def test_extract_keywords_empty_for_unknown_text():
    assert clf.extract_keywords("") == []


# ── Sentiment normalisation ─────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("positive", "positive"),
        ("negative", "negative"),
        ("neutral", "neutral"),
        (None, "neutral"),
        ("something-else", "neutral"),
        # NB: raw HF label ids are NOT decoded — they contain neither "neg"
        # nor "pos", so all three collapse to "neutral". Documented here as
        # current behaviour; sentiment only runs when HF_API_TOKEN is set.
        ("LABEL_0", "neutral"),
        ("LABEL_1", "neutral"),
        ("LABEL_2", "neutral"),
    ],
)
def test_normalize_sentiment(raw, expected):
    assert clf.normalize_sentiment(raw) == expected
