import os
import re
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

CATEGORY_RENAME = {
    'Roads': 'Road',
    'Healthcare': 'Health',
    'Water': 'Water',
    'Electricity': 'Electricity',
    'Sanitation': 'Sanitation',
    'Transport': 'Transport',
}

# Canonical storage keys (lowercase) for Firestore
CATEGORY_CANONICAL = {
    'Road': 'roads',
    'Water': 'water',
    'Electricity': 'electricity',
    'Sanitation': 'sanitation',
    'Health': 'health',
    'Transport': 'transport',
    'Other': 'other',
    'Roads': 'roads',
    'Healthcare': 'health',
}

def canonical_category(cat: str) -> str:
    if not cat:
        return 'other'
    c = str(cat).strip()
    # direct canonical
    if c.lower() in ['roads','water','electricity','sanitation','health','transport','governance','other']:
        return c.lower()
    # map via CATEGORY_CANONICAL
    return CATEGORY_CANONICAL.get(c, CATEGORY_CANONICAL.get(c.capitalize(), c.lower()))

DEFAULT_CONFIDENCE_THRESHOLD = 0.50
DEFAULT_MARGIN_THRESHOLD = 0.25

NORMALIZATION_MAP = {
    'bijli': 'electricity', 'बिजली': 'electricity', 'वीज': 'electricity',
    'vij': 'electricity', 'current': 'electricity', 'transformer': 'electricity',
    'power': 'electricity', 'voltage': 'electricity',

    'pani': 'water', 'paani': 'water', 'पानी': 'water', 'पाणी': 'water',
    'jal': 'water', 'jal board': 'water',

    'sadak': 'road', 'सड़क': 'road', 'रस्त्यावर': 'road', 'रस्ता': 'road',
    'gaddha': 'pothole', 'gaddhe': 'pothole', 'gaddho': 'pothole',
    'speed breaker': 'speedbreaker', 'speedbreaker': 'speedbreaker',

    'kachra': 'garbage', 'कचरा': 'garbage', 'safai': 'sanitation', 'सफाई': 'sanitation',
    'ganda': 'dirty', 'gandagi': 'dirty', 'kooda': 'garbage', 'कूड़ा': 'garbage',

    'aspatal': 'hospital', 'अस्पताल': 'hospital', 'रुग्णालय': 'hospital',
    'dawai': 'medicine', 'mareez': 'patient', 'chikitsa': 'treatment',

    'bus': 'bus', 'बस': 'bus', 'rickshaw': 'rickshaw',
}

_NORM_KEYS_SORTED = sorted(NORMALIZATION_MAP.keys(), key=len, reverse=True)
_NORM_PATTERN = re.compile(r'\b(' + '|'.join(re.escape(k) for k in _NORM_KEYS_SORTED) + r')\b')

DOMAIN_KEYWORDS = {
    'Electricity': ['electricity', 'meter reading', 'load shedding', 'fuse', 'wire', 'streetlight', 'street light', 'power', 'voltage', 'transformer', 'sparking', 'cable', 'blackout', 'current', 'electrical'],
    'Water': ['water', 'pipeline', 'pipe', 'tap', 'tanker', 'leakage', 'leak',
              'contaminated', 'drinking water', 'borewell', 'supply', 'pressure'],
    'Road': ['road', 'pothole', 'highway', 'flyover', 'bridge', 'traffic',
             'speedbreaker', 'signage', 'overbridge', 'footpath', 'divider'],
    'Sanitation': ['garbage', 'sanitation', 'dirty', 'sewage', 'drain', 'dustbin',
                   'waste', 'cleanliness', 'sweeper', 'trash', 'dump', 'sewer'],
    'Health': ['hospital', 'doctor', 'health', 'medicine', 'treatment', 'ambulance',
               'clinic', 'nurse', 'patient', 'blood bank', 'blood group'],
    'Transport': ['bus', 'transport', 'route', 'auto', 'rickshaw', 'train',
                  'station', 'conductor', 'bus stop', 'taxi'],
}

_DOMAIN_PATTERNS = {
    domain: [re.compile(r'\b' + re.escape(w) + r'\b') for w in words]
    for domain, words in DOMAIN_KEYWORDS.items()
}


def normalize_hinglish(text):
    return _NORM_PATTERN.sub(lambda m: NORMALIZATION_MAP[m.group(0)], str(text))


def clean_text(text):
    text = str(text).lower()
    text = normalize_hinglish(text)
    text = re.sub(r'[^a-z0-9\u0900-\u097F\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def detect_domain(clean_txt):
    scores = {domain: sum(1 for p in patterns if p.search(clean_txt))
              for domain, patterns in _DOMAIN_PATTERNS.items()}
    max_hits = max(scores.values())
    if max_hits == 0:
        return None, 0, scores
    top_domains = [d for d, s in scores.items() if s == max_hits]
    if len(top_domains) > 1:
        return None, max_hits, scores
    return top_domains[0], max_hits, scores


def build_vectorizers(train_texts):
    word_vec = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=1)
    char_vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=1, max_features=1500)
    word_vec.fit(train_texts)
    char_vec.fit(train_texts)
    return word_vec, char_vec


def vectorize(texts, word_vec, char_vec):
    return hstack([word_vec.transform(texts), char_vec.transform(texts)])


def leak_free_split(df, test_size=0.2, seed=42):
    """
    Group-based split to prevent data leakage.
    With only 30 unique texts repeated 40x, a naive row split puts same sentence
    in train AND test. This splits on unique clean_text groups, stratified by category,
    then expands back to all duplicate rows.
    """
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
    assert len(set(train_rows['clean_text']).intersection(set(test_rows['clean_text']))) == 0, "Leakage detected!"
    return train_rows, test_rows


class GrievanceModel:
    """
    TF-IDF + LogisticRegression + Domain Override grievance model matching pipeline v5.
    """

    def __init__(self, confidence_threshold=DEFAULT_CONFIDENCE_THRESHOLD,
                 margin_threshold=DEFAULT_MARGIN_THRESHOLD):
        self.confidence_threshold = confidence_threshold
        self.margin_threshold = margin_threshold
        self.word_vec = None
        self.char_vec = None
        self.clf = None
        self.train_rows_ = None
        self.test_rows_ = None
        self.is_trained = False

    def train(self, train_path=None, test_size=0.2, seed=42, verbose=False):
        if train_path is None:
            base_dir = os.path.dirname(__file__)
            possible_paths = [
                os.path.join(base_dir, 'data', 'Citizen (1).csv'),
                os.path.join(base_dir, '..', 'backend', 'data', 'Citizen (1).csv'),
                os.path.join(base_dir, '..', 'data', 'Citizen (1).csv'),
                os.path.join(base_dir, 'Citizen (1).csv'),
                os.path.join(base_dir, 'Citizen.csv'),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    train_path = p
                    break

        if train_path and os.path.exists(train_path):
            # Robust CSV handling: file has two header rows (Column1/Column2 + Complaint_Text/Category)
            try:
                # Try skiprows=1 for the known double-header format
                train_df = pd.read_csv(train_path, skiprows=1, encoding='utf-8', engine='python', on_bad_lines='skip')
                # Validate we got expected columns
                if list(train_df.columns)[:2] != ['Complaint_Text', 'Category'] and list(train_df.columns)[:2] != ['text', 'category']:
                    # Fallback: try without skiprows
                    alt = pd.read_csv(train_path, encoding='utf-8', engine='python', on_bad_lines='skip')
                    if list(alt.columns) == ['Column1', 'Column2']:
                        train_df = pd.read_csv(train_path, skiprows=1, encoding='utf-8', engine='python', on_bad_lines='skip')
                    else:
                        train_df = alt
                train_df.columns = ['text', 'category'] if len(train_df.columns) >= 2 else train_df.columns
            except Exception as e:
                # Final fallback: try default read without skip
                try:
                    train_df = pd.read_csv(train_path, encoding='utf-8', engine='python', on_bad_lines='skip')
                    if len(train_df.columns) >= 2:
                        train_df.columns = ['text', 'category'] + list(train_df.columns[2:])
                except Exception:
                    raise e
            # Drop empty rows
            train_df = train_df.dropna(subset=['text', 'category'])
            train_df = train_df[train_df['text'].astype(str).str.strip() != '']
            train_df['category'] = train_df['category'].astype(str).str.strip().map(CATEGORY_RENAME).fillna(train_df['category'])
            train_df['clean_text'] = train_df['text'].apply(clean_text)

            # Leak-free split: group by clean_text to avoid duplicate leakage
            if test_size and test_size > 0:
                train_rows, test_rows = leak_free_split(train_df, test_size=test_size, seed=seed)
                self.train_rows_ = train_rows
                self.test_rows_ = test_rows
                train_texts = train_rows['clean_text']
                train_cats = train_rows['category']
                if verbose:
                    print(f"Leak-free split: {len(train_rows)} train rows ({train_rows['clean_text'].nunique()} unique), {len(test_rows)} test rows ({test_rows['clean_text'].nunique()} unique)")
            else:
                train_rows = train_df
                test_rows = pd.DataFrame(columns=train_df.columns)
                self.train_rows_ = train_rows
                self.test_rows_ = test_rows
                train_texts = train_df['clean_text']
                train_cats = train_df['category']

            self.word_vec, self.char_vec = build_vectorizers(train_texts)
            X_train = vectorize(train_texts, self.word_vec, self.char_vec)

            self.clf = LogisticRegression(max_iter=2000, class_weight='balanced')
            self.clf.fit(X_train, train_cats)
            self.is_trained = True
            if verbose and test_size and test_size > 0:
                print(f"Trained on {X_train.shape[0]} rows ({train_texts.nunique()} unique templates), {len(self.clf.classes_)} categories: {list(self.clf.classes_)}")
                print(f"Held out {len(test_rows)} rows ({test_rows['clean_text'].nunique()} unique templates) for leak-free evaluation.")

        return self

    def predict(self, text: str) -> dict:
        if not self.is_trained:
            try:
                self.train()
            except Exception:
                pass

        clean = clean_text(text)
        domain, hits, _ = detect_domain(clean)

        if not self.is_trained:
            if domain:
                return {'category': canonical_category(domain), 'confidence': round(min(0.95, 0.6 + 0.1 * (hits - 1)), 3),
                        'reason': f'domain override match ({hits} keyword hit(s))'}
            return {'category': 'other', 'confidence': 0.35, 'reason': 'Untrained model fallback'}

        vec = vectorize([clean], self.word_vec, self.char_vec)
        proba = self.clf.predict_proba(vec)[0]

        if domain is not None:
            if domain in self.clf.classes_:
                model_conf = float(proba[list(self.clf.classes_).index(domain)])
            else:
                model_conf = None
            keyword_conf = min(0.95, 0.6 + 0.1 * (hits - 1))
            confidence = max(keyword_conf, model_conf) if model_conf is not None else keyword_conf
            return {'category': canonical_category(domain), 'confidence': round(confidence, 3),
                    'reason': f'domain override match ({hits} keyword hit(s))'}

        order = np.argsort(proba)[::-1]
        top1_prob, top2_prob = proba[order[0]], proba[order[1]]
        top1_class = self.clf.classes_[order[0]]
        margin = top1_prob - top2_prob

        if top1_prob < self.confidence_threshold:
            return {'category': 'other', 'confidence': round(float(top1_prob), 3),
                    'reason': f'low confidence ({top1_prob:.2f} < {self.confidence_threshold})'}
        if margin < self.margin_threshold:
            return {'category': 'other', 'confidence': round(float(top1_prob), 3),
                    'reason': f'top-2 classes too close (margin {margin:.2f} < {self.margin_threshold})'}
        return {'category': canonical_category(top1_class), 'confidence': round(float(top1_prob), 3),
                'reason': 'confident model prediction'}
