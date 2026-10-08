import os

repos_code = {
    "backend/app/repositories/__init__.py": """from __future__ import annotations
from .departments import dept_repository
from .audit import audit_repository
from .notifications import notif_repository
from .progress import progress_repository
from .sla_config import sla_repository
""",
    "backend/app/repositories/departments.py": """from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

class DepartmentRepository:
    def create(self, name: str, key: str, manager_id: str | None = None) -> dict: raise NotImplementedError
    def get(self, dept_id: str) -> dict | None: raise NotImplementedError
    def get_by_key(self, key: str) -> dict | None: raise NotImplementedError
    def list(self) -> list[dict]: raise NotImplementedError
    def update(self, dept_id: str, updates: dict) -> dict | None: raise NotImplementedError
    def delete(self, dept_id: str) -> bool: raise NotImplementedError
    def ensure_indexes(self): raise NotImplementedError

class MongoDepartmentRepository(DepartmentRepository):
    def __init__(self, uri: str):
        self.client = MongoClient(uri)
        self.db = self.client.get_default_database()
        self.collection = self.db.departments

    def ensure_indexes(self):
        self.collection.create_index("key", unique=True)

    def create(self, name: str, key: str, manager_id: str | None = None) -> dict:
        dept = {
            "_id": str(uuid.uuid4()),
            "name": name,
            "key": key,
            "managerId": manager_id,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        self.collection.insert_one(dept)
        return dept

    def get(self, dept_id: str) -> dict | None:
        return self.collection.find_one({"_id": dept_id})

    def get_by_key(self, key: str) -> dict | None:
        return self.collection.find_one({"key": key})

    def list(self) -> list[dict]:
        return list(self.collection.find())

    def update(self, dept_id: str, updates: dict) -> dict | None:
        if not updates:
            return self.get(dept_id)
        self.collection.update_one({"_id": dept_id}, {"$set": updates})
        return self.get(dept_id)

    def delete(self, dept_id: str) -> bool:
        res = self.collection.update_one({"_id": dept_id}, {"$set": {"isActive": False}})
        return res.modified_count > 0

class InMemoryDepartmentRepository(DepartmentRepository):
    def __init__(self):
        self.data = {}

    def ensure_indexes(self):
        pass

    def create(self, name: str, key: str, manager_id: str | None = None) -> dict:
        dept = {
            "_id": str(uuid.uuid4()),
            "name": name,
            "key": key,
            "managerId": manager_id,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        self.data[dept["_id"]] = dept
        return dept

    def get(self, dept_id: str) -> dict | None:
        return self.data.get(dept_id)

    def get_by_key(self, key: str) -> dict | None:
        for dept in self.data.values():
            if dept["key"] == key:
                return dept
        return None

    def list(self) -> list[dict]:
        return list(self.data.values())

    def update(self, dept_id: str, updates: dict) -> dict | None:
        if dept_id in self.data:
            self.data[dept_id].update(updates)
            return self.data[dept_id]
        return None

    def delete(self, dept_id: str) -> bool:
        if dept_id in self.data:
            self.data[dept_id]["isActive"] = False
            return True
        return False

MONGODB_URI = os.getenv("MONGODB_URI")
if MONGODB_URI:
    dept_repository = MongoDepartmentRepository(MONGODB_URI)
else:
    dept_repository = InMemoryDepartmentRepository()
""",
    "backend/app/repositories/audit.py": """from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

class AuditRepository:
    def append(self, entry: dict) -> dict: raise NotImplementedError
    def list(self, entity_id: str | None = None, actor_id: str | None = None, limit: int = 100) -> list[dict]: raise NotImplementedError
    def ensure_indexes(self): raise NotImplementedError

class MongoAuditRepository(AuditRepository):
    def __init__(self, uri: str):
        self.client = MongoClient(uri)
        self.db = self.client.get_default_database()
        self.collection = self.db.audit_logs

    def ensure_indexes(self):
        self.collection.create_index("entityId")
        self.collection.create_index("actorId")

    def append(self, entry: dict) -> dict:
        if "_id" not in entry:
            entry["_id"] = str(uuid.uuid4())
        if "at" not in entry:
            entry["at"] = datetime.now(timezone.utc).isoformat()
        self.collection.insert_one(entry)
        return entry

    def list(self, entity_id: str | None = None, actor_id: str | None = None, limit: int = 100) -> list[dict]:
        query = {}
        if entity_id: query["entityId"] = entity_id
        if actor_id: query["actorId"] = actor_id
        return list(self.collection.find(query).sort("at", -1).limit(limit))

class InMemoryAuditRepository(AuditRepository):
    def __init__(self):
        self.data = []

    def ensure_indexes(self): pass

    def append(self, entry: dict) -> dict:
        if "_id" not in entry:
            entry["_id"] = str(uuid.uuid4())
        if "at" not in entry:
            entry["at"] = datetime.now(timezone.utc).isoformat()
        self.data.append(entry)
        return entry

    def list(self, entity_id: str | None = None, actor_id: str | None = None, limit: int = 100) -> list[dict]:
        res = reversed(self.data)
        if entity_id: res = [r for r in res if r.get("entityId") == entity_id]
        if actor_id: res = [r for r in res if r.get("actorId") == actor_id]
        return list(res)[:limit]

MONGODB_URI = os.getenv("MONGODB_URI")
if MONGODB_URI:
    audit_repository = MongoAuditRepository(MONGODB_URI)
else:
    audit_repository = InMemoryAuditRepository()
""",
    "backend/app/repositories/notifications.py": """from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

class NotificationRepository:
    def create(self, user_id: str, kind: str, entity_id: str, title: str) -> dict: raise NotImplementedError
    def list_for_user(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]: raise NotImplementedError
    def mark_read(self, notif_id: str, user_id: str) -> bool: raise NotImplementedError
    def mark_all_read(self, user_id: str) -> bool: raise NotImplementedError
    def ensure_indexes(self): raise NotImplementedError

class MongoNotificationRepository(NotificationRepository):
    def __init__(self, uri: str):
        self.client = MongoClient(uri)
        self.db = self.client.get_default_database()
        self.collection = self.db.notifications

    def ensure_indexes(self):
        self.collection.create_index("userId")

    def create(self, user_id: str, kind: str, entity_id: str, title: str) -> dict:
        notif = {
            "_id": str(uuid.uuid4()),
            "userId": user_id,
            "kind": kind,
            "entityId": entity_id,
            "title": title,
            "isRead": False,
            "at": datetime.now(timezone.utc).isoformat()
        }
        self.collection.insert_one(notif)
        return notif

    def list_for_user(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
        query = {"userId": user_id}
        if unread_only: query["isRead"] = False
        return list(self.collection.find(query).sort("at", -1).limit(limit))

    def mark_read(self, notif_id: str, user_id: str) -> bool:
        res = self.collection.update_one({"_id": notif_id, "userId": user_id}, {"$set": {"isRead": True}})
        return res.modified_count > 0

    def mark_all_read(self, user_id: str) -> bool:
        res = self.collection.update_many({"userId": user_id, "isRead": False}, {"$set": {"isRead": True}})
        return res.modified_count > 0

class InMemoryNotificationRepository(NotificationRepository):
    def __init__(self):
        self.data = []

    def ensure_indexes(self): pass

    def create(self, user_id: str, kind: str, entity_id: str, title: str) -> dict:
        notif = {
            "_id": str(uuid.uuid4()),
            "userId": user_id,
            "kind": kind,
            "entityId": entity_id,
            "title": title,
            "isRead": False,
            "at": datetime.now(timezone.utc).isoformat()
        }
        self.data.append(notif)
        return notif

    def list_for_user(self, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
        res = [n for n in reversed(self.data) if n["userId"] == user_id]
        if unread_only: res = [n for n in res if not n["isRead"]]
        return res[:limit]

    def mark_read(self, notif_id: str, user_id: str) -> bool:
        for n in self.data:
            if n["_id"] == notif_id and n["userId"] == user_id:
                n["isRead"] = True
                return True
        return False

    def mark_all_read(self, user_id: str) -> bool:
        mod = False
        for n in self.data:
            if n["userId"] == user_id and not n["isRead"]:
                n["isRead"] = True
                mod = True
        return mod

MONGODB_URI = os.getenv("MONGODB_URI")
if MONGODB_URI:
    notif_repository = MongoNotificationRepository(MONGODB_URI)
else:
    notif_repository = InMemoryNotificationRepository()
""",
    "backend/app/repositories/progress.py": """from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

class ProgressRepository:
    def create(self, data: dict) -> dict: raise NotImplementedError
    def list_for_grievance(self, grievance_id: str, visibility_filter: str | None = None) -> list[dict]: raise NotImplementedError
    def ensure_indexes(self): raise NotImplementedError

class MongoProgressRepository(ProgressRepository):
    def __init__(self, uri: str):
        self.client = MongoClient(uri)
        self.db = self.client.get_default_database()
        self.collection = self.db.progress_updates

    def ensure_indexes(self):
        self.collection.create_index("grievanceId")

    def create(self, data: dict) -> dict:
        if "_id" not in data:
            data["_id"] = str(uuid.uuid4())
        if "id" not in data:
            data["id"] = data["_id"]
        if "createdAt" not in data:
            data["createdAt"] = datetime.now(timezone.utc).isoformat()
        self.collection.insert_one(data)
        return data

    def list_for_grievance(self, grievance_id: str, visibility_filter: str | None = None) -> list[dict]:
        query = {"grievanceId": grievance_id}
        if visibility_filter: query["visibility"] = visibility_filter
        return list(self.collection.find(query).sort("createdAt", 1))

class InMemoryProgressRepository(ProgressRepository):
    def __init__(self):
        self.data = []

    def ensure_indexes(self): pass

    def create(self, data: dict) -> dict:
        if "_id" not in data:
            data["_id"] = str(uuid.uuid4())
        if "id" not in data:
            data["id"] = data["_id"]
        if "createdAt" not in data:
            data["createdAt"] = datetime.now(timezone.utc).isoformat()
        self.data.append(data)
        return data

    def list_for_grievance(self, grievance_id: str, visibility_filter: str | None = None) -> list[dict]:
        res = [d for d in self.data if d.get("grievanceId") == grievance_id]
        if visibility_filter: res = [d for d in res if d.get("visibility") == visibility_filter]
        return res

MONGODB_URI = os.getenv("MONGODB_URI")
if MONGODB_URI:
    progress_repository = MongoProgressRepository(MONGODB_URI)
else:
    progress_repository = InMemoryProgressRepository()
""",
    "backend/app/repositories/sla_config.py": """from __future__ import annotations
import os
import uuid
from pymongo import MongoClient

class SlaConfigRepository:
    def get_days(self, category: str, priority: str) -> int: raise NotImplementedError
    def ensure_indexes(self): raise NotImplementedError
    def _seed(self): raise NotImplementedError

class MongoSlaConfigRepository(SlaConfigRepository):
    def __init__(self, uri: str):
        self.client = MongoClient(uri)
        self.db = self.client.get_default_database()
        self.collection = self.db.sla_config
        self._seed()

    def ensure_indexes(self):
        self.collection.create_index([("category", 1), ("priority", 1)], unique=True)

    def _seed(self):
        if self.collection.count_documents({}) == 0:
            self.collection.insert_many([
                {"category": "any", "priority": "high", "days": 3},
                {"category": "any", "priority": "medium", "days": 7},
                {"category": "any", "priority": "low", "days": 14}
            ])

    def get_days(self, category: str, priority: str) -> int:
        doc = self.collection.find_one({"category": category, "priority": priority})
        if doc: return doc["days"]
        doc = self.collection.find_one({"category": "any", "priority": priority})
        if doc: return doc["days"]
        
        mapping = {"high": 3, "medium": 7, "low": 14}
        return mapping.get(priority.lower(), 7)

class InMemorySlaConfigRepository(SlaConfigRepository):
    def __init__(self):
        self.data = {
            ("any", "high"): 3,
            ("any", "medium"): 7,
            ("any", "low"): 14
        }
    
    def ensure_indexes(self): pass
    def _seed(self): pass

    def get_days(self, category: str, priority: str) -> int:
        if (category, priority) in self.data: return self.data[(category, priority)]
        if ("any", priority) in self.data: return self.data[("any", priority)]
        
        mapping = {"high": 3, "medium": 7, "low": 14}
        return mapping.get(priority.lower(), 7)

MONGODB_URI = os.getenv("MONGODB_URI")
if MONGODB_URI:
    sla_repository = MongoSlaConfigRepository(MONGODB_URI)
else:
    sla_repository = InMemorySlaConfigRepository()
"""
}

for filepath, code in repos_code.items():
    with open(filepath, "w") as f:
        f.write(code)
print("Repositories written successfully.")
