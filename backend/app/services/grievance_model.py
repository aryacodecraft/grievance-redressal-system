import re
from pathlib import Path
import numpy as np
from scipy.sparse import hstack

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
    # Domain counts provide candidate evidence, but a Water decision requires
    # an explicit service problem phrase. Generic terms such as water, pipe,
    # pipeline, or tap can appear incidentally in another complaint.
    'Water': ['water', 'pipeline', 'pipe', 'tap', 'tanker', 'leakage', 'leak',
              'contaminated', 'drinking water', 'borewell', 'pressure'],
    'Road': ['road', 'pothole', 'highway', 'flyover', 'bridge', 'traffic',
             'speedbreaker', 'signage', 'overbridge', 'footpath', 'divider'],
    'Sanitation': ['garbage', 'sanitation', 'dirty', 'sewage', 'drain', 'dustbin',
                   'waste', 'cleanliness', 'sweeper', 'trash', 'dump', 'sewer'],
    'Health': ['hospital', 'doctor', 'health', 'medicine', 'treatment', 'ambulance',
               'clinic', 'nurse', 'patient', 'blood bank', 'blood group'],
    'Transport': ['bus', 'transport', 'route', 'auto', 'rickshaw', 'train',
                  'station', 'conductor', 'bus stop', 'taxi'],
}

_WATER_OVERRIDE_PHRASES = tuple(re.compile(pattern) for pattern in (
    r'\bwater supply\b', r'\bno water\b', r'\bwater pressure\b',
    r'\bdrinking water\b',
    r'\bwater pipe\s+(?:leak(?:age|ing)?|burst|broken|contaminat\w*)\b',
    r'\bwater pipeline\s+(?:leak(?:age|ing)?|burst|broken|contaminat\w*)\b',
    r'\b(?:burst(?:ed)?|broken|leaking|leak(?:age)?|damaged)\s+water main\b',
    r'\bwater main\s+(?:is\s+)?(?:burst|broken|leaking|leak(?:age)?|damaged)\b',
    r'\bwater\s+(?:ki|ka|ke)\s+supply\b',
    r'\bwater\s+(?:is\s+)?leaking\s+(?:from|out of)\s+(?:the\s+)?(?:pipe|pipeline)\b',
    r'\bwater tanker\b',
    r'\bwater leak(?:age|ing)?\b', r'\bwater contamination\b',
    r'\bwater is not (?:coming|available)\b',
    r'\bwater nahi (?:aa|a) raha\b', r'\bpaani nahi (?:aa|a) raha\b',
    r'\bwater nahi mil\b', r'पानी\s+सप्लाई', r'पानी\s+की\s+आपूर्ति',
    r'पाणी\s+पुरवठा', r'पाणीपुरवठा',
))

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
    explicit_water_issue = any(
        pattern.search(clean_txt) for pattern in _WATER_OVERRIDE_PHRASES
    )
    if max_hits == 0:
        if explicit_water_issue:
            return 'Water', 1, scores
        return None, 0, scores
    top_domains = [d for d, s in scores.items() if s == max_hits]
    if len(top_domains) > 1:
        return None, max_hits, scores
    # Multiple Water terms can still be incidental (for example, "water pipe
    # installed"). Require an explicit Water service problem. When another
    # civic domain also has evidence, abstain unless the Water evidence is
    # clearly stronger; borderline multi-issue text is left for review.
    if top_domains[0] == 'Water' and not explicit_water_issue:
        return None, max_hits, scores
    if top_domains[0] == 'Water':
        strongest_other = max(
            (score for domain, score in scores.items() if domain != 'Water'),
            default=0,
        )
        if strongest_other and scores['Water'] < strongest_other + 2:
            return None, max_hits, scores
    return top_domains[0], max_hits, scores


def vectorize(texts, word_vec, char_vec):
    return hstack([word_vec.transform(texts), char_vec.transform(texts)])


class GrievanceModel:
    """
    Word/character TF-IDF + LogisticRegression inference and domain gate.

    The API loads a notebook-exported artifact. Model fitting lives in the
    research notebook and is not available on this serving class.
    """

    def __init__(self, confidence_threshold=DEFAULT_CONFIDENCE_THRESHOLD,
                 margin_threshold=DEFAULT_MARGIN_THRESHOLD):
        self.confidence_threshold = confidence_threshold
        self.margin_threshold = margin_threshold
        self.word_vec = None
        self.char_vec = None
        self.clf = None
        self.is_trained = False

    @classmethod
    def load_artifact(cls, artifact_path):
        """Load a trusted, notebook-exported inference artifact without fitting."""
        import joblib

        artifact_path = Path(artifact_path)
        payload = joblib.load(artifact_path)
        required = {"word_vectorizer", "char_vectorizer", "classifier", "labels"}
        if not isinstance(payload, dict) or not required.issubset(payload):
            raise ValueError(f"Invalid grievance model artifact: {artifact_path}")
        model = cls()
        model.word_vec = payload["word_vectorizer"]
        model.char_vec = payload["char_vectorizer"]
        model.clf = payload["classifier"]
        if list(model.clf.classes_) != list(payload["labels"]):
            raise ValueError("Artifact labels do not match classifier classes")
        if not hasattr(model.clf, "predict_proba"):
            raise ValueError("Production category artifact must provide probabilities")
        model.is_trained = True
        return model

    def predict(self, text: str) -> dict:
        if not self.is_trained or self.clf is None:
            return {'category': 'other', 'confidence': 0.0,
                    'source': 'model_unavailable', 'reason': 'No inference artifact loaded'}

        clean = clean_text(text)
        domain, hits, _ = detect_domain(clean)

        vec = vectorize([clean], self.word_vec, self.char_vec)
        proba = self.clf.predict_proba(vec)[0]

        if domain is not None:
            # This is a deterministic domain rule, not a model probability.
            # Keep confidence at zero and label the source so the cascade can
            # accept a decisive rule without claiming calibrated confidence.
            return {'category': canonical_category(domain), 'confidence': 0.0,
                    'source': 'domain_override',
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
