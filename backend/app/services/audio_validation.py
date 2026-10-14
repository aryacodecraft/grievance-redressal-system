"""Bounded validation of the v1 PCM WAV contract; no audio persistence."""

import io
import struct
import wave

from fastapi import HTTPException


def validate_wav(data: bytes, max_seconds: float = 30) -> bytes:
    """Validate actual RIFF chunks and frames, then strip metadata for Sarvam.

    The caller caps bytes before entering here. RIFF lengths are untrusted:
    checking every chunk prevents wave.readframes() accepting truncated files.
    Only classic PCM (format tag 1) is accepted in v1.
    """
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise HTTPException(415, "Only PCM WAV audio is supported")
    invalid = HTTPException(400, "Malformed or truncated WAV audio")
    if struct.unpack_from("<I", data, 4)[0] + 8 != len(data):
        raise invalid
    offset = 12
    fmt = None
    frames = None
    while offset < len(data):
        if offset + 8 > len(data):
            raise invalid
        name, size = struct.unpack_from("<4sI", data, offset)
        start = offset + 8
        end = start + size
        if end + (size % 2) > len(data):
            raise invalid
        if name == b"fmt ":
            if fmt is not None or size < 16:
                raise invalid
            fmt = struct.unpack_from("<HHIIHH", data, start)
            if size not in (16, 18) or (size == 18 and data[start + 16:end] != b"\0\0"):
                raise HTTPException(415, "Only classic PCM WAV audio is supported")
        elif name == b"data":
            if frames is not None or fmt is None:
                raise invalid
            frames = data[start:end]
        offset = end + (size % 2)
    if fmt is None or not frames or len(frames) % 2:
        raise invalid
    if fmt != (1, 1, 16000, 32000, 2, 16):
        raise HTTPException(415, "WAV must be mono, 16-bit PCM, 16 kHz")
    # Integer frame boundary: 480000 frames accepted, 480001 rejected.
    if len(frames) // 2 > min(max_seconds, 30) * 16000:
        raise HTTPException(400, "Audio must not exceed 30 seconds")
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        wav.writeframes(frames)
    return out.getvalue()
