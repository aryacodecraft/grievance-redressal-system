"""The offline bulk job must use the same category decision as submission."""


def test_recategorize_preserves_classifier_category_without_refinement(monkeypatch):
    from tools import recategorize

    monkeypatch.setattr(recategorize, "classify_category", lambda _text: {
        "rawLabel": "Issues related to roads, potholes, footpaths, traffic, or road damage",
        "category": "roads",
        "confidence": 0.88,
        "source": "ml_model",
        "categoryOutcome": "categorized",
        "categoryConfidenceSemantics": "uncalibrated_model_probability",
    })
    monkeypatch.setattr(recategorize, "classify_priority", lambda _text: {
        "priority": "medium",
        "sentiment": "neutral",
        "sentimentScore": 0.0,
        "source": "keyword_rules",
    })
    monkeypatch.setattr(recategorize, "extract_keywords", lambda _text: [])
    monkeypatch.setattr(recategorize, "find_urgent_matches", lambda _text: [])

    result = recategorize.classify(
        "Potholes on the road; a water pipe nearby is not the issue."
    )

    assert result["category"] == "roads"
    assert result["modelInfo"]["categorySource"] == "ml_model"
    assert result["modelInfo"]["categoryOutcome"] == "categorized"
    assert result["modelInfo"]["categoryConfidenceSemantics"] == "uncalibrated_model_probability"
    assert result["modelInfo"]["groqModel"] == "None"
