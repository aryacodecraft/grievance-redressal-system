"""Permission system — static role→permission map v1.

Role strings (as stored in JWT and DB):
  USER        = citizen / grievance raiser
  RESOLVER    = department employee (assigned-only scope)
  ADMIN       = department manager (dept-scoped write)
  SUPERADMIN  = system administrator (global)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException

from .auth import get_current_user

# ── Permission map ────────────────────────────────────────────────────────────
# Keys MUST match the `role` field stored in JWT and users collection.

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "USER": {
        "grievance.view_own",
        "grievance.create",
        "grievance.escalate",
        "grievance.withdraw",
        "department.view",
    },
    "RESOLVER": {
        "grievance.view_own",   # scoped to assigned in router
        "grievance.create",
        "grievance.progress",
        "grievance.transition", # limited: start/block/resume/submit-resolution only
        "grievance.escalate",
        "grievance.resolve",    # propose resolution
        "department.view",
    },
    "ADMIN": {
        "grievance.view_own",
        "grievance.view_dept",
        "grievance.create",
        "grievance.assign",
        "grievance.progress",
        "grievance.transition",
        "grievance.priority",
        "grievance.deadline",
        "grievance.escalate",
        "grievance.resolve",
        "grievance.approve_resolution",
        "grievance.close",
        "grievance.withdraw",
        "grievance.reject",
        "user.view",
        "user.manage",
        "department.view",
        "audit.view_dept",
    },
    "SUPERADMIN": {
        "grievance.view_own",
        "grievance.view_dept",
        "grievance.view_all",
        "grievance.create",
        "grievance.assign",
        "grievance.progress",
        "grievance.transition",
        "grievance.priority",
        "grievance.deadline",
        "grievance.escalate",
        "grievance.resolve",
        "grievance.approve_resolution",
        "grievance.close",
        "grievance.withdraw",
        "grievance.reject",
        "user.view",
        "user.manage",
        "user.manage_admin",
        "role.manage",
        "department.view",
        "department.manage",
        "audit.view_dept",
        "audit.view_all",
    },
}


# ── Dependency factory ────────────────────────────────────────────────────────

def require_permission(permission: str, recheck_db: bool = False):
    """Dependency factory: raise 403 unless caller has *permission*.

    Usage::

        @router.post("/departments")
        def create_dept(current = Depends(require_permission("department.manage"))):
            ...

    When *recheck_db* is True the role is re-fetched from the users collection
    (catches role changes that happened after the access token was issued).
    """

    def _check(
        current: Annotated[dict, Depends(get_current_user)],
    ) -> dict:
        user_role = current.get("role", "")

        if recheck_db:
            # Re-validate role from DB to catch post-issuance role changes
            from .users_db import users_repository
            db_user = users_repository.get(current.get("user_id", ""))
            if not db_user and current.get("email"):
                db_user = users_repository.find_by_email(current["email"])
            if not db_user:
                raise HTTPException(status_code=401, detail="User not found")
            user_role = db_user.get("role", "")
            current = {**current, "role": user_role}

        perms = ROLE_PERMISSIONS.get(user_role, set())
        if permission not in perms:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: requires permission '{permission}'",
            )
        return current

    return _check
