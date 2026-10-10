"""Core tests for citizen face login (Step 2) and recovery (Step 3).

Covers:
  - Login works with phone and Citizen ID; JWT works for /grievances
  - Unknown identifier and privileged roles (ADMIN, SUPERADMIN, RESOLVER) return identical generic 401
  - face_only user gets 403 on staff routes
  - MODEL_MISMATCH does not increment lockout counter
  - Admin reset deletes template and mints token; re-enroll succeeds and burns token (single-use)
  - Re-enroll with expired/wrong token fails generically
"""

from __future__ import annotations

import base64
import io
import time
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from backend.app import config, users_db
from backend.app.auth import create_access_token, create_reenroll_token, JWT_SECRET, JWT_ALGORITHM
import jwt
from backend.app.main import app
from backend.app.repositories import face_templates as face_repo_mod
from backend.app.services import face_service
from backend.app.services.face_service import Detection


FRAME_SIZE = 96


def make_frame(index: int) -> bytes:
    lo = min(6 + index * 20, 160)
    hi = lo + 90
    arr = np.full((FRAME_SIZE, FRAME_SIZE, 3), hi, dtype=np.uint8)
    yy, xx = np.indices((FRAME_SIZE, FRAME_SIZE))
    arr[((yy // 4) + (xx // 4)) % 2 == 0] = lo
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _frames(count: int = 5) -> list[str]:
    return [base64.b64encode(make_frame(i)).decode() for i in range(count)]


_VECPACHE: dict[int, np.ndarray] = {}


def person_vector(person: int) -> np.ndarray:
    if person not in _VECPACHE:
        rng = np.random.default_rng(2000 + person)
        _VECPACHE[person] = rng.standard_normal(face_service.FACE_EMBED_DIM).astype(np.float32)
    return _VECPACHE[person]


class FakeDetector:
    def __init__(self, person: int = 1) -> None:
        self.person = person
        self.face_count = 1
        self.det_score = 0.99
        self.reset()

    def reset(self) -> None:
        self.yaw = lambda idx: 0.0
        self.ear = lambda idx: 0.30
        self.mouth = lambda idx: 0.60

    def __call__(self, img: np.ndarray) -> list[Detection]:
        idx = max(0, min(int(round((float(img.mean()) - 51.0) / 20.0)), 7))
        return [
            Detection(
                bbox=(20.0, 20.0, 220.0, 220.0),
                det_score=self.det_score,
                embedding=person_vector(self.person),
                yaw_degrees=float(self.yaw(idx)),
                eye_aspect=float(self.ear(idx)),
                mouth_width=float(self.mouth(idx)),
            )
            for _ in range(self.face_count)
        ]


class FakeEmbedder:
    def __init__(self, person: int = 1) -> None:
        self.person = person

    def __call__(self, img: np.ndarray, det: Detection) -> np.ndarray:
        return person_vector(self.person)


def satisfy(action: str, fake: FakeDetector) -> None:
    if action == "turn_left":
        fake.yaw = lambda idx: min(idx, 4) * 12.0
    elif action == "turn_right":
        fake.yaw = lambda idx: -min(idx, 4) * 12.0
    elif action == "blink":
        fake.ear = lambda idx: 0.05 if 1 <= idx <= 3 else 0.30
    elif action == "smile":
        fake.mouth = lambda idx: 0.70 if 1 <= idx <= 3 else 0.60


@pytest.fixture()
def face_env(monkeypatch):
    monkeypatch.setattr(config, "FACE_AUTH_ENABLED", True)
    detector = FakeDetector()
    embedder = FakeEmbedder()
    monkeypatch.setattr(face_service, "_real_detections", detector)
    monkeypatch.setattr(face_service, "_real_embed", embedder)
    return detector


@pytest.fixture()
def client(face_env):
    with TestClient(app, base_url="https://testserver") as tc:
        yield tc


def _challenge(client) -> tuple[str, str]:
    res = client.post("/auth/face/challenge")
    assert res.status_code == 200, res.text
    d = res.json()
    return d["challenge_id"], d["action"]


def _signup_citizen(client, face_env, phone: str = "9876543210", name: str = "Asha Sharma") -> dict:
    res_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": name, "phone": phone, "consent": True},
    )
    assert res_start.status_code == 200, res_start.text
    st_data = res_start.json()
    satisfy(st_data["action"], face_env)

    res_comp = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": st_data["signup_token"],
            "challenge_id": st_data["challenge_id"],
            "frames": _frames(5),
        },
    )
    assert res_comp.status_code == 200, res_comp.text
    return res_comp.json()


def test_login_works_with_phone_and_citizen_id(client, face_env):
    signup_data = _signup_citizen(client, face_env, phone="9876543210")
    citizen_id = signup_data["citizen_id"]
    phone = "9876543210"

    # 1. Login with phone
    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_phone = client.post(
        "/auth/face/login",
        json={"identifier": phone, "challenge_id": cid, "frames": _frames(5)},
    )
    assert res_phone.status_code == 200, res_phone.text
    token_phone = res_phone.json()["access_token"]
    assert res_phone.json()["user"]["phone"] == phone

    # Verify JWT works for /grievances
    res_grv = client.get("/grievances", headers={"Authorization": f"Bearer {token_phone}"})
    assert res_grv.status_code == 200

    # 2. Login with Citizen ID
    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_cid = client.post(
        "/auth/face/login",
        json={"identifier": citizen_id, "challenge_id": cid, "frames": _frames(5)},
    )
    assert res_cid.status_code == 200, res_cid.text
    token_cid = res_cid.json()["access_token"]
    assert res_cid.json()["user"]["citizen_id"] == citizen_id

    res_grv2 = client.get("/grievances", headers={"Authorization": f"Bearer {token_cid}"})
    assert res_grv2.status_code == 200


def test_unknown_identifier_and_privileged_role_return_generic_401(client, face_env):
    # 1. Unknown identifier
    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_unknown = client.post(
        "/auth/face/login",
        json={"identifier": "9800000000", "challenge_id": cid, "frames": _frames(5)},
    )
    assert res_unknown.status_code == 401
    assert res_unknown.json() == {"error": "Face sign-in failed"}

    # 2. Privileged roles: ADMIN, SUPERADMIN, RESOLVER
    users_db.users_repository.create({
        "email": "testadmin@city.gov",
        "full_name": "Admin User",
        "role": "ADMIN",
        "auth_method": "password",
    })
    users_db.users_repository.create({
        "email": "testresolver@city.gov",
        "full_name": "Resolver Staff",
        "role": "RESOLVER",
        "auth_method": "password",
    })

    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_admin = client.post(
        "/auth/face/login",
        json={"identifier": "testadmin@city.gov", "challenge_id": cid, "frames": _frames(5)},
    )
    assert res_admin.status_code == 401
    assert res_admin.json() == {"error": "Face sign-in failed"}

    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_res = client.post(
        "/auth/face/login",
        json={"identifier": "testresolver@city.gov", "challenge_id": cid, "frames": _frames(5)},
    )
    assert res_res.status_code == 401
    assert res_res.json() == {"error": "Face sign-in failed"}

    # Lockout counters for unknown & privileged are NOT incremented
    repo = face_repo_mod.face_repository
    assert repo.rate_count("face:fail:email:testadmin@city.gov", 900) == 0
    assert repo.rate_count("face:fail:email:testresolver@city.gov", 900) == 0
    assert repo.rate_count("face:fail:id:9800000000", 900) == 0


def test_face_only_user_gets_403_on_staff_routes(client, face_env):
    signup_data = _signup_citizen(client, face_env, phone="9876543211")
    token = signup_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Citizen accessing admin overview
    res_admin = client.get("/admin/overview", headers=headers)
    assert res_admin.status_code == 403

    # Citizen accessing staff routes
    res_users = client.get("/users", headers=headers)
    assert res_users.status_code == 403

    res_audit = client.get("/audit", headers=headers)
    assert res_audit.status_code == 403


def test_model_mismatch_does_not_increment_lockout(client, face_env, monkeypatch):
    phone = "9876543212"
    _signup_citizen(client, face_env, phone=phone)

    # Change model name to simulate model version drift
    monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_l")

    cid, action = _challenge(client)
    satisfy(action, face_env)
    res = client.post(
        "/auth/face/login",
        json={"identifier": phone, "challenge_id": cid, "frames": _frames(5)},
    )
    assert res.status_code == 401
    assert res.json() == {"error": "Face sign-in failed"}
    assert res.headers.get("x-face-reason") == "MODEL_MISMATCH"

    # Counter did not move
    repo = face_repo_mod.face_repository
    assert repo.rate_count(f"face:fail:id:{phone}", 900) == 0


def test_admin_reset_and_reenroll_token_single_use(client, face_env):
    phone = "9876543213"
    signup_data = _signup_citizen(client, face_env, phone=phone)
    user_id = signup_data["user"]["id"]
    citizen_id = signup_data["citizen_id"]

    # Verify template exists
    assert face_repo_mod.face_repository.get_template(user_id) is not None

    # Admin auth token
    admin_token = create_access_token(user_id="admin-1", role="ADMIN", email="admin@test.gov")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin reset
    res_reset = client.post(f"/auth/face/admin-reset/{user_id}", headers=admin_headers)
    assert res_reset.status_code == 200, res_reset.text
    reset_data = res_reset.json()
    assert "re_enroll_token" in reset_data
    token = reset_data["re_enroll_token"]

    # Template was deleted
    assert face_repo_mod.face_repository.get_template(user_id) is None

    # 2. Re-enroll with token (public)
    cid, action = _challenge(client)
    satisfy(action, face_env)
    res_reenroll = client.post(
        "/auth/face/re-enroll",
        json={
            "token": token,
            "identifier": citizen_id,
            "challenge_id": cid,
            "frames": _frames(5),
        },
    )
    assert res_reenroll.status_code == 200, res_reenroll.text
    reenroll_data = res_reenroll.json()
    assert reenroll_data.get("re_enrolled") is True
    assert "access_token" in reenroll_data

    # Template is restored
    assert face_repo_mod.face_repository.get_template(user_id) is not None

    # 3. Token is burned (single-use)
    cid2, action2 = _challenge(client)
    satisfy(action2, face_env)
    res_reuse = client.post(
        "/auth/face/re-enroll",
        json={
            "token": token,
            "identifier": citizen_id,
            "challenge_id": cid2,
            "frames": _frames(5),
        },
    )
    assert res_reuse.status_code == 400
    err = res_reuse.json().get("error") or res_reuse.json().get("detail")
    assert err == "Invalid or expired re-enrollment token"


def test_reenroll_with_invalid_or_expired_token_fails_generically(client, face_env):
    cid, action = _challenge(client)
    satisfy(action, face_env)

    # 1. Completely bogus token
    res_bogus = client.post(
        "/auth/face/re-enroll",
        json={
            "token": "bogus.token.here",
            "identifier": "9876543210",
            "challenge_id": cid,
            "frames": _frames(5),
        },
    )
    assert res_bogus.status_code == 400
    assert (res_bogus.json().get("error") or res_bogus.json().get("detail")) == "Invalid or expired re-enrollment token"

    # 2. Wrong token type (e.g. standard access token)
    access_tok = create_access_token(user_id="usr-1", role="USER")
    cid2, action2 = _challenge(client)
    satisfy(action2, face_env)
    res_wrong_type = client.post(
        "/auth/face/re-enroll",
        json={
            "token": access_tok,
            "identifier": "9876543210",
            "challenge_id": cid2,
            "frames": _frames(5),
        },
    )
    assert res_wrong_type.status_code == 400
    assert (res_wrong_type.json().get("error") or res_wrong_type.json().get("detail")) == "Invalid or expired re-enrollment token"

    # 3. Expired re-enrollment token
    expired_payload = {
        "sub": "usr-1",
        "phone": "9876543210",
        "type": "re_enroll",
        "exp": int(time.time()) - 100,
        "iat": int(time.time()) - 200,
        "jti": "expired-jti-123",
    }
    expired_token = jwt.encode(expired_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    cid3, action3 = _challenge(client)
    satisfy(action3, face_env)
    res_expired = client.post(
        "/auth/face/re-enroll",
        json={
            "token": expired_token,
            "identifier": "9876543210",
            "challenge_id": cid3,
            "frames": _frames(5),
        },
    )
    assert res_expired.status_code == 400
    assert (res_expired.json().get("error") or res_expired.json().get("detail")) == "Invalid or expired re-enrollment token"


def test_reenroll_rejects_when_token_sub_does_not_match_identifier(client, face_env):
    # Two citizens
    s1 = _signup_citizen(client, face_env, phone="9876543221", name="Citizen One")
    s2 = _signup_citizen(client, face_env, phone="9876543222", name="Citizen Two")
    u1_id = s1["user"]["id"]
    u2_phone = "9876543222"

    admin_token = create_access_token(user_id="admin-1", role="ADMIN", email="admin@test.gov")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin reset for citizen 1
    res_reset = client.post(f"/auth/face/admin-reset/{u1_id}", headers=admin_headers)
    assert res_reset.status_code == 200
    token1 = res_reset.json()["re_enroll_token"]

    cid, action = _challenge(client)
    satisfy(action, face_env)

    # Attempt to re-enroll using citizen 1's token with citizen 2's phone
    res = client.post(
        "/auth/face/re-enroll",
        json={
            "token": token1,
            "identifier": u2_phone,
            "challenge_id": cid,
            "frames": _frames(5),
        },
    )
    assert res.status_code == 400
    assert (res.json().get("error") or res.json().get("detail")) == "Invalid or expired re-enrollment token"

