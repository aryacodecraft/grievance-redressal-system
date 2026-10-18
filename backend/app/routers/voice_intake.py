"""Conversational voice intake: authenticated LLM extraction; no storage.

No grievance is created here and no database is touched — the endpoint turns
what a citizen said so far into structured draft fields plus at most one
follow-up question (services/grievance_intake.py). Submission still flows
through the existing POST /submit-grievance pipeline.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import VoiceIntakeRequest
from ..services.grievance_intake import extract_fields

router = APIRouter(tags=["voice-intake"])


@router.post("/grievance-intake/extract")
def extract_voice_intake(
    payload: VoiceIntakeRequest,
    current: Annotated[dict, Depends(get_current_user)],
):
    # Plain `def` on purpose: the Groq SDK is synchronous, so FastAPI runs
    # this in its threadpool instead of blocking the event loop.
    return extract_fields(payload)
