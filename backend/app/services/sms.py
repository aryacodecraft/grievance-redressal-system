"""Citizen-only SMS templates. Provider delivery intentionally remains dry-run/off."""
from __future__ import annotations

import logging
import threading
import time
from urllib.parse import quote

from .. import config
from ..db import repository
from ..users_db import to_e164, users_repository

logger = logging.getLogger("grievance-api")
STAGE_SMS_LABEL = {
    "SUBMITTED": "received", "AI_PROCESSING": "being reviewed",
    "PENDING_ASSIGNMENT": "awaiting department assignment", "ASSIGNED": "assigned to a department",
    "ACCEPTED": "accepted by the team", "IN_PROGRESS": "work in progress",
    "BLOCKED": "temporarily delayed", "RESOLUTION_SUBMITTED": "awaiting review",
    "UNDER_REVIEW": "under review", "RESOLVED": "resolved", "CLOSED": "closed",
    "ESCALATED": "escalated for review", "REJECTED": "reviewed and not accepted",
    "WITHDRAWN": "withdrawn", "REOPENED": "reopened",
}
SEND_STAGES = {"SUBMITTED", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "RESOLVED", "REJECTED", "CLOSED"}
_sent: set[tuple[str, str]] = set()
_user_dispatches: dict[str, list[float]] = {}
_grievance_dispatches: dict[str, list[float]] = {}
_lock = threading.Lock()


def render_stage_message(grievance_id: str, stage: str) -> str:
    if stage not in STAGE_SMS_LABEL:
        raise ValueError("Unknown grievance stage")
    link = f"{config.FRONTEND_URL.rstrip('/')}/track?ref={quote(grievance_id)}"
    return f"GRV: Grievance {grievance_id} is {STAGE_SMS_LABEL[stage]}. Track: {link}"


def send_stage_update(user_id: str, grievance_id: str, stage: str) -> bool:
    """Best-effort informational dispatch; never lets SMS disrupt a workflow."""
    try:
        if stage not in SEND_STAGES or config.SMS_PROVIDER == "off":
            return False
        user = users_repository.get(user_id)
        if (not user or user.get("role") != "USER" or not user.get("phoneVerifiedAt")
                or user.get("smsConsent") is not True or user.get("smsOptOutAt") or not user.get("phone")):
            return False
        body = render_stage_message(grievance_id, stage)
        if len(body) > 160:
            logger.warning("SMS template exceeds single segment; skipped stage=%s", stage)
            return False
        with _lock:
            dedupe_key = (grievance_id, stage)
            if dedupe_key in _sent:
                return False
            now = time.time()
            user_recent = [t for t in _user_dispatches.get(user_id, []) if now - t < 3600]
            grievance_recent = [t for t in _grievance_dispatches.get(grievance_id, []) if now - t < 86400]
            if (len(user_recent) >= config.SMS_RATE_LIMIT_PER_USER_HOUR
                    or len(grievance_recent) >= config.SMS_RATE_LIMIT_PER_GRIEVANCE_DAY):
                logger.info("SMS rate cap reached; stage update skipped")
                return False
            _sent.add(dedupe_key)
            _user_dispatches[user_id] = [*user_recent, now]
            _grievance_dispatches[grievance_id] = [*grievance_recent, now]
        if config.SMS_PROVIDER != "dry-run":
            logger.warning("Unsupported SMS provider; update notification not delivered")
            return False
        # This prototype records dispatch intent only. It deliberately does not
        # log destination, rendered content, OTP, or grievance detail.
        _ = to_e164(user["phone"])
        logger.info("SMS dry-run stage notification queued stage=%s", stage)
        return True
    except Exception:
        logger.exception("SMS notification failed; grievance workflow unaffected")
        return False


def queue_stage_update(background_tasks, user_id: str | None, grievance_id: str, stage: str):
    if user_id:
        background_tasks.add_task(send_stage_update, user_id, grievance_id, stage)
