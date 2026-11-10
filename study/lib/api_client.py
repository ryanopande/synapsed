"""HTTP client for Synapsed study pipeline APIs."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

STUDY_ROOT = Path(__file__).resolve().parent.parent


def load_study_env() -> None:
    """Load study/.env if present (copy from env.example)."""
    env_path = STUDY_ROOT / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv(STUDY_ROOT / "env.example")


def get_base_url() -> str:
    load_study_env()
    url = os.getenv("SYNAPSED_BASE_URL", "http://localhost:3000").rstrip("/")
    return url


def get_study_api_key() -> str:
    load_study_env()
    key = os.getenv("STUDY_API_KEY", "")
    if not key:
        raise ValueError("STUDY_API_KEY is not set. Copy study/env.example to study/.env")
    return key


def get_class_id() -> str:
    load_study_env()
    class_id = os.getenv("STUDY_CLASS_ID", "")
    if not class_id:
        raise ValueError("STUDY_CLASS_ID is not set in study/.env")
    return class_id


def post_json(path: str, body: dict[str, Any], *, api_key: str | None = None) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-study-api-key"] = api_key
    response = requests.post(f"{get_base_url()}{path}", json=body, headers=headers, timeout=120)
    response.raise_for_status()
    return response.json()


def get_json(path: str, *, params: dict[str, str] | None = None) -> dict[str, Any]:
    response = requests.get(f"{get_base_url()}{path}", params=params, timeout=60)
    response.raise_for_status()
    return response.json()


def upload_file(
    path: str,
    class_id: str,
    file_path: Path,
    category: str,
) -> dict[str, Any]:
    with file_path.open("rb") as handle:
        response = requests.post(
            f"{get_base_url()}{path}",
            data={"classId": class_id, "category": category},
            files={"files": (file_path.name, handle, "application/pdf")},
            timeout=120,
        )
    response.raise_for_status()
    return response.json()


def poll_syllabus_extract(material_id: str, *, max_attempts: int = 30, interval_sec: float = 2.0) -> dict[str, Any]:
    """Poll syllabus extract until processing completes or times out."""
    for attempt in range(max_attempts):
        result = post_json("/api/syllabus/extract", {"materialId": material_id})
        if result.get("success") and (result.get("content") or result.get("cached")):
            return result
        if result.get("message") == "Syllabus already processed and up to date":
            return result
        time.sleep(interval_sec)
    raise TimeoutError(f"Syllabus extract did not complete for material {material_id}")


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
