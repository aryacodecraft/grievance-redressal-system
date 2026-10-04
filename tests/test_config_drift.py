"""Environment configuration: drift between code, examples, and deploy config.

Three files describe the same surface and are maintained by hand:

* `backend/app/config.py` — what the code actually reads
* `backend/.env.example` / `frontend/.env.example` — what a fresh clone copies
* `render.yaml` — what a deployment is given

Any of the three falling behind is invisible until someone deploys. These tests
parse all three, so a key added to `config.py` without documenting it fails
here rather than in production.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "backend" / "app" / "config.py"
ENV_EXAMPLE = ROOT / "backend" / ".env.example"
FRONTEND_ENV_EXAMPLE = ROOT / "frontend" / ".env.example"
RENDER_YAML = ROOT / "render.yaml"

# Keys the backend cannot do anything useful without, or whose absence
# silently changes behaviour rather than erroring.
CRITICAL_BACKEND_KEYS = {
    "MONGODB_URI",
    "MONGODB_DB",
    "CORS_ORIGINS",
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "HF_API_TOKEN",
    "IMAGE_LLM_THRESHOLD",
    "LLAVA_MODEL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
}


def _env_keys(path: Path) -> set[str]:
    """`KEY=` at the start of a line; comments and blank lines ignored."""
    if not path.exists():
        return set()
    keys = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=", stripped)
        if match:
            keys.add(match.group(1))
    return keys


def _config_keys() -> set[str]:
    """Every `os.getenv("NAME"...)`/`os.environ[...]` reference in config.py."""
    text = CONFIG.read_text(encoding="utf-8")
    return set(re.findall(r"""(?:getenv|environ(?:\.get)?)\(\s*["']([A-Z0-9_]+)["']""", text))


def _render_keys() -> set[str]:
    text = RENDER_YAML.read_text(encoding="utf-8")
    return set(re.findall(r"^\s*- key:\s*([A-Z0-9_]+)\s*$", text, re.MULTILINE))


# ── The three files agree ───────────────────────────────────────────────────


def test_config_keys_are_documented_in_env_example():
    """A key the code reads must be discoverable by someone setting up."""
    missing = _config_keys() - _env_keys(ENV_EXAMPLE)
    # PORT is set by the platform, not by hand.
    missing.discard("PORT")
    assert not missing, (
        "read by config.py but absent from backend/.env.example: "
        f"{sorted(missing)}"
    )


def test_env_example_keys_are_still_read_by_the_code():
    """Stale documentation is worse than none — it implies a knob exists."""
    stale = _env_keys(ENV_EXAMPLE) - _config_keys()
    assert not stale, (
        f"documented in backend/.env.example but never read: {sorted(stale)}"
    )


def test_every_critical_backend_key_is_documented():
    missing = CRITICAL_BACKEND_KEYS - _env_keys(ENV_EXAMPLE)
    assert not missing, f"critical keys missing from backend/.env.example: {sorted(missing)}"


def test_render_declares_everything_the_backend_needs():
    """`sync: false` keys are fine (set in the dashboard); absent ones are not."""
    required = {"MONGODB_URI", "MONGODB_DB", "CORS_ORIGINS", "PORT"}
    missing = required - _render_keys()
    assert not missing, f"missing from render.yaml envVars: {sorted(missing)}"


def test_render_database_variables_exist():
    """Without `MONGODB_URI` a deployment silently runs in-memory."""
    assert "MONGODB_URI" in _render_keys()
    assert "MONGODB_DB" in _render_keys()


def test_render_cors_origin_is_not_a_localhost_placeholder():
    """A deployed backend pointed at `localhost:3000` rejects the real frontend.

    `CORS_ORIGINS` used to be pinned to a literal `http://localhost:3000`,
    which is correct for local dev but wrong for any public URL — the browser
    would block every cross-origin call with no server-side error to explain
    it. Leaving it `sync: false` makes the operator supply the real origin
    instead of inheriting a placeholder.
    """
    text = RENDER_YAML.read_text(encoding="utf-8")
    start = text.find("key: CORS_ORIGINS")
    assert start != -1, "CORS_ORIGINS must be declared in render.yaml envVars"

    # The entry runs to the next `- key:` marker (or end of file).
    rest = text[start:]
    next_entry = re.search(r"\n\s*- key:", rest[1:])
    entry = rest[: next_entry.start() + 1] if next_entry else rest

    assert "sync: false" in entry, (
        "CORS_ORIGINS should be operator-supplied (sync: false), not a pinned "
        f"value — found:\n{entry.strip()}"
    )
    assert "localhost" not in entry and "127.0.0.1" not in entry, (
        f"CORS_ORIGINS pins a localhost origin: {entry.strip()}"
    )


# ── Defaults that must not silently break a fresh clone ─────────────────────


def test_groq_model_default_is_not_a_decommissioned_model():
    """The old default (`llama-3.3-70b-versatile`) 404s on Groq.

    A 404 there is swallowed by the cascade, so classification silently dropped
    to keyword rules while appearing configured. See DEC-015.
    """
    from backend.app.config import GROQ_MODEL

    assert GROQ_MODEL, "GROQ_MODEL must have a non-empty default"
    assert "llama-3.3-70b-versatile" not in GROQ_MODEL, (
        "GROQ_MODEL defaults to a decommissioned model (DEC-015)"
    )


def test_example_and_code_agree_on_groq_model_default():
    from backend.app.config import GROQ_MODEL

    example = next(
        (
            line.split("=", 1)[1].strip()
            for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines()
            if line.startswith("GROQ_MODEL=")
        ),
        None,
    )
    assert example is not None, "GROQ_MODEL must appear in backend/.env.example"
    assert example == GROQ_MODEL, (
        f".env.example says {example!r} but config.py defaults to {GROQ_MODEL!r}"
    )


def test_llava_model_is_actually_consumed():
    """`LLAVA_MODEL` was declared in config.py and read by nobody — the model
    string was hardcoded in `services/image.py` instead (DEC-015)."""
    image_source = (ROOT / "backend" / "app" / "services" / "image.py").read_text(
        encoding="utf-8"
    )
    assert "LLAVA_MODEL" in image_source, (
        "services/image.py must consume LLAVA_MODEL, not a hardcoded literal"
    )
    # And the literal it used to hardcode must not be back.
    assert '"meta-llama/llama-4-scout-17b-16e-instruct"' not in image_source


def test_env_example_ships_a_no_wildcard_cors_origin():
    line = next(
        (
            l
            for l in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines()
            if l.startswith("CORS_ORIGINS=")
        ),
        "",
    )
    assert "*" not in line, "do not teach operators to ship a wildcard origin"


def test_env_example_carries_no_real_secrets():
    """Values must be empty or a placeholder — never a live credential."""
    forbidden = re.compile(
        r"(mongodb\+srv://|gsk_[A-Za-z0-9]{10,}|//rsabegin|[A-Za-z0-9._%+-]+@"
        r"(gmail|outlook|yahoo)\.[a-z]{2,}:[^=\s]+)",
        re.IGNORECASE,
    )
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        assert not forbidden.search(value), f"possible secret in {key}"


# ── Frontend ────────────────────────────────────────────────────────────────


def test_frontend_example_documents_the_mock_switch():
    """`NEXT_PUBLIC_USE_MOCKS` decides whether the UI shows *real* data.

    `useMocks()` returns `process.env.NEXT_PUBLIC_USE_MOCKS !== "false"`, so
    anything other than the exact string `false` — unset, `0`, `FALSE`, `no` —
    leaves the app on built-in mock data. A deployment that forgets the var
    presents fabricated grievances as if they were live, with no warning.
    """
    text = FRONTEND_ENV_EXAMPLE.read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_USE_MOCKS" in text
    assert "NEXT_PUBLIC_API_URL" in text


def test_frontend_example_var_names_are_the_real_ones():
    """A typo'd `NEXT_PUBLIC_` name is not an error — it is just undefined,
    and `undefined !== "false"` quietly selects mock mode."""
    keys = _env_keys(FRONTEND_ENV_EXAMPLE)
    assert {"NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_USE_MOCKS"} <= keys


def test_frontend_does_not_ship_cloudinary_secrets():
    """The browser only ever needs the cloud name and an unsigned preset.

    Anything with `SECRET` in the name must not be reachable from client code.
    """
    frontend_lib = ROOT / "frontend" / "lib"
    offenders = []
    for path in frontend_lib.rglob("*.ts*"):
        text = path.read_text(encoding="utf-8")
        if re.search(r"CLOUDINARY_API_SECRET|CLOUDINARY_API_KEY", text):
            offenders.append(str(path.relative_to(ROOT)))
    assert not offenders, f"client-side Cloudinary credential reference: {offenders}"


def test_example_values_are_not_real_endpoints():
    """`NEXT_PUBLIC_API_URL` in the example must point at local dev."""
    line = next(
        (
            l
            for l in FRONTEND_ENV_EXAMPLE.read_text(encoding="utf-8").splitlines()
            if l.startswith("NEXT_PUBLIC_API_URL=")
        ),
        "",
    )
    value = line.partition("=")[2].strip()
    assert value.startswith("http"), "must be a full URL"
    assert "localhost" in value or "127.0.0.1" in value
