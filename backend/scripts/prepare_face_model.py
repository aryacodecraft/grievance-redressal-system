#!/usr/bin/env python3
"""Pre-download only the InsightFace models the app needs.

The official ``buffalo_s.zip`` pack also contains a 143 MB 3D-landmark model
and a gender/age model. InsightFace's legacy model loader creates an ONNX
session for every ``.onnx`` file *before* filtering by ``allowed_modules``, so
keeping those files costs a lot of memory on small hosts (Render free is
512 MB). This script fetches the official archive and extracts only:

  det_500m.onnx    SCRFD face detector
  2d106det.onnx    106-point landmarks (liveness)
  w600k_mbf.onnx   recognition embeddings

It writes them to ``<root>/models/buffalo_s`` and fails loudly if anything is
missing. Run it at build time (Render) and point ``FACE_MODEL_ROOT`` at the
same directory at runtime.

Usage:
  python backend/scripts/prepare_face_model.py \
      --root /opt/render/project/src/.insightface

  # Offline / CI: reuse an existing archive instead of downloading.
  python backend/scripts/prepare_face_model.py \
      --root /tmp/face-model --archive /tmp/buffalo_s.zip
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import requests

MODEL_NAME = "buffalo_s"
MODEL_URL = (
    "https://github.com/deepinsight/insightface/releases/download/"
    "model-zoo/buffalo_s.zip"
)
# Only these three files are loaded by FaceAnalysis(allowed_modules=...).
REQUIRED = ("det_500m.onnx", "2d106det.onnx", "w600k_mbf.onnx")
# Cheap integrity guard against truncated downloads/extractions (bytes).
MIN_BYTES = {
    "det_500m.onnx": 2_000_000,
    "2d106det.onnx": 4_000_000,
    "w600k_mbf.onnx": 12_000_000,
}


def _download(url: str, dest: Path) -> None:
    print(f"Downloading {url}")
    with requests.get(url, stream=True, timeout=(15, 300)) as response:
        response.raise_for_status()
        expected = int(response.headers.get("content-length") or 0)
        written = 0
        with dest.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
                    written += len(chunk)
    if expected and written != expected:
        raise RuntimeError(f"short download: {written:,}/{expected:,} bytes")
    print(f"Downloaded {written:,} bytes")


def _extract(archive: Path, root: Path) -> Path:
    target = root / "models" / MODEL_NAME
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        names = set(bundle.namelist())
        missing = [name for name in REQUIRED if name not in names]
        if missing:
            raise RuntimeError(f"archive is missing: {missing}")
        for name in REQUIRED:
            with bundle.open(name) as src, (target / name).open("wb") as dst:
                shutil.copyfileobj(src, dst)
            size = (target / name).stat().st_size
            minimum = MIN_BYTES[name]
            if size < minimum:
                raise RuntimeError(
                    f"{name} is only {size:,} bytes (expected at least {minimum:,})"
                )
            print(f"  {name}: {size:,} bytes")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        default=os.getenv("FACE_MODEL_ROOT") or os.path.expanduser("~/.insightface"),
        help="InsightFace root directory (default: $FACE_MODEL_ROOT or ~/.insightface)",
    )
    parser.add_argument(
        "--archive",
        help="Use an existing buffalo_s.zip instead of downloading (offline/CI)",
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    target = root / "models" / MODEL_NAME
    target.mkdir(parents=True, exist_ok=True)

    # Remove any unused models left by a full-pack download. The loader would
    # otherwise create sessions for them before applying allowed_modules.
    for stale in sorted(target.glob("*.onnx")):
        if stale.name not in REQUIRED:
            print(f"Removing unused model {stale.name}")
            stale.unlink()

    if all((target / name).is_file() for name in REQUIRED):
        print(f"Model files already present in {target}; nothing to do.")
        return 0

    temp_path: Path | None = None
    try:
        if args.archive:
            archive = Path(args.archive).expanduser().resolve()
            if not archive.is_file():
                raise RuntimeError(f"archive not found: {archive}")
        else:
            fd, name = tempfile.mkstemp(prefix="buffalo_s-", suffix=".zip")
            os.close(fd)
            temp_path = Path(name)
            _download(MODEL_URL, temp_path)
            archive = temp_path
        extracted = _extract(archive, root)
        print(f"Face model ready: {extracted}")
        return 0
    except Exception as exc:  # fail the build, not the runtime
        print(f"prepare_face_model failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
