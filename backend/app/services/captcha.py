"""Self-hosted text captcha — no vendor, no extra keys.

A 5-character challenge is rendered as SVG (rotated glyphs + strike lines +
noise dots) and only its HMAC is stored, in the OTP challenge store with a
5-minute TTL. Verification burns the challenge (single use) and allows 3
attempts, mirroring the OTP rules. Solutions are never logged.

This is prototype-grade bot friction, not reCAPTCHA: it stops casual form
spam and protects OTP SMS spend, and says so honestly.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets

from .. import config
from ..repositories.otp_codes import otp_repository

logger = logging.getLogger("grievance-api")

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L lookalikes
CODE_LENGTH = 5
CAPTCHA_TTL_SECONDS = 300

_WIDTH, _HEIGHT = 180, 60


def _hash(key: str, code: str) -> str:
    return hmac.new(
        config.OTP_HASH_SECRET.encode(), f"{key}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def _render_svg(code: str) -> str:
    """Distorted-text SVG. Characters are drawn from a fixed safe alphabet,
    so no XML escaping is needed."""
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{_WIDTH}" height="{_HEIGHT}" role="img" aria-label="Captcha challenge">',
        f'<rect width="{_WIDTH}" height="{_HEIGHT}" fill="#f4f4f5"/>',
    ]
    step = _WIDTH // (len(code) + 1)
    for i, ch in enumerate(code):
        x = step * (i + 1) + secrets.randbelow(7) - 3
        y = 38 + secrets.randbelow(9) - 4
        angle = secrets.randbelow(41) - 20
        shade = 30 + secrets.randbelow(40)
        parts.append(
            f'<text x="{x}" y="{y}" text-anchor="middle" font-family="monospace" '
            f'font-size="30" font-weight="bold" fill="rgb({shade},{shade},{shade})" '
            f'transform="rotate({angle} {x} {y})">{ch}</text>'
        )
    for _ in range(2):
        x1, y1 = secrets.randbelow(_WIDTH), secrets.randbelow(_HEIGHT)
        x2, y2 = secrets.randbelow(_WIDTH), secrets.randbelow(_HEIGHT)
        parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="#a1a1aa" stroke-width="1.5"/>'
        )
    for _ in range(15):
        cx, cy = secrets.randbelow(_WIDTH), secrets.randbelow(_HEIGHT)
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="1.2" fill="#d4d4d8"/>')
    parts.append("</svg>")
    return "".join(parts)


def mint_captcha() -> dict:
    """Create a challenge. Returns the id, SVG markup, and TTL."""
    code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    captcha_id = "cap_" + secrets.token_hex(12)
    otp_repository.put(captcha_id, _hash(captcha_id, code), "captcha", CAPTCHA_TTL_SECONDS)
    logger.info("Captcha minted")
    return {"captcha_id": captcha_id, "svg": _render_svg(code), "expires_in": CAPTCHA_TTL_SECONDS}


def verify_captcha(captcha_id: str, solution: str | None) -> bool:
    """Check a solution (case-insensitive). Burns on success, 3-strike burn
    on failure — same rules as OTP. Never logs the solution."""
    try:
        challenge = otp_repository.get(captcha_id or "")
        if not challenge or challenge.get("purpose") != "captcha":
            return False
        if not hmac.compare_digest(
            challenge["hash"], _hash(captcha_id, (solution or "").strip().upper())
        ):
            otp_repository.fail(captcha_id)
            return False
        otp_repository.consume(captcha_id)
        return True
    except Exception:
        logger.exception("Captcha verification failed")
        return False
