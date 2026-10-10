"""Users collection persistence.

Two implementations:
- ``MongoUsersRepository`` — backed by MongoDB Atlas (``users`` collection).
- ``InMemoryUsersRepository`` — process-local fallback; data lost on restart.

The singleton ``users_repository`` is selected at import time based on
``MONGODB_URI`` from the environment, exactly like ``db.py`` for grievances.
"""

from __future__ import annotations

import logging
import re
import secrets
from typing import Any, Optional

logger = logging.getLogger("grievance-api")

def normalize_phone(raw: str) -> str:
    """Normalize phone number to 10-digit Indian mobile standard (starts with 6-9).

    Strips spaces, dashes, dots, parentheses, and leading +91, 91, or 0.
    Accepts only 10 digits starting with 6-9; otherwise raises ValueError.
    """
    if not raw:
        raise ValueError("Phone number cannot be empty")
    cleaned = re.sub(r"[\s\-\.\(\)]", "", str(raw))
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]

    if len(cleaned) == 10 and cleaned.isdigit() and cleaned[0] in "6789":
        return cleaned
    raise ValueError("Invalid Indian mobile number; enter 10 digits starting with 6-9.")


def to_e164(raw: str) -> str:
    """Return an Indian mobile number in provider format without changing storage."""
    return f"+91{normalize_phone(raw)}"


def generate_citizen_id() -> str:
    """Generate a random Citizen ID formatted as CIT-<8 digits>."""
    num = secrets.randbelow(90_000_000) + 10_000_000
    return f"CIT-{num}"


# ── In-memory fallback ───────────────────────────────────────────────────────

class InMemoryUsersRepository:
    def __init__(self) -> None:
        self._users: dict[str, dict] = {}  # id → user doc
        self._by_email: dict[str, str] = {}  # email → id
        self._by_phone: dict[str, str] = {}  # phone → id
        self._by_citizen_id: dict[str, str] = {}  # citizen_id → id
        self._seq = 0

    @staticmethod
    def _out(raw: dict | None) -> Optional[dict]:
        if raw is None:
            return None
        doc = dict(raw)
        doc.setdefault("email", None)
        doc.setdefault("phone", None)
        doc.setdefault("citizen_id", None)
        doc.setdefault("hashed_password", None)
        doc.setdefault("auth_method", "google" if doc.get("google_id") else "password")
        return doc

    def create(self, doc: dict[str, Any]) -> str:
        payload = dict(doc)

        email = payload.get("email")
        if email:
            email_clean = email.strip().lower()
            if email_clean in self._by_email:
                raise ValueError(f"User with email {email!r} already exists")
            payload["email"] = email_clean
        else:
            payload["email"] = None

        phone = payload.get("phone")
        if phone:
            phone_clean = normalize_phone(phone)
            if phone_clean in self._by_phone:
                raise ValueError(f"User with phone {phone!r} already exists")
            payload["phone"] = phone_clean
        else:
            payload["phone"] = None

        citizen_id = payload.get("citizen_id")
        if citizen_id:
            cid_clean = citizen_id.strip().upper()
            if cid_clean in self._by_citizen_id:
                raise ValueError(f"User with citizen_id {citizen_id!r} already exists")
            payload["citizen_id"] = cid_clean
        else:
            payload["citizen_id"] = None

        if "password_hash" in payload and "hashed_password" not in payload:
            payload["hashed_password"] = payload.pop("password_hash")

        payload.setdefault(
            "auth_method",
            "face_only" if payload.get("auth_method") == "face_only" else ("google" if payload.get("google_id") else "password"),
        )

        self._seq += 1
        uid = f"u{self._seq:05d}"
        payload["id"] = uid
        self._users[uid] = payload

        if payload["email"]:
            self._by_email[payload["email"]] = uid
        if payload["phone"]:
            self._by_phone[payload["phone"]] = uid
        if payload["citizen_id"]:
            self._by_citizen_id[payload["citizen_id"]] = uid

        return uid

    def get(self, user_id: str) -> Optional[dict]:
        return self._out(self._users.get(user_id))

    def find_by_email(self, email: str | None) -> Optional[dict]:
        if not email:
            return None
        uid = self._by_email.get(email.strip().lower())
        if not uid:
            return None
        return self._out(self._users.get(uid))

    def find_by_phone(self, phone: str | None) -> Optional[dict]:
        if not phone:
            return None
        try:
            phone_clean = normalize_phone(phone)
        except ValueError:
            phone_clean = phone.strip()
        uid = self._by_phone.get(phone_clean)
        if not uid:
            return None
        return self._out(self._users.get(uid))

    def find_by_citizen_id(self, citizen_id: str | None) -> Optional[dict]:
        if not citizen_id:
            return None
        uid = self._by_citizen_id.get(citizen_id.strip().upper())
        if not uid:
            return None
        return self._out(self._users.get(uid))

    def find_by_identifier(self, identifier: str) -> Optional[dict]:
        if not identifier:
            return None
        raw = identifier.strip()
        if raw.upper().startswith("CIT-"):
            return self.find_by_citizen_id(raw)
        if "@" in raw:
            return self.find_by_email(raw)
        try:
            user = self.find_by_phone(raw)
            return user if user and user.get("phoneVerifiedAt") else None
        except Exception:
            return None

    def generate_unique_citizen_id(self) -> str:
        for _ in range(10):
            cid = generate_citizen_id()
            if not self.find_by_citizen_id(cid):
                return cid
        raise RuntimeError("Failed to generate a unique citizen ID after 10 attempts")

    def update(self, user_id: str, patch: dict[str, Any]) -> Optional[dict]:
        doc = self._users.get(user_id)
        if not doc:
            return None

        if "email" in patch:
            old_email = doc.get("email")
            if old_email:
                self._by_email.pop(old_email.lower(), None)
            new_email = patch.get("email")
            if new_email:
                cleaned = new_email.strip().lower()
                patch["email"] = cleaned
                self._by_email[cleaned] = user_id
            else:
                patch["email"] = None

        if "phone" in patch:
            old_phone = doc.get("phone")
            if old_phone:
                self._by_phone.pop(old_phone, None)
            new_phone = patch.get("phone")
            if new_phone:
                cleaned_phone = normalize_phone(new_phone)
                patch["phone"] = cleaned_phone
                self._by_phone[cleaned_phone] = user_id
            else:
                patch["phone"] = None

        if "citizen_id" in patch:
            old_cid = doc.get("citizen_id")
            if old_cid:
                self._by_citizen_id.pop(old_cid.upper(), None)
            new_cid = patch.get("citizen_id")
            if new_cid:
                cleaned_cid = new_cid.strip().upper()
                patch["citizen_id"] = cleaned_cid
                self._by_citizen_id[cleaned_cid] = user_id
            else:
                patch["citizen_id"] = None

        if "password_hash" in patch and "hashed_password" not in patch:
            patch["hashed_password"] = patch.pop("password_hash")

        doc.update(patch)
        return self._out(doc)

    def list_users(self, role: str | None = None, dept_id: str | None = None, q: str | None = None, limit: int = 100) -> list[dict]:
        res = [self._out(v) for v in self._users.values() if v is not None]
        if role:
            res = [u for u in res if u.get("role") == role]
        if dept_id:
            res = [u for u in res if u.get("departmentId") == dept_id]
        if q:
            q_lower = q.lower()
            res = [
                u for u in res
                if q_lower in (u.get("full_name") or "").lower()
                or q_lower in (u.get("email") or "").lower()
                or q_lower in (u.get("phone") or "").lower()
                or q_lower in (u.get("citizen_id") or "").lower()
            ]
        return res[:limit]

    def update_role(self, user_id: str, role: str) -> Optional[dict]:
        return self.update(user_id, {"role": role})

    def set_active(self, user_id: str, is_active: bool) -> Optional[dict]:
        return self.update(user_id, {"isActive": is_active})

    def delete(self, user_id: str) -> bool:
        user = self._users.pop(user_id, None)
        if not user:
            return False
        if user.get("email"):
            self._by_email.pop(user["email"].lower(), None)
        if user.get("phone"):
            self._by_phone.pop(user["phone"], None)
        if user.get("citizen_id"):
            self._by_citizen_id.pop(user["citizen_id"].upper(), None)
        return True


# ── MongoDB-backed implementation ────────────────────────────────────────────

class MongoUsersRepository:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient

        self._col = MongoClient(uri)[db_name]["users"]
        self.ensure_indexes()

    def ensure_indexes(self) -> None:
        from pymongo.errors import OperationFailure

        for spec, name in [
            ("email", "uniq_user_email"),
            ("phone", "uniq_user_phone"),
            ("citizen_id", "uniq_user_citizen_id"),
        ]:
            try:
                self._col.create_index(spec, unique=True, sparse=True, name=name)
            except OperationFailure as exc:
                if exc.code == 85:  # IndexOptionsConflict
                    self._col.drop_index(name)
                    self._col.create_index(spec, unique=True, sparse=True, name=name)
                else:
                    raise

        self._col.create_index([("role", 1), ("departmentId", 1), ("isActive", 1)])
        self._col.create_index("departmentId")

    @staticmethod
    def _out(raw: dict | None) -> Optional[dict]:
        if raw is None:
            return None
        doc = {k: v for k, v in raw.items() if k != "_id"}
        doc["id"] = str(raw["_id"])
        doc.setdefault("email", None)
        doc.setdefault("phone", None)
        doc.setdefault("citizen_id", None)
        doc.setdefault("hashed_password", None)
        doc.setdefault("auth_method", "google" if doc.get("google_id") else "password")
        return doc

    def create(self, doc: dict[str, Any]) -> str:
        payload = dict(doc)

        if payload.get("email"):
            payload["email"] = payload["email"].strip().lower()
        else:
            payload.pop("email", None)

        if payload.get("phone"):
            payload["phone"] = normalize_phone(payload["phone"])
        else:
            payload.pop("phone", None)

        if payload.get("citizen_id"):
            payload["citizen_id"] = payload["citizen_id"].strip().upper()
        else:
            payload.pop("citizen_id", None)

        if "password_hash" in payload and "hashed_password" not in payload:
            payload["hashed_password"] = payload.pop("password_hash")

        payload.setdefault(
            "auth_method",
            "face_only" if payload.get("auth_method") == "face_only" else ("google" if payload.get("google_id") else "password"),
        )

        result = self._col.insert_one(payload)
        return str(result.inserted_id)

    def get(self, user_id: str) -> Optional[dict]:
        from bson import ObjectId

        try:
            raw = self._col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        return self._out(raw)

    def find_by_email(self, email: str | None) -> Optional[dict]:
        if not email:
            return None
        raw = self._col.find_one({"email": email.strip().lower()})
        return self._out(raw)

    def find_by_phone(self, phone: str | None) -> Optional[dict]:
        if not phone:
            return None
        try:
            cleaned = normalize_phone(phone)
        except ValueError:
            cleaned = phone.strip()
        raw = self._col.find_one({"phone": cleaned})
        return self._out(raw)

    def find_by_citizen_id(self, citizen_id: str | None) -> Optional[dict]:
        if not citizen_id:
            return None
        raw = self._col.find_one({"citizen_id": citizen_id.strip().upper()})
        return self._out(raw)

    def find_by_identifier(self, identifier: str) -> Optional[dict]:
        if not identifier:
            return None
        raw = identifier.strip()
        if raw.upper().startswith("CIT-"):
            return self.find_by_citizen_id(raw)
        if "@" in raw:
            return self.find_by_email(raw)
        try:
            user = self.find_by_phone(raw)
            return user if user and user.get("phoneVerifiedAt") else None
        except Exception:
            return None

    def generate_unique_citizen_id(self) -> str:
        for _ in range(10):
            cid = generate_citizen_id()
            if not self.find_by_citizen_id(cid):
                return cid
        raise RuntimeError("Failed to generate a unique citizen ID after 10 attempts")

    def update(self, user_id: str, patch: dict[str, Any]) -> Optional[dict]:
        from bson import ObjectId

        to_set = dict(patch)
        to_unset = {}

        if "email" in to_set:
            if to_set["email"]:
                to_set["email"] = to_set["email"].strip().lower()
            else:
                to_set.pop("email")
                to_unset["email"] = ""

        if "phone" in to_set:
            if to_set["phone"]:
                to_set["phone"] = normalize_phone(to_set["phone"])
            else:
                to_set.pop("phone")
                to_unset["phone"] = ""

        if "citizen_id" in to_set:
            if to_set["citizen_id"]:
                to_set["citizen_id"] = to_set["citizen_id"].strip().upper()
            else:
                to_set.pop("citizen_id")
                to_unset["citizen_id"] = ""

        if "password_hash" in to_set and "hashed_password" not in to_set:
            to_set["hashed_password"] = to_set.pop("password_hash")

        update_ops = {}
        if to_set:
            update_ops["$set"] = to_set
        if to_unset:
            update_ops["$unset"] = to_unset

        if not update_ops:
            return self.get(user_id)

        try:
            raw = self._col.find_one_and_update(
                {"_id": ObjectId(user_id)},
                update_ops,
                return_document=True,  # AFTER
            )
        except Exception:
            return None
        return self._out(raw)

    def list_users(self, role: str | None = None, dept_id: str | None = None, q: str | None = None, limit: int = 100) -> list[dict]:
        query = {}
        if role:
            query["role"] = role
        if dept_id:
            query["departmentId"] = dept_id
        if q:
            query["$or"] = [
                {"full_name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
                {"citizen_id": {"$regex": q, "$options": "i"}},
            ]
        return [self._out(d) for d in self._col.find(query).limit(limit)]

    def update_role(self, user_id: str, role: str) -> Optional[dict]:
        return self.update(user_id, {"role": role})

    def set_active(self, user_id: str, is_active: bool) -> Optional[dict]:
        return self.update(user_id, {"isActive": is_active})

    def delete(self, user_id: str) -> bool:
        from bson import ObjectId

        try:
            result = self._col.delete_one({"_id": ObjectId(user_id)})
            return result.deleted_count == 1
        except Exception:
            return False


# ── Singleton factory ────────────────────────────────────────────────────────

def _build_users_repo():
    from .config import MONGODB_DB, MONGODB_URI

    if MONGODB_URI:
        try:
            repo = MongoUsersRepository(MONGODB_URI, MONGODB_DB)
            logger.info("Users: MongoDB (%s.users)", MONGODB_DB)
            return repo
        except Exception as exc:
            logger.warning("MongoDB users init failed (%s); using in-memory fallback.", exc)
    else:
        logger.warning("MONGODB_URI not set — users stored in memory (lost on restart).")
    return InMemoryUsersRepository()


users_repository = _build_users_repo()
