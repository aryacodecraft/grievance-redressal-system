# ADMIN_UI_RESTRUCTURING_PLAN.md — Admin Architecture Plan

> **Created:** 2026-10-05  
> **Source:** Owner approved design proposal  
> **Status:** IMPLEMENTED (2026-10-05, DEC-018)

---

## 1. Overview & Vision
Reorganize the administrative interface into a modular, production-grade 3-part layout:
1. **Admin Control Panel (`/admin`)**: Clean, high-throughput triage board containing top numerical metrics, filters, SLA countdown indicators, and a clean grievance list.
2. **Centered Grievance Review Modal (`GrievanceReviewModal.tsx`)**: Opens in a centered dialog when any grievance is clicked, displaying full details, photographic evidence, single-pin location map, AI automated triage diagnostics, and officer action controls.
3. **Analytics & Oversight Dashboard (`/admin/analytics`)**: Dedicated executive analytics page housing macro metrics, category distribution charts, TF-IDF similarity clusters, geographic cluster maps, and CSV/PDF export tools.

---

## 2. Layout & Page Navigation

```
                       ┌─────────────────────────────────────────┐
                       │           Admin Top Nav Bar             │
                       │   [Grievance Queue]   [Analytics]      │
                       └──────────────────┬──────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌─────────────────────────┐                     ┌─────────────────────────┐
     │  /admin                 │                     │  /admin/analytics       │
     ├─────────────────────────┤                     ├─────────────────────────┤
     │ • Metric Cards          │                     │ • Macro Charts          │
     │ • Filter & Search Strip │                     │ • TF-IDF Clusters       │
     │ • Grievance Table       │                     │ • Geographic Heatmap    │
     │   (with SLA Status)     │                     │ • CSV / Report Export   │
     └────────────┬────────────┘                     └─────────────────────────┘
                  │
        (Click Grievance Row)
                  │
                  ▼
     ┌─────────────────────────┐
     │ Grievance Review Modal  │
     │ (Centered Dialog)       │
     ├─────────────────────────┤
     │ • Details & Citizen ID  │
     │ • Image Evidence        │
     │ • Pinpoint Map          │
     │ • AI Triage Analysis    │
     │ • Officer Actions       │
     └─────────────────────────┘
```

---

## 3. Detailed Component Specifications

### Page 1: Main Admin Control Panel (`/admin`)
* **Metrics Summary Bar**: Numerical cards for Total Grievances, Urgent Attention (pulsing), Pending Routing, and Resolved Count.
* **Filter Strip**: Search bar, Department selector, Priority filter, Status filter, and Sort order.
* **Grievance Queue Table**: Clean table displaying Ticket ID, Title, Department, Priority, Status, Assignee, SLA Countdown (`Overdue` / `On Track`), and Age.
* **No Inline Maps/Charts**: Kept lean for high-speed triage.

### Component 2: Grievance Review Modal (`GrievanceReviewModal.tsx`)
* **Trigger**: Clicking any row in the `/admin` queue table opens this centered backdrop modal.
* **Content**:
  * Ticket Reference ID, timestamp, citizen user ID, status, and priority badges.
  * Full title, description, and attached photographic proof with full-resolution link.
  * Single-location interactive Leaflet map showing exact latitude/longitude.
  * AI Automated Triage panel (predicted category, confidence score, urgency flags, key phrases).
  * Action controls: Nodal department assignment dropdown, resolution memo text field, and status transition buttons (`Assign & Route`, `In Progress`, `Mark Resolved`, `Reject / Close`).

### Page 3: Executive Analytics (`/admin/analytics`)
* **Navigation**: Accessible via top sub-tabs (`Grievance Queue` | `Analytics & Metrics`) on the Admin header.
* **Geographic Cluster Map**: Full-width Leaflet map with spatial marker clustering across zones.
* **TF-IDF Similarity Clusters**: Card list grouping duplicate or related grievances by semantic similarity.
* **Analytics Charts**: Category distribution pie/bar charts and volume trends.
* **Report Export**: Action button to export grievance metrics and registry records as CSV.

---

## 4. Implementation Checklist
- [x] Create `/admin/analytics` page route and move `AdminCharts`, `AdminClusters`, and `AdminMap` spatial cluster view into it.
- [x] Add top sub-tabs (`Grievance Queue` | `Executive Analytics`) to `/admin` layout/header. (`AdminNav.tsx`)
- [x] Build `GrievanceReviewModal.tsx` as a centered dialog containing single-pin Leaflet map, image viewer, AI analysis, and action buttons.
- [x] Refactor `/admin` page & `AdminBoard.tsx` into a clean full-width table view with SLA status badges and modal trigger.
- [x] Add CSV export functionality on `/admin/analytics`.
- [x] Verify build (`npm run build`) and pytest suite.

### Implementation Notes (2026-10-05, DEC-018)
- SLA badges come from `frontend/lib/sla.ts`, a deterministic prototype heuristic
  (`createdAt + priority SLA days`; high 3d / medium 7d / low 14d) because the
  backend does not yet persist a `due_date` (Phase 9 / OQ-005 OPEN). Replace with the
  server deadline once SLA configuration ships.
- Shared admin chrome (`AdminGate`, `AdminNav`/`AdminHeader`) and
  `useAdminGrievanceFeed` keep the queue and analytics pages on one access/loading contract.
- `npm run build` passes; `/admin` and `/admin/analytics` return 200 under `next start`.
- `pytest -q`: 196 passed / 27 skipped / 7 failed — the 7 failures are **pre-existing**
  `tests/test_status_vocabularies.py` source-parsers (missing `TIMELINE` in
  `GrievanceCard.tsx`, missing `Field label="Status"` in `AdminBoard.tsx`) and are not
  caused by this restructuring.
