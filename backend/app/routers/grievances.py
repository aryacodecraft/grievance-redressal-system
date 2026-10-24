"""Grievance submission, listing, lookup and officer status updates.

Auth wiring (Phase 1):
  - POST /submit-grievance  → any authenticated user (USER/RESOLVER/ADMIN)
  - GET  /grievances        → any authenticated user; citizens auto-scoped to
                              their own grievances, ADMIN/RESOLVER see all
  - GET  /grievances/{id}   → authenticated; citizens may only see their own
  - PATCH /grievances/{id}/status → ADMIN or RESOLVER only
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import JSONResponse

from ..auth import get_current_user, get_optional_user, require_role
from ..config import IMAGE_LLM_THRESHOLD
from ..db import repository, to_api
from ..models import StatusUpdateRequest, SubmitGrievanceRequest
from ..services.classification import (
    CATEGORY_KEYS,
    CATEGORY_LABELS,
    CATEGORY_MODEL,
    GROQ_MODEL,
    PRIORITY_MODEL,
    classify_category,
    classify_priority,
    classification_budget,
    extract_keywords,
    find_urgent_matches,
    is_clearly_out_of_scope,
)
from ..services.image import llm_image_confidence
from ..repositories.notifications import notif_repository
from ..services.departments import canonical_department
from ..services.quality_check import check_quality
from ..services.quality_check import check_quality

logger = logging.getLogger("grievance-api")
router = APIRouter()

@router.post("/submit-grievance")
def submit_grievance(
    payload: SubmitGrievanceRequest,
    background_tasks: BackgroundTasks,
    current: Annotated[dict, Depends(get_current_user)],
):
    title = payload.title.strip()
    description = payload.description.strip()

    # Submission identity always comes from the verified JWT. The userId body
    # field remains accepted for backwards-compatible payload parsing, but is
    # never trusted for ownership.
    user_id = current["user_id"]

    if not title or not description:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Missing required fields (title, description)"
            },
        )

    full_text = f"{title}\n{description}"
    if not any(character.isalpha() for character in full_text):
        return JSONResponse(
            status_code=400,
            content={
                "error": (
                    "Please describe the issue using words; punctuation or "
                    "symbols alone are not enough."
                )
            },
        )

    # Reject only locally recognizable, clearly non-civic intent. Keep this
    # before image/provider validation, classification, reference generation,
    # persistence, notifications and SMS; uncertain text stays reviewable.
    if is_clearly_out_of_scope(full_text):
        logger.info("grievance submission rejected reason=clearly_out_of_scope")
        return JSONResponse(
            status_code=422,
            content={
                "error": (
                    "Please describe a problem related to a public service or "
                    "civic issue. Add what happened and where it is affecting you."
                )
            },
        )

    image_url = payload.imageUrl
    image_validation_result = None

    # 1. Image validation (measured low scores reject; unavailable checks are
    # retained as unverified for staff review rather than blocking submission).
    if image_url:
        try:
            llm_res = llm_image_confidence(image_url)
        except Exception as exc:
            logger.exception("LLM image validation failed during submit")
            llm_res = {
                "score": None,
                "explanation": "Image validation unavailable; retained for human review.",
                "raw": "validation-unavailable",
            }
        llm_score = llm_res.get("score")
        validation_available = llm_score is not None
        image_validation_result = {
            "ok": bool(validation_available and float(llm_score) >= IMAGE_LLM_THRESHOLD),
            "status": "validated" if validation_available else "unverified",
            "llm_score": float(llm_score) if validation_available else None,
            "explanation": llm_res.get("explanation", ""),
            "raw": llm_res.get("raw", ""),
        }
        if validation_available and float(llm_score) < IMAGE_LLM_THRESHOLD:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Image rejected by LLM validation (score below threshold)",
                    "imageValidation": image_validation_result,
                    "threshold": float(IMAGE_LLM_THRESHOLD),
                },
            )

    # 2. Classification cascade (local model → local scope/keyword policy →
    # scoped provider fallback). The budget bounds provider time.
    with classification_budget():
        try:
            cat_res = classify_category(full_text)
        except Exception:
            logger.exception("category classification failed")
            cat_res = {
                "rawLabel": "", "category": "other", "confidence": 0.0,
                "source": "classifier_error", "categoryOutcome": "uncertain",
                "categoryConfidenceSemantics": "unavailable",
            }
        try:
            pri_res = classify_priority(full_text)
        except Exception:
            logger.exception("priority classification failed")
            pri_res = {"sentiment": "neutral", "sentimentScore": 0.0, "priority": "low"}

        hf_priority = pri_res.get("priority", "low")
        sentiment_raw = pri_res.get("sentiment", "neutral")
        sentiment_score = pri_res.get("sentimentScore", 0.0)
        urgent_matches = find_urgent_matches(full_text)

        hf_category = cat_res.get("category", "other")
        if hf_category == "sanitation" and hf_priority == "low":
            hf_priority = "medium"

        hf_raw_label = cat_res.get("rawLabel", "")
        keywords = extract_keywords(full_text)

        # The optional quality classifier is useful only when the local
        # category cascade abstains. Avoid an external call on every submission;
        # provider failures remain fail-open for uncertain civic complaints.
        quality_result = {"is_genuine": True, "reason": "quality check skipped"}
        if cat_res.get("categoryOutcome") == "uncertain":
            try:
                quality_result = check_quality(title, description)
            except Exception:
                quality_result = {"is_genuine": True, "reason": "quality check error"}

    priority = hf_priority
    category = hf_category
    ai_explanation = (
        f"Category '{category}' predicted from '{hf_raw_label}' "
        f"(score: {float(cat_res.get('confidence', 0.0)):.2f}), "
        f"Priority '{priority}' determined using sentiment ('{sentiment_raw}', "
        f"score: {float(sentiment_score):.2f}) and urgency keywords."
    )
    if cat_res.get("categoryOutcome") == "out_of_scope":
        ai_explanation = (
            "The classifier marked this text as apparently outside civic services. "
            "It remains submitted under Other for officer review."
        )
    elif cat_res.get("source") in {"scope_gate", "uncertain", "invalid_input"}:
        ai_explanation = (
            "Category is uncertain. Please add details about the municipal service "
            "or issue, or have an officer review the category."
        )

    hf_engine = {
        "category": category,
        "priority": priority,
        "isUrgent": priority == "high",
        "keywords": keywords,
        "explanation": ai_explanation,
        "rawCategoryLabel": hf_raw_label,
        "categoryConfidence": float(cat_res.get("confidence", 0.0)),
        "urgentMatches": urgent_matches,
        "modelInfo": {
            "categoryModel": CATEGORY_MODEL,
            "priorityModel": PRIORITY_MODEL,
            "sentimentLabel": sentiment_raw,
            "sentimentScore": float(sentiment_score),
            "groqModel": GROQ_MODEL if (
                cat_res.get("source") == "groq_fallback"
                or pri_res.get("source") == "groq_fallback"
            ) else "None",
            "categorySource": cat_res.get("source", "unknown"),
            "categoryOutcome": cat_res.get(
                "categoryOutcome",
                "categorized" if hf_category != "other" else "uncertain",
            ),
            "categoryConfidenceSemantics": cat_res.get(
                "categoryConfidenceSemantics", "unavailable"
            ),
            "prioritySource": pri_res.get("source", "unknown"),
            "hfCategory": hf_category,
            "hfPriority": hf_priority,
        },
    }

    # 3. Persist
    record = {
        "title": title,
        "description": description,
        "userId": user_id,
        "status": "open",
        "state": "PENDING_ASSIGNMENT",
        "category": category,
        "departmentId": canonical_department(category),
        "priority": priority,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "hfEngine": hf_engine,
    }
    is_genuine = quality_result.get("is_genuine", True)
    if not is_genuine:
        record["qualityFlag"] = "suspicious"
        record["qualityReason"] = quality_result.get("reason", "")
    if image_url:
        record["imageUrl"] = image_url
        if payload.imagePublicId:
            record["imagePublicId"] = payload.imagePublicId
        if image_validation_result:
            record["imageValidation"] = image_validation_result
    if payload.latitude is not None and payload.longitude is not None:
        record["latitude"] = float(payload.latitude)
        record["longitude"] = float(payload.longitude)
    if payload.address:
        record["address"] = payload.address.strip()

    try:
        doc_id = repository.create(record)
    except Exception:
        logger.exception("Failed to create grievance document")
        return JSONResponse(
            status_code=500, content={"error": "Failed to save grievance"}
        )

    notif_repository.create({
        "userId": user_id,
        "kind": "grievance.submitted",
        "entityId": doc_id,
        "title": f"Grievance {doc_id} registered",
        "message": "Your complaint has been registered and is awaiting review.",
    })
    from ..services.sms import queue_stage_update
    queue_stage_update(background_tasks, user_id, doc_id, "SUBMITTED")

    return {
        "message": "Grievance submitted successfully",
        "grievanceId": doc_id,
        "hfEngine": hf_engine,
        "flagged": not is_genuine,
        "flagReason": quality_result.get("reason", "") if not is_genuine else None,
    }


@router.get("/grievances")
def list_grievances(
    userId: str | None = None,
    limit: int = Query(50, ge=1, le=1000),
    state: str | None = None,
    dept: str | None = None,
    overdue: bool = False,
    current: Annotated[dict | None, Depends(get_optional_user)] = None,
):
    if not current:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})

    role = current["role"]
    if current:
        if role == "SUPERADMIN":
            scoped_user = userId
            scoped_owner = None
            scoped_dept = canonical_department(dept) if dept else None
        elif role in ("ADMIN", "MANAGER"):
            scoped_user = userId
            scoped_owner = None
            own_department = current.get("departmentId")
            # A department manager cannot broaden their scope via query params;
            # a global ADMIN may optionally filter to one department.
            scoped_dept = canonical_department(own_department) if own_department else (canonical_department(dept) if dept else None)
        elif role in ("RESOLVER", "EMPLOYEE"):
            scoped_user = userId
            scoped_owner = current["user_id"]
            # Owner scope is sufficient for a resolver. canonical_department(None)
            # defaults to "other", hiding assignments from every other team.
            scoped_dept = canonical_department(dept) if dept else None
        else:
            scoped_user = current["user_id"]
            scoped_owner = None
            scoped_dept = dept
    else:
        scoped_user = userId
        scoped_owner = None
        scoped_dept = dept

    docs = repository.list(
        user_id=scoped_user, limit=limit,
        state=state.upper() if state else None,
        dept_id=scoped_dept,
        owner_id=scoped_owner,
        overdue=overdue
    )
    return [to_api(doc) for doc in docs]


@router.get("/resolver/tasks")
def list_resolver_tasks(
    current: Annotated[dict, Depends(get_current_user)],
):
    """List all tasks assigned to the authenticated employee, independent of department aliases."""
    if current["role"] not in ("RESOLVER", "EMPLOYEE"):
        return JSONResponse(status_code=403, content={"error": "Requires RESOLVER"})
    docs = repository.list(limit=1000, owner_id=current["user_id"])
    return [to_api(doc) for doc in docs]


@router.get("/grievances/department-counts")
def grievance_department_counts():
    """Return aggregate counts only; individual grievance data remains protected."""
    docs = repository.list(limit=100000)
    counts: dict[str, int] = {}
    for doc in docs:
        key = str(doc.get("category") or (doc.get("hfEngine") or {}).get("category") or "other").lower()
        counts[key] = counts.get(key, 0) + 1
    return {"total": len(docs), "counts": counts}


@router.get("/grievances/{grievance_id}")
def get_grievance(
    grievance_id: str,
    current: Annotated[dict | None, Depends(get_optional_user)] = None,
):
    # Reference IDs are case-insensitive for lookup; stored IDs stay uppercase.
    doc = repository.get(grievance_id.strip().upper())
    if doc is None:
        return JSONResponse(
            status_code=404, content={"error": "Grievance not found"}
        )
    result = to_api(doc)

    if current:
        role = current["role"]
        is_owner = result.get("userId") == current["user_id"]
        is_assignee = result.get("ownerId") == current["user_id"]
        is_in_department = (
            not current.get("departmentId")
            or canonical_department(current.get("departmentId"))
            == canonical_department(result.get("departmentId") or result.get("category"))
        )
        can_view_full = (
            role in ("SUPERADMIN",)
            or (role in ("ADMIN", "MANAGER") and is_in_department)
            or (role == "USER" and is_owner)
            or (role in ("RESOLVER", "EMPLOYEE") and is_assignee)
        )
        if not can_view_full:
            return _public_tracking_view(result)
    else:
        return _public_tracking_view(result)

    return result


def _public_tracking_view(result: dict) -> dict:
    """Expose only non-identifying fields to public reference-ID lookups."""
    return {
        key: result[key]
        for key in ("id", "title", "status", "state", "category", "priority", "createdAt", "departmentId")
        if key in result
    } | {"description": ""}


@router.patch("/grievances/{grievance_id}/status")
def update_status(
    grievance_id: str,
    payload: StatusUpdateRequest,
    current: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN", "RESOLVER"]))],
):
    """Update grievance status / assignee.  Requires ADMIN, SUPERADMIN, or RESOLVER."""
    patch = {}
    if payload.status is not None:
        # Reject a blank status rather than storing it. An empty string used
        # to be written straight through (`update()` only drops `None`), which
        # left the document with no usable status: `Badge` matched nothing and
        # `StatusTimeline` fell back to step 0, showing an untouched grievance
        # as "submitted". The vocabulary itself is NOT validated here — that is
        # DEC-006's state machine (Phase 2); only emptiness is a bug.
        status = payload.status.strip()
        if not status:
            return JSONResponse(
                status_code=400, content={"error": "status must not be blank"}
            )
        patch["status"] = status
    if payload.assignee is not None:
        assignee = payload.assignee.strip()
        if not assignee:
            return JSONResponse(
                status_code=400, content={"error": "assignee must not be blank"}
            )
        patch["assignee"] = assignee

    if not patch:
        return JSONResponse(
            status_code=400, content={"error": "Nothing to update"}
        )

    doc = repository.update(grievance_id.strip(), patch)
    if doc is None:
        return JSONResponse(
            status_code=404, content={"error": "Grievance not found"}
        )
    return to_api(doc)
