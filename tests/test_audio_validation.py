"""Deterministic PCM fixtures; no speech recordings or provider calls."""

import io
import struct
import wave

import pytest
from fastapi import HTTPException

from backend.app.services.audio_validation import validate_wav


def wav_bytes(frames=160, channels=1, width=2, rate=16000):
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setparams((channels, width, rate, 0, "NONE", "not compressed"))
        wav.writeframes(b"\0" * frames * channels * width)
    return out.getvalue()


def test_exact_duration_boundary():
    assert validate_wav(wav_bytes(480000)) == wav_bytes(480000)
    with pytest.raises(HTTPException) as exc:
        validate_wav(wav_bytes(480001))
    assert exc.value.status_code == 400


@pytest.mark.parametrize("data", [b"", b"webm", wav_bytes()[:-1], wav_bytes() + b"x", wav_bytes(0)], ids=["empty", "webm", "truncated", "trailing", "no-frames"])
def test_invalid_containers(data):
    with pytest.raises(HTTPException):
        validate_wav(data)


@pytest.mark.parametrize("options", [{"channels": 2}, {"width": 1}, {"rate": 8000}])
def test_wrong_pcm_properties(options):
    with pytest.raises(HTTPException) as exc:
        validate_wav(wav_bytes(**options))
    assert exc.value.status_code == 415


def test_declared_chunk_size_cannot_hide_truncation():
    data = bytearray(wav_bytes())
    struct.pack_into("<I", data, 40, 999999)
    with pytest.raises(HTTPException):
        validate_wav(bytes(data))


def test_odd_frame_payload():
    data = bytearray(wav_bytes())
    data.extend(b"\0\0")
    struct.pack_into("<I", data, 4, len(data) - 8)
    struct.pack_into("<I", data, 40, len(data) - 45)
    with pytest.raises(HTTPException):
        validate_wav(bytes(data))
