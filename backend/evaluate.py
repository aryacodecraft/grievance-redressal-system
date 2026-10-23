#!/usr/bin/env python3
"""Deprecated pointer to the canonical Jupyter ML workflow.

Dataset analysis, training and evaluation now run only in
``notebooks/grievance_ml_experiments.ipynb``. This path remains as a helpful
message for anyone using the former command; it does not load data or fit a
model.
"""
from __future__ import annotations


def main() -> None:
    raise SystemExit(
        "ML training and evaluation moved to notebooks/grievance_ml_experiments.ipynb. "
        "Run its cells from a clean Jupyter kernel."
    )


if __name__ == "__main__":
    main()
