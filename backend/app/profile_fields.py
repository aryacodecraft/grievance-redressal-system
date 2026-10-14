"""Shared citizen profile-field validation for both signup paths.

Both `/auth/register` (password) and `/auth/face/signup/*` (face-only)
accept the same four fields and validate them identically here, so the two
flows can never drift apart.
"""
from __future__ import annotations

from datetime import date

GENDERS = {"female", "male", "other", "prefer_not_to_say"}

ADDRESS_MIN, ADDRESS_MAX = 10, 500
OCCUPATION_MIN, OCCUPATION_MAX = 2, 100
# Signup is adult-only (the UI caps the date picker at 18 years ago);
# MAX bounds a plausible human lifespan.
MIN_AGE_YEARS, MAX_AGE_YEARS = 18, 120


def _age_on(born: date, today: date) -> int:
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def validate_profile(address: str, dob: str, occupation: str, gender: str) -> dict:
    """Clean + validate the four profile fields.

    Returns the canonical dict for storage. Raises ValueError with a
    human-readable message on the first problem found.
    """
    address_clean = (address or "").strip()
    if not ADDRESS_MIN <= len(address_clean) <= ADDRESS_MAX:
        raise ValueError(
            f"Address must be {ADDRESS_MIN}-{ADDRESS_MAX} characters"
        )
    try:
        born = date.fromisoformat((dob or "").strip())
    except ValueError:
        raise ValueError("Date of birth must be a valid YYYY-MM-DD date") from None
    today = date.today()
    if born > today:
        raise ValueError("Date of birth cannot be in the future")
    age = _age_on(born, today)
    if not MIN_AGE_YEARS <= age <= MAX_AGE_YEARS:
        raise ValueError(
            f"Citizen must be {MIN_AGE_YEARS}-{MAX_AGE_YEARS} years old"
        )
    occupation_clean = (occupation or "").strip()
    if not OCCUPATION_MIN <= len(occupation_clean) <= OCCUPATION_MAX:
        raise ValueError(
            f"Occupation must be {OCCUPATION_MIN}-{OCCUPATION_MAX} characters"
        )
    gender_clean = (gender or "").strip().lower().replace("-", "_").replace(" ", "_")
    if gender_clean not in GENDERS:
        raise ValueError("Gender must be female, male, other, or prefer not to say")
    return {
        "address": address_clean,
        "dob": born.isoformat(),
        "occupation": occupation_clean,
        "gender": gender_clean,
    }
