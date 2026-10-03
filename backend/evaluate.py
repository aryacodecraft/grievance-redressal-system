#!/usr/bin/env python3
"""
evaluate.py — Full evaluation suite (Step 6 + 10)
Reproducible, leak-free evaluation matching the notebook.

4 metrics:
1. Train vs test accuracy (raw classifier, no gate) — overfitting signal
2. Classification report on leak-free test set
3. Confusion matrix on leak-free test set
4. Gated pipeline results (Correct / Other / Wrong) on leak-free test + holdout

Usage:
    python backend/evaluate.py
    python backend/evaluate.py --holdout
"""
import re
import pathlib
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score, classification_report

# Import the project model — it lives in the serving package (DEC-010).
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))  # repository root
from backend.app.services.grievance_model import (
    GrievanceModel,
    clean_text,
    CATEGORY_RENAME,
)

def leak_free_split(df, test_size=0.2, seed=42):
    if 'clean_text' not in df.columns:
        df = df.copy()
        df['clean_text'] = df['text'].apply(clean_text)
    unique_df = df.drop_duplicates(subset=['clean_text'])[['clean_text', 'category']].copy()
    train_groups, test_groups = train_test_split(
        unique_df, test_size=test_size, stratify=unique_df['category'], random_state=seed
    )
    train_texts = set(train_groups['clean_text'])
    test_texts = set(test_groups['clean_text'])
    train_rows = df[df['clean_text'].isin(train_texts)].copy()
    test_rows = df[df['clean_text'].isin(test_texts)].copy()
    assert len(set(train_rows['clean_text']).intersection(set(test_rows['clean_text']))) == 0
    return train_rows, test_rows

def build_vectorizers(train_texts):
    word_vec = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=1)
    char_vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=1, max_features=1500)
    word_vec.fit(train_texts)
    char_vec.fit(train_texts)
    return word_vec, char_vec

def vectorize(texts, word_vec, char_vec):
    if char_vec is None:
        return word_vec.transform(texts)
    return hstack([word_vec.transform(texts), char_vec.transform(texts)])

def main():
    # Load Citizen (1).csv with robust handling
    train_path = pathlib.Path(__file__).parent / "data" / "Citizen (1).csv"
    if not train_path.exists():
        train_path = pathlib.Path("backend/data/Citizen (1).csv")
    print(f"Loading training data from: {train_path} exists={train_path.exists()}")
    try:
        df = pd.read_csv(train_path, skiprows=1, encoding='utf-8', engine='python', on_bad_lines='skip')
        if list(df.columns)[:2] != ['Complaint_Text', 'Category']:
            alt = pd.read_csv(train_path, encoding='utf-8', engine='python', on_bad_lines='skip')
            if list(alt.columns) == ['Column1', 'Column2']:
                df = pd.read_csv(train_path, skiprows=1, encoding='utf-8', engine='python', on_bad_lines='skip')
            else:
                df = alt
        df.columns = ['text', 'category'] if len(df.columns) >= 2 else df.columns
    except Exception:
        df = pd.read_csv(train_path, encoding='utf-8', engine='python', on_bad_lines='skip')
        df.columns = ['text', 'category'] if len(df.columns) >= 2 else df.columns
    df = df.dropna(subset=['text', 'category'])
    df = df[df['text'].astype(str).str.strip() != '']
    df['category'] = df['category'].map(CATEGORY_RENAME).fillna(df['category'])
    df['clean_text'] = df['text'].apply(clean_text)
    print(f"Total samples: {len(df)}, unique: {df['clean_text'].nunique()}, categories: {sorted(df['category'].unique())}")

    # Train model (leak-free)
    model = GrievanceModel()
    model.train(str(train_path), verbose=True)

    # 1. Train vs test accuracy (raw, no gate)
    train_rows, test_rows = model.train_rows_, model.test_rows_
    X_train = vectorize(train_rows['clean_text'], model.word_vec, model.char_vec)
    X_test = vectorize(test_rows['clean_text'], model.word_vec, model.char_vec)
    train_pred = model.clf.predict(X_train)
    test_pred = model.clf.predict(X_test)
    train_acc = accuracy_score(train_rows['category'], train_pred)
    test_acc = accuracy_score(test_rows['category'], test_pred)
    print("\n1. TRAIN vs TEST ACCURACY (raw classifier, no domain override / no gate)")
    print(f"   Train: {train_acc:.2%} | Test: {test_acc:.2%} | Gap: {train_acc - test_acc:.2%}")

    # 2. Classification report on leak-free test set (raw)
    print("\n2. CLASSIFICATION REPORT (leak-free test set, raw classifier)")
    print(classification_report(test_rows['category'], test_pred, zero_division=0))

    # 3. Confusion matrix (raw)
    labels = sorted(test_rows['category'].unique())
    cm = confusion_matrix(test_rows['category'], test_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"true:{l}" for l in labels], columns=[f"pred:{l}" for l in labels])
    print("3. CONFUSION MATRIX (counts, raw classifier)")
    print(cm_df.to_string())
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)
    cm_norm_df = pd.DataFrame(cm_norm.round(3), index=[f"true:{l}" for l in labels], columns=[f"pred:{l}" for l in labels])
    print("\n   Row-normalized (recall):")
    print(cm_norm_df.to_string())

    # 4. Gated pipeline results on leak-free test set (canonical comparison)
    def _canon(cat):
        m = {'Road':'roads','Roads':'roads','Water':'water','Electricity':'electricity','Sanitation':'sanitation','Health':'health','Transport':'transport','Other':'other','other':'other'}
        c = str(cat).strip()
        return m.get(c, m.get(c.capitalize(), c.lower()))
    gated_results = test_rows['text'].apply(model.predict)
    gated_preds = gated_results.apply(lambda r: _canon(r['category']))
    true_labels_canonical = test_rows['category'].apply(_canon)
    correct = (gated_preds == true_labels_canonical)
    other = (gated_preds == 'other')
    wrong = (~correct) & (~other)
    print(f"\n4. GATED PIPELINE RESULTS -- leak-free test set (n={len(test_rows)})")
    print(f"   Correct: {correct.mean():.2%}")
    print(f"   Sent to 'Other': {other.mean():.2%}")
    print(f"   Wrong: {wrong.mean():.2%}")

    # 5. Holdout evaluation (if available)
    holdout_path = pathlib.Path(__file__).parent / "data" / "grievances_holdout_templates (2).csv"
    if not holdout_path.exists():
        holdout_path = pathlib.Path("backend/data/grievances_holdout_templates (2).csv")
    if holdout_path.exists():
        print(f"\n--- HOLDOUT EVALUATION ---")
        print(f"Loading holdout from: {holdout_path}")
        holdout_df = pd.read_csv(holdout_path, encoding='utf-8', engine='python', on_bad_lines='skip')
        holdout_df.columns = [c.strip().lower() for c in holdout_df.columns]
        col_map = {'complaint_text':'text','complaint':'text','grievance':'text','text':'text','category':'category','label':'category'}
        holdout_df = holdout_df.rename(columns={k:v for k,v in col_map.items() if k in holdout_df.columns})
        if 'text' not in holdout_df.columns:
            holdout_df.columns = ['grievance_id','text','category'][:len(holdout_df.columns)]
        HOLDOUT_TO_TRAIN = {
            'Water Supply': 'Water','Healthcare & Hospitals': 'Health','Sanitation & Garbage': 'Sanitation',
            'Roads & Infrastructure': 'Road','Transport & Traffic': 'Transport','Electricity & Power': 'Electricity',
            'Water':'Water','Health':'Health','Sanitation':'Sanitation','Road':'Road','Transport':'Transport','Electricity':'Electricity',
        }
        if 'category' in holdout_df.columns:
            holdout_df['category_raw'] = holdout_df['category']
            holdout_df['category'] = holdout_df['category'].map(HOLDOUT_TO_TRAIN).fillna(holdout_df['category'])
            holdout_df['category'] = holdout_df['category'].map(CATEGORY_RENAME).fillna(holdout_df['category'])
        holdout_df['clean_text'] = holdout_df['text'].astype(str).apply(clean_text)
        print(f"Holdout: {len(holdout_df)} rows, {holdout_df['category'].nunique()} categories")
        print(holdout_df['category'].value_counts().head(15).to_string())

        known_cats = set(model.train_rows_['category'].unique())
        holdout_known_mask = holdout_df['category'].isin(known_cats)
        holdout_unknown_mask = ~holdout_known_mask
        print(f"\nHoldout known: {holdout_known_mask.sum()} | unknown: {holdout_unknown_mask.sum()}")

        if holdout_known_mask.sum() > 0:
            X_holdout = vectorize(holdout_df['clean_text'], model.word_vec, model.char_vec)
            holdout_raw_pred = model.clf.predict(X_holdout)
            known_acc = accuracy_score(holdout_df.loc[holdout_known_mask, 'category'], holdout_raw_pred[holdout_known_mask])
            print(f"\nHoldout RAW accuracy (known only): {known_acc:.2%}")
            print(classification_report(holdout_df.loc[holdout_known_mask, 'category'], holdout_raw_pred[holdout_known_mask], zero_division=0))
            labels_known = sorted(holdout_df.loc[holdout_known_mask, 'category'].unique())
            cm_h = confusion_matrix(holdout_df.loc[holdout_known_mask, 'category'], holdout_raw_pred[holdout_known_mask], labels=labels_known)
            cm_h_df = pd.DataFrame(cm_h, index=[f"true:{l}" for l in labels_known], columns=[f"pred:{l}" for l in labels_known])
            print("Confusion Matrix (holdout known):")
            print(cm_h_df.to_string())

        gated_holdout = holdout_df['text'].apply(model.predict)
        gated_holdout_pred = gated_holdout.apply(lambda r: _canon(r['category']))
        # Canonicalize holdout true categories as well
        holdout_cats_canonical = holdout_df['category'].apply(_canon)
        known_cats_canonical = set([_canon(c) for c in known_cats])
        is_known = holdout_cats_canonical.isin(known_cats_canonical)
        is_correct_known = (gated_holdout_pred == holdout_cats_canonical) & is_known
        is_other_unknown = (gated_holdout_pred == 'other') & (~is_known)
        is_correct = is_correct_known | is_other_unknown
        is_other_known = (gated_holdout_pred == 'other') & is_known
        is_wrong = ~(is_correct | is_other_known)
        print(f"\nGATED PIPELINE on HOLDOUT (n={len(holdout_df)}):")
        print(f"  Correct (known correct + unknown->Other): {is_correct.mean():.2%} ({is_correct.sum()}/{len(holdout_df)})")
        print(f"  Sent to 'Other' for known (abstained): {is_other_known.mean():.2%}")
        print(f"  Wrong: {is_wrong.mean():.2%}")
        print(f"  Breakdown: known correct {is_correct_known.sum()}/{is_known.sum()} ({is_correct_known.sum()/max(1,is_known.sum()):.1%}), unknown->Other {is_other_unknown.sum()}/{holdout_unknown_mask.sum()} ({is_other_unknown.sum()/max(1,holdout_unknown_mask.sum()):.1%})")

        print("\nSUMMARY COMPARISON")
        print(f"  Train (raw): {train_acc:.2%}")
        print(f"  Leak-free Test (raw): {test_acc:.2%} Gap {train_acc-test_acc:.2%}")
        if holdout_known_mask.sum()>0:
            print(f"  Holdout known RAW: {known_acc:.2%}")
        print(f"  Gated leak-free test: Correct {correct.mean():.2%}, Other {other.mean():.2%}, Wrong {wrong.mean():.2%}")
        print(f"  Gated holdout: Correct {is_correct.mean():.2%}, Other-known {is_other_known.mean():.2%}, Wrong {is_wrong.mean():.2%}")
    else:
        print(f"\nHoldout file not found at {holdout_path}, skipping holdout evaluation")

if __name__ == "__main__":
    main()
