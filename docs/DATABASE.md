# DATABASE.md — Database Design

> Status: PROPOSED — not yet implemented.
> Update this file when migrations are created.

---

## Technology

- PostgreSQL 15+
- SQLAlchemy (async) as ORM
- Alembic for migrations
- pgvector extension for embedding-based similarity search

---

## Core Domain Entities

### users

Stores all authenticated users regardless of role.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR UNIQUE NOT NULL | |
| hashed_password | VARCHAR | NULL for OAuth-only users |
| full_name | VARCHAR NOT NULL | |
| phone | VARCHAR | Optional |
| google_id | VARCHAR UNIQUE | For Google OAuth users |
| avatar_url | VARCHAR | |
| is_active | BOOLEAN DEFAULT TRUE | |
| is_verified | BOOLEAN DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### roles

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR UNIQUE NOT NULL | USER, RESOLVER, ADMIN, SUPERADMIN |
| description | TEXT | |

---

### user_roles

Junction table for user↔role assignment (supports multiple roles per user if needed).

| Column | Type | Notes |
|---|---|---|
| user_id | UUID FK → users | |
| role_id | UUID FK → roles | |
| assigned_by | UUID FK → users | Who assigned this role |
| assigned_at | TIMESTAMPTZ | |

---

### departments

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR UNIQUE NOT NULL | |
| description | TEXT | |
| head_user_id | UUID FK → users | Department head |
| is_active | BOOLEAN DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | |

---

### resolver_profiles

Extended profile for users with RESOLVER role.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users UNIQUE | |
| department_id | UUID FK → departments | |
| expertise_tags | TEXT[] | Skill/domain tags for assignment |
| max_concurrent_cases | INTEGER DEFAULT 10 | For workload management |
| is_available | BOOLEAN DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | |

---

### grievance_categories

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR UNIQUE NOT NULL | |
| description | TEXT | |
| parent_category_id | UUID FK → grievance_categories | For hierarchy |
| default_sla_days | INTEGER | Default SLA for this category |
| assigned_department_id | UUID FK → departments | Default routing |
| is_active | BOOLEAN DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | |

---

### grievances

Core entity.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| reference_number | VARCHAR UNIQUE | Human-readable ID (e.g., GRV-2026-00001) |
| submitter_id | UUID FK → users | Grievance raiser |
| title | VARCHAR NOT NULL | Short title |
| description | TEXT NOT NULL | Full grievance text |
| category_id | UUID FK → grievance_categories | May be NULL before AI classification |
| status | ENUM | See states below |
| severity | ENUM | LOW, MEDIUM, HIGH, CRITICAL |
| initial_priority | SMALLINT | 1–5, set at submission |
| current_priority | SMALLINT | May change over lifecycle |
| priority_reason | TEXT | Reason for current priority (if changed) |
| due_date | TIMESTAMPTZ | SLA deadline |
| submitted_at | TIMESTAMPTZ | |
| acknowledged_at | TIMESTAMPTZ | |
| assigned_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |
| closed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Status Enum:**
```
SUBMITTED, AI_PROCESSING, PENDING_ASSIGNMENT, ASSIGNED,
IN_PROGRESS, PENDING_ESCALATION, ESCALATED,
RESOLVED, UNDER_REVIEW, CLOSED, REJECTED, WITHDRAWN
```

---

### grievance_status_history

Audit trail for all grievance state changes.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| previous_status | ENUM | |
| new_status | ENUM | |
| actor_id | UUID FK → users | NULL if system/AI action |
| action_source | ENUM | HUMAN, AI_RECOMMENDATION, SYSTEM |
| reason | TEXT | |
| metadata | JSONB | Additional context |
| created_at | TIMESTAMPTZ | |

---

### grievance_assignments

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| department_id | UUID FK → departments | |
| resolver_id | UUID FK → users | May be NULL (dept-level assignment) |
| assigned_by | UUID FK → users | Admin who approved |
| ai_recommendation | JSONB | Full AI-07 recommendation stored |
| assignment_type | ENUM | AI_RECOMMENDED, ADMIN_ASSIGNED, REASSIGNED |
| notes | TEXT | |
| is_active | BOOLEAN | Only one active assignment at a time |
| assigned_at | TIMESTAMPTZ | |
| reassigned_at | TIMESTAMPTZ | |

---

### grievance_ai_analysis

Stores all AI analysis results per grievance.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| module_id | VARCHAR | AI-01, AI-02, etc. |
| model_version | VARCHAR | Model/prompt version used |
| input_hash | VARCHAR | Hash of input for cache/dedup |
| result | JSONB | Module-specific structured output |
| confidence | FLOAT | 0–1 where applicable |
| processing_time_ms | INTEGER | |
| created_at | TIMESTAMPTZ | |

---

### grievance_embeddings

Stores Sentence Transformer embeddings for similarity search.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances UNIQUE | |
| embedding | vector(384) | Dimension depends on model |
| model_name | VARCHAR | e.g., all-MiniLM-L6-v2 |
| created_at | TIMESTAMPTZ | |

*Requires pgvector extension.*

---

### grievance_relationships

Links between similar, related, or duplicate grievances.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| source_grievance_id | UUID FK → grievances | |
| target_grievance_id | UUID FK → grievances | |
| relationship_type | ENUM | DUPLICATE, RELATED, RECURRING_PATTERN |
| similarity_score | FLOAT | Cosine similarity |
| detected_by | ENUM | AI, HUMAN | |
| confirmed_by | UUID FK → users | NULL if not human-confirmed |
| created_at | TIMESTAMPTZ | |

---

### comments

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| author_id | UUID FK → users | |
| content | TEXT NOT NULL | |
| is_internal | BOOLEAN DEFAULT FALSE | Internal = not visible to submitter |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### attachments

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| uploaded_by | UUID FK → users | |
| filename | VARCHAR | |
| storage_path | VARCHAR | Server-side storage path |
| file_type | VARCHAR | MIME type |
| file_size_bytes | INTEGER | |
| is_resolution_doc | BOOLEAN DEFAULT FALSE | Resolution-related attachment |
| created_at | TIMESTAMPTZ | |

---

### sla_configurations

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| category_id | UUID FK → grievance_categories | NULL = global default |
| severity | ENUM | NULL = applies to all severities |
| resolution_days | INTEGER NOT NULL | SLA target in days |
| warning_days | INTEGER | Days before deadline to warn |
| is_active | BOOLEAN DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | |

---

### escalations

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| recommended_by | ENUM | AI, HUMAN | |
| ai_reason | TEXT | AI reasoning for recommendation |
| escalated_by | UUID FK → users | Admin who approved escalation |
| escalated_to_id | UUID FK → users | Escalation target user |
| priority_override | SMALLINT | Priority set during escalation |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |

---

### resolutions

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances UNIQUE | |
| submitted_by | UUID FK → users | Resolver |
| resolution_text | TEXT NOT NULL | |
| actions_taken | TEXT | Summary of actions |
| resolution_type | ENUM | RESOLVED, PARTIAL, REFERRED, REJECTED |
| submitted_at | TIMESTAMPTZ | |

---

### resolution_quality_assessments

Stores AI-10 resolution quality evaluation results.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| resolution_id | UUID FK → resolutions | |
| grievance_id | UUID FK → grievances | |
| relevance_score | FLOAT | 0–1 |
| completeness_score | FLOAT | 0–1 |
| overall_score | FLOAT | 0–1 |
| issues_addressed | JSONB | List of identified issues and coverage |
| flagged_for_review | BOOLEAN DEFAULT FALSE | |
| flag_reason | TEXT | |
| model_version | VARCHAR | |
| created_at | TIMESTAMPTZ | |

---

### feedback

User-submitted feedback on resolution.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| grievance_id | UUID FK → grievances | |
| submitted_by | UUID FK → users | |
| rating | SMALLINT | 1–5 |
| comment | TEXT | |
| is_satisfied | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

---

### notifications

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| grievance_id | UUID FK → grievances | NULL for system notifications |
| type | VARCHAR | e.g., STATUS_CHANGE, ASSIGNMENT, ESCALATION |
| title | VARCHAR | |
| message | TEXT | |
| is_read | BOOLEAN DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | |

---

### audit_logs

System-wide audit trail for security and compliance.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| actor_id | UUID FK → users | NULL for system actions |
| action | VARCHAR | e.g., GRIEVANCE_ASSIGNED, ROLE_CHANGED |
| resource_type | VARCHAR | e.g., grievance, user |
| resource_id | UUID | |
| previous_value | JSONB | |
| new_value | JSONB | |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

---

## Key Indexes

```sql
-- Grievance lookup
CREATE INDEX idx_grievances_submitter ON grievances(submitter_id);
CREATE INDEX idx_grievances_status ON grievances(status);
CREATE INDEX idx_grievances_category ON grievances(category_id);
CREATE INDEX idx_grievances_due_date ON grievances(due_date);

-- Assignment lookup
CREATE INDEX idx_assignments_grievance ON grievance_assignments(grievance_id);
CREATE INDEX idx_assignments_resolver ON grievance_assignments(resolver_id);

-- AI analysis lookup
CREATE INDEX idx_ai_analysis_grievance ON grievance_ai_analysis(grievance_id);
CREATE INDEX idx_ai_analysis_module ON grievance_ai_analysis(module_id);

-- Vector similarity (pgvector)
CREATE INDEX idx_embeddings_vector ON grievance_embeddings
  USING ivfflat (embedding vector_cosine_ops);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

---

## Migration Strategy

1. Use Alembic with `--autogenerate` for initial migration from SQLAlchemy models
2. Every schema change gets a new Alembic revision
3. Never modify existing migration files — create new ones
4. Migration history preserved in `alembic/versions/`
5. `alembic upgrade head` is idempotent

---

## Notes and Open Questions

- Vector dimension (384) assumes `all-MiniLM-L6-v2`. Update if model changes — see DEC-004.
- pgvector IVFFlat index requires `VACUUM ANALYZE` after bulk inserts; note for seeding.
- File storage strategy (local filesystem vs. object storage) not finalized — `storage_path` field is agnostic.
- Soft delete pattern: for grievances and users, prefer `is_active = false` over physical delete to preserve audit trail.
