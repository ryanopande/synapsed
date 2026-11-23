#!/usr/bin/env python3
"""Seed the Study 1 simulated learners into SynapsEd via POST /api/study/seed.

Place this folder at study/study1_instructor/ and run from study/:
    python study1_instructor/seed_study1.py
Needs study/.env with SYNAPSED_BASE_URL, STUDY_API_KEY, and STUDY_PROFESSOR_ID
(creates a new class owned by that professor) or STUDY_CLASS_ID (reuses a class).
WARNING: with STUDY_CLASS_ID the endpoint deletes that class's pathways and survey
responses first (reset=True). Never point it at a real course.
"""
from __future__ import annotations
import os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDY_ROOT = HERE.parent
sys.path.insert(0, str(STUDY_ROOT))
from lib.api_client import get_study_api_key, load_json, load_study_env, post_json, save_json  # noqa: E402


def main() -> int:
    load_study_env()
    data = load_json(HERE / "study1_profiles.json")
    body = {"apiKey": get_study_api_key(), "profiles": data["profiles"], "reset": True,
            "classTitle": os.getenv("STUDY1_CLASS_TITLE", "AI Literacy (Study 1)"),
            "classDescription": "AI literacy course built from three short DeepLearning.AI courses"}
    if os.getenv("STUDY_CLASS_ID"):
        body["classId"] = os.environ["STUDY_CLASS_ID"]
    elif os.getenv("STUDY_PROFESSOR_ID"):
        body["professorId"] = os.environ["STUDY_PROFESSOR_ID"]
    else:
        print("Set STUDY_PROFESSOR_ID (recommended) or STUDY_CLASS_ID in study/.env")
        return 1
    result = post_json("/api/study/seed", body, api_key=get_study_api_key())
    save_json(HERE / "seed_result.json", result)
    print(f"classId={result['classId']} surveyId={result['surveyId']} students={len(result['students'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
