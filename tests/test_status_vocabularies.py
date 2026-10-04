"""The four status vocabularies that must migrate together in Phase 2.

DEC-006 specifies 12 uppercase states. Nothing implements them yet, so the
codebase currently runs on four *different* lowercase vocabularies, each
maintained by hand in a different file:

| Source                | Values                                        |
|-----------------------|-----------------------------------------------|
| Backend default       | `open` (submit + `to_api()` fallback)         |
| `GrievanceCard`       | `TIMELINE` — submitted/assigned/… /closed     |
| `Badge.StatusBadge`   | open, submitted, assigned, in_progress, …     |
| `AdminBoard` filter   | open, assigned, in_progress, resolved         |
| `lib/mock.ts`         | open, assigned, in_progress, resolved         |

These tests parse the sources rather than importing them (the timeline and
badge live inside JSX, which cannot be loaded outside a React runtime). They
pin two things: the *current* divergence, so nobody "fixes" one site in
isolation, and the *shape* of DEC-006's target set, so Phase 2 knows it is a
four-way migration rather than a backend-only change.

When Phase 2 lands, expect the assertions marked `PHASE 2` to fail — update
them to the new vocabulary rather than deleting them.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"


def _read(*relative: str) -> str:
    return (FRONTEND.joinpath(*relative)).read_text(encoding="utf-8")


# ── Extractors ──────────────────────────────────────────────────────────────


def _timeline_statuses() -> list[str]:
    source = _read("components", "grievance", "GrievanceCard.tsx")
    match = re.search(r"const TIMELINE\s*=\s*\[([^\]]*)\]", source)
    assert match, "TIMELINE array not found in GrievanceCard.tsx"
    return re.findall(r'"([^"]+)"', match.group(1))


def _badge_branch_statuses() -> set[str]:
    """Every literal `StatusBadge` compares against, plus its input."""
    source = _read("components", "ui", "Badge.tsx")
    match = re.search(r"export function StatusBadge.*?\{(.*?)\n\}", source, re.S)
    assert match, "StatusBadge not found in Badge.tsx"
    return set(re.findall(r'"([^"]+)"', match.group(1))) | {"status"}


def _admin_filter_statuses() -> set[str]:
    source = _read("components", "admin", "AdminBoard.tsx")
    start = source.find('Field label="Status"')
    assert start != -1, "Status filter field not found in AdminBoard.tsx"
    block = source[start : source.find("</Select>", start)]
    return set(re.findall(r'<option value="([^"]+)"', block)) - {"all"}


def _mock_statuses() -> set[str]:
    source = _read("lib", "mock.ts")
    return set(re.findall(r'status:\s*"([^"]+)"', source))


def _backend_default_status() -> str:
    source = (ROOT / "backend" / "app" / "db.py").read_text(encoding="utf-8")
    match = re.search(r'"status":\s*doc\.get\("status",\s*"([^"]+)"\)', source)
    assert match, "backend status default not found in db.py::to_api"
    return match.group(1)


# ── Each source parses at all ───────────────────────────────────────────────


def test_every_vocabulary_source_still_parses():
    """If a file is refactored beyond recognition, fail loudly here rather
    than silently feeding an empty set to every assertion below."""
    assert _timeline_statuses(), "TIMELINE extracted nothing"
    assert _badge_branch_statuses() - {"status"}, "badge branches extracted nothing"
    assert _admin_filter_statuses(), "admin status filter extracted nothing"
    assert _mock_statuses(), "mock.ts statuses extracted nothing"
    assert _backend_default_status()


# ── The current divergence (documented, not endorsed) ───────────────────────


def test_backend_default_status_renders_as_a_badge():
    """`open` is what every new grievance gets, so it must be one of the
    states `StatusBadge` styles — anything else falls through to the neutral
    `outline` tone and reads as "unclassified" to an officer."""
    default = _backend_default_status()
    assert default in _badge_branch_statuses(), (
        f"backend default status {default!r} is not handled by StatusBadge"
    )


def test_backend_default_status_is_absent_from_the_timeline():
    """BASELINE for Phase 2 — explains the `idx === -1` fallback.

    `TIMELINE` starts at `submitted` but the backend writes `open`, so a
    freshly submitted grievance is never "on" the timeline. GrievanceCard
    papers over this with `idx = current === -1 ? 0 : current`, which draws
    step 0. Without that line the component would render no progress at all.
    """
    default = _backend_default_status()
    assert default not in _timeline_statuses(), (
        "the timeline now covers the default status — update "
        "test_backend_default_status_is_absent_from_the_timeline to match"
    )


def test_the_four_vocabularies_are_not_identical():
    """PHASE 2 tripwire: four sites, four sets, no shared source of truth.

    Dec-006's migration is not complete until this fails — i.e. until every
    site reads one exported list. Delete this test only at that point.
    """
    sets = {
        "timeline": set(_timeline_statuses()),
        "badge": _badge_branch_statuses() - {"status"},
        "adminFilter": _admin_filter_statuses(),
        "mock": _mock_statuses(),
    }
    assert len({frozenset(v) for v in sets.values()}) > 1, (
        f"all four vocabularies now agree ({sets}) — consolidate them into one "
        "module and replace this test with a shared-source assertion"
    )


def test_admin_filter_covers_every_mock_status():
    """Every status mock data can carry must be selectable in the admin
    filter, otherwise a mock grievance is permanently un-filterable."""
    missing = _mock_statuses() - _admin_filter_statuses()
    assert not missing, f"mock statuses with no admin filter option: {sorted(missing)}"


def test_admin_filter_misses_the_timeline_endpoints():
    """BASELINE for Phase 2: an officer cannot filter to `closed` even though
    the timeline renders it, and `submitted` appears only as a timeline step.

    Neither can arrive from the backend today (it only ever writes `open`, and
    PATCH stores whatever string it is given) — but once DEC-006's states
    circulate, the filter silently under-reports.
    """
    uncovered = set(_timeline_statuses()) - _admin_filter_statuses()
    # `submitted` and `closed` are timeline steps with no filter option.
    assert uncovered, (
        "the admin filter now covers the whole timeline — update this baseline"
    )


def test_all_current_vocabs_are_lowercase():
    """The present convention, pinned so DEC-006's uppercase set reads as a
    deliberate breaking change rather than a partial refactor."""
    everything = (
        set(_timeline_statuses())
        | _badge_branch_statuses()
        | _admin_filter_statuses()
        | _mock_statuses()
    )
    assert everything == {s.lower() for s in everything}


# ── DEC-006's target ────────────────────────────────────────────────────────

DEC_006_STATES = [
    "SUBMITTED",
    "AI_PROCESSING",
    "PENDING_ASSIGNMENT",
    "ASSIGNED",
    "IN_PROGRESS",
    "PENDING_ESCALATION",
    "ESCALATED",
    "RESOLVED",
    "UNDER_REVIEW",
    "CLOSED",
    "REJECTED",
    "WITHDRAWN",
]


def test_dec_006_state_list_matches_the_decision_record():
    """Guard against `memory/DECISIONS.md` and this test drifting apart — the
    migration will be measured against whichever one is read first."""
    text = (ROOT / "memory" / "DECISIONS.md").read_text(encoding="utf-8")
    block = re.search(r"## DEC-006.*?\n(.*?)(?=\n## )", text, re.S)
    assert block, "DEC-006 entry not found in memory/DECISIONS.md"
    for state in DEC_006_STATES:
        assert state in block.group(1), f"{state} missing from DEC-006"
    assert len(DEC_006_STATES) == 12


def test_dec_006_states_are_disjoint_from_the_current_lowercase_set():
    """Case-sensitive disjointness is what makes Phase 2 a *migration*:

    `open` is not `SUBMITTED`, and `resolved` is not `RESOLVED`, so no amount
    of case-folding in a component will bridge the two sets. Every call site
    listed in the module docstring has to be touched.
    """
    current = (
        set(_timeline_statuses())
        | _badge_branch_statuses()
        | _admin_filter_statuses()
        | _mock_statuses()
        | {_backend_default_status()}
    )
    overlap = current & set(DEC_006_STATES)
    assert overlap == set(), f"unexpectedly already migrated: {sorted(overlap)}"


def test_no_component_already_speaks_dec_006():
    """If some file has already moved to uppercase states, the migration has
    started and this module's premise needs revisiting."""
    offenders = []
    for path in (FRONTEND / "components").rglob("*.tsx"):
        source = path.read_text(encoding="utf-8")
        for state in DEC_006_STATES:
            # Look for a quoted uppercase state, e.g. status === "ESCALATED".
            if re.search(rf'"{state}"', source):
                offenders.append(f"{path.name}:{state}")
    assert not offenders, (
        f"DEC-006 states already referenced in components: {offenders} — "
        "the four-site migration has begun; update this module"
    )
