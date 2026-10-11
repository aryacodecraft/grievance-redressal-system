"""Unit tests for the updated User data model (Block 1).

Covers:
  - Allowing email = null and password_hash = null.
  - phone (normalized E.164, unique, sparse index).
  - citizen_id (CIT-<8 digits>, unique, generated server-side with collision retry).
  - auth_method = "face_only" | "password" | "google".
  - Existing users and flows unchanged.
  - Password and Google login for a face_only user returns the same generic failure.
  - In-memory repository index behaviors.
"""

from __future__ import annotations

import re
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.users_db import (
    InMemoryUsersRepository,
    normalize_phone,
    generate_citizen_id,
)


@pytest.mark.parametrize(
    "raw_phone",
    [
        "9876543210",
        "+919876543210",
        "919876543210",
        "09876543210",
        "+91 98765-43210",
        "+91 (98765) 43210",
        "98765-43210",
    ],
)
def test_normalize_phone_valid_variants(raw_phone):
    assert normalize_phone(raw_phone) == "9876543210"


@pytest.mark.parametrize(
    "invalid_phone",
    [
        "5876543210",  # does not start with 6-9
        "12345",       # too short
        "abcdefghij",  # non-digits
    ],
)
def test_normalize_phone_invalid_cases(invalid_phone):
    with pytest.raises(ValueError):
        normalize_phone(invalid_phone)


def test_generate_citizen_id():
    cid = generate_citizen_id()
    assert re.match(r"^CIT-\d{8}$", cid)


class TestInMemoryUsersRepositoryDataModel:
    def test_create_face_only_user(self):
        repo = InMemoryUsersRepository()
        cid = repo.generate_unique_citizen_id()
        uid = repo.create({
            "full_name": "Ramesh Kumar",
            "phone": "9876543210",
            "citizen_id": cid,
            "auth_method": "face_only",
            "role": "USER",
        })

        user = repo.get(uid)
        assert user is not None
        assert user["id"] == uid
        assert user["email"] is None
        assert user["hashed_password"] is None
        assert user["phone"] == "9876543210"
        assert user["citizen_id"] == cid
        assert user["auth_method"] == "face_only"
        assert user["role"] == "USER"

    def test_multiple_null_emails_do_not_collide(self):
        repo = InMemoryUsersRepository()
        u1 = repo.create({"full_name": "User 1", "phone": "9876543211", "auth_method": "face_only"})
        u2 = repo.create({"full_name": "User 2", "phone": "9876543212", "auth_method": "face_only"})

        assert u1 != u2
        assert repo.get(u1)["email"] is None
        assert repo.get(u2)["email"] is None

    def test_duplicate_phone_rejected(self):
        repo = InMemoryUsersRepository()
        repo.create({"full_name": "User 1", "phone": "9876543210", "auth_method": "face_only"})
        with pytest.raises(ValueError, match="already exists"):
            repo.create({"full_name": "User 2", "phone": "+919876543210", "auth_method": "face_only"})

    def test_duplicate_citizen_id_rejected(self):
        repo = InMemoryUsersRepository()
        cid = repo.generate_unique_citizen_id()
        repo.create({"full_name": "User 1", "citizen_id": cid, "auth_method": "face_only"})
        with pytest.raises(ValueError, match="already exists"):
            repo.create({"full_name": "User 2", "citizen_id": cid.lower(), "auth_method": "face_only"})

    def test_find_by_identifier(self):
        repo = InMemoryUsersRepository()
        cid = repo.generate_unique_citizen_id()
        repo.create({
            "full_name": "Citizen One",
            "phone": "9876543210",
            "phoneVerifiedAt": "test-otp-verified",
            "citizen_id": cid,
            "auth_method": "face_only",
        })
        repo.create({
            "full_name": "Standard User",
            "email": "standard@example.com",
            "hashed_password": "hash",
            "auth_method": "password",
        })

        # By citizen_id
        assert repo.find_by_identifier(cid)["citizen_id"] == cid
        assert repo.find_by_identifier(cid.lower())["citizen_id"] == cid

        # By phone
        assert repo.find_by_identifier("+919876543210")["citizen_id"] == cid
        assert repo.find_by_identifier("9876543210")["citizen_id"] == cid

        # By email
        assert repo.find_by_identifier("standard@example.com")["email"] == "standard@example.com"

        # Unknown
        assert repo.find_by_identifier("unknown@example.com") is None
        assert repo.find_by_identifier("CIT-00000000") is None
        assert repo.find_by_identifier("+910000000000") is None


def test_password_login_rejects_face_only_user():
    from backend.app.users_db import users_repository
    client = TestClient(app)

    # Register face_only user directly in repository with an email (simulating an edge-case account)
    uid = users_repository.create({
        "full_name": "Face Only User",
        "email": "faceonly_test@example.com",
        "auth_method": "face_only",
        "role": "USER",
    })

    try:
        # Attempt password login
        res = client.post("/auth/login", json={"email": "faceonly_test@example.com", "password": "AnyPassword123!"})
        assert res.status_code == 401
        err_msg = res.json().get("error") or res.json().get("detail")
        assert err_msg == "Invalid email or password"
    finally:
        users_repository.delete(uid)


def test_face_only_user_can_submit_and_track_grievance():
    from backend.app.users_db import users_repository
    from backend.app.auth import create_access_token

    client = TestClient(app)
    cid = users_repository.generate_unique_citizen_id()
    uid = users_repository.create({
        "full_name": "Radha Sharma",
        "phone": "9876500001",
        "citizen_id": cid,
        "auth_method": "face_only",
        "role": "USER",
    })
    token = create_access_token(uid, "USER", email=None)
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # 1. Submit grievance
        res_submit = client.post(
            "/submit-grievance",
            json={
                "title": "Street light broken near park",
                "description": "Street light pole 14 has been dark for a week causing safety concerns.",
                "category": "electricity",
            },
            headers=headers,
        )
        assert res_submit.status_code == 200, res_submit.text
        data = res_submit.json()
        assert "grievanceId" in data
        gid = data["grievanceId"]

        # 2. Track grievance by ID
        res_track = client.get(f"/grievances/{gid}", headers=headers)
        assert res_track.status_code == 200
        g_data = res_track.json()
        assert g_data["id"] == gid
        assert g_data["userId"] == uid

        # 3. List my grievances
        res_list = client.get("/grievances", headers=headers)
        assert res_list.status_code == 200
        items = res_list.json()
        assert any(item["id"] == gid for item in items)
    finally:
        users_repository.delete(uid)


class TestMongoUsersRepositoryDataModel:
    @pytest.fixture
    def mongo_users_repo(self):
        import os
        import uuid
        from pymongo import MongoClient
        from backend.app.users_db import MongoUsersRepository

        uri = os.getenv("MONGODB_URI_TEST")
        if not uri:
            pytest.skip("MONGODB_URI_TEST not set")
        db_name = os.getenv("MONGODB_DB", "grievance_db")
        client = MongoClient(uri)
        temp_col_name = f"test_users_{uuid.uuid4().hex[:8]}"
        repo = MongoUsersRepository(uri, db_name)
        repo._col = client[db_name][temp_col_name]
        repo.ensure_indexes()
        try:
            yield repo
        finally:
            try:
                repo._col.drop()
            except Exception:
                pass

    def test_mongo_create_face_only_and_sparse_indexes(self, mongo_users_repo):
        from pymongo.errors import DuplicateKeyError

        cid1 = mongo_users_repo.generate_unique_citizen_id()
        cid2 = mongo_users_repo.generate_unique_citizen_id()

        # Two face-only users with no email
        u1 = mongo_users_repo.create({
            "full_name": "Citizen One",
            "phone": "9876543211",
            "citizen_id": cid1,
            "auth_method": "face_only",
            "role": "USER",
        })
        u2 = mongo_users_repo.create({
            "full_name": "Citizen Two",
            "phone": "9876543212",
            "citizen_id": cid2,
            "auth_method": "face_only",
            "role": "USER",
        })

        assert u1 != u2
        doc1 = mongo_users_repo.get(u1)
        assert doc1["email"] is None
        assert doc1["phone"] == "+919876543211"
        assert doc1["citizen_id"] == cid1

        # Lookups
        assert mongo_users_repo.find_by_phone("9876543211")["id"] == u1
        assert mongo_users_repo.find_by_citizen_id(cid1)["id"] == u1
        assert mongo_users_repo.find_by_identifier(cid2)["id"] == u2

        # Duplicate phone raises DuplicateKeyError
        with pytest.raises(DuplicateKeyError):
            mongo_users_repo.create({
                "full_name": "Duplicate Phone",
                "phone": "+919876543211",
                "auth_method": "face_only",
            })

        # Duplicate citizen_id raises DuplicateKeyError
        with pytest.raises(DuplicateKeyError):
            mongo_users_repo.create({
                "full_name": "Duplicate CID",
                "citizen_id": cid1,
                "auth_method": "face_only",
            })
