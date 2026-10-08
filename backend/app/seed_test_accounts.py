"""Testing-phase seed accounts — one MANAGER + one EMPLOYEE per department.

Dev-only. Called from startup when ``SEED_TEST_ACCOUNTS`` is true, and
directly by ``tests/test_seed_accounts.py``. Every account is idempotent:
an existing email is left untouched (never updated, never re-hashed).

Department taxonomy intentionally mirrors ``CATEGORY_KEYS`` in
``services/classification.py`` (asserted by test, not imported, to keep
this module light). ``departmentId`` on users therefore matches the
``departmentId`` set at assignment time, so scoping tests are meaningful.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("grievance-api")

# (department key, display name) — keys MUST equal CATEGORY_KEYS.
TEST_DEPARTMENTS: tuple[tuple[str, str], ...] = (
    ("water", "Water Supply & Sewerage Board"),
    ("roads", "Roads & Infrastructure Authority"),
    ("transport", "Traffic & Transport Operations"),
    ("electricity", "Electricity & Power Distribution"),
    ("sanitation", "Municipal Sanitation & Waste"),
    ("health", "Public Health & Medical Services"),
    ("governance", "Civic Governance & Citizen Services"),
    ("other", "General Urban Administration"),
)

SUPERADMIN_EMAIL = "superadmin@grievance.local"
SUPERADMIN_DEFAULT_PASSWORD = "SuperAdmin@2026!"
MANAGER_DEFAULT_PASSWORD = "Manager@2026!"
EMPLOYEE_DEFAULT_PASSWORD = "Resolver@2026!"


def seed_test_accounts(password_override: str | None = None) -> dict:
    """Create default superadmin + per-department test users. Idempotent.

    Returns ``{"departments_created": int, "users_created": int,
    "users_skipped": int}``.
    """
    import bcrypt as _bcrypt

    from .config import SEED_TEST_PASSWORD
    from .repositories.departments import dept_repository
    from .users_db import users_repository

    password = (password_override if password_override is not None
                else (SEED_TEST_PASSWORD or ""))
    manager_pw = password or MANAGER_DEFAULT_PASSWORD
    employee_pw = password or EMPLOYEE_DEFAULT_PASSWORD
    superadmin_pw = password or SUPERADMIN_DEFAULT_PASSWORD

    stats = {"departments_created": 0, "users_created": 0, "users_skipped": 0}

    def _ensure_user(email: str, pw: str, role: str, name: str,
                     department_id: str | None = None) -> None:
        if users_repository.find_by_email(email):
            stats["users_skipped"] += 1
            return
        hashed = _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt(12)).decode()
        doc: dict = {
            "email": email.lower(),
            "full_name": name,
            "hashed_password": hashed,
            "role": role,
            "isActive": True,
        }
        if department_id:
            doc["departmentId"] = department_id
        users_repository.create(doc)
        stats["users_created"] += 1
        logger.info("Seeded test %s account: %s", role, email)

    # Default superadmin (main.py only seeds one when env vars are set).
    _ensure_user(SUPERADMIN_EMAIL, superadmin_pw, "SUPERADMIN", "Test SuperAdmin")

    for key, display in TEST_DEPARTMENTS:
        try:
            if not dept_repository.get_by_key(key):
                dept_repository.create({"name": display, "key": key, "isActive": True})
                stats["departments_created"] += 1
        except Exception:
            logger.exception("Test seed: could not ensure department %s", key)
        _ensure_user(f"{key}.manager@grievance.local", manager_pw,
                     "ADMIN", f"{display} Manager (test)", department_id=key)
        _ensure_user(f"{key}.employee@grievance.local", employee_pw,
                     "RESOLVER", f"{display} Employee (test)", department_id=key)

    return stats
