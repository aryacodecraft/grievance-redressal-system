# Classification Pipeline Audit — 2026-10-20

## Production model and pipeline

The existing serving model is `GrievanceModel` in
`backend/app/services/grievance_model.py`: word TF-IDF (1–2 grams) plus
character `char_wb` TF-IDF (3–5 grams, max 1,500 features), combined with
`LogisticRegression(max_iter=2000, class_weight="balanced")`. It is trained
lazily from `backend/data/Citizen (1).csv` in each process. There is no saved
or serialized production model artifact. `backend/app/services/classification.py`
then applies the confidence/domain policy, deterministic category fallback,
HF zero-shot fallback, and Groq fallback. The submit router previously replaced
the result with a separate keyword inference and always ran Groq refinement.

## Data audit

Running `python backend/evaluate.py` found:

| Measure | Result |
|---|---:|
| Training CSV rows | 1,200 |
| Unique raw complaint texts | 30 |
| Unique cleaned complaint texts | 30 |
| Exact cleaned-text duplicate rate | 97.50% |
| Conflicting labels for identical cleaned text | 0 |
| Distinct training examples per category | 5 each across 6 categories |
| Category row counts | Electricity 192; Health 194; Road 211; Sanitation 200; Transport 206; Water 197 |

The separate holdout file contains 614 unique cleaned texts. Two hundred rows
belong to the five categories represented in the training set; 414 belong to
unrepresented categories and are excluded from category metrics, not counted as
correct `Other` predictions. Exact cross-dataset overlap was zero. A character
TF-IDF audit found no train/holdout pairs at cosine similarity ≥0.85 (maximum
0.492); this is a heuristic and cannot rule out every paraphrased template.

## Evaluation results

The training-file split was made on distinct cleaned texts (24 train / 6 test,
four and one per class respectively), so duplicate rows cannot cross the split
or inflate support. The prior duplicate-weighted fit and deduplicated fit had
the same raw test metrics: accuracy **0.833**, macro F1 **0.778**, weighted F1
**0.778**. Raw-model Water precision/recall were **0.000 / 0.000** on that one
Water test example. A single example per class is not a reliable estimate.

On the separate 200-row known-category holdout:

| Evaluation | Accuracy | Macro F1 | Weighted F1 | Water P / R / F1 | Rejection |
|---|---:|---:|---:|---:|---:|
| Prior duplicate-weighted raw model, before domain policy | 0.860 | 0.828 | 0.837 | 0.606 / 1.000 / 0.754 | n/a |
| Prior production domain-override policy | 1.000 | 1.000 | 1.000 | 1.000 / 1.000 / 1.000 | 0.00% |
| Updated deduplicated local policy + deterministic fallback | 1.000 | 1.000 | 1.000 | 1.000 / 1.000 / 1.000 | 0.00% |

The raw model made 27 Water predictions on Road examples in this holdout; the
prior domain policy corrected those predictions. The updated policy preserves
100% Water precision/recall on this holdout while requiring explicit or
corroborated Water evidence for a Water domain override. These results come
from a template-style holdout and do not establish real-world generalization.
The training set has only 30 independent texts, so the model remains
**EXPERIMENTAL** and the reported 100% policy scores must not be presented as
validated accuracy.

The evaluator reports class-wise metrics and confusion matrices in full when
run. The 0% holdout rejection rate applies only to the known-category rows; the
files do not label out-of-scope submissions or uncertain-but-in-scope
complaints, so scope-gate accuracy and expected rejection rate on real traffic
are not computable. No threshold was tuned on the test set.

## Changes and evidence

- Training and evaluation now exclude conflicting cleaned-text groups and use
  one row per distinct cleaned complaint. The fitting feature setup and
  LogisticRegression algorithm/hyperparameters remain unchanged.
- The Water domain rule no longer uses generic `supply` alone; a bare Water
  mention is not enough to override the model. Explicit phrases and corroborated
  evidence still preserve legitimate Water complaints, including Hindi supply
  wording.
- Domain overrides, keyword matches and Groq output carry confidence `0.0`
  because they have no calibrated probability. Existing LogisticRegression
  thresholds are preserved and are not claimed to be calibrated.
- Category keyword evidence returns uncertain on ties and no longer replaces a
  model result after classification. A decisive local keyword category is
  handled before external providers; unsupported/no-signal inputs return `other`
  with zero confidence and an uncertainty explanation.
- Groq refinement no longer runs unconditionally after category/priority
  classification. High-confidence local category predictions and decisive
  keyword predictions do not call the category providers. Groq-generated
  category output has confidence `0.0` (uncalibrated), and provider source,
  latency, failures, and available token counts are logged.
- Regression tests cover water incidental mentions, legitimate water phrases,
  empty/gibberish/unrelated input, provider bypass, ambiguous keyword ties,
  conflicting labels, split deduplication, and submit-path duplicate-refinement
  removal. Tests mock provider calls.

There is no production telemetry baseline for category-fallback counts or token
cost, so cost reduction is verified structurally and in mocked tests, not as a
measured live percentage. The separate suspicious-submission quality check is
still an independent Groq feature and is not counted as a category fallback.

## Recommendation

Keep the existing TF-IDF + LogisticRegression production model. Do not replace
it with LinearSVC or tune its confidence thresholds on this dataset. Collect a
larger set of independent, label-audited complaints and labeled out-of-scope
examples before claiming validation or revisiting model selection.
