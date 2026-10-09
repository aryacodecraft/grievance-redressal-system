"""RBAC workflow tests for Phase 0-3 routers.

Covers the new endpoints behind one contract:
  assign/reassign, state machine, progress + visibility,
  resolution approve/return, close/withdraw/reopen/reject,
  users/departments/admin/audit/notifications RBAC.

All run in-process with fresh in-memory stores per test (see conftest).
"""

from __future__ import annotations


def _login(client, email, password="Pass1234!"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.json()
    return res.json()


def _make_user(client, email, role="USER", department_id=None):
    from backend.app.users_db import users_repository
    import bcrypt as _bcrypt

    hashed = _bcrypt.hashpw(b"Pass1234!", _bcrypt.gensalt(12)).decode()
    # users_repository here is the fresh per-test instance (conftest rebinds it).
    users_repository.create({
        "email": email,
        "full_name": role,
        "hashed_password": hashed,
        "role": role,
        **({"departmentId": department_id} if department_id else {}),
    })
    return _login(client, email)


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _submit_as(client, token) -> str:
    res = client.post(
        "/submit-grievance",
        json={"title": "Pothole road damage", "description": "Deep pothole damaging vehicles"},
        headers=_bearer(token),
    )
    assert res.status_code == 200, res.json()
    return res.json()["grievanceId"]


class TestAssignRBAC:
    def test_public_reference_lookup_finds_worker_started_grievance(self, client):
        citizen = client.post("/auth/register", json={"email": "public-track@x.com", "password": "Pass1234!", "full_name": "Citizen"}).json()
        grievance_id = _submit_as(client, citizen["access_token"])
        admin = _make_user(client, "public-track-admin@x.com", "ADMIN")
        employee = _make_user(client, "public-track-worker@x.com", "RESOLVER", "roads")
        assigned = client.post(
            f"/grievances/{grievance_id}/assign",
            json={"departmentId": "roads", "ownerId": employee["user"]["id"], "reason": "Route to roads"},
            headers=_bearer(admin["access_token"]),
        )
        assert assigned.status_code == 200, assigned.json()
        started = client.patch(
            f"/grievances/{grievance_id}/state",
            json={"to_state": "IN_PROGRESS", "reason": "Worker started"},
            headers=_bearer(employee["access_token"]),
        )
        assert started.status_code == 200, started.json()
        internal_update = client.post(
            f"/grievances/{grievance_id}/progress",
            json={"bodyInternal": "Private depot access instructions", "visibility": "internal"},
            headers=_bearer(employee["access_token"]),
        )
        assert internal_update.status_code == 201, internal_update.json()
        customer_update = client.post(
            f"/grievances/{grievance_id}/progress",
            json={"bodyInternal": "Crew dispatched", "bodyCustomer": "A crew has started work on the issue.", "visibility": "customer"},
            headers=_bearer(employee["access_token"]),
        )
        assert customer_update.status_code == 201, customer_update.json()

        public = client.get(f"/grievances/{grievance_id.lower()}")
        assert public.status_code == 200, public.json()
        assert public.json()["state"] == "IN_PROGRESS"
        for private_field in ("ownerId", "managerId", "userId", "latitude", "longitude", "imageUrl", "stateHistory", "assignmentHistory"):
            assert private_field not in public.json()
        public_history = client.get(f"/grievances/{grievance_id}/history")
        assert public_history.status_code == 200
        assert any(row.get("bodyCustomer") == "A crew has started work on the issue." for row in public_history.json())
        assert all("bodyInternal" not in row for row in public_history.json())
        assert all("Private depot access instructions" not in str(row) for row in public_history.json())

        another_citizen = client.post("/auth/register", json={"email": "other-track@x.com", "password": "Pass1234!", "full_name": "Other"}).json()
        other_view = client.get(f"/grievances/{grievance_id}", headers=_bearer(another_citizen["access_token"]))
        assert other_view.status_code == 200
        assert other_view.json()["state"] == "IN_PROGRESS"

    def test_roads_manager_assignment_is_visible_to_legacy_transport_employee(self, client):
        citizen = client.post("/auth/register", json={"email": "rt-citizen@x.com", "password": "Pass1234!", "full_name": "Citizen"}).json()
        grievance_id = _submit_as(client, citizen["access_token"])
        from backend.app.users_db import users_repository
        import bcrypt as _bcrypt

        password_hash = _bcrypt.hashpw(b"Pass1234!", _bcrypt.gensalt(12)).decode()
        manager_id = users_repository.create({
            "email": "rt-manager@x.com", "full_name": "Roads manager",
            "hashed_password": password_hash, "role": "ADMIN",
            "departmentId": "Roads & Transport", "isActive": True,
        })
        employee_id = users_repository.create({
            "email": "rt-employee@x.com", "full_name": "Transport employee",
            "hashed_password": password_hash, "role": "RESOLVER",
            "departmentId": "Traffic & Transport Operations", "isActive": True,
        })
        manager = _login(client, "rt-manager@x.com")
        employee = _login(client, "rt-employee@x.com")
        team = client.get("/users", headers=_bearer(manager["access_token"]))
        assert team.status_code == 200
        assert any(row["id"] == employee_id for row in team.json())

        assigned = client.post(
            f"/grievances/{grievance_id}/reassign",
            json={"ownerId": employee_id, "departmentId": "roads", "reason": "Roads team allocation"},
            headers=_bearer(manager["access_token"]),
        )
        assert assigned.status_code == 200, assigned.json()

        tasks = client.get("/resolver/tasks", headers=_bearer(employee["access_token"]))
        assert tasks.status_code == 200, tasks.json()
        assert [task["id"] for task in tasks.json()] == [grievance_id]
        notices = client.get("/notifications", headers=_bearer(employee["access_token"]))
        assert any(row.get("entityId") == grievance_id for row in notices.json())
        started = client.patch(
            f"/grievances/{grievance_id}/state",
            json={"to_state": "IN_PROGRESS", "reason": "Worker started"},
            headers=_bearer(employee["access_token"]),
        )
        assert started.status_code == 200, started.json()

        other_employee = _make_user(client, "water-employee@x.com", "RESOLVER", "water")
        hidden = client.get("/resolver/tasks", headers=_bearer(other_employee["access_token"]))
        assert hidden.status_code == 200
        assert hidden.json() == []

    def test_resolver_list_shows_owned_grievances_without_department_filter(self, client):
        citizen = client.post("/auth/register", json={"email": "queue-citizen@x.com", "password": "Pass1234!", "full_name": "Citizen"}).json()
        grievance_id = _submit_as(client, citizen["access_token"])
        from backend.app.users_db import users_repository
        import bcrypt as _bcrypt

        resolver_id = users_repository.create({
            "email": "queue-resolver@x.com",
            "full_name": "Roads employee",
            "hashed_password": _bcrypt.hashpw(b"Pass1234!", _bcrypt.gensalt(12)).decode(),
            "role": "RESOLVER",
            "departmentId": "roads",
        })
        admin = _make_user(client, "queue-admin@x.com", "ADMIN")
        assigned = client.post(
            f"/grievances/{grievance_id}/assign",
            json={"departmentId": "roads", "ownerId": resolver_id, "reason": "Route to roads"},
            headers=_bearer(admin["access_token"]),
        )
        assert assigned.status_code == 200, assigned.json()

        resolver = _login(client, "queue-resolver@x.com")
        response = client.get("/grievances", headers=_bearer(resolver["access_token"]))
        assert response.status_code == 200
        assert [row["id"] for row in response.json()] == [grievance_id]

    def test_user_cannot_assign(self, client):
        u = client.post("/auth/register", json={"email": "a@x.com", "password": "Pass1234!", "full_name": "A"}).json()
        gid = _submit_as(client, u["access_token"])
        res = client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": "x", "reason": "t"}, headers=_bearer(u["access_token"]))
        assert res.status_code in (401, 403)

    def test_resolver_cannot_assign(self, client):
        u = client.post("/auth/register", json={"email": "b@x.com", "password": "Pass1234!", "full_name": "B"}).json()
        gid = _submit_as(client, u["access_token"])
        r = _make_user(client, "r1@x.com", "RESOLVER")
        res = client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": "x", "reason": "t"}, headers=_bearer(r["access_token"]))
        assert res.status_code == 403

    def test_admin_can_assign_and_sets_due_date(self, client):
        u = client.post("/auth/register", json={"email": "c@x.com", "password": "Pass1234!", "full_name": "C"}).json()
        gid = _submit_as(client, u["access_token"])
        a = _make_user(client, "adm1@x.com", "ADMIN")
        resolver = _make_user(client, "assignable@x.com", "RESOLVER", "roads")
        res = client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": resolver["user"]["id"], "reason": "triage"}, headers=_bearer(a["access_token"]))
        assert res.status_code == 200, res.json()
        assert "dueDate" in res.json()

    def test_assign_invalid_state_422(self, client):
        u = client.post("/auth/register", json={"email": "d@x.com", "password": "Pass1234!", "full_name": "D"}).json()
        gid = _submit_as(client, u["access_token"])
        a = _make_user(client, "adm2@x.com", "ADMIN")
        worker1 = _make_user(client, "first-worker@x.com", "RESOLVER", "roads")
        worker2 = _make_user(client, "second-worker@x.com", "RESOLVER", "roads")
        h = _bearer(a["access_token"])
        assert client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": worker1["user"]["id"], "reason": "t"}, headers=h).status_code == 200
        # Second assign without reset must 422 (already ASSIGNED).
        res = client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": worker2["user"]["id"], "reason": "t2"}, headers=h)
        assert res.status_code == 422


class TestLifecycle:
    def test_full_resolve_close_flow(self, client):
        cit = client.post("/auth/register", json={"email": "lc@x.com", "password": "Pass1234!", "full_name": "Cit"}).json()
        gid = _submit_as(client, cit["access_token"])
        adm = _make_user(client, "ladm@x.com", "ADMIN")
        reso = _make_user(client, "lres@x.com", "RESOLVER", "roads")
        resolver_id = reso["user"]["id"]
        ha, hc = _bearer(adm["access_token"]), _bearer(cit["access_token"]
        )
        # Assign to the resolver's real user id so owner checks pass.
        assert client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": resolver_id, "reason": "t"}, headers=ha).status_code == 200
        # Resolver starts work via canonical state endpoint.
        hr = _bearer(reso["access_token"])
        assert client.patch(f"/grievances/{gid}/state", json={"to_state": "IN_PROGRESS", "reason": "start"}, headers=hr).status_code == 200
        # Resolver posts customer-visible progress.
        p = client.post(f"/grievances/{gid}/progress", json={"bodyInternal": "filled pothole", "bodyCustomer": "Pothole filled", "visibility": "customer", "kind": "note"}, headers=hr)
        assert p.status_code == 201, p.json()
        # Resolver proposes resolution.
        assert client.post(f"/grievances/{gid}/resolution", json={"text": "fixed", "actions": ["filled"]}, headers=hr).status_code == 200
        # Admin approves then closes.
        assert client.post(f"/grievances/{gid}/approve-resolution", headers=ha).status_code == 200
        assert client.post(f"/grievances/{gid}/close", json={"reason": "done"}, headers=ha).status_code == 200
        # Citizen history hides internal but shows customer update.
        h = client.get(f"/grievances/{gid}/history", headers=hc)
        assert h.status_code == 200
        rows = h.json()
        assert any(r.get("visibility") == "customer" for r in rows)
        assert all("bodyInternal" not in r or r.get("visibility") != "customer" or True for r in rows)
        for r in rows:
            assert "bodyInternal" not in r  # citizen projection strips it

    def test_resolver_cannot_read_unassigned_history(self, client):
        cit = client.post("/auth/register", json={"email": "h1@x.com", "password": "Pass1234!", "full_name": "H"}).json()
        gid = _submit_as(client, cit["access_token"])
        adm = _make_user(client, "hadm@x.com", "ADMIN")
        reso = _make_user(client, "hres@x.com", "RESOLVER", "roads")
        assigned_to = _make_user(client, "hres-other@x.com", "RESOLVER", "roads")
        client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": assigned_to["user"]["id"], "reason": "t"}, headers=_bearer(adm["access_token"]))
        res = client.get(f"/grievances/{gid}/history", headers=_bearer(reso["access_token"]))
        assert res.status_code == 403

    def test_citizen_cannot_escalate_others(self, client):
        a = client.post("/auth/register", json={"email": "e1@x.com", "password": "Pass1234!", "full_name": "E1"}).json()
        b = client.post("/auth/register", json={"email": "e2@x.com", "password": "Pass1234!", "full_name": "E2"}).json()
        gid = _submit_as(client, a["access_token"])
        res = client.post(f"/grievances/{gid}/escalate", json={"reason": "urgent"}, headers=_bearer(b["access_token"]))
        assert res.status_code == 403


class TestSystemRBAC:
    def test_users_list_requires_permission(self, client):
        u = client.post("/auth/register", json={"email": "u1@x.com", "password": "Pass1234!", "full_name": "U"}).json()
        assert client.get("/users", headers=_bearer(u["access_token"])).status_code == 403
        sup = _make_user(client, "sup1@x.com", "SUPERADMIN")
        res = client.get("/users", headers=_bearer(sup["access_token"]))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_only_superadmin_can_change_roles(self, client):
        sup = _make_user(client, "sup2@x.com", "SUPERADMIN")
        adm = _make_user(client, "adm3@x.com", "ADMIN")
        target_id = adm["user"]["id"]
        # ADMIN lacks user.manage_admin.
        res = client.post(f"/users/{target_id}/roles", json={"role": "RESOLVER", "reason": "t"}, headers=_bearer(adm["access_token"]))
        assert res.status_code == 403
        res = client.post(f"/users/{target_id}/roles", json={"role": "RESOLVER", "reason": "t"}, headers=_bearer(sup["access_token"]))
        assert res.status_code == 200
        assert res.json()["role"] == "RESOLVER"

    def test_departments_superadmin_write(self, client):
        adm = _make_user(client, "dadm@x.com", "ADMIN")
        sup = _make_user(client, "dsup@x.com", "SUPERADMIN")
        res = client.post("/departments", json={"name": "Roads", "key": "roads"}, headers=_bearer(adm["access_token"]))
        assert res.status_code == 403
        res = client.post("/departments", json={"name": "Roads", "key": "roads"}, headers=_bearer(sup["access_token"]))
        assert res.status_code == 201

    def test_audit_and_notifications_flow(self, client):
        cit = client.post("/auth/register", json={"email": "an@x.com", "password": "Pass1234!", "full_name": "An"}).json()
        gid = _submit_as(client, cit["access_token"])
        adm = _make_user(client, "aan@x.com", "ADMIN")
        sup = _make_user(client, "asn@x.com", "SUPERADMIN")
        resolver = _make_user(client, "notif-worker@x.com", "RESOLVER", "roads")
        client.post(f"/grievances/{gid}/assign", json={"departmentId": "roads", "ownerId": resolver["user"]["id"], "reason": "t"}, headers=_bearer(adm["access_token"]))
        # Audit visible to superadmin.
        res = client.get("/audit", headers=_bearer(sup["access_token"]))
        assert res.status_code == 200
        assert any(r.get("entityId") == gid for r in res.json())
        # Citizen got an assignment notification.
        res = client.get("/notifications", headers=_bearer(cit["access_token"]))
        assert res.status_code == 200
        assert any(gid in (r.get("entityId") or "") for r in res.json())
