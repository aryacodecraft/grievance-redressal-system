# Grievance Classification Pipeline Audit — 2026-10-20

## Executive verdict: PROMISING BUT EXPERIMENTAL

The reported data counts and headline metrics are reproducible for the
evaluation procedures that produced them. They do not establish production
accuracy: the labeled training file has only 30 distinct texts, the six-item
training split has one item per class, and the “holdout” is a template-style
file that has been used while changing the Water policy. A further production
versus evaluation training-size mismatch was found and corrected in this
audit: the serving singleton now fits all 30 unconflicted texts.

The current TF-IDF + LogisticRegression model is retained. Two narrow Water
rule gaps were also corrected: common Hinglish “paani ki supply” wording now
matches the Water override, and a corroborated-but-incidental pipe mention no
longer forces Water when another civic domain is present.

The repository-wide search also found that the Mongo bulk recategorization
utility still overwrote the cascade result with a second keyword pass and
called Groq refinement for every processed grievance. It now uses the shared
bounded cascade result directly, matching the submit path.

## Scope and commands

Audited branch: `codex/ml-pipeline-reliability`. The base audit commit was
`8c4def7`; this report records the verification and small corrections made
after that commit. Dataset and metrics were computed offline. Provider keys
were blanked for evaluation and tests; the full regression suite ran with
providers disabled.

Commands that completed:

```powershell
$env:HF_API_TOKEN=''; $env:GROQ_API_KEY=''; $env:SARVAM_API_KEY=''
.venv\Scripts\python.exe backend/evaluate.py
.venv\Scripts\python.exe -m pytest --collect-only -q --basetemp=.pytest_tmp_audit
.venv\Scripts\python.exe -m pytest -q --tb=short --basetemp=.pytest_tmp_audit
```

`python backend/evaluate.py` did not run because `python` resolves to Python
2.7.18 on this machine; the project virtual environment is Python 3.12.9.
The original audit full run reported 568 passed, 24 failed, and 5 skipped.
After the follow-up reliability changes below, the full run reported 588
passed, 24 failed, and 5 skipped; a separate `--collect-only` run reported
616 tests, while the full-run summary categories sum to 617. The one-item
collection/run discrepancy remains unexplained. The 24 failures remain in
existing status vocabulary/state, Render transcription configuration, image
validation, and assignment/RBAC suites; focused classifier, endpoint, bulk,
and evaluation checks pass.

**Provider-call disclosure:** An early standalone text probe, before provider
environment variables were cleared, attempted the Hugging Face fallback
(both configured model endpoints) and Groq. The HF attempts failed DNS
resolution and Groq failed to connect; no provider returned a result. Billing
cannot be checked from this environment. All later measurements used blank
keys or controlled mocks, and no successful live provider request was made.

## Follow-up reliability verification

The follow-up shares one category decision path across submission, the legacy
`predict_with_fallback()` adapter, and Mongo bulk recategorization. Local
classification runs before remote providers; provider candidates are parsed
and validated, including the contextual Water evidence gate, and unsupported
responses fall through safely. Groq logging records stage, model, elapsed
time, failure type, and token totals when supplied by the SDK without logging
complaint text. Provider-call behavior was verified with mocks; no live usage
or cost baseline is available.

Punctuation-, digit-, and symbol-only title/description combinations are now
rejected with HTTP 400 before classifier/provider work. Short and misspelled
word inputs remain accepted for human review and can receive an uncertain
`other` outcome; the classifier does not silently discard submissions.

The current production local policy was reevaluated on the existing
deduplicated 24/6 split: 5/6 accuracy (0.833), macro F1 0.714, weighted F1
0.833, with Water support 1, precision/recall/F1 0/0/0, FP 0, FN 1. The
current local policy continues to score 200/200 on the known-category
template holdout, including Water 43/43 and zero Water false positives. The
raw all-row ablation records Water precision/recall/F1 0.606/1.000/0.754,
with 28 Water false positives (27 Road, one Sanitation). The holdout was used
while refining the policy, so its perfect score is development evidence, not
independent validation; the six-item split is far too small to tune from.

Final checks: focused offline backend suite 137 passed, 9 deselected;
`backend/evaluate.py` completed; frontend contract checks and `tsc --noEmit`
passed; `git diff --check` passed. The full-suite failure list is retained
above and in the final session log. No new model algorithm was benchmarked;
the available 30 unique examples do not support a reliable model comparison.

## Dataset audit

The training CSV has two header rows; loading it with the production parser
produces 1,200 complaint rows. `clean_text()` lowercases, normalizes listed
Hindi/Hinglish forms, replaces non-Latin/Devanagari punctuation with spaces,
and collapses whitespace. Counts below use that same function.

| Measure | Reproduced result |
|---|---:|
| Training rows | 1,200 |
| Unique raw complaint texts | 30 |
| Unique cleaned complaint texts | 30 |
| Exact cleaned duplicates | 1,170 (97.50%) |
| Conflicting cleaned-text label groups | 0 |
| Distinct cleaned texts after conflict handling | 30 |

| Category | Rows before deduplication | Distinct texts after deduplication |
|---|---:|---:|
| Electricity | 192 | 5 |
| Health | 194 | 5 |
| Road | 211 | 5 |
| Sanitation | 200 | 5 |
| Transport | 206 | 5 |
| Water | 197 | 5 |

There are 30 distinct strings, but repeated copies of each string are not
independent complaints. Exact-label conflicts are checked after cleaning and
would be excluded from fitting; none occur in this file. The evaluator's raw
duplicate-weighted fit intentionally reproduces a historical ablation, while
the current production fit uses one row per distinct cleaned text.

The separate holdout has 614 rows and 614 distinct cleaned strings. After the
file's category aliases are mapped, 200 records belong to represented
categories and 414 to nine categories absent from the training taxonomy.
Known-category counts are Electricity 37, Health 45, Road 36, Sanitation 39,
and Water 43; Transport has no holdout examples. The 414 unsupported labels
are excluded, not scored as correct `Other` predictions. Exact cleaned-text
overlap is zero.

The reported maximum character-TFIDF cosine similarity of **0.492** is
reproducible when one vectorizer is fit jointly on the 30 training texts and
614 holdout texts, as `backend/evaluate.py` currently does for this diagnostic.
Fitting the vectorizer on training text only gives a nearest-training-text
maximum of **0.665**. Training-only nearest-neighbor quantiles (min, 25th,
median, 75th, 90th, 95th, 99th, max) are 0.072, 0.227, 0.355, 0.428, 0.506,
0.553, 0.626, 0.665. Neither method finds a pair at 0.85 or above. Jointly
fitting IDF changes the diagnostic; neither statistic proves semantic
independence.

The holdout filename contains `templates`; inspection also shows recurring
sentence frames with cities, durations, greetings, and closings varied (for
example, the Water pipeline-leak sentence family). It is exact-text distinct
from training, but its provenance and human-labeling procedure are not
documented. Treat it as a structured test fixture, not a representative sample
of incoming citizen complaints.

## Metric reproduction

All reported tables use category names after the evaluator's alias mapping.
Per-class scores use zero division as zero. `Other`/rejection means a predicted
category outside the represented classes for these known-category metrics.

### Distinct-text training split

The split is stratified after deduplication, with `random_state=42`: 24 train
texts and 6 test texts, four and one per category. The cleaned-text sets are
disjoint. The unmodified duplicate-weighted and deduplicated LogisticRegression
fits produce the same six predictions.

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Electricity | 1.000 | 1.000 | 1.000 | 1 |
| Health | 1.000 | 1.000 | 1.000 | 1 |
| Road | 1.000 | 1.000 | 1.000 | 1 |
| Sanitation | 0.500 | 1.000 | 0.667 | 1 |
| Transport | 1.000 | 1.000 | 1.000 | 1 |
| Water | 0.000 | 0.000 | 0.000 | 1 |
| **Overall** | — | — | **Accuracy 0.833; macro F1 0.778; weighted F1 0.778** | **6** |

Rows are true labels and columns predicted labels, in the order shown:

```text
[[1, 0, 0, 0, 0, 0],
 [0, 1, 0, 0, 0, 0],
 [0, 0, 1, 0, 0, 0],
 [0, 0, 0, 1, 0, 0],
 [0, 0, 0, 0, 1, 0],
 [0, 0, 0, 1, 0, 0]]
```

There are no `Other` predictions. Water precision/recall/F1 are 0/0/0. Five of
six is a 0.833 point estimate; a 95% Wilson interval under an IID Bernoulli
assumption is approximately 0.436–0.970. That assumption is weak here, and one
example per class cannot measure generalization.

### Known-category holdout

The 200 rows and labels below are identical across configurations. The
published 0.860 raw-model result is reproducible for an all-1,200-row
duplicate-weighted ablation, but it is not the exact old serving fit: the
historical serving code used the default 80/20 unique-text split, expanded its
24 training groups back to 958 repeated rows, and held out six groups. That
exact prior serving fit scores 0.855 raw accuracy. Both policy pipelines
remain perfect on this fixture.

| Configuration | Fit data | N evaluated | Excluded | Accuracy | Macro F1 | Weighted F1 | Water P / R / F1 | Final `Other` rate | Rejection rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Raw duplicate-weighted ablation (reported) | all 1,200 rows | 200 | 414 out-of-taxonomy | 0.860 | 0.828 | 0.837 | 0.606 / 1.000 / 0.754 | 0% | 0% |
| Exact prior serving raw LR | 958 repeated rows from 24 distinct train groups | 200 | 414 out-of-taxonomy | 0.855 | 0.824 | 0.833 | 0.597 / 1.000 / 0.748 | 0% | 0% |
| Prior serving domain policy | same 958-row fit plus historic domain overrides | 200 | 414 out-of-taxonomy | 1.000 | 1.000 | 1.000 | 1.000 / 1.000 / 1.000 | 0% | 0% |
| Current local policy | 30 distinct cleaned texts | 200 | 414 out-of-taxonomy | 1.000 | 1.000 | 1.000 | 1.000 / 1.000 / 1.000 | 0% | 0% |
| Current category cascade, providers mocked to miss | same 30-text model + local policy | 200 | 414 out-of-taxonomy | 1.000 | 1.000 | 1.000 | 1.000 / 1.000 / 1.000 | 0% | 0% |

Per-class holdout scores for the raw all-row ablation:

| Class | Precision | Recall | F1 | Support |
|---|---:|---:|---:|---:|
| Electricity | 1.000 | 1.000 | 1.000 | 37 |
| Health | 1.000 | 1.000 | 1.000 | 45 |
| Road | 1.000 | 0.250 | 0.400 | 36 |
| Sanitation | 1.000 | 0.974 | 0.987 | 39 |
| Water | 0.606 | 1.000 | 0.754 | 43 |

The exact prior-serving raw fit has Electricity and Health P/R/F1 of 1/1/1;
Road 1/0.250/0.400; Sanitation 1/0.949/0.974; and Water
0.597/1/0.748. The prior domain policy and current local policy have P/R/F1
of 1/1/1 for each of the five represented categories. Transport has support
zero and is omitted from the per-class tables. No configuration rejects any
of the 200 in-taxonomy records.

Confusion matrices use rows = true and columns = predicted, order
Electricity, Health, Road, Sanitation, Water.

Raw all-row ablation (the reported 0.860):

```text
[[37, 0, 0, 0, 0],
 [0, 45, 0, 0, 0],
 [0, 0, 9, 0, 27],
 [0, 0, 0, 38, 1],
 [0, 0, 0, 0, 43]]
```

Exact prior-serving raw fit (0.855):

```text
[[37, 0, 0, 0, 0],
 [0, 45, 0, 0, 0],
 [0, 0, 9, 0, 27],
 [0, 0, 0, 37, 2],
 [0, 0, 0, 0, 43]]
```

Prior domain policy and current local policy each produce the identity matrix
with diagonal `[37, 45, 36, 39, 43]` and zero off-diagonal entries. The raw
all-row ablation's **27 Road → Water** errors reproduce. The historical rule
corrected those holdout predictions, but the current perfect score remains a
template-set result: the Water override was revised after those same holdout
errors were inspected. The holdout is therefore reused development evidence,
not an untouched final test.

### Statistical validity

- Thirty distinct texts (five per class) are not enough for model selection,
  confidence calibration, or broad accuracy claims. Keeping LogisticRegression
  is a conservative choice, not evidence it is optimal.
- One test item per class is not statistically meaningful. The 5/6 result has
  very wide uncertainty and says little about future complaints.
- A 200/200 score has a 95% Wilson lower bound near 0.981 only under IID,
  representative, correctly labeled examples. The template construction and
  policy iteration violate the main practical assumptions. For Water, 43/43
  gives an IID Wilson lower bound near 0.918, not a guarantee.
- The 414 unrepresented categories are not out-of-scope examples. No labeled
  math/gibberish/unrelated evaluation set exists, so rejection precision,
  recall, and expected rejection rate cannot be estimated.
- Confidence is not calibrated: LogisticRegression probabilities are learned
  from 30 examples with balanced class weights; HF's score threshold is 0.4;
  deterministic rules and Groq answers report zero confidence. Keep these as
  decision signals, not probabilities of correctness.
- Splits use fixed seed 42 and vectorizers are fitted on training text only.
  The production LR fit uses a deterministic solver/configuration, but
  dependency versions are not pinned in `requirements.txt`, so bitwise
  reproducibility across library versions/platforms is not promised.

## Production path and implementation findings

Submission enters `submit_grievance()` in
`backend/app/routers/grievances.py`, combines title and description, and calls
`classify_category()` inside the shared bounded Groq budget. The classifier
short-circuits clearly unrelated prompts, tries the process-local model, then
uses a decisive local keyword result or abstains before the HF/Groq category
fallbacks. Category and priority are stored in the grievance record and
returned in `hfEngine`; the added endpoint regression checks response and
persisted category agree.

| Claim | Finding |
|---|---|
| Word TF-IDF 1–2 grams | Confirmed |
| `char_wb` TF-IDF 3–5 grams, max 1,500 | Confirmed |
| LogisticRegression `max_iter=2000`, balanced classes | Confirmed |
| Lazy training and no serialized production artifact | Confirmed; one model singleton per worker, no model file found |
| Local thresholds 0.50 and top-two margin 0.25 | Confirmed; not calibrated |
| Water needs explicit phrase or corroboration; generic `supply` alone is not Water | Confirmed after narrow corrections below |
| Keyword tie abstains | Confirmed |
| Unsupported/no-signal text becomes `other`, zero confidence, explanation | Confirmed for covered cases; scope gate is heuristic, not validated |
| Decisive local result skips HF/Groq category fallback | Confirmed by code and mocks |
| Submit route does not overwrite category with a second keyword inference | Confirmed |
| Groq category refinement is not called unconditionally | Confirmed; helper remains defined but has no submit call site |
| Repository-wide duplicate category inference/refinement | Found and fixed in `tools/recategorize.py`, which also persists categories |
| Provider failure and latency logging | Groq logs stage, success/failure latency, error type, and available token totals; Hugging Face logs malformed responses and request failures with latency |
| Sensitive grievance text in logs | No full complaint text found in classification log statements; configured providers receive complaint text in prompts |

Source pointers: model constants and thresholds are at
`backend/app/services/grievance_model.py:42-43`; Water evidence and conflict
handling at `:69-140`; vectorizer settings at `:144-145`; grouped split at
`:155-168`; training/fitting at `:194-276`; prediction thresholds at
`:275-306`. Lazy serving setup is in
`backend/app/services/classification.py:95-151`; the scope/keyword/provider
cascade at `:319-533`; HF request timeout/logging at `:380-417`; priority HF
sentiment at `:564-589`; and the retained refinement helper at `:641-681`.
The request path and persistence are in `backend/app/routers/grievances.py:46-223`.
The bulk path is `tools/recategorize.py:32-169`; it now preserves the shared
classifier's category and wraps category/priority calls in the same Groq budget.
Evaluator splitting, raw metrics, legacy comparison, and similarity fitting
are at `backend/evaluate.py:66-100`, `:117-160`, `:163-220`, and `:222-276`.
The model dependencies are unpinned in `requirements.txt:8-13`.

**Confirmed production/evaluation defect fixed:** before this audit,
`_get_ml_model()` called `GrievanceModel().train()` with `test_size=0.2`.
That default is for evaluation and meant the serving model fitted only 24 of
30 cleaned texts. `backend/evaluate.py` evaluated the updated holdout policy
with `train(test_size=0)`, all 30. The serving call now passes `test_size=0`;
a focused regression asserts it. The holdout score happened to remain 1.000
with either 24 or 30 texts because domain rules decided all fixture cases, but
the prior evaluator did not mirror production training size.

**Confirmed Water gaps fixed:** a normalized Hinglish form such as “peene ke
paani ki supply teen din se band hai” was `other` because `paani` normalized
to `water` but the English phrase matcher did not accept “water ki supply”.
That postposition is now covered. A Road complaint with an incidental “water
pipe is nearby” could receive a Water override from two keyword hits; Water
evidence now needs an explicit Water issue phrase when another civic domain is
present. “Water pipeline” alone is no longer treated as an issue phrase;
pipeline leak/burst/broken/contamination phrases remain supported. Focused
regressions cover both cases. Explicit lexical matches can still misread
negation or genuinely multi-issue text; the rule is not semantic analysis.

**Other implementation checks:** train and inference use the same cleaning
function. Split vectorizers are fit only on training groups; duplicates are
removed before current-model fitting; label mapping aligns Road(s) and
Healthcare/Health aliases. Lazy initialization has no lock, so simultaneous
first requests in a worker could redundantly train more than once; the fixed
seed and same data make the completed models equivalent, but CPU work can
duplicate. HF endpoints have per-request timeouts (5 seconds for each of two
category models; 10 seconds for sentiment); the shared 20-second budget bounds
Groq calls, not the total wall time of HF requests.

## Provider-call behavior

No live calls were used for the counts below. Provider stage functions were
mocked to return no result.

| Fixture / path | HF category stage calls | Groq category calls | Groq refinement calls |
|---|---:|---:|---:|
| Known-category holdout, old local policy (200 rows) | 0 | 0 | 200 if Groq was configured; the old router called refinement per submission |
| Known-category holdout, current local-first cascade (200 rows) | 0 | 0 | 0 |
| Eight representative inputs (math, gibberish, civic-but-ambiguous, Water, supply, electricity, bus) | 1 | 1 | 0 |
| Bulk recategorization, per processed grievance | n/a | conditional category fallback | 1 unconditional call in old utility; now 0 refinement calls |

The mock counts are category-stage invocations, not individual HF model HTTP
requests: a failed HF stage can try two models. On the 200 known holdout texts,
the current local model/domain decisions handled all 200. The eight-fixture
set sent only its one in-scope unresolved case through HF and then Groq after
the mocked HF miss; clearly unrelated/no-signal inputs made neither call.
The historical local policy was also decisive for all 200 holdout rows, so this
holdout demonstrates **zero avoided HF/Groq category fallback calls** versus
the old path. The observed difference is the 200 conditional Groq refinement
calls removed. This is a fixture count, not a savings estimate for production
traffic.

The old bulk utility independently performed a keyword overwrite and invoked
`refine_with_groq()` once per grievance if a Groq client was configured. This
was verified from code, not executed against MongoDB; the current utility uses
the same category cascade as submission and makes no refinement call.

`check_quality()` remains a separate suspicious-submission feature and is
still called on submission; if Groq is configured it can make its own call.
Priority sentiment/priority providers are also separate from category
classification and are not included above.

## Regression suite

Original audit run: **568 passed, 24 failed, 5 skipped**. Final follow-up full
run: **588 passed, 24 failed, 5 skipped**. The separate final
`--collect-only` result is 616; the full-run summary categories sum to 617 and
do not reconcile by one item. No classification-focused tests failed. The 24
failures concern unrelated status-vocabulary/state expectations, a Render
transcription config assertion, an image-validation endpoint expectation, and
assignment/RBAC lifecycle expectations. The 5 skips are optional Mongo-backed
cases and the opt-in voice end-to-end test. Test fixtures blank HF/Groq/Sarvam
keys; provider branches were mocked where tested. The final focused backend
suite passed **137/137** with 9 unrelated status-contract tests deselected.

Coverage includes Water phrases and incidental mentions, ambiguous keyword
ties, math/gibberish/unrelated gates, duplicate-safe splitting, conflicting
labels, provider bypass and failure fallback, submit refinement removal,
response-to-persistence category agreement, and bulk recategorization result
preservation. Tests do not establish production classification quality; they
enforce code behavior.

## Modified files in this verification

- `backend/app/services/classification.py` — production fit uses all
  distinct unconflicted examples; contextual Water candidate validation is
  shared across local, keyword, HF and Groq results; provider telemetry and
  outcome/score semantics are explicit.
- `backend/app/services/grievance_model.py` — contextual Water evidence and
  competition checks, including supported Hinglish issue phrases.
- `backend/app/routers/grievances.py` and frontend API contracts — outcome
  metadata persists, and symbols-only text is rejected before classification.
- `backend/app/services/llm_fallback.py` — legacy adapter now delegates to the
  shared bounded cascade.
- `backend/evaluate.py` — production-policy offline evaluation and explicit
  Water false-positive/false-negative counts.
- `tools/recategorize.py` — removed its duplicate keyword overwrite and
  unconditional Groq refinement; use the shared bounded cascade instead.
- `tests/test_classification_cascade.py` — regression cases for the production
  training size and Water policy gaps.
- `tests/test_recategorize.py` — guards the bulk job against category overwrite
  and refinement regression.
- `tests/test_endpoints.py` — verifies classifier category is persisted.
- `docs/ML_EVALUATION.md`, `docs/AI_SYSTEM.md`, and project memory — correction
  notes and durable audit findings.

## Prioritized next steps

1. Collect a new evaluation set of real, consented, human-labeled complaints,
   deduplicated by complaint/event rather than template wording. Keep it
   locked until policy decisions are frozen.
2. Collect out-of-scope and ambiguous/multi-issue examples; include category
   presence, intended primary issue, and whether an officer would abstain.
3. Capture a date-stamped, privacy-safe production sample and officer-reviewed
   labels. Track per-category precision/recall, abstention, and provider-source
   counts separately.
4. Calibrate local and HF confidence thresholds only on training/validation
   data, then report one untouched external test set with confidence intervals.
5. Re-evaluate the Water rules on negative, incidental, negated, Hindi,
   Hinglish, and competing-category cases before extending them.

Until those steps are complete, report the classifier as **EXPERIMENTAL** and
do not claim 100% production accuracy.
