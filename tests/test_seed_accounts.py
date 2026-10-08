"""Testing-phase seed accounts (backend/app/seed_test_accounts.py).

Verifies the matrix the /login dev box advertises:
  superadmin + one MANAGER (ADMIN) and one EMPLOYEE (RESOLVER) per
  department, all idempotent (existing emails untouched).
"""

from __future__ import annotations


def _login(client, email, password):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.json()
    return res.json()


class TestSeedMatrix:
    def test_departments_match_category_keys(self):
        from backend.app.seed_test_accounts import TEST_DEPARTMENTS
        from backend.app.services.classification import CATEGORY_KEYS

        assert [k for k, _ in TEST_DEPARTMENTS] == list(CATEGORY_KEYS)

    def test_seed_creates_matrix_and_is_idempotent(self, client):
        from backend.app.seed_test_accounts import (
            EMPLOYEE_DEFAULT_PASSWORD,
            MANAGER_DEFAULT_PASSWORD,
            SUPERADMIN_DEFAULT_PASSWORD,
            seed_test_accounts,
        )

        first = seed_test_accounts()
        assert first["departments_created"] == 8
        assert first["users_created"] == 17  # superadmin + 8 managers + 8 employees
        assert first["users_skipped"] == 0

        # Spot-check logins, roles and department scoping fields.
        sup = _login(client, "superadmin@grievance.local", SUPERADMIN_DEFAULT_PASSWORD)
        assert sup["user"]["role"] == "SUPERADMIN"
        mgr = _login(client, "water.manager@grievance.local", MANAGER_DEFAULT_PASSWORD)
        assert mgr["user"]["role"] == "ADMIN"
        emp = _login(client, "roads.employee@grievance.local", EMPLOYEE_DEFAULT_PASSWORD)
        assert emp["user"]["role"] == "RESOLVER"

        from backend.app.users_db import users_repository

        assert users_repository.find_by_email("water.manager@grievance.local")["departmentId"] == "water"
        assert users_repository.find_by_email("roads.employee@grievance.local")["departmentId"] == "roads"

        # Second run creates nothing and changes nothing.
        second = seed_test_accounts()
        assert second == {"departments_created": 0, "users_created": 0, "users_skipped": 17}

    def test_existing_accounts_are_left_untouched(self, client):
        import bcrypt as _bcrypt

        from backend.app.seed_test_accounts import seed_test_accounts
        from backend.app.users_db import users_repository

        users_repository.create({
            "email": "water.manager@grievance.local",
            "full_name": "Pre-existing Owner",
            "hashed_password": _bcrypt.hashpw(b"OriginalPass123!", _bcrypt.gensalt(4)).decode(),
            "role": "USER",
            "isActive": True,
        })
        seed_test_accounts()
        kept = users_repository.find_by_email("water.manager@grievance.local")
        assert kept["role"] == "USER"  # not overwritten to ADMIN
        assert kept["full_name"] == "Pre-existing Owner"
        # Original password still works.
        assert client.post("/auth/login", json={
            "email": "water.manager@grievance.local", "password": "OriginalPass123!",
        }).status_code == 200

    def test_seeded_employee_can_work_assigned_ticket(self, client):
        from backend.app.seed_test_accounts import (
            EMPLOYEE_DEFAULT_PASSWORD,
            MANAGER_DEFAULT_PASSWORD,
            seed_test_accounts,
        )

        seed_test_accounts()
        mgr = _login(client, "water.manager@grievance.local", MANAGER_DEFAULT_PASSWORD)
        emp = _login(client, "water.employee@grievance.local", EMPLOYEE_DEFAULT_PASSWORD)
        other = _login(client, "roads.employee@grievance.local", EMPLOYEE_DEFAULT_PASSWORD)
        citizen = client.post("/auth/register", json={
            "email": "seedflow@x.com", "password": "Pass1234!", "full_name": "Seed Flow",
        }).json()

        def _bearer(tok):
            return {"Authorization": f"Bearer {tok}"}

        gid = client.post(
            "/submit-grievance",
            json={"title": "Burst water main", "description": "Flooding the lane"},
            headers=_bearer(citizen["access_token"]),
        ).json()["grievanceId"]
        emp_id = emp["user"]["id"]
        assert client.post(
            f"/grievances/{gid}/assign",
            json={"departmentId": "water", "ownerId": emp_id, "reason": "triage"},
            headers=_bearer(mgr["access_token"]),
        ).status_code == 200
        # Assignee can post progress; another department's employee cannot.
        assert client.post(
            f"/grievances/{gid}/progress",
            json={"bodyInternal": "on site", "visibility": "internal", "kind": "note"},
            headers=_bearer(emp["access_token"]),
        ).status_code == 201
        assert client.post(
            f"/grievances/{gid}/progress",
            json={"bodyInternal": "snoop", "visibility": "internal", "kind": "note"},
            headers=_bearer(other["access_token"]),
        ).status_code == 403
