from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


CATALOG_SCHEMA_VERSION = "1.0"


def load_catalog(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "schema_version": CATALOG_SCHEMA_VERSION,
            "updated_at": None,
            "projects": [],
        }
    payload = json.loads(path.read_text(encoding="utf-8"))
    validate_catalog(payload)
    return payload


def build_catalog(
    previous: dict[str, Any],
    published: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    validate_catalog(previous)
    records = {int(item["id"]): dict(item) for item in previous["projects"]}

    for record in records.values():
        record["active"] = False

    for rank, project in enumerate(published, start=1):
        repo_id = int(project["id"])
        existing = records.get(repo_id)
        first_seen = existing["first_seen"] if existing else generated_at
        previous_best = int(existing["best_rank"]) if existing else rank
        records[repo_id] = {
            **project,
            "first_seen": first_seen,
            "last_seen": generated_at,
            "last_rank": rank,
            "best_rank": min(previous_best, rank),
            "active": True,
            "last_score": int(project["recommendation_score"]),
        }

    projects = sorted(
        records.values(),
        key=lambda item: (
            not bool(item["active"]),
            int(item["last_rank"]),
            str(item["full_name"]).casefold(),
        ),
    )
    payload = {
        "schema_version": CATALOG_SCHEMA_VERSION,
        "updated_at": generated_at,
        "projects": projects,
    }
    validate_catalog(payload)
    return payload


def validate_catalog(payload: dict[str, Any]) -> None:
    required = {"schema_version", "updated_at", "projects"}
    missing = required - payload.keys()
    if missing:
        raise ValueError(f"Missing catalog fields: {sorted(missing)}")
    if payload["schema_version"] != CATALOG_SCHEMA_VERSION:
        raise ValueError(f"Unsupported catalog schema: {payload['schema_version']!r}")
    if payload["updated_at"] is not None:
        _parse_timestamp(payload["updated_at"], "updated_at")
    if not isinstance(payload["projects"], list):
        raise ValueError("Catalog projects must be a list")

    seen: set[int] = set()
    for record in payload["projects"]:
        if not isinstance(record, dict):
            raise ValueError("Catalog project must be an object")
        missing_project = {
            "id",
            "full_name",
            "url",
            "first_seen",
            "last_seen",
            "last_rank",
            "best_rank",
            "active",
            "last_score",
        } - record.keys()
        if missing_project:
            raise ValueError(f"Missing catalog project fields: {sorted(missing_project)}")
        repo_id = int(record["id"])
        if repo_id in seen:
            raise ValueError(f"Duplicate catalog repository id: {repo_id}")
        seen.add(repo_id)
        if not str(record["url"]).startswith("https://github.com/"):
            raise ValueError(f"Invalid catalog URL for {record['full_name']}")
        first_seen = _parse_timestamp(record["first_seen"], "first_seen")
        last_seen = _parse_timestamp(record["last_seen"], "last_seen")
        if first_seen > last_seen:
            raise ValueError(f"first_seen is after last_seen for {record['full_name']}")
        if not isinstance(record["active"], bool):
            raise ValueError(f"Invalid active state for {record['full_name']}")
        for field in ("last_rank", "best_rank"):
            value = record[field]
            if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                raise ValueError(f"Invalid {field} for {record['full_name']}")
        score = record["last_score"]
        if not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= 100:
            raise ValueError(f"Invalid last_score for {record['full_name']}")


def _parse_timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"Catalog {field} must be an ISO timestamp")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Invalid catalog {field}: {value!r}") from error
