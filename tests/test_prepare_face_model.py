"""Tests for backend/scripts/prepare_face_model.py (DEC-046).

The real archive is ~122 MB and the script is exercised against a synthetic
zip; the real-model download is a build/deploy step, not a unit test.
"""

from __future__ import annotations

import sys
import zipfile

from backend.scripts import prepare_face_model as script


def _write_archive(path):
    with zipfile.ZipFile(path, "w") as bundle:
        for name in script.REQUIRED:
            bundle.writestr(name, b"required-payload")
        bundle.writestr("1k3d68.onnx", b"unused-payload")
        bundle.writestr("genderage.onnx", b"unused-payload")
    return path


def _run(root, archive, monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "prepare_face_model.py",
            "--root",
            str(root),
            "--archive",
            str(archive),
        ],
    )
    # The synthetic payloads are tiny; the real sizes are checked by the
    # deploy build against the actual archive.
    monkeypatch.setattr(script, "MIN_BYTES", {name: 1 for name in script.REQUIRED})
    return script.main()


def test_extracts_only_required_models_and_prunes_unused(tmp_path, monkeypatch):
    archive = _write_archive(tmp_path / "buffalo_s.zip")
    root = tmp_path / "face-root"
    target = root / "models" / script.MODEL_NAME
    target.mkdir(parents=True)
    (target / "1k3d68.onnx").write_bytes(b"stale")

    assert _run(root, archive, monkeypatch) == 0
    assert sorted(path.name for path in target.glob("*.onnx")) == sorted(script.REQUIRED)
    assert all((target / name).is_file() for name in script.REQUIRED)


def test_second_run_is_idempotent(tmp_path, monkeypatch):
    archive = _write_archive(tmp_path / "buffalo_s.zip")
    root = tmp_path / "face-root"

    assert _run(root, archive, monkeypatch) == 0
    target = root / "models" / script.MODEL_NAME
    mtimes = {name: (target / name).stat().st_mtime_ns for name in script.REQUIRED}

    assert _run(root, archive, monkeypatch) == 0
    assert {
        name: (target / name).stat().st_mtime_ns for name in script.REQUIRED
    } == mtimes


def test_missing_archive_fails_the_build(tmp_path, monkeypatch):
    assert _run(tmp_path / "face-root", tmp_path / "missing.zip", monkeypatch) == 1
