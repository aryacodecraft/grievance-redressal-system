# AI_SYSTEM.md — AI Module Specifications

> Every AI capability is documented separately.
> Status: The module specifications below include PLANNED designs. Stage 4B
> adds an IMPLEMENTED speech-to-text backend; see the feature note below.
> Do not claim an LLM call automatically constitutes a validated AI module.

---

## Design Principles

Stage 4B speech-to-text is an IMPLEMENTED draft-assistance backend (mock testing
recorded in memory/CHANGELOG.md), not a validated recognition model. It returns
original-language text for citizen review, creates no grievance and stores no
AI output in MongoDB. Stage 5 frontend is IMPLEMENTED and mock TESTED; real
speech accuracy remains unvalidated. See [VOICE_ASSISTED_COMPLAINT.md](VOICE_ASSISTED_COMPLAINT.md).

1. AI is a **decision-support layer**, not a final authority.
2. Every AI output includes: module ID, model/version, confidence score (where available), timestamp.
3. AI outputs are stored in the database — not only returned transiently.
4. Human review is required for flagged outputs.
5. Every module has a defined fallback behavior for unavailability.
6. Evaluation metrics are defined before any module is declared VALIDATED.
7. Experimental status is declared honestly — fabricated metrics are not acceptable.
8. Citizen-facing surfaces never display classification outputs (predicted
   category/department, priority, keywords, explanation) or confidence scores;
   the operational triage diagnostic is staff-only (DEC-044).

---

## AI-01 — Grievance Summarization

**Status:** PLANNED
**Purpose:** Generate a concise summary of the grievance text for use by admins and resolvers.

**Input:**
- `grievance_id`: UUID
- `description`: Full grievance text
- `title`: Grievance title

**Output:**
```json
{
  "summary": "string (2–4 sentences)",
  "key_issues": ["list of identified key issues"],
  "model_version": "string",
  "confidence": null
}
```

**Approach:** LLM API prompt-based (zero-shot). Prompt instructs the model to summarize
neutrally and identify the core issues without adding interpretation.

**Evaluation Metrics:** ROUGE-L / BERTScore against human-written summaries (dataset required).

**Fallback:** Return empty summary — do not block grievance processing.

**Human Review:** Not required for summarization specifically; admins may always edit.

**Limitations:**
- Quality depends on LLM API and prompt design
- Very long grievances may require chunking
- Dataset for evaluation not yet available (DATASET REQUIRED)

---

## AI-02 — Category Classification

**Status:** IMPLEMENTED — EXPERIMENTAL; not VALIDATED (2026-10-20 audit)
**Purpose:** Classify the grievance into a predefined category from `grievance_categories`.

**Input:**
- `description`: Grievance text
- `available_categories`: List of category names and descriptions

**Output:**
```json
{
  "predicted_category_id": "UUID",
  "predicted_category_name": "string",
  "confidence": 0.0,
  "top_alternatives": [
    {"category_id": "...", "category_name": "...", "score": 0.0}
  ],
  "model_version": "string"
}
```

**Serving implementation:** `backend/app/services/classification.py` calls the existing
`backend/app/services/grievance_model.py` first: word TF-IDF (1–2 grams) plus
character `char_wb` TF-IDF (3–5 grams, at most 1,500 features), horizontally
combined and fitted with `LogisticRegression(max_iter=2000,
class_weight="balanced")`. Text is lowercased, Hinglish terms are normalized,
and punctuation outside Latin/Devanagari text is removed. Vectorizers are fit
only on the training groups. The current dataset is
`backend/data/Citizen (1).csv`; exact cleaned-text duplicates and conflicting
label groups are audited before fitting. There is no serialized model artifact:
the model is trained lazily in each server process, using all distinct,
unconflicted training texts. The stratified 24/6 split is for evaluation only;
the serving model does not reserve a test subset.

The local confidence policy keeps the existing 0.50 LogisticRegression score
and 0.25 top-two-margin thresholds; these scores have not been calibrated on
independent data. HF's zero-shot score is also not treated as a calibrated
probability. Explicit domain overrides, keyword decisions, and Groq outputs
are tagged by source and report confidence `0.0` because they do not produce a
calibrated probability. `hfEngine.modelInfo` records `categorySource`, a
`categoryOutcome` (`categorized`, `other`, or `uncertain`), and
`categoryConfidenceSemantics`. The persisted routing category `other` does not
by itself mean rejection: the outcome says whether the classifier selected
Other or abstained. Explicitly out-of-scope text is rejected before local
classification and before submission side effects. Uncertain outcomes are not
discarded: they remain available for officer review. Local model and decisive keyword results avoid HF/Groq
category calls. Explicitly unrelated requests are stopped before local model
classification; after the local model, no-signal text returns `other` with zero
confidence and an uncertainty explanation. Uncertain text with a civic signal
may use the existing bounded HF/Groq cascade. Groq categories are validated
against `CATEGORY_KEYS`; a generative answer does not receive an invented 0.95
confidence. The submit route no longer overwrites a model category with a
second generic keyword pass or performs unconditional Groq refinement.

Thresholds and model hyperparameters were not tuned: the labeled file contains
only 30 distinct cleaned examples (five per category), too few to establish a
reliable winner or calibrate confidence. See [ML evaluation audit](ML_EVALUATION.md)
and the [independent pipeline verification](ML_CLASSIFICATION_AUDIT_2026-10-20.md).
The production algorithm remains the existing LogisticRegression model.

### Civic relevance gate

Before image validation, classifier/provider calls, reference generation or
persistence, a local deterministic gate rejects only recognizable,
clearly non-civic intent (for example arithmetic, joke/creative requests,
plain greetings, keyboard-row gibberish, sports results and generic definition
requests without civic-problem language). Punctuation-only input remains a
separate basic validation error. The gate checks request intent, not just
whether civic nouns such as "road", "water" or "hospital" appear. Ambiguous,
short, misspelled and multilingual complaints are not rejected on category
uncertainty; the existing `other` queue remains the human-review path. The
optional quality classifier runs only after local category abstention and is
fail-open. This is an explainable baseline with false-positive and
false-negative risk, not a validated relevance model.

Water is accepted only when the shared local policy finds an explicit Water
service issue phrase and no comparably strong competing civic-domain signal.
Supported examples include a burst, broken, leaking, or damaged water main;
these phrases are evidence only when the complaint describes a water service
issue and no stronger competing category signal.
The same contextual check is applied to local model, keyword, Hugging Face,
and Groq Water candidates. Unsupported Water candidates are discarded and the
cascade continues to another allowed fallback or returns `other`/uncertain.
This conservative rule can miss valid Water wording outside its supported
phrases; the tiny training set and absence of an independent labeled test set
do not justify a broader rule. The offline evaluator injects its split model
into this same production policy with external providers disabled.

**Evaluation Metrics:** Accuracy, macro-F1, per-category precision/recall/F1,
confusion matrix, Water precision/recall, and rejection rate. Formal validation
still needs a larger, independently labeled dataset.

**Fallback:** Preserve the existing API/taxonomy with `category="other"`,
`categoryConfidence=0`, and an uncertainty explanation; do not force Water.

**Human Review:** Low-confidence classifications surfaced to admin for confirmation.

**Limitations:**
- Quality degrades for ambiguous multi-category grievances
- Requires clear category definitions to work well
- New categories require prompt update or re-evaluation (DATASET REQUIRED)

---

## AI-03 — Entity Extraction

**Status:** PLANNED
**Purpose:** Extract named entities relevant to the grievance (locations, officials, departments, dates, amounts, etc.).

**Input:**
- `description`: Grievance text

**Output:**
```json
{
  "entities": [
    {"type": "LOCATION", "text": "Block A, Main Campus", "start": 12, "end": 30},
    {"type": "DEPARTMENT", "text": "Hostel Office", "start": 45, "end": 58},
    {"type": "DATE", "text": "last Monday", "start": 60, "end": 71},
    {"type": "PERSON", "text": "Warden Singh", "start": 80, "end": 93}
  ],
  "model_version": "string"
}
```

**Approach:** LLM API prompt-based NER. May be supplemented by spaCy NER for speed.

**Evaluation Metrics:** Precision, Recall, F1 per entity type (labeled dataset required).

**Fallback:** Return empty entity list — entity extraction is supplementary.

**Human Review:** Not required; informational only.

**Limitations:** General-purpose NER may miss domain-specific entities (DATASET REQUIRED).

---

## AI-04 — Severity Assessment

**Status:** PLANNED
**Purpose:** Estimate the severity of the grievance: LOW, MEDIUM, HIGH, or CRITICAL.

**Input:**
- `description`: Grievance text
- `title`: Grievance title
- `category`: Category name (if available)

**Output:**
```json
{
  "severity": "HIGH",
  "severity_score": 0.78,
  "reasoning": "string — brief explanation of severity assessment",
  "model_version": "string"
}
```

**Approach:** LLM API with structured output. Prompt includes severity definitions.

**Severity Definitions (initial):**
- CRITICAL: Immediate safety, health, legal, or rights risk
- HIGH: Significant operational impact, rights violation, requires urgent attention
- MEDIUM: Standard service failure, notable inconvenience
- LOW: Minor issue, informational, or suggestion

**Evaluation Metrics:** Accuracy / Kappa against human-labeled severity scores (DATASET REQUIRED).

**Fallback:** Default to MEDIUM if assessment fails.

**Human Review:** Admin may override severity at any time; override is recorded in audit log.

**Limitations:**
- Severity is partially subjective; LLM assessment is an approximation
- High-stakes severity decisions (CRITICAL) should always be reviewed by admin

---

## AI-05 — Priority Estimation

**Status:** PLANNED
**Purpose:** Estimate initial grievance priority (1 = highest, 5 = lowest) combining severity,
category urgency, and other signals.

**Input:**
- `severity`: AI-04 output
- `category`: Category name and default SLA
- `description`: Grievance text
- `is_recurring`: Boolean flag from AI-06 (if available)

**Output:**
```json
{
  "priority": 2,
  "reasoning": "string",
  "model_version": "string"
}
```

**Approach:** Hybrid rule-based + LLM. Rules apply clear mappings (CRITICAL → priority 1),
LLM provides nuance for ambiguous cases.

**Dynamic Priority:** Priority may later be updated by AI-08 (delay/risk signals).
Original priority is preserved; change history is recorded. See DEC-006.

**Evaluation Metrics:** Correlation with human-assigned priorities (DATASET REQUIRED).

**Fallback:** Map severity to priority via fixed rule (CRITICAL→1, HIGH→2, MEDIUM→3, LOW→4).

---

## AI-06 — Similar / Related Grievance Detection

**Status:** PLANNED
**Purpose:** Identify previously submitted grievances that are similar, related, or duplicates.
Detect recurring grievance patterns suggesting systemic issues.

**Input:**
- `grievance_id`: New grievance
- `embedding`: Sentence Transformer embedding of the new grievance

**Output:**
```json
{
  "similar_grievances": [
    {
      "grievance_id": "UUID",
      "reference_number": "GRV-2026-00042",
      "similarity_score": 0.91,
      "relationship_type": "DUPLICATE",
      "title": "string"
    }
  ],
  "recurring_pattern_detected": false,
  "pattern_description": null,
  "model_version": "string"
}
```

**Approach:**
1. Generate embedding using Sentence Transformers (`all-MiniLM-L6-v2` or similar)
2. Query `grievance_embeddings` via pgvector cosine similarity
3. Apply threshold: score > 0.85 → candidate for DUPLICATE, 0.65–0.85 → RELATED
4. If multiple similar grievances from different submitters within N days → RECURRING_PATTERN flag

**Important:** Do not treat every similar grievance as a duplicate.
Distinguish: DUPLICATE (same underlying issue), RELATED (similar topic), RECURRING_PATTERN (systemic).

**Evaluation Metrics:**
- Precision/Recall for duplicate detection on labeled pairs
- Semantic similarity correlation with human judgment

**Fallback:** Return empty similar list — do not block grievance processing.

**Human Review:** Admin confirms or rejects suggested DUPLICATE links. RECURRING_PATTERN flags surface to admin dashboard.

**Limitations:**
- Quality depends on embedding model choice (see DEC-004)
- Cosine similarity alone may miss paraphrased duplicates → hybrid BM25+embedding considered
- pgvector index requires maintenance as embeddings grow

---

## AI-07 — Assignment Recommendation

**Status:** PLANNED
**Purpose:** Recommend department, team, and/or individual resolver for the grievance.

**Input:**
- `grievance_id`: UUID
- `category_id`: From AI-02
- `severity`: From AI-04
- `entities`: From AI-03 (location, department mentions)
- `current_resolver_workloads`: Dict of {resolver_id: active_count}

**Output:**
```json
{
  "recommended_department_id": "UUID",
  "recommended_department_name": "string",
  "recommended_resolver_id": "UUID",
  "recommended_resolver_name": "string",
  "confidence": 0.82,
  "reasoning": "string — why this assignment is recommended",
  "alternatives": [
    {"department_id": "...", "resolver_id": "...", "score": 0.67, "reasoning": "..."}
  ],
  "model_version": "string"
}
```

**Approach:**
- Primary: Rule-based mapping from category → department (via `grievance_categories.assigned_department_id`)
- Enhancement: LLM-based reasoning using category, severity, entities, and department descriptions
- Resolver selection: Consider expertise tags, current workload, availability

**Human Approval Required:** Per DEC-003, an Admin must approve, modify, or override.
AI recommendation is stored alongside final human assignment decision.

**Evaluation Metrics:**
- Assignment accuracy (does recommended department match ground truth?)
- Resolver workload distribution fairness
(Labeled dataset required for formal evaluation)

**Fallback:** Recommend only department (based on category mapping); leave resolver unassigned.

---

## AI-08 — Delay / Risk Assessment

**Status:** PLANNED
**Purpose:** Identify grievances at risk of SLA breach, inactivity, or delay.

**Input (per grievance evaluation):**
- `grievance_id`: UUID
- `current_status`: State
- `assigned_at`: Timestamp
- `due_date`: SLA deadline
- `last_action_at`: Timestamp of last status change or comment
- `reassignment_count`: Integer
- `escalation_history`: List

**Output:**
```json
{
  "risk_level": "HIGH",
  "risk_flags": [
    "approaching_sla_deadline",
    "no_activity_7_days"
  ],
  "days_to_deadline": 2,
  "recommended_action": "Escalate or reassign — no activity in 7 days with deadline in 2 days",
  "model_version": "string"
}
```

**Approach:**
- Rule-based: Deterministic checks for SLA deadline proximity and inactivity thresholds
- Optional ML enhancement: Risk score prediction based on historical patterns (if data available)

**Evaluation Metrics:** Precision/Recall for identifying actually-delayed grievances (post-hoc).

**Fallback:** Rule-based checks are deterministic — no failure mode.

**Human Review:** AI-08 outputs feed AI-09 escalation recommendations, surfaced to admin dashboard.

---

## AI-09 — Escalation Recommendation

**Status:** PLANNED
**Purpose:** Recommend escalation for at-risk or stalled grievances.

**Input:**
- AI-08 risk assessment output
- `grievance_id` metadata

**Output:**
```json
{
  "recommend_escalation": true,
  "urgency": "IMMEDIATE",
  "reason": "string",
  "suggested_escalation_target_role": "ADMIN",
  "model_version": "string"
}
```

**Approach:** Rule-based triggers (risk_level = HIGH + specific flags) with optional LLM narrative.

**Human Approval Required:** Admin must approve escalation. AI recommendation is advisory.

**Fallback:** Surface flag to admin without escalation recommendation text.

---

## AI-10 — Resolution Quality Assessment

**Status:** PLANNED — high research priority
**Purpose:** Evaluate whether a submitted resolution adequately addresses the original grievance.

**Input:**
- `grievance_id`: UUID
- `description`: Original grievance text
- `key_issues`: From AI-01 (key issues list)
- `actions_taken`: Resolver's recorded actions
- `resolution_text`: Final resolution text

**Output:**
```json
{
  "relevance_score": 0.78,
  "completeness_score": 0.65,
  "overall_score": 0.72,
  "issues_addressed": [
    {"issue": "Water supply disruption", "addressed": true, "evidence": "Resolution mentions..."},
    {"issue": "Compensation request", "addressed": false, "evidence": null}
  ],
  "flagged_for_review": true,
  "flag_reason": "Completeness below threshold — compensation issue not addressed",
  "model_version": "string"
}
```

**Approach:**
- LLM-based evaluation: Provide grievance, key issues, and resolution text; ask model to evaluate coverage
- Semantic similarity as a secondary signal (resolution embedding vs. grievance embedding)
- Threshold-based flagging: overall_score < 0.6 → flagged for human review

**IMPORTANT:** Flagged resolutions are presented to admin for review. They are **not automatically rejected**.

**Evaluation Metrics:**
- Correlation with human quality ratings
- Precision/Recall for flagging genuinely inadequate resolutions
(Labeled dataset of grievance-resolution pairs required)

**Fallback:** Skip quality assessment — do not block resolution submission. Flag as UNASSESSED.

**Human Review Required:** All flagged resolutions must receive human review before closure.

**Limitations:**
- Resolution quality is inherently subjective
- LLM evaluation is an approximation of human judgment
- Assessment quality degrades for highly technical or domain-specific resolutions
- Dataset for calibration not yet available (DATASET REQUIRED)

---

## AI-11 — Administrative Insight Generation

**Status:** PLANNED — lower priority
**Purpose:** Generate natural-language summaries and pattern descriptions for the analytics dashboard.

**Input:** Aggregated analytics data (from AnalyticsService)

**Output:** Natural language summaries of:
- Emerging complaint clusters
- Recurring grievance patterns
- Department performance trends
- Workload distribution observations

**Approach:** LLM API with structured analytics data in prompt.

**Fallback:** Display raw analytics without natural language summaries.

**Human Review:** Insights are informational — no human approval required.

---

### Optional complaint-photo validation

When the configured vision model returns a parseable relevance score, the
backend compares it with `IMAGE_LLM_THRESHOLD`; scores below threshold reject
the attachment. The vision model is experimental and can misclassify images.
The local sharpness/brightness/resolution heuristic is diagnostic only: it
cannot establish that an image depicts the reported issue. If vision is missing,
fails, or returns an unusable response, the photo remains attached as
`unverified` for staff review rather than being approved by the heuristic.
Staff grievance review and employee task detail surfaces display this state.
This is not a validated screenshot detector; human review remains necessary.

## Evaluation Protocol (General)

Before any module is declared VALIDATED:

1. Define ground truth: what does a correct output look like?
2. Collect or assemble a labeled evaluation dataset
3. Run the module against the dataset
4. Compute defined metrics
5. Record results in an evaluation report (to be added to `docs/` or `research/`)
6. Document failure modes and limitations

Until evaluated: all modules remain PROTOTYPE / EXPERIMENTAL.
