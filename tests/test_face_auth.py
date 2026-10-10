"""Face authentication tests (DEC-024).

Synthetic checkerboard frames plus a fake detection backend (the
``face_service._real_detections`` seam) so the suite never touches a camera
or downloads the insightface model. Frame index is encoded in mean
brightness (51 + 20 * index) which lets the fake drive liveness traces
deterministically and statelessly across requests.
"""

from __future__ import annotations

import base64
import io
import os
import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import config
from backend.app.repositories import audit as audit_repo_mod
from backend.app.repositories import face_templates as face_repo_mod
from backend.app.services import face_service
from backend.app.services.face_service import Detection, FaceAuthError

FRAME_SIZE = 96


# ── Synthetic frames ─────────────────────────────────────────────────────────

def make_frame(index: int) -> bytes:
    """JPEG whose 4 px checkerboard brightness encodes *index* (clamped at 7).

    Mean = 51 + 20 * index (see frame_index); the high-contrast checker keeps
    the Laplacian variance far above the blur threshold.
    """
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


def frame_index(img: np.ndarray) -> int:
    return max(0, min(int(round((float(img.mean()) - 51.0) / 20.0)), 7))


def _frame_bytes(count: int = 5) -> list[bytes]:
    return [make_frame(i) for i in range(count)]


def _frames(count: int = 5) -> list[str]:
    return [base64.b64encode(raw).decode() for raw in _frame_bytes(count)]


# ── Fake detection backend ───────────────────────────────────────────────────

_VECPACHE: dict[int, np.ndarray] = {}


def person_vector(person: int) -> np.ndarray:
    """Deterministic unit-ish embedding per simulated identity."""
    if person not in _VECPACHE:
        rng = np.random.default_rng(1000 + person)
        _VECPACHE[person] = rng.standard_normal(face_service.FACE_EMBED_DIM).astype(np.float32)
    return _VECPACHE[person]


class FakeDetector:
    """Synthetic replacement for the ``face_service._real_detections`` seam.

    Stateless across requests: the frame index is recovered from brightness,
    so traces stay correct no matter which attempt a frame belongs to.
    """

    def __init__(self, person: int = 1) -> None:
        self.person = person
        self.person_for = None  # optional callable(index) -> person id
        self.face_count = 1
        self.det_score = 0.99
        self.reset()

    def reset(self) -> None:
        """Restore neutral traces (satisfy() persists between requests)."""
        self.yaw = lambda idx: 0.0
        self.ear = lambda idx: 0.30
        self.mouth = lambda idx: 0.60

    def __call__(self, img: np.ndarray) -> list[Detection]:
        idx = frame_index(img)
        person = self.person_for(idx) if self.person_for else self.person
        return [
            Detection(
                bbox=(20.0, 20.0, 220.0, 220.0),
                det_score=self.det_score,
                embedding=person_vector(person),
                yaw_degrees=float(self.yaw(idx)),
                eye_aspect=float(self.ear(idx)),
                mouth_width=float(self.mouth(idx)),
            )
            for _ in range(self.face_count)
        ]


class FakeEmbedder:
    """Synthetic replacement for the ``face_service._real_embed`` seam."""

    def __init__(self, person: int = 1) -> None:
        self.person = person
        self.person_for = None
        self.calls: list[int] = []

    def __call__(self, img: np.ndarray, det: Detection) -> np.ndarray:
        idx = frame_index(img)
        self.calls.append(idx)
        person = self.person_for(idx) if self.person_for else self.person
        return person_vector(person)


def satisfy(action: str, fake: FakeDetector) -> None:
    """Program the fake so the given challenge action passes liveness."""
    if action == "turn_left":
        fake.yaw = lambda idx: min(idx, 4) * 12.0
    elif action == "turn_right":
        fake.yaw = lambda idx: -min(idx, 4) * 12.0
    elif action == "blink":
        fake.ear = lambda idx: 0.05 if 1 <= idx <= 3 else 0.30
    elif action == "smile":
        fake.mouth = lambda idx: 0.70 if 1 <= idx <= 3 else 0.60


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def face_on(monkeypatch):
    monkeypatch.setattr(config, "FACE_AUTH_ENABLED", True)


@pytest.fixture()
def fake(monkeypatch):
    detector = FakeDetector()
    monkeypatch.setattr(face_service, "_real_detections", detector)
    return detector


@pytest.fixture()
def fclient(app, face_on, fake):
    """HTTPS client with the face flag on (guard requires TLS off-localhost)."""
    with TestClient(app, base_url="https://testserver") as client:
        yield client


@pytest.fixture()
def http_face_client(app, face_on, fake):
    """Plain-HTTP client (host testserver) with the flag on — guard must trip."""
    with TestClient(app) as client:
        yield client


# ── Helpers ──────────────────────────────────────────────────────────────────

def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register(client, email: str, password: str = "Pass1234!") -> dict:
    res = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": "Face Tester"},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _seed_role(email: str, role: str, password: str = "Pass1234!") -> dict:
    from backend.app.users_db import users_repository

    users_repository.create({
        "email": email,
        "full_name": f"Test {role}",
        "hashed_password": bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode(),
        "role": role,
    })
    return users_repository.find_by_email(email)


def _uid(email: str) -> str:
    from backend.app.users_db import users_repository

    user = users_repository.find_by_email(email)
    assert user, f"no user for {email}"
    return user["id"]


def _password_login(client, email: str, password: str = "Pass1234!") -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


def _challenge(client) -> tuple[str, str]:
    res = client.post("/auth/face/challenge")
    assert res.status_code == 200, res.text
    data = res.json()
    return data["challenge_id"], data["action"]


def _enroll(client, token, fake, *, consent=True, require_2fa=False, count=5):
    cid, action = _challenge(client)
    satisfy(action, fake)
    return client.post(
        "/auth/face/enroll",
        json={
            "challenge_id": cid,
            "frames": _frames(count),
            "consent": consent,
            "require_login_2fa": require_2fa,
        },
        headers=_bearer(token),
    )


def _login(client, email, fake, *, count=5):
    cid, action = _challenge(client)
    satisfy(action, fake)
    return client.post(
        "/auth/face/login",
        json={"challenge_id": cid, "frames": _frames(count), "email": email},
    )


def _verify(client, pending_token, fake, *, count=5):
    cid, action = _challenge(client)
    satisfy(action, fake)
    return client.post(
        "/auth/face/verify-second-factor",
        json={"challenge_id": cid, "frames": _frames(count)},
        headers=_bearer(pending_token),
    )


def _bump_login(client, email, *, challenge_id="deadbeef"):
    """A fast failed /login (unknown challenge id) — exercises counters only."""
    return client.post(
        "/auth/face/login",
        json={"challenge_id": challenge_id, "frames": _frames(), "email": email},
    )


def _audit_entries() -> list[dict]:
    return audit_repo_mod.audit_repository.list(limit=500)


def _user_count(user_id: str) -> int:
    return face_repo_mod.face_repository.rate_count(
        f"face:fail:user:{user_id}", face_service.RATE_WINDOW_SECONDS
    )


def _email_count(email: str) -> int:
    return face_repo_mod.face_repository.rate_count(
        f"face:fail:email:{email}", face_service.RATE_WINDOW_SECONDS
    )


def _decode(token: str) -> dict:
    return jwt.decode(token, os.environ["JWT_SECRET_KEY"], algorithms=["HS256"])


class TestFlagOff:
    """Every face route 404s while FACE_AUTH_ENABLED=false (default client)."""

    def test_config_reports_face_auth_off(self, client):
        res = client.get("/config")
        assert res.status_code == 200
        assert res.json() == {"faceAuthEnabled": False}

    def test_config_reports_face_auth_on_when_flag_on(self, fclient):
        assert fclient.get("/config").json() == {"faceAuthEnabled": True}

    def test_challenge_404(self, client):
        assert client.post("/auth/face/challenge").status_code == 404

    def test_login_404_before_body_validation(self, client):
        # frames is invalid on purpose: the guard must 404 before Pydantic runs.
        res = client.post(
            "/auth/face/login",
            json={"email": "a@b.com", "challenge_id": "x", "frames": []},
        )
        assert res.status_code == 404
        assert res.json() == {"error": "Not Found"}

    def test_status_404(self, client):
        assert client.get("/auth/face/status").status_code == 404

    def test_enroll_404_even_with_auth_header(self, client):
        token = _register(client, "flagoff@face.test")["access_token"]
        res = client.post(
            "/auth/face/enroll",
            json={"challenge_id": "x", "frames": _frames(), "consent": True},
            headers=_bearer(token),
        )
        assert res.status_code == 404

    def test_unrouted_face_subpath_also_404(self, client):
        assert client.get("/auth/face/whatever").status_code == 404

    def test_flag_off_wins_over_https(self, app):
        with TestClient(app, base_url="https://testserver") as c:
            assert c.post("/auth/face/challenge").status_code == 404


class TestPublicFaceLogin:
    """Challenge / enroll / 1:1 login for USER accounts."""

    def test_challenge_shape(self, fclient):
        cid, action = _challenge(fclient)
        assert isinstance(cid, str) and cid
        assert action in face_service.VALID_ACTIONS
        res = fclient.post("/auth/face/challenge")
        assert res.status_code == 200
        assert res.json()["expires_in"] == face_service.CHALLENGE_TTL_SECONDS

    def test_enroll_login_roundtrip(self, fclient, fake):
        token = _register(fclient, "citizen@face.test")["access_token"]
        res = _enroll(fclient, token, fake)
        assert res.status_code == 200, res.text
        assert res.json() == {"enrolled": True}
        assert fclient.get("/auth/face/status", headers=_bearer(token)).json() == {
            "enrolled": True
        }

        res = _login(fclient, "citizen@face.test", fake)
        assert res.status_code == 200, res.text
        body = res.json()
        assert set(body) == {"access_token", "refresh_token", "token_type", "user"}
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == "citizen@face.test"
        claims = _decode(body["access_token"])
        assert claims["type"] == "access"
        assert claims["role"] == "USER"
        # RBAC from a face login is identical to a password login.
        assert (
            fclient.get("/grievances", headers=_bearer(body["access_token"])).status_code
            == 200
        )
        assert (
            fclient.get("/admin/overview", headers=_bearer(body["access_token"])).status_code
            == 403
        )

    def test_failures_are_generic_and_identical(self, fclient, fake):
        """Wrong face vs unknown email: same status AND same body (no oracle)."""
        token = _register(fclient, "known@face.test")["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        fake.person = 2  # a different identity
        wrong_face = _login(fclient, "known@face.test", fake)
        fake.person = 1
        unknown = _login(fclient, "ghost@face.test", fake)

        assert wrong_face.status_code == unknown.status_code == 401
        assert wrong_face.json() == unknown.json() == {"error": "Face sign-in failed"}

    def test_challenge_single_use(self, fclient, fake):
        email = "reuse@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        cid, action = _challenge(fclient)
        satisfy(action, fake)
        body = {"challenge_id": cid, "frames": _frames(), "email": email}
        assert fclient.post("/auth/face/login", json=body).status_code == 200
        res = fclient.post("/auth/face/login", json=body)
        assert res.status_code == 401
        assert res.json() == {"error": "Face sign-in failed"}

    def test_expired_challenge_rejected(self, fclient, fake):
        email = "expired@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        cid, action = _challenge(fclient)
        satisfy(action, fake)
        repo = face_repo_mod.face_repository
        repo._challenges[cid]["expiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        res = fclient.post(
            "/auth/face/login",
            json={"challenge_id": cid, "frames": _frames(), "email": email},
        )
        assert res.status_code == 401
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "challenge_expired"

    def test_liveness_mismatch_rejected(self, fclient, fake):
        """Neutral traces satisfy no challenge action → fail closed."""
        email = "lazy@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        fake.reset()  # undo the traces _enroll configured for its action
        cid, _ = _challenge(fclient)
        res = fclient.post(
            "/auth/face/login",
            json={"challenge_id": cid, "frames": _frames(), "email": email},
        )
        assert res.status_code == 401
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "LIVENESS_FAILED"

    def test_enroll_requires_auth(self, fclient, fake):
        cid, action = _challenge(fclient)
        satisfy(action, fake)
        res = fclient.post(
            "/auth/face/enroll",
            json={"challenge_id": cid, "frames": _frames(), "consent": True},
        )
        assert res.status_code == 401

    def test_consent_required(self, fclient, fake):
        token = _register(fclient, "consent@face.test")["access_token"]
        res = _enroll(fclient, token, fake, consent=False)
        assert res.status_code == 400
        assert "consent" in res.json()["error"]

    @pytest.mark.parametrize("count", [4, 9])
    def test_frame_count_bounds(self, fclient, fake, count):
        token = _register(fclient, f"frames{count}@face.test")["access_token"]
        cid, action = _challenge(fclient)
        satisfy(action, fake)
        res = fclient.post(
            "/auth/face/enroll",
            json={"challenge_id": cid, "frames": _frames(count), "consent": True},
            headers=_bearer(token),
        )
        assert res.status_code == 400

    def test_invalid_base64_rejected(self, fclient, fake):
        token = _register(fclient, "b64@face.test")["access_token"]
        cid, action = _challenge(fclient)
        satisfy(action, fake)
        res = fclient.post(
            "/auth/face/enroll",
            json={"challenge_id": cid, "frames": ["not base64!!"] * 5, "consent": True},
            headers=_bearer(token),
        )
        assert res.status_code == 400
        assert "base64" in res.json()["error"]

    def test_frame_over_1mb_rejected(self, fclient, fake):
        token = _register(fclient, "big@face.test")["access_token"]
        cid, _ = _challenge(fclient)
        big = base64.b64encode(b"x" * (face_service.MAX_FRAME_BYTES + 1)).decode()
        res = fclient.post(
            "/auth/face/enroll",
            json={"challenge_id": cid, "frames": [big] + _frames(4), "consent": True},
            headers=_bearer(token),
        )
        assert res.status_code == 400
        assert "1 MB" in res.json()["error"]

    def test_multiple_faces_rejected(self, fclient, fake):
        token = _register(fclient, "two@face.test")["access_token"]
        fake.face_count = 2
        res = _enroll(fclient, token, fake)
        assert res.status_code == 400
        assert "face" in res.json()["error"].lower()

    def test_blurry_frame_rejected(self, fclient, fake):
        token = _register(fclient, "blur@face.test")["access_token"]
        cid, action = _challenge(fclient)
        satisfy(action, fake)
        res = fclient.post(
            "/auth/face/enroll",
            json={
                "challenge_id": cid,
                "frames": [base64.b64encode(_solid_jpeg()).decode()] + _frames(4),
                "consent": True,
            },
            headers=_bearer(token),
        )
        assert res.status_code == 400
        assert "blur" in res.json()["error"].lower()

    def test_model_mismatch_forces_reenroll(self, fclient, fake, monkeypatch):
        email = "model@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_l")
        res = _login(fclient, email, fake)
        assert res.status_code == 401
        assert res.json() == {"error": "Face sign-in failed"}
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "MODEL_MISMATCH"

    def test_model_mismatch_login_does_not_increment_lockout(
        self, fclient, fake, monkeypatch
    ):
        """Check: MODEL_MISMATCH on /login audits only — no counter moves."""
        email = "mismatch@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_l")

        res = _login(fclient, email, fake)
        assert res.status_code == 401
        assert res.json() == {"error": "Face sign-in failed"}

        repo = face_repo_mod.face_repository
        assert _email_count(email) == 0
        assert repo._counters == {}  # rate_hit was never called at all
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "MODEL_MISMATCH"

    def test_privileged_cannot_face_login(self, fclient, fake):
        _seed_role("admin@face.test", "ADMIN")
        token = _password_login(fclient, "admin@face.test")["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        # Enrollment is just storage — the public face sign-in still denies them.
        res = _login(fclient, "admin@face.test", fake)
        assert res.status_code == 401
        assert res.json() == {"error": "Face sign-in failed"}
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "privileged_signin_denied"


class TestPrivilegedStepUp:
    """Optional face step after a privileged password login (DEC-024)."""

    def _admin_with_face(self, fclient, fake, email="chief@face.test"):
        _seed_role(email, "ADMIN")
        token = _password_login(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake, require_2fa=True).status_code == 200
        return email

    def test_password_login_returns_pending_token(self, fclient, fake):
        email = self._admin_with_face(fclient, fake)
        body = _password_login(fclient, email)
        assert body.get("two_factor") == "face"
        assert "access_token" not in body
        claims = _decode(body["pending_token"])
        assert claims["type"] == "pending_2fa"
        assert claims["role"] == "ADMIN"

    def test_pending_token_grants_no_api_access(self, fclient, fake):
        email = self._admin_with_face(fclient, fake)
        pending = _password_login(fclient, email)["pending_token"]
        assert fclient.get("/grievances", headers=_bearer(pending)).status_code == 401
        assert fclient.get("/auth/me", headers=_bearer(pending)).status_code == 401
        # and the skip endpoint refuses full access tokens in its place
        assert fclient.post("/auth/complete-pending", headers=_bearer(
            _register(fclient, "someuser@face.test")["access_token"]
        )).status_code == 401

    def test_access_token_rejected_by_verify_endpoint(self, fclient, fake):
        user_token = _register(fclient, "plain@face.test")["access_token"]
        cid, action = _challenge(fclient)
        satisfy(action, fake)
        res = fclient.post(
            "/auth/face/verify-second-factor",
            json={"challenge_id": cid, "frames": _frames()},
            headers=_bearer(user_token),
        )
        assert res.status_code == 401

    def test_verify_success_returns_full_tokens(self, fclient, fake):
        email = self._admin_with_face(fclient, fake)
        uid = _uid(email)
        pending = _password_login(fclient, email)["pending_token"]
        res = _verify(fclient, pending, fake)
        assert res.status_code == 200, res.text
        body = res.json()
        assert set(body) == {"access_token", "refresh_token", "token_type", "user"}
        assert _decode(body["access_token"])["type"] == "access"
        assert body["user"]["role"] == "ADMIN"
        # same RBAC as a password login
        assert (
            fclient.get("/admin/overview", headers=_bearer(body["access_token"])).status_code
            == 200
        )
        # success resets the per-user counter
        assert _user_count(uid) == 0
        assert any(e["action"] == "face.verify_success" for e in _audit_entries())

    def test_complete_pending_rejected_when_not_locked_out(self, fclient, fake):
        """Check: complete-pending only completes a LOCKED-OUT account."""
        email = self._admin_with_face(fclient, fake)
        pending = _password_login(fclient, email)["pending_token"]
        res = fclient.post("/auth/complete-pending", headers=_bearer(pending))
        assert res.status_code == 403
        assert res.json() == {"error": "Face verification required"}
        # the pending token stays unusable for protected routes either way
        assert fclient.get("/grievances", headers=_bearer(pending)).status_code == 401
        assert fclient.get("/auth/me", headers=_bearer(pending)).status_code == 401

    def test_complete_pending_allowed_when_locked_out(self, fclient, fake):
        """The same pending token completes once face verification is locked."""
        email = self._admin_with_face(fclient, fake)
        uid = _uid(email)
        pending = _password_login(fclient, email)["pending_token"]
        fake.person = 2
        for _ in range(5):
            assert _verify(fclient, pending, fake).status_code == 401
        assert _user_count(uid) == 5  # locked out of verify-second-factor

        res = fclient.post("/auth/complete-pending", headers=_bearer(pending))
        assert res.status_code == 200, res.text
        body = res.json()
        assert set(body) == {"access_token", "refresh_token", "token_type", "user"}
        assert _decode(body["access_token"])["type"] == "access"
        assert body["user"]["email"] == email

    def test_unauthenticated_verify_cannot_burn_counter(self, fclient, fake):
        """Check: NO unauthenticated request can move face:fail:user:{id}."""
        email = self._admin_with_face(fclient, fake)
        uid = _uid(email)

        def attempt(headers):
            cid, action = _challenge(fclient)
            satisfy(action, fake)
            return fclient.post(
                "/auth/face/verify-second-factor",
                json={"challenge_id": cid, "frames": _frames()},
                headers=headers,
            )

        # (a) no token at all
        assert attempt({}).status_code == 401
        assert attempt({}).status_code == 401
        # (b) garbage token
        assert attempt(_bearer("garbage.token.here")).status_code == 401
        # (c) a full access token (wrong type — dependency rejects it)
        access = _register(fclient, "other@face.test")["access_token"]
        assert attempt(_bearer(access)).status_code == 401

        assert _user_count(uid) == 0
        # nothing was ever recorded against any counter, not even IP/email
        assert face_repo_mod.face_repository._counters == {}

    def test_wrong_face_verify_generic_then_lockout(self, fclient, fake):
        email = self._admin_with_face(fclient, fake)
        uid = _uid(email)
        pending = _password_login(fclient, email)["pending_token"]

        fake.person = 2
        for _ in range(5):
            res = _verify(fclient, pending, fake)
            assert res.status_code == 401
            assert res.json() == {"error": "Face sign-in failed"}
        assert _user_count(uid) == 5

        # 6th attempt → 429, before any challenge work; counter does not grow.
        res = fclient.post(
            "/auth/face/verify-second-factor",
            json={"challenge_id": "x", "frames": _frames()},
            headers=_bearer(pending),
        )
        assert res.status_code == 429
        assert _user_count(uid) == 5
        assert any(
            e["action"] == "face.lockout" and e["reason"] == "user lockout"
            for e in _audit_entries()
        )

    def test_lockout_falls_back_to_password_only(self, fclient, fake):
        """Face lockout never blocks password login — it skips the face step."""
        email = self._admin_with_face(fclient, fake)
        uid = _uid(email)
        pending = _password_login(fclient, email)["pending_token"]
        fake.person = 2
        for _ in range(5):
            assert _verify(fclient, pending, fake).status_code == 401
        assert _user_count(uid) == 5

        body = _password_login(fclient, email)
        assert "pending_token" not in body
        assert "access_token" in body
        assert _decode(body["access_token"])["type"] == "access"

    def test_ordinary_user_cannot_enable_2fa_flag(self, fclient, fake):
        email = "worker@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake, require_2fa=True).status_code == 200
        # stored flag forced off for non-privileged roles (DEC-024)
        assert face_repo_mod.face_repository.get_template(_uid(email))["requireLogin2fa"] is False
        # password login is unaffected — full token directly
        body = _password_login(fclient, email)
        assert "pending_token" not in body
        assert "access_token" in body

    def test_admin_without_opt_in_gets_full_token(self, fclient, fake):
        _seed_role("optout@face.test", "ADMIN")
        token = _password_login(fclient, "optout@face.test")["access_token"]
        assert _enroll(fclient, token, fake, require_2fa=False).status_code == 200
        body = _password_login(fclient, "optout@face.test")
        assert "pending_token" not in body
        assert "access_token" in body

    def test_model_mismatch_verify_does_not_increment_lockout(
        self, fclient, fake, monkeypatch
    ):
        """Check: MODEL_MISMATCH on /verify-second-factor audits only."""
        email = "mismatch2@face.test"
        _seed_role(email, "ADMIN")
        token = _password_login(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake, require_2fa=True).status_code == 200
        pending = _password_login(fclient, email)["pending_token"]
        monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_l")

        res = _verify(fclient, pending, fake)
        assert res.status_code == 401
        assert res.json() == {"error": "Face sign-in failed"}

        uid = _uid(email)
        assert _user_count(uid) == 0
        assert face_repo_mod.face_repository._counters == {}  # rate_hit never called
        entry = next(e for e in _audit_entries() if e["action"] == "face.verify_failed")
        assert entry["reason"] == "MODEL_MISMATCH"


class TestRateLimits:
    """Lockouts live on the face endpoints only (DEC-024)."""

    def test_email_lockout_after_5_failures(self, fclient, fake):
        email = "lock@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        for _ in range(5):
            assert _bump_login(fclient, email).status_code == 401
        assert _email_count(email) == 5

        res = _bump_login(fclient, email)
        assert res.status_code == 429
        assert _email_count(email) == 5  # pre-check does not increment
        assert any(
            e["action"] == "face.lockout" and e["reason"] == "email lockout"
            for e in _audit_entries()
        )
        # password login is untouched by the face lockout
        body = _password_login(fclient, email)
        assert "access_token" in body

    def test_ip_lockout_after_20_failures(self, fclient, fake):
        for _ in range(20):
            assert _bump_login(fclient, "ghost1@face.test").status_code == 401
        # challenge issuance and login both refuse the locked IP
        assert fclient.post("/auth/face/challenge").status_code == 429
        assert _bump_login(fclient, "ghost2@face.test").status_code == 429

    def test_public_login_never_touches_user_counter(self, fclient, fake):
        email = "counter@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        uid = _uid(email)
        for _ in range(5):
            assert _bump_login(fclient, email).status_code == 401
        assert _user_count(uid) == 0

    def test_success_resets_email_counter(self, fclient, fake):
        email = "reset@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        for _ in range(4):
            assert _bump_login(fclient, email).status_code == 401
        assert _email_count(email) == 4
        assert _login(fclient, email, fake).status_code == 200
        assert _email_count(email) == 0


class TestTemplateManagement:
    """PATCH / DELETE template rules and their audit rows."""

    def test_user_cannot_toggle(self, fclient, fake):
        token = _register(fclient, "toggle@face.test")["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        res = fclient.patch(
            "/auth/face/template", json={"require_login_2fa": True}, headers=_bearer(token)
        )
        assert res.status_code == 403

    def test_admin_toggle_roundtrip(self, fclient, fake):
        email = "mgr@face.test"
        _seed_role(email, "ADMIN")
        token = _password_login(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        res = fclient.patch(
            "/auth/face/template", json={"require_login_2fa": True}, headers=_bearer(token)
        )
        assert res.status_code == 200
        assert res.json() == {"requireLogin2fa": True}
        assert _password_login(fclient, email).get("two_factor") == "face"

        res = fclient.patch(
            "/auth/face/template", json={"require_login_2fa": False}, headers=_bearer(token)
        )
        assert res.json() == {"requireLogin2fa": False}
        body = _password_login(fclient, email)
        assert "pending_token" not in body and "access_token" in body

        # both toggles audited with old/new (newest first).
        entries = [
            e for e in _audit_entries() if e["action"] == "face.template_updated"
        ]
        assert len(entries) == 2
        assert entries[0]["old"] == {"requireLogin2fa": True}
        assert entries[0]["new"] == {"requireLogin2fa": False}
        assert entries[1]["old"] == {"requireLogin2fa": False}
        assert entries[1]["new"] == {"requireLogin2fa": True}

    def test_toggle_without_template_404(self, fclient):
        _seed_role("notpl@face.test", "ADMIN")
        token = _password_login(fclient, "notpl@face.test")["access_token"]
        res = fclient.patch(
            "/auth/face/template", json={"require_login_2fa": True}, headers=_bearer(token)
        )
        assert res.status_code == 404

    def test_delete_own_template(self, fclient, fake):
        email = "del@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200

        res = fclient.delete("/auth/face/template", headers=_bearer(token))
        assert res.status_code == 200
        assert res.json() == {"deleted": True}
        assert fclient.get("/auth/face/status", headers=_bearer(token)).json() == {
            "enrolled": False
        }
        assert fclient.delete("/auth/face/template", headers=_bearer(token)).status_code == 404

        # face login is no longer possible
        res = _login(fclient, email, fake)
        assert res.status_code == 401
        entry = next(e for e in _audit_entries() if e["action"] == "face.login_failed")
        assert entry["reason"] == "not_enrolled"
        assert any(e["action"] == "face.template_deleted" for e in _audit_entries())

    def test_revoke_requires_superadmin(self, fclient, fake):
        target_email = "target@face.test"
        target_token = _register(fclient, target_email)["access_token"]
        assert _enroll(fclient, target_token, fake).status_code == 200
        uid = _uid(target_email)

        _seed_role("deptmgr@face.test", "ADMIN")
        admin_token = _password_login(fclient, "deptmgr@face.test")["access_token"]
        assert (
            fclient.delete(f"/auth/face/template/{uid}", headers=_bearer(admin_token)).status_code
            == 403
        )
        # the owner cannot use the admin route either (no user.manage_admin)
        assert (
            fclient.delete(f"/auth/face/template/{uid}", headers=_bearer(target_token)).status_code
            == 403
        )

        _seed_role("root@face.test", "SUPERADMIN")
        root_token = _password_login(fclient, "root@face.test")["access_token"]
        res = fclient.delete(f"/auth/face/template/{uid}", headers=_bearer(root_token))
        assert res.status_code == 200
        assert res.json() == {"deleted": True}

        entry = next(e for e in _audit_entries() if e["action"] == "face.template_revoked")
        assert entry["actorId"] == _uid("root@face.test")
        assert entry["entityId"] == uid

        res = _login(fclient, target_email, fake)
        assert res.status_code == 401
        assert fclient.delete(f"/auth/face/template/{uid}", headers=_bearer(root_token)).status_code == 404


class TestSecurity:
    """HTTPS enforcement, body cap, startup guard, audit hygiene."""

    def test_non_https_rejected(self, http_face_client):
        res = http_face_client.post("/auth/face/challenge")
        assert res.status_code == 400
        assert "HTTPS" in res.json()["error"]

    def test_localhost_plain_http_allowed(self, app, face_on, fake):
        with TestClient(app, base_url="http://localhost") as client:
            assert client.post("/auth/face/challenge").status_code == 200

    def test_forwarded_proto_honoured_only_with_trust_proxy(
        self, http_face_client, monkeypatch
    ):
        headers = {"X-Forwarded-Proto": "https"}
        assert http_face_client.post("/auth/face/challenge", headers=headers).status_code == 400
        monkeypatch.setattr(config, "TRUST_PROXY", True)
        assert http_face_client.post("/auth/face/challenge", headers=headers).status_code == 200
        # without the header it is still plain HTTP
        assert http_face_client.post("/auth/face/challenge").status_code == 400

    def test_body_over_4mb_rejected_before_parsing(self, fclient):
        res = fclient.post(
            "/auth/face/challenge", json={"pad": "x" * (4 * 1024 * 1024 + 1000)}
        )
        assert res.status_code == 413
        assert "too large" in res.json()["error"].lower()

    def test_audit_never_contains_embeddings_or_frames(self, fclient, fake):
        email = "audit@face.test"
        token = _register(fclient, email)["access_token"]
        assert _enroll(fclient, token, fake).status_code == 200
        fake.person = 2
        assert _login(fclient, email, fake).status_code == 401  # below threshold
        assert _login(fclient, "nobody@face.test", fake).status_code == 401  # unknown email

        face_entries = [e for e in _audit_entries() if str(e.get("action", "")).startswith("face.")]
        assert face_entries
        banned = {"frames", "encryptedEmbedding", "embedding", "image", "jpeg"}
        for entry in face_entries:
            assert not (banned & set(entry)), entry
            assert entry["source"] == "SYSTEM"
            assert entry["reason"]

        threshold = next(e for e in face_entries if e["reason"] == "below_threshold")
        assert re.fullmatch(r"-?\d+\.\d{2}", threshold["scoreBucket"])
        assert float(threshold["scoreBucket"]) <= config.FACE_MATCH_THRESHOLD

    def test_startup_fails_when_flag_on_without_key(self, app, monkeypatch):
        monkeypatch.setattr(config, "FACE_AUTH_ENABLED", True)
        monkeypatch.setattr(config, "FACE_EMBED_KEY", "")
        with pytest.raises(ValueError):
            with TestClient(app):
                pass


class TestFaceService:
    """Pure unit tests for crypto, quality, liveness and matching."""

    # ── crypto / config ──

    def test_encrypt_roundtrip_preserves_direction(self):
        vec = person_vector(1)
        token = face_service.encrypt_embedding(vec)
        assert isinstance(token, str)
        back = face_service.decrypt_embedding(token)
        assert back.shape == (face_service.FACE_EMBED_DIM,)
        assert face_service.similarity(vec, back) == pytest.approx(1.0, abs=1e-5)

    def test_encrypt_rejects_wrong_dimensions(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.encrypt_embedding(np.ones(7, dtype=np.float32))
        assert exc.value.code == "EMBEDDING_INVALID"

    def test_decrypt_fails_with_wrong_key(self, monkeypatch):
        from cryptography.fernet import Fernet

        token = face_service.encrypt_embedding(person_vector(1))
        monkeypatch.setattr(config, "FACE_EMBED_KEY", Fernet.generate_key().decode())
        with pytest.raises(FaceAuthError) as exc:
            face_service.decrypt_embedding(token)
        assert exc.value.code == "DECRYPT_FAILED"

    @pytest.mark.parametrize(
        "key,code", [("", "KEY_MISSING"), ("not-a-key", "KEY_INVALID")]
    )
    def test_fernet_error_codes(self, monkeypatch, key, code):
        monkeypatch.setattr(config, "FACE_EMBED_KEY", key)
        with pytest.raises(FaceAuthError) as exc:
            face_service.encrypt_embedding(person_vector(1))
        assert exc.value.code == code

    @pytest.mark.parametrize("key", ["", "garbage"])
    def test_validate_embed_key_rejects_bad_keys(self, monkeypatch, key):
        monkeypatch.setattr(config, "FACE_EMBED_KEY", key)
        with pytest.raises(ValueError):
            face_service.validate_embed_key()

    def test_validate_embed_key_accepts_configured_key(self):
        assert config.FACE_EMBED_KEY  # pinned by conftest
        face_service.validate_embed_key()  # must not raise

    # ── vector helpers ──

    def test_normalize_rejects_zero_vector(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.normalize(np.zeros(512, dtype=np.float32))
        assert exc.value.code == "EMBEDDING_INVALID"

    def test_similarity_of_orthogonal_vectors_is_zero(self):
        a = np.zeros(512, dtype=np.float32)
        a[0] = 1
        b = np.zeros(512, dtype=np.float32)
        b[1] = 1
        assert face_service.similarity(a, b) == pytest.approx(0.0)

    def test_aggregate_rejects_empty(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.aggregate_embeddings([])
        assert exc.value.code == "EMBEDDING_INVALID"

    def test_aggregate_is_mean_then_unit(self):
        out = face_service.aggregate_embeddings([person_vector(1), person_vector(2)])
        assert out.shape == (face_service.FACE_EMBED_DIM,)
        assert float(np.linalg.norm(out)) == pytest.approx(1.0, abs=1e-5)

    # ── frame decode / quality ──

    def test_decode_frame_accepts_jpeg(self):
        arr = face_service.decode_frame(make_frame(0))
        assert arr.shape == (FRAME_SIZE, FRAME_SIZE, 3)

    def test_decode_frame_rejects_empty(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.decode_frame(b"")
        assert exc.value.code == "IMAGE_INVALID"

    def test_decode_frame_rejects_non_jpeg(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.decode_frame(b"not a jpeg")
        assert exc.value.code == "IMAGE_INVALID"

    def test_decode_frame_rejects_oversize(self):
        payload = b"\xff\xd8" + b"x" * face_service.MAX_FRAME_BYTES
        with pytest.raises(FaceAuthError) as exc:
            face_service.decode_frame(payload)
        assert exc.value.code == "FRAME_TOO_LARGE"

    def test_laplacian_variance(self):
        gray = np.full((32, 32), 128.0)
        assert face_service.laplacian_variance(gray) == pytest.approx(0.0)
        checker = (np.indices((32, 32)).sum(axis=0) % 2) * 90.0
        assert face_service.laplacian_variance(checker) >= config.FACE_MIN_BLUR_VARIANCE

    # ── face selection ──

    def _det(self, **kw) -> Detection:
        base = dict(
            bbox=(0.0, 0.0, 200.0, 200.0),
            det_score=0.99,
            embedding=person_vector(1),
        )
        base.update(kw)
        return Detection(**base)

    def test_select_single_face_ok(self):
        assert face_service.select_single_face([self._det()]).embedding is not None

    def test_select_single_face_rejects_zero_or_two(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([])
        assert exc.value.code == "FACE_COUNT"
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([self._det(), self._det()])
        assert exc.value.code == "FACE_COUNT"

    def test_select_single_face_rejects_low_confidence(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([self._det(det_score=0.2)])
        assert exc.value.code == "DETECTION_FAILED"

    def test_select_single_face_rejects_small_bbox(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([self._det(bbox=(0.0, 0.0, 30.0, 30.0))])
        assert exc.value.code == "FACE_TOO_SMALL"

    def test_select_single_face_rejects_missing_embedding(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([self._det(embedding=None)])
        assert exc.value.code == "DETECTION_FAILED"

    # ── liveness ──

    def _dets(self, yaws=None, ears=None, mouths=None) -> list[Detection]:
        n = 5
        yaws = yaws if yaws is not None else [0.0] * n
        ears = ears if ears is not None else [0.30] * n
        mouths = mouths if mouths is not None else [0.60] * n
        return [
            Detection(
                bbox=(0.0, 0.0, 200.0, 200.0),
                det_score=0.99,
                embedding=person_vector(1),
                yaw_degrees=yaws[i],
                eye_aspect=ears[i],
                mouth_width=mouths[i],
            )
            for i in range(n)
        ]

    def test_turn_liveness_pass(self):
        good = [0.0, 12.0, 24.0, 36.0, 48.0]
        face_service.check_action("turn_left", self._dets(yaws=good))
        face_service.check_action("turn_right", self._dets(yaws=[-v for v in good]))

    def test_turn_liveness_too_small(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("turn_left", self._dets(yaws=[0.0] * 5))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_turn_liveness_inconsistent_direction(self):
        # net change is large enough, but most steps move the wrong way
        weird = [0.0, 10.0, 20.0, 30.0, -30.0]
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("turn_right", self._dets(yaws=weird))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_turn_requires_pose_estimates(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("turn_left", self._dets(yaws=[None] * 5))
        assert exc.value.code == "LANDMARKS_UNAVAILABLE"

    def test_blink_liveness_pass(self):
        face_service.check_action("blink", self._dets(ears=[0.30, 0.05, 0.05, 0.05, 0.30]))

    def test_blink_liveness_no_blink(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("blink", self._dets(ears=[0.30] * 5))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_blink_liveness_eyes_closed_at_edges(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("blink", self._dets(ears=[0.10, 0.05, 0.05, 0.05, 0.10]))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_blink_requires_eye_landmarks(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("blink", self._dets(ears=[None] * 5))
        assert exc.value.code == "LANDMARKS_UNAVAILABLE"

    def test_smile_liveness_pass(self):
        face_service.check_action(
            "smile", self._dets(mouths=[0.60, 0.70, 0.70, 0.70, 0.60])
        )

    def test_smile_liveness_no_smile(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("smile", self._dets(mouths=[0.60] * 5))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_smile_requires_mouth_landmarks(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("smile", self._dets(mouths=[None] * 5))
        assert exc.value.code == "LANDMARKS_UNAVAILABLE"

    # ── env-tunable thresholds (DEC-024) ──

    def test_tunable_defaults_are_pinned(self):
        """conftest pins these; values mirror backend/.env.example."""
        assert config.FACE_TURN_MIN_DEGREES == 15.0
        assert config.FACE_BLINK_EAR_DROP == 0.7
        assert config.FACE_SMILE_MOUTH_WIDEN == 1.08
        assert config.FACE_MIN_BLUR_VARIANCE == 30.0
        assert config.FACE_MIN_FACE_PX == 80

    def test_turn_min_degrees_is_env_tunable(self, monkeypatch):
        trace = [0.0, 12.0, 24.0, 36.0, 48.0]
        face_service.check_action("turn_left", self._dets(yaws=trace))  # default 15°
        monkeypatch.setattr(config, "FACE_TURN_MIN_DEGREES", 60.0)
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("turn_left", self._dets(yaws=trace))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_blink_ear_drop_is_env_tunable(self, monkeypatch):
        trace = [0.30, 0.25, 0.25, 0.25, 0.30]
        with pytest.raises(FaceAuthError) as exc:  # default 0.7 rejects a small drop
            face_service.check_action("blink", self._dets(ears=trace))
        assert exc.value.code == "LIVENESS_FAILED"
        monkeypatch.setattr(config, "FACE_BLINK_EAR_DROP", 0.9)
        face_service.check_action("blink", self._dets(ears=trace))  # now passes

    def test_smile_widen_is_env_tunable(self, monkeypatch):
        trace = [0.60, 0.70, 0.70, 0.70, 0.60]
        face_service.check_action("smile", self._dets(mouths=trace))  # default 1.08
        monkeypatch.setattr(config, "FACE_SMILE_MOUTH_WIDEN", 1.2)
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("smile", self._dets(mouths=trace))
        assert exc.value.code == "LIVENESS_FAILED"

    def test_min_face_px_is_env_tunable(self, monkeypatch):
        det = self._det(bbox=(0.0, 0.0, 200.0, 200.0))
        face_service.select_single_face([det])  # default 80 px
        monkeypatch.setattr(config, "FACE_MIN_FACE_PX", 500)
        with pytest.raises(FaceAuthError) as exc:
            face_service.select_single_face([det])
        assert exc.value.code == "FACE_TOO_SMALL"

    def test_blur_variance_is_env_tunable(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        frames = _frame_bytes(5)  # checkerboards pass the default 30.0 floor
        satisfy("turn_left", detector)
        face_service.verify_frames(frames, "turn_left")
        monkeypatch.setattr(config, "FACE_MIN_BLUR_VARIANCE", 1e9)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(frames, "turn_left")
        assert exc.value.code == "FACE_BLURRY"

    def test_unknown_action_rejected(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("wink", self._dets())
        assert exc.value.code == "LIVENESS_FAILED"

    def test_too_few_frames_rejected(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_action("blink", self._dets()[:2])
        assert exc.value.code == "LIVENESS_FAILED"

    # ── template matching ──

    def test_template_compatibility(self, monkeypatch):
        monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_s")
        face_service.check_template_compatibility({"modelName": "buffalo_s"})
        with pytest.raises(FaceAuthError) as exc:
            face_service.check_template_compatibility({"modelName": "buffalo_l"})
        assert exc.value.code == "MODEL_MISMATCH"

    def test_similarity_to_template(self, monkeypatch):
        monkeypatch.setattr(config, "FACE_MODEL_NAME", "buffalo_s")
        vec = person_vector(1)
        template = {
            "modelName": "buffalo_s",
            "encryptedEmbedding": face_service.encrypt_embedding(vec),
        }
        same = face_service.VerifiedFace(
            embedding=vec, frame_count=5, min_pair_similarity=1.0, yaw_trace=[0.0] * 5
        )
        assert face_service.similarity_to_template(template, same) == pytest.approx(1.0, abs=1e-5)
        other = face_service.VerifiedFace(
            embedding=person_vector(2), frame_count=5, min_pair_similarity=1.0, yaw_trace=[0.0] * 5
        )
        assert face_service.similarity_to_template(template, other) < config.FACE_MATCH_THRESHOLD

    # ── verify_frames orchestration (fake detector) ──

    def test_verify_frames_happy_path(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        satisfy("turn_left", detector)
        out = face_service.verify_frames(_frame_bytes(5), "turn_left")
        assert out.frame_count == 3
        assert out.min_pair_similarity == pytest.approx(1.0)
        assert float(np.linalg.norm(out.embedding)) == pytest.approx(1.0, abs=1e-5)

    def test_verify_frames_three_frame_embedding_path(self, monkeypatch):
        detector = FakeDetector()
        embedder = FakeEmbedder()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        monkeypatch.setattr(face_service, "_real_embed", embedder)
        satisfy("turn_left", detector)
        out = face_service.verify_frames(_frame_bytes(5), "turn_left")
        assert out.frame_count == 3
        assert len(embedder.calls) == 4
        # In turn_left, yaws are [0, 12, 24, 36, 48]. Smallest |yaw| are indices 0, 1, 2.
        # Action frame (largest |yaw|) is index 4.
        assert embedder.calls == [0, 1, 2, 4]
        assert out.binding_score == pytest.approx(1.0)

    def test_verify_frames_rejects_action_frame_different_identity(self, monkeypatch):
        detector = FakeDetector()
        # Frontal frames (0, 1, 2) get person 1; action frame (idx 4 for turn_left) gets person 2
        detector.person_for = lambda idx: 2 if idx == 4 else 1
        monkeypatch.setattr(face_service, "_real_detections", detector)
        satisfy("turn_left", detector)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(5), "turn_left")
        assert exc.value.code == "LIVENESS_IDENTITY_MISMATCH"

    def test_verify_frames_passes_action_frame_same_identity(self, monkeypatch):
        detector = FakeDetector()
        detector.person_for = lambda idx: 1
        monkeypatch.setattr(face_service, "_real_detections", detector)
        satisfy("turn_left", detector)
        out = face_service.verify_frames(_frame_bytes(5), "turn_left")
        assert out.binding_score is not None
        assert out.binding_score >= config.FACE_BINDING_THRESHOLD

    def test_verify_frames_debug_rejects_action_frame_different_identity(self, monkeypatch):
        monkeypatch.setattr(config, "FACE_DEBUG", True)
        detector = FakeDetector()
        detector.person_for = lambda idx: 2 if idx == 4 else 1
        monkeypatch.setattr(face_service, "_real_detections", detector)
        satisfy("turn_left", detector)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(5), "turn_left")
        assert exc.value.code == "LIVENESS_IDENTITY_MISMATCH"

    def test_verify_frames_rejects_count_before_decoding(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames([b"junk"] * 4, None)
        assert exc.value.code == "FRAME_COUNT"
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames([b"junk"] * 9, None)
        assert exc.value.code == "FRAME_COUNT"

    def test_verify_frames_rejects_unknown_action(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(5), "wink")
        assert exc.value.code == "LIVENESS_FAILED"

    def test_verify_frames_rejects_split_identity(self, monkeypatch):
        detector = FakeDetector()
        detector.person_for = lambda idx: 1 if idx == 0 else 2
        monkeypatch.setattr(face_service, "_real_detections", detector)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(5), None)
        assert exc.value.code == "INCONSISTENT_FRAMES"

    def test_verify_frames_rejects_blurry(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames([_solid_jpeg()] + _frame_bytes(4), None)
        assert exc.value.code == "FACE_BLURRY"

    def test_verify_frames_tolerates_one_failed_frame_out_of_six(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        # 1 blurry frame + 5 valid frames = 6 frames total (tolerated)
        verified = face_service.verify_frames([_solid_jpeg()] + _frame_bytes(5), None)
        assert verified.frame_count == 3

    def test_verify_frames_rejects_two_failed_frames_out_of_six(self, monkeypatch):
        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        # 2 blurry frames + 4 valid frames = 6 frames total (only 4 pass, so rejected)
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames([_solid_jpeg(), _solid_jpeg()] + _frame_bytes(4), None)
        assert exc.value.code == "FACE_BLURRY"

    def test_verify_frames_rejects_fewer_than_five_frames(self):
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(4), None)
        assert exc.value.code == "FRAME_COUNT"

    def test_consistency_threshold_is_used_and_tunable(self, monkeypatch):
        v1 = np.zeros(512, dtype=np.float32)
        v1[0] = 1.0
        v2 = np.zeros(512, dtype=np.float32)
        v2[0] = 0.35
        v2[1] = np.sqrt(1.0 - 0.35**2)

        detector = FakeDetector()
        monkeypatch.setattr(face_service, "_real_detections", detector)
        calls = [0]
        def embed_fn(img, det):
            calls[0] += 1
            return v1 if calls[0] == 1 else v2
        monkeypatch.setattr(face_service, "_real_embed", embed_fn)

        # Under default FACE_CONSISTENCY_THRESHOLD=0.30, 0.35 passes (even though FACE_MATCH_THRESHOLD=0.45)
        monkeypatch.setattr(config, "FACE_CONSISTENCY_THRESHOLD", 0.30)
        monkeypatch.setattr(config, "FACE_MATCH_THRESHOLD", 0.45)
        verified = face_service.verify_frames(_frame_bytes(5), None)
        assert verified.frame_count == 3

        # If FACE_CONSISTENCY_THRESHOLD is set above 0.35, it fails
        monkeypatch.setattr(config, "FACE_CONSISTENCY_THRESHOLD", 0.40)
        calls[0] = 0
        with pytest.raises(FaceAuthError) as exc:
            face_service.verify_frames(_frame_bytes(5), None)
        assert exc.value.code == "INCONSISTENT_FRAMES"


class TestFaceRepository:
    """Contract tests for the in-memory template/challenge/rate stores."""

    @pytest.fixture()
    def repo(self):
        return face_repo_mod.InMemoryFaceRepository()

    def test_challenge_single_use(self, repo):
        ch = repo.create_challenge("blink", 30)
        assert repo.consume_challenge(ch["id"]) == ("blink", "ok")
        assert repo.consume_challenge(ch["id"]) == (None, "not_found")

    def test_challenge_unknown_id(self, repo):
        assert repo.consume_challenge("missing") == (None, "not_found")

    def test_challenge_expiry(self, repo):
        ch = repo.create_challenge("smile", 30)
        repo._challenges[ch["id"]]["expiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert repo.consume_challenge(ch["id"]) == (None, "expired")

    def test_rate_counts(self, repo):
        repo.rate_hit("k1", 5, 900)
        repo.rate_hit("k1", 5, 900)
        repo.rate_hit("k2", 5, 900)
        counts = repo.rate_counts(["k1", "k2", "k3"])
        assert counts == {"k1": 2, "k2": 1, "k3": 0}

    def test_rate_limit_counts_to_limit_then_blocks(self, repo):
        key = "face:fail:user:u1"
        for i in range(5):
            allowed, remaining = repo.rate_hit(key, 5, 900)
            assert allowed and remaining == 4 - i
        assert repo.rate_hit(key, 5, 900) == (False, 0)
        assert repo.rate_count(key, 900) == 5
        repo.rate_reset(key)
        assert repo.rate_count(key, 900) == 0

    def test_rate_window_expires(self, repo):
        key = "face:fail:ip:1.2.3.4"
        assert repo.rate_hit(key, 5, 900) == (True, 4)
        assert repo.rate_count(key, 900) == 1
        repo._counters[key]["windowExpiresAt"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert repo.rate_count(key, 900) == 0
        # an expired window restarts on the next hit
        assert repo.rate_hit(key, 5, 900) == (True, 4)

    def test_template_roundtrip(self, repo):
        assert repo.get_template("u1") is None
        repo.upsert_template(
            "u1",
            {"encryptedEmbedding": "tok", "modelName": "buffalo_s", "requireLogin2fa": True},
        )
        doc = repo.get_template("u1")
        assert doc["userId"] == "u1"
        assert doc["requireLogin2fa"] is True
        repo.upsert_template("u1", {**doc, "requireLogin2fa": False})
        assert repo.get_template("u1")["requireLogin2fa"] is False
        assert repo.delete_template("u1") is True
        assert repo.delete_template("u1") is False

