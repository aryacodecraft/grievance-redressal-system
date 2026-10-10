"""Tests for citizen passwordless face signup (Step 1).

Covers:
  - POST /auth/face/signup/start (minting 5-min signup token + challenge)
  - POST /auth/face/signup/complete (creating citizen user + template)
  - Resulting JWT works for /grievances
  - Failed enrollment leaves no user and no phone reserved, allowing retry
  - Duplicate phone returns generic 400 error
  - Created face_only user cannot use password login
"""

from __future__ import annotations

import base64
import io
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app
from backend.app.repositories import face_templates as face_repo_mod
from backend.app.services import face_service
from backend.app.services.face_service import Detection
from backend.app import users_db


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


def _solid_jpeg(value: int = 51) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (FRAME_SIZE, FRAME_SIZE), (value, value, value)).save(
        buf, format="JPEG", quality=95
    )
    return buf.getvalue()


def _frames(count: int = 5) -> list[str]:
    return [base64.b64encode(make_frame(i)).decode() for i in range(count)]


_VECPACHE: dict[int, np.ndarray] = {}


def person_vector(person: int) -> np.ndarray:
    if person not in _VECPACHE:
        rng = np.random.default_rng(1000 + person)
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
        # Estimate index from brightness
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


def test_face_signup_success_and_jwt_grievances(client, face_env):
    phone = "9876543210"
    res_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Sita Devi", "phone": phone, "consent": True},
    )
    assert res_start.status_code == 200, res_start.text
    data = res_start.json()
    assert "signup_token" in data
    assert "challenge_id" in data
    assert "action" in data
    assert data.get("expires_in") == 300

    satisfy(data["action"], face_env)

    res_comp = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": data["signup_token"],
            "challenge_id": data["challenge_id"],
            "frames": _frames(5),
        },
    )
    assert res_comp.status_code == 200, res_comp.text
    comp_data = res_comp.json()
    assert "access_token" in comp_data
    assert "citizen_id" in comp_data
    citizen_id = comp_data["citizen_id"]
    assert citizen_id.startswith("CIT-")
    user = comp_data["user"]
    assert user["citizen_id"] == citizen_id
    assert user["phone"] == phone
    assert user["auth_method"] == "face_only"
    assert user["role"] == "USER"

    # Template stored
    uid = user["id"]
    assert face_repo_mod.face_repository.get_template(uid) is not None

    # Test JWT works for /grievances
    headers = {"Authorization": f"Bearer {comp_data['access_token']}"}
    res_grv = client.get("/grievances", headers=headers)
    assert res_grv.status_code == 200


def test_failed_enrollment_leaves_no_user_and_allows_retry(client, face_env):
    phone = "9876543222"
    res_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Ravi Kumar", "phone": phone, "consent": True},
    )
    assert res_start.status_code == 200
    st_data = res_start.json()

    # Provide blurry frames so quality check fails (FACE_BLURRY)
    blurry_frames = [base64.b64encode(_solid_jpeg(50)).decode() for _ in range(5)]
    res_fail = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": st_data["signup_token"],
            "challenge_id": st_data["challenge_id"],
            "frames": blurry_frames,
        },
    )
    assert res_fail.status_code == 400

    # No user or phone is reserved in the database
    assert users_db.users_repository.find_by_phone(phone) is None

    # Same phone can start and succeed afterwards
    res_retry_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Ravi Kumar", "phone": phone, "consent": True},
    )
    assert res_retry_start.status_code == 200
    retry_data = res_retry_start.json()
    satisfy(retry_data["action"], face_env)

    res_retry_comp = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": retry_data["signup_token"],
            "challenge_id": retry_data["challenge_id"],
            "frames": _frames(5),
        },
    )
    assert res_retry_comp.status_code == 200
    assert users_db.users_repository.find_by_phone(phone) is not None


def test_duplicate_phone_generic_error(client, face_env):
    phone = "9876543233"
    # Create first citizen
    res_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Original User", "phone": phone, "consent": True},
    )
    assert res_start.status_code == 200
    d = res_start.json()
    satisfy(d["action"], face_env)
    res_comp = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": d["signup_token"],
            "challenge_id": d["challenge_id"],
            "frames": _frames(5),
        },
    )
    assert res_comp.status_code == 200

    # Second signup with same phone must fail generically
    res_dup = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Duplicate Person", "phone": phone, "consent": True},
    )
    assert res_dup.status_code == 400
    err = res_dup.json().get("error") or res_dup.json().get("detail")
    assert err == "Could not complete signup"


def test_created_face_only_user_cannot_use_password_login(client, face_env):
    phone = "9876543244"
    res_start = client.post(
        "/auth/face/signup/start",
        json={"full_name": "Face User", "phone": phone, "consent": True},
    )
    assert res_start.status_code == 200
    d = res_start.json()
    satisfy(d["action"], face_env)
    res_comp = client.post(
        "/auth/face/signup/complete",
        json={
            "signup_token": d["signup_token"],
            "challenge_id": d["challenge_id"],
            "frames": _frames(5),
        },
    )
    assert res_comp.status_code == 200
    user_id = res_comp.json()["user"]["id"]

    # Even if an email is associated with the face_only account
    users_db.users_repository.update(user_id, {"email": "faceuser@example.com"})

    # Attempt password login
    res_pwd = client.post("/auth/login", json={"email": "faceuser@example.com", "password": "AnyPassword123!"})
    assert res_pwd.status_code == 401
    err = res_pwd.json().get("error") or res_pwd.json().get("detail")
    assert err == "Invalid email or password"
