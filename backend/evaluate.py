#!/usr/bin/env python3
"""Audit and evaluate the existing TF-IDF + LogisticRegression classifier.

All reported train/test metrics use distinct cleaned complaints. An optional
separate holdout is evaluated only for categories represented in training;
unrepresented categories are reported as out of taxonomy, never as correct
"Other" predictions. No external API is called.

Usage: python backend/evaluate.py
"""
from __future__ import annotations

import pathlib
import re
import sys
import time

import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
from backend.app.services.grievance_model import (  # noqa: E402
    CATEGORY_RENAME,
    GrievanceModel,
    clean_text,
    vectorize,
)
from backend.app.services.classification import classify_category  # noqa: E402

ROOT = pathlib.Path(__file__).parent
TRAIN_PATH = ROOT / "data" / "Citizen (1).csv"
HOLDOUT_PATH = ROOT / "data" / "grievances_holdout_templates (2).csv"
HOLDOUT_RENAME = {
    "Water Supply": "Water", "Healthcare & Hospitals": "Health",
    "Sanitation & Garbage": "Sanitation", "Roads & Infrastructure": "Road",
    "Transport & Traffic": "Transport", "Electricity & Power": "Electricity",
    "Water": "Water", "Health": "Health", "Sanitation": "Sanitation",
    "Road": "Road", "Transport": "Transport", "Electricity": "Electricity",
}
LABEL_FROM_KEY = {
    "water": "Water", "roads": "Road", "transport": "Transport",
    "electricity": "Electricity", "sanitation": "Sanitation",
    "health": "Health", "governance": "Governance", "other": "Other",
}
LEGACY_DOMAIN_KEYWORDS = {
    "Electricity": ["electricity", "meter reading", "load shedding", "fuse", "wire", "streetlight", "street light", "power", "voltage", "transformer", "sparking", "cable", "blackout", "current", "electrical"],
    "Water": ["water", "pipeline", "pipe", "tap", "tanker", "leakage", "leak", "contaminated", "drinking water", "borewell", "supply", "pressure"],
    "Road": ["road", "pothole", "highway", "flyover", "bridge", "traffic", "speedbreaker", "signage", "overbridge", "footpath", "divider"],
    "Sanitation": ["garbage", "sanitation", "dirty", "sewage", "drain", "dustbin", "waste", "cleanliness", "sweeper", "trash", "dump", "sewer"],
    "Health": ["hospital", "doctor", "health", "medicine", "treatment", "ambulance", "clinic", "nurse", "patient", "blood bank", "blood group"],
    "Transport": ["bus", "transport", "route", "auto", "rickshaw", "train", "station", "conductor", "bus stop", "taxi"],
}


def legacy_predict(text: str, word_vec, char_vec, clf) -> str:
    """Reproduce the prior model's domain override and confidence rejection."""
    clean = clean_text(text)
    scores = {
        domain: sum(
            1 for word in words
            if re.search(r"\b" + re.escape(word) + r"\b", clean)
        )
        for domain, words in LEGACY_DOMAIN_KEYWORDS.items()
    }
    max_hits = max(scores.values())
    top = [domain for domain, hits in scores.items() if hits == max_hits and hits]
    if len(top) == 1:
        return top[0]
    features = hstack([word_vec.transform([clean]), char_vec.transform([clean])])
    probabilities = clf.predict_proba(features)[0]
    order = probabilities.argsort()[::-1]
    top1, top2 = float(probabilities[order[0]]), float(probabilities[order[1]])
    if top1 < 0.50 or top1 - top2 < 0.25:
        return "Other"
    predicted = str(clf.classes_[order[0]])
    return {"Roads": "Road", "Healthcare": "Health"}.get(predicted, predicted)


def updated_offline_predict(text: str, model: GrievanceModel) -> str:
    """Use the shared production policy with an injected local model only."""
    result = classify_category(text, model=model, allow_providers=False)
    return LABEL_FROM_KEY.get(result["category"], "Other")


def load_training_rows() -> pd.DataFrame:
    frame = pd.read_csv(TRAIN_PATH, skiprows=1, encoding="utf-8", engine="python")
    frame = frame.iloc[:, :2].copy()
    frame.columns = ["text", "category"]
    frame = frame.dropna(subset=["text", "category"])
    frame["text"] = frame["text"].astype(str).str.strip()
    frame = frame[frame["text"] != ""].copy()
    frame["category"] = (
        frame["category"].astype(str).str.strip().map(CATEGORY_RENAME)
        .fillna(frame["category"].astype(str).str.strip())
    )
    frame["clean_text"] = frame["text"].map(clean_text)
    return frame


def audit(frame: pd.DataFrame) -> tuple[pd.DataFrame, set[str]]:
    label_counts = frame.groupby("clean_text")["category"].nunique()
    conflicting = set(label_counts[label_counts > 1].index)
    unique = frame[~frame["clean_text"].isin(conflicting)].drop_duplicates("clean_text")
    raw_dupe_rate = 1 - frame["text"].nunique() / max(1, len(frame))
    clean_dupe_rate = 1 - frame["clean_text"].nunique() / max(1, len(frame))
    print("DATASET AUDIT")
    print(f"  Rows: {len(frame)}")
    print(f"  Unique raw complaint texts: {frame['text'].nunique()}")
    print(f"  Unique cleaned complaint texts: {frame['clean_text'].nunique()}")
    print(f"  Raw duplicate rate: {raw_dupe_rate:.2%}; cleaned duplicate rate: {clean_dupe_rate:.2%}")
    print(f"  Conflicting cleaned texts: {len(conflicting)} (excluded from training/evaluation)")
    print(f"  Category rows: {frame['category'].value_counts().sort_index().to_dict()}")
    print(f"  Distinct unconflicted examples/category: {unique['category'].value_counts().sort_index().to_dict()}")
    return unique, conflicting


def fit_classifier(rows: pd.DataFrame) -> tuple[TfidfVectorizer, TfidfVectorizer, LogisticRegression, float]:
    started = time.perf_counter()
    texts = rows["clean_text"].tolist()
    word_vec = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1)
    char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1, max_features=1500)
    features = hstack([word_vec.fit_transform(texts), char_vec.fit_transform(texts)])
    clf = LogisticRegression(max_iter=2000, class_weight="balanced")
    clf.fit(features, rows["category"])
    return word_vec, char_vec, clf, time.perf_counter() - started


def report_metrics(title: str, truth: list[str], predictions: list[str], labels: list[str]) -> None:
    metric_labels = [label for label in labels if label in truth or label in predictions]
    metric_labels.extend(sorted(set(predictions) - set(metric_labels)))
    print(f"\n{title} (n={len(truth)} distinct examples)")
    print(f"  Accuracy: {accuracy_score(truth, predictions):.3f}")
    print(f"  Macro F1: {f1_score(truth, predictions, average='macro', labels=metric_labels, zero_division=0):.3f}")
    print(f"  Weighted F1: {f1_score(truth, predictions, average='weighted', labels=metric_labels, zero_division=0):.3f}")
    print(classification_report(truth, predictions, labels=metric_labels, zero_division=0))
    cm = confusion_matrix(truth, predictions, labels=labels)
    print("  Confusion matrix labels:", labels)
    print(cm)
    if "Water" in labels:
        p, r, f, _ = precision_recall_fscore_support(
            truth, predictions, labels=["Water"], average=None, zero_division=0
        )
        tp, fp, fn = class_error_counts(truth, predictions, "Water")
        print(
            f"  Water support={tp + fn} precision={p[0]:.3f} recall={r[0]:.3f} "
            f"F1={f[0]:.3f} false_positives={fp} false_negatives={fn}"
        )


def class_error_counts(
    truth: list[str], predictions: list[str], label: str
) -> tuple[int, int, int]:
    """Return one-vs-rest (true positives, false positives, false negatives)."""
    tp = sum(actual == label and predicted == label for actual, predicted in zip(truth, predictions))
    fp = sum(actual != label and predicted == label for actual, predicted in zip(truth, predictions))
    fn = sum(actual == label and predicted != label for actual, predicted in zip(truth, predictions))
    return tp, fp, fn


def main() -> None:
    frame = load_training_rows()
    unique, conflicting = audit(frame)
    if conflicting:
        print("  Conflicting labels:", {
            text: sorted(frame.loc[frame.clean_text == text, "category"].unique().tolist())
            for text in sorted(conflicting)
        })

    labels = sorted(unique["category"].unique().tolist())
    train_rows, test_rows = train_test_split(
        unique, test_size=0.2, stratify=unique["category"], random_state=42
    )
    train_texts = set(train_rows["clean_text"])
    repeated_train_rows = frame[
        frame["clean_text"].isin(train_texts) & ~frame["clean_text"].isin(conflicting)
    ]

    # Compare the prior duplicate-weighted training procedure with the fixed
    # procedure on the same exact-text-group split and untouched test groups.
    legacy_vecs = fit_classifier(repeated_train_rows)
    improved_vecs = fit_classifier(train_rows)
    legacy_word, legacy_char, legacy_clf, legacy_seconds = legacy_vecs
    word_vec, char_vec, clf, improved_seconds = improved_vecs
    X_test_legacy = hstack([legacy_word.transform(test_rows.clean_text), legacy_char.transform(test_rows.clean_text)])
    X_test = hstack([word_vec.transform(test_rows.clean_text), char_vec.transform(test_rows.clean_text)])
    test_truth = test_rows.category.tolist()
    report_metrics(
        "LEAKAGE-RESISTANT UNIQUE-TEXT TEST — prior duplicate-weighted fit",
        test_truth, legacy_clf.predict(X_test_legacy).tolist(), labels,
    )
    report_metrics(
        "LEAKAGE-RESISTANT UNIQUE-TEXT TEST — deduplicated existing model",
        test_truth, clf.predict(X_test).tolist(), labels,
    )
    split_policy_model = GrievanceModel()
    split_policy_model.word_vec = word_vec
    split_policy_model.char_vec = char_vec
    split_policy_model.clf = clf
    split_policy_model.train_rows_ = train_rows
    split_policy_model.is_trained = True
    report_metrics(
        "LEAKAGE-RESISTANT UNIQUE-TEXT TEST — prior production model policy",
        test_truth,
        [legacy_predict(text, legacy_word, legacy_char, legacy_clf) for text in test_rows.text],
        labels,
    )
    report_metrics(
        "LEAKAGE-RESISTANT UNIQUE-TEXT TEST — updated local policy",
        test_truth,
        [updated_offline_predict(text, split_policy_model) for text in test_rows.text],
        labels,
    )
    print(f"\nDistinct examples/split: train={len(train_rows)}, test={len(test_rows)}")
    print(f"Train split class counts: {train_rows.category.value_counts().sort_index().to_dict()}")
    print(f"Test split class counts: {test_rows.category.value_counts().sort_index().to_dict()}")
    print(f"Exact cleaned-text overlap across split: {len(train_texts.intersection(set(test_rows.clean_text)))}")
    print(f"Fit time: prior={legacy_seconds:.4f}s ({len(repeated_train_rows)} rows); deduplicated={improved_seconds:.4f}s ({len(train_rows)} rows)")

    # The holdout is only category-evaluable for classes represented in the
    # training labels. Other service categories are out of taxonomy, not true
    # positives for the catch-all label.
    if HOLDOUT_PATH.exists():
        holdout = pd.read_csv(HOLDOUT_PATH, encoding="utf-8", engine="python")
        holdout["category"] = holdout["category"].map(HOLDOUT_RENAME).fillna(holdout["category"])
        holdout["clean_text"] = holdout["text"].astype(str).map(clean_text)
        holdout = holdout.drop_duplicates("clean_text")
        known = holdout[holdout.category.isin(labels)].copy()
        unknown = holdout[~holdout.category.isin(labels)]
        print("\nSEPARATE HOLDOUT AUDIT")
        print(f"  Rows/unique cleaned texts: {len(holdout)}/{holdout.clean_text.nunique()}")
        print(f"  In-taxonomy: {len(known)}; out-of-taxonomy: {len(unknown)} (not scored as Other)")
        print(f"  Holdout category counts: {holdout.category.value_counts().sort_index().to_dict()}")

        # Report approximate near-duplicate overlap from character n-gram
        # cosine similarity; this is an audit signal, not a semantic label.
        all_texts = unique.clean_text.tolist() + holdout.clean_text.tolist()
        overlap_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1).fit_transform(all_texts)
        pair_scores = cosine_similarity(overlap_vec[:len(unique)], overlap_vec[len(unique):])
        print(f"  Exact cross-dataset cleaned-text overlap: {len(set(unique.clean_text) & set(holdout.clean_text))}")
        print(f"  Cross-dataset char-TFIDF pairs >=0.85: {int((pair_scores >= 0.85).sum())}; max similarity: {pair_scores.max():.3f}")

        trained_rows = unique
        updated = GrievanceModel().train(test_size=0)
        baseline_word, baseline_char, baseline_clf, _ = fit_classifier(frame[~frame.clean_text.isin(conflicting)])
        known_truth = known.category.tolist()
        baseline_features = hstack([baseline_word.transform(known.clean_text), baseline_char.transform(known.clean_text)])
        baseline_predictions = baseline_clf.predict(baseline_features).tolist()
        report_metrics(
            "KNOWN-CATEGORY HOLDOUT — prior duplicate-weighted raw classifier",
            known_truth, baseline_predictions, labels,
        )
        updated_predictions = [updated_offline_predict(text, updated) for text in known.text]
        legacy_policy_predictions = [
            legacy_predict(text, baseline_word, baseline_char, baseline_clf)
            for text in known.text
        ]
        report_metrics(
            "KNOWN-CATEGORY HOLDOUT — prior production model + domain override",
            known_truth, legacy_policy_predictions, labels,
        )
        report_metrics(
            "KNOWN-CATEGORY HOLDOUT — updated deduplicated model + confidence policy",
            known_truth, updated_predictions, labels,
        )
        print(f"  Updated policy rejection rate (category=Other): {sum(p == 'Other' for p in updated_predictions) / max(1, len(updated_predictions)):.2%}")
        started = time.perf_counter()
        for text in known.text:
            updated.predict(text)
        mean_ms = (time.perf_counter() - started) * 1000 / max(1, len(known))
        print(f"  Updated local inference mean: {mean_ms:.3f} ms/example")
        print(f"  Training examples used by updated model: {len(trained_rows)} distinct")
    print("\nNo alternative algorithm benchmarked: only 30 distinct training complaints are available.")
    print("Scope-gate accuracy, calibrated confidence, and LLM fallback rate require labeled scope/production telemetry and are not inferred here.")


if __name__ == "__main__":
    main()
