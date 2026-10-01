# DATABASE.md — Database Design

> Status: **IMPLEMENTED** for the `grievances` collection.
> Formerly a proposed PostgreSQL/pgvector schema — that design is deferred to
> the roadmap at the bottom of this file.

---

## Technology

- **MongoDB** (MongoDB Atlas, free M0 tier)
- **pymongo 4.x** — synchronous driver
- No ORM and no migration tooling: the FastAPI endpoints are sync `def`
  functions (FastAPI runs them in a threadpool), so a blocking driver is
  appropriate and simpler than `motor`.
- Indexes are ensured at application startup, not via a migration.

---

## Connection

Set these in `backend/.env` (see `backend/.env.example`):

| Var | Example | Notes |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/` | **Required for persistence.** `mongodb+srv` needs `dnspython`. |
| `MONGODB_DB` | `grievance` | Database name; defaults to `grievance`. |

If `MONGODB_URI` is unset the API falls back to an **in-memory repository**,
logs a warning, and reports `"storage": "in-memory"` from `GET /health`.
That keeps local development working before Atlas is configured, but data is
lost on restart.

---

## Collection: `grievances`

One document per grievance. Human-readable id scheme: `GRV-<year>-<seq>`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique, e.g. `GRV-2026-0001`. Returned as `id`. |
| `title` | string | Required. |
| `description` | string | Required. |
| `userId` | string | Submitter id. **Not authenticated** — see `docs/SECURITY.md`. |
| `status` | string | `open` → `assigned` → `in_progress` → `resolved`. |
| `category` | string | One of `CATEGORY_KEYS`. Mirrors `hfEngine.category`. |
| `priority` | string | `low` \| `medium` \| `high`. Mirrors `hfEngine.priority`. |
| `createdAt` | **BSON date** | Stored as UTC `Date`, serialised back to ISO-8601 by the API. |
| `imageUrl` | string | Optional — Cloudinary secure URL. |
| `imageValidation` | object | Optional — `{llm_score, explanation, raw}`. |
| `latitude` | double | Optional. |
| `longitude` | double | Optional. |
| `assignee` | string | Optional — department name once an officer acts. |
| `hfEngine` | object | AI triage output (below). |

### `hfEngine`

```json
{
  "category": "roads",
  "priority": "high",
  "isUrgent": true,
  "keywords": ["pothole", "road"],
  "explanation": "…",
  "rawCategoryLabel": "Issues related to roads, …",
  "categoryConfidence": 0.95,
  "urgentMatches": ["deep pothole"],
  "modelInfo": {
    "categoryModel": "…", "priorityModel": "…",
    "sentimentLabel": "neutral", "sentimentScore": 0.0,
    "groqModel": "…", "hfCategory": "roads", "hfPriority": "medium"
  }
}
```

### Indexes (created at startup)

| Name | Keys | Purpose |
|---|---|---|
| `uniq_grievance_id` | `id` (unique) | Primary lookup + prevents duplicate ids. |
| `user_created` | `userId` asc, `createdAt` desc | Citizen-scoped `GET /grievances?userId=…`. |

---

## Repository abstraction

`backend/app/db.py` defines a `GrievanceRepository` protocol with two
implementations:

- `MongoRepository` — used when `MONGODB_URI` is set.
- `InMemoryRepository` — fallback when it is not.

Routers only depend on the protocol, so the storage backend can change without
touching any HTTP layer.

---

## Roadmap (deferred)

The original PostgreSQL design is preserved here for later phases. None of it
is implemented:

`users`, `roles`, `user_roles`, `departments`, `resolver_profiles`,
`grievance_categories`, `grievance_status_history`, `grievance_assignments`,
`grievance_ai_analysis`, `grievance_embeddings`, `grievance_relationships`,
`comments`, `attachments`, `sla_configurations`, `escalations`, `resolutions`,
`resolution_quality_assessments`, `feedback`, `notifications`, `audit_logs`.

Notes:

- Real authentication and RBAC are out of scope for this pass (demo session).
- Similarity search no longer needs `grievance_embeddings`/pgvector: TF-IDF
  clustering runs client-side in the admin panel (`frontend/lib/tfidf.ts`),
  exactly as the legacy HTML did. A server-side port remains optional.
