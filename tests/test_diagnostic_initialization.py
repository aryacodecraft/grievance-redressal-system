"""Initialization-only guard tests: MongoDB is always mocked."""
import importlib
from unittest.mock import MagicMock

import pytest
from pymongo.errors import OperationFailure

from backend.app import config


REPOSITORIES = [
    ("backend.app.db", "MongoRepository", 5),
    ("backend.app.users_db", "MongoUsersRepository", 5),
    ("backend.app.repositories.audit", "MongoAuditRepository", 2),
    ("backend.app.repositories.departments", "MongoDepartmentRepository", 1),
    ("backend.app.repositories.notifications", "MongoNotificationRepository", 1),
    ("backend.app.repositories.progress", "MongoProgressRepository", 2),
    ("backend.app.repositories.face_templates", "MongoFaceRepository", 3),
    ("backend.app.repositories.sla_config", "MongoSlaConfigRepository", 1),
    ("backend.app.repositories.otp_codes", "MongoOtpRepository", 2),
]


@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("module_name,class_name,index_count", REPOSITORIES)
def test_initialization_writes(monkeypatch, module_name, class_name, index_count, enabled):
    monkeypatch.setattr(config, "DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", enabled)
    client = MagicMock()
    collection = client.__getitem__.return_value.__getitem__.return_value
    collection.count_documents.return_value = 0
    monkeypatch.setattr("pymongo.MongoClient", lambda *a, **kw: client)
    cls = getattr(importlib.import_module(module_name), class_name)
    repo = cls("mongodb://mock.invalid", "test")
    # Users and OTP perform initialization inside their constructor.
    if class_name not in ("MongoUsersRepository", "MongoOtpRepository"):
        method = getattr(repo, "ensure_indexes_and_seed", None) or repo.ensure_indexes
        method()
    assert collection.create_index.call_count == (0 if enabled else index_count)
    assert collection.drop_index.call_count == 0
    assert collection.insert_many.call_count == (
        1 if not enabled and class_name == "MongoSlaConfigRepository" else 0
    )
    if enabled:
        assert collection.mock_calls == []


@pytest.mark.parametrize("enabled", [True, False])
def test_email_conflict_replacement(monkeypatch, enabled):
    from backend.app.users_db import MongoUsersRepository

    monkeypatch.setattr(config, "DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", enabled)
    client = MagicMock()
    col = client.__getitem__.return_value.__getitem__.return_value
    col.create_index.side_effect = [OperationFailure("conflict", code=85)] + [None] * 5
    monkeypatch.setattr("pymongo.MongoClient", lambda *a, **kw: client)
    MongoUsersRepository("mongodb://mock.invalid", "test")
    if enabled:
        assert col.mock_calls == []
    else:
        col.drop_index.assert_called_once_with("uniq_user_email")
        assert col.create_index.call_count == 6


def test_startup_guard_prevents_backfill_and_seeding(monkeypatch):
    from backend.app import main, db, users_db

    monkeypatch.setattr(config, "DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", True)
    grievances = MagicMock()
    users = MagicMock()
    monkeypatch.setattr(db, "repository", grievances)
    monkeypatch.setattr(users_db, "users_repository", users)
    main._seed_on_startup()
    assert grievances.mock_calls == []
    assert users.mock_calls == []


def test_normal_startup_still_checks_existing_users(monkeypatch):
    from backend.app import main, db, users_db

    monkeypatch.setattr(config, "DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", False)
    for name in ("SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD",
                 "SEED_SUPERADMIN_EMAIL", "SEED_SUPERADMIN_PASSWORD"):
        monkeypatch.setattr(config, name, "")
    monkeypatch.setattr(config, "SEED_TEST_ACCOUNTS", False)
    grievances = MagicMock()
    grievances.list.return_value = []
    users = MagicMock()
    users.find_by_email.return_value = {"id": "existing"}
    monkeypatch.setattr(db, "repository", grievances)
    monkeypatch.setattr(users_db, "users_repository", users)
    main._seed_on_startup()
    grievances.list.assert_called_once_with(limit=1000)
    users.find_by_email.assert_called_once_with("citizen@grievance.local")
    users.create.assert_not_called()


@pytest.mark.parametrize("value,expected", [(None, False), ("false", False), ("true", True)])
def test_guard_configuration(value, expected):
    import os
    import subprocess
    import sys

    env = dict(os.environ)
    env.pop("DIAGNOSTIC_SKIP_INITIALIZATION_WRITES", None)
    if value is not None:
        env["DIAGNOSTIC_SKIP_INITIALIZATION_WRITES"] = value
    result = subprocess.run(
        [sys.executable, "-B", "-c",
         "from backend.app.config import DIAGNOSTIC_SKIP_INITIALIZATION_WRITES; "
         f"assert DIAGNOSTIC_SKIP_INITIALIZATION_WRITES is {expected}"],
        env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
