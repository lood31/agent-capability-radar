from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from collector import SCHEMA_VERSION
from collector.catalog import build_catalog, load_catalog, validate_catalog
from collector.github import GitHubClient, GitHubError
from collector.history import HistoryStore
from collector.models import ECOSYSTEM_LAYERS, PROJECT_SUBTYPES, Project
from collector.rules import classify
from collector.scoring import score_project
from collector.translations import (
    README_LANGUAGES,
    SUMMARY_SOURCES,
    SUMMARY_STATUSES,
    GitHubModelsClient,
    ReadmeInfo,
    SummaryTranslator,
    analyse_readme,
    load_translation_cache,
    resolve_project_content,
    validate_translation_cache,
)


SITE_DATA_MAX_BYTES = 600_000


def load_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_search_query(search: dict[str, Any], now: datetime) -> str:
    query = str(search["query"]).strip()
    window_days = search.get("window_days")
    if window_days is None:
        return query
    if not isinstance(window_days, int) or isinstance(window_days, bool) or window_days < 1:
        raise ValueError(f"Invalid search window_days: {window_days!r}")
    date_field = search.get("date_field")
    if date_field not in {"created", "pushed"}:
        raise ValueError(f"Invalid search date_field: {date_field!r}")
    cutoff = (now - timedelta(days=window_days)).date().isoformat()
    return f"{query} {date_field}:>{cutoff}"


def validate_site_data(payload: dict[str, Any]) -> None:
    required = {
        "schema_version",
        "generated_at",
        "collection_status",
        "windows",
        "stats",
        "projects",
    }
    missing = required - payload.keys()
    if missing:
        raise ValueError(f"Missing top-level fields: {sorted(missing)}")
    if payload["collection_status"] not in {"live", "demo", "stale"}:
        raise ValueError(f"Invalid collection status: {payload['collection_status']!r}")
    new_projects_days = payload["windows"].get("new_projects_days")
    if (
        not isinstance(new_projects_days, int)
        or isinstance(new_projects_days, bool)
        or new_projects_days < 1
    ):
        raise ValueError("Invalid new_projects_days")
    seen: set[int] = set()
    for project in payload["projects"]:
        repo_id = project.get("id")
        if repo_id in seen:
            raise ValueError(f"Duplicate repository id: {repo_id}")
        seen.add(repo_id)
        for field in ("quality_score", "fit_score", "recommendation_score"):
            if not 0 <= project.get(field, -1) <= 100:
                raise ValueError(f"Invalid {field} for {project.get('full_name')}")
        if not str(project.get("url", "")).startswith("https://github.com/"):
            raise ValueError(f"Invalid GitHub URL for {project.get('full_name')}")
        homepage = project.get("homepage")
        if homepage and not str(homepage).startswith(("https://", "http://")):
            raise ValueError(f"Invalid homepage URL for {project.get('full_name')}")
        if project.get("ecosystem_layer") not in ECOSYSTEM_LAYERS:
            raise ValueError(f"Invalid ecosystem_layer for {project.get('full_name')}")
        if project.get("project_subtype") not in PROJECT_SUBTYPES:
            raise ValueError(f"Invalid project_subtype for {project.get('full_name')}")
        if project.get("summary_source") not in SUMMARY_SOURCES:
            raise ValueError(f"Invalid summary_source for {project.get('full_name')}")
        for field in ("use_cases", "functional_capabilities"):
            if not isinstance(project.get(field), list):
                raise ValueError(f"Invalid {field} for {project.get('full_name')}")
        if not isinstance(project.get("features"), dict):
            raise ValueError(f"Invalid features for {project.get('full_name')}")
        if payload.get("schema_version") == SCHEMA_VERSION:
            if project.get("readme_language") not in README_LANGUAGES:
                raise ValueError(f"Invalid readme_language for {project.get('full_name')}")
            if project.get("summary_status") not in SUMMARY_STATUSES:
                raise ValueError(f"Invalid summary_status for {project.get('full_name')}")
            excerpt = project.get("readme_excerpt")
            if excerpt is not None and (not isinstance(excerpt, str) or len(excerpt) > 1200):
                raise ValueError(f"Invalid readme_excerpt for {project.get('full_name')}")
            readme_url = project.get("readme_url")
            if readme_url is not None and not str(readme_url).startswith("https://github.com/"):
                raise ValueError(f"Invalid readme_url for {project.get('full_name')}")
            readme_hash = project.get("readme_hash")
            if readme_hash is not None and not re.fullmatch(r"[0-9a-f]{64}", str(readme_hash)):
                raise ValueError(f"Invalid readme_hash for {project.get('full_name')}")


def validate_site_size(payload: dict[str, Any], limit: int = SITE_DATA_MAX_BYTES) -> None:
    size = len(
        (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    )
    if size > limit:
        raise ValueError(f"site.json exceeds {limit} bytes: {size}")


def collect(
    root: Path,
    *,
    dry_run: bool = False,
    client: GitHubClient | None = None,
    translator: SummaryTranslator | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    config = load_config(root / "config" / "discovery.json")
    client = client or GitHubClient(os.environ.get("GITHUB_TOKEN"))
    overrides = config.get("overrides", {})
    excluded = set(config.get("exclude", []))
    translation_config = config.get("translation", {})
    translation_limit = int(translation_config.get("batch_size", 20))
    if translation_limit < 0:
        raise ValueError("translation batch_size must not be negative")
    catalog_path = root / "data" / "catalog.json"
    previous_catalog = load_catalog(catalog_path)
    translations_path = root / "data" / "translations.json"
    translations = load_translation_cache(translations_path)
    if translator is None and not dry_run and translation_config.get("enabled", False):
        model_token = os.environ.get("GITHUB_MODELS_TOKEN") or os.environ.get("GITHUB_TOKEN")
        if model_token:
            translator = GitHubModelsClient(model_token)
    candidates: dict[int, dict[str, Any]] = {}

    for search in config["searches"]:
        try:
            query = build_search_query(search, now)
            results = client.search(query, limit=int(search.get("limit", 40)))
        except GitHubError as error:
            print(f"warning: {error}")
            continue
        for repo in results:
            if repo.get("full_name") not in excluded:
                candidates[int(repo["id"])] = repo

    if not candidates:
        raise RuntimeError("No GitHub candidates were collected; keeping the previous site data")

    ordered = sorted(candidates.values(), key=lambda item: int(item.get("stargazers_count", 0)), reverse=True)
    enrich_limit = int(config.get("enrich_limit", 120))
    history = HistoryStore(root / "data" / "history")
    projects: list[Project] = []
    observed: list[dict[str, Any]] = []
    readmes: dict[int, ReadmeInfo] = {}

    for candidate in ordered[:enrich_limit]:
        full_name = str(candidate["full_name"])
        try:
            repo = client.repository(full_name) or candidate
            readme = client.readme(full_name)
        except GitHubError as error:
            print(f"warning: {error}")
            repo, readme = candidate, ""
        observed.append(repo)
        readmes[int(repo["id"])] = analyse_readme(full_name, readme)
        classification = classify(repo, readme, overrides.get(full_name))
        if classification is None:
            continue
        growth = history.growth_for(int(repo["id"]), int(repo.get("stargazers_count", 0)), now)
        scores = score_project(repo, classification, growth, readme, now)
        projects.append(Project(repo, classification, growth, scores))

    projects.sort(key=lambda item: item.scores.recommendation, reverse=True)
    projects = projects[: int(config.get("publish_limit", 100))]
    generated_at = now.isoformat().replace("+00:00", "Z")
    site_projects = [project.to_site_dict() for project in projects]
    for project in site_projects:
        resolve_project_content(
            project,
            readmes[int(project["id"])],
            translations,
            translator=None,
            generated_at=generated_at,
            allow_model_call=False,
        )

    translation_calls = 0
    stop_translation_batch = False
    translation_candidates = sorted(
        site_projects,
        key=lambda project: (
            project.get("summary_status") == "stale",
            -int(project.get("recommendation_score", 0)),
        ),
    )
    if not dry_run and translator is not None:
        for project in translation_candidates:
            if translation_calls >= translation_limit or stop_translation_batch:
                break
            if project.get("summary_status") not in {"pending", "stale"}:
                continue
            called, stop_translation_batch = resolve_project_content(
                project,
                readmes[int(project["id"])],
                translations,
                translator=translator,
                generated_at=generated_at,
                allow_model_call=True,
            )
            translation_calls += int(called)
    payload: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "collection_status": "live",
        "windows": {
            "new_projects_days": int(config.get("new_projects_days", 30)),
        },
        "stats": {
            "candidates": len(candidates),
            "published": len(projects),
            "history_days": history.history_days,
        },
        "projects": site_projects,
    }
    validate_site_data(payload)
    validate_site_size(payload)
    catalog = build_catalog(previous_catalog, site_projects, generated_at)

    if not dry_run and translator is not None and translation_calls < translation_limit:
        checked_inactive = 0
        for record in catalog["projects"]:
            if (
                record["active"]
                or record.get("summary_status") == "ready"
                or checked_inactive >= translation_limit - translation_calls
                or stop_translation_batch
            ):
                continue
            checked_inactive += 1
            try:
                raw_readme = client.readme(str(record["full_name"]))
            except GitHubError as error:
                print(f"warning: {error}")
                continue
            info = analyse_readme(str(record["full_name"]), raw_readme)
            called, stop_translation_batch = resolve_project_content(
                record,
                info,
                translations,
                translator=translator,
                generated_at=generated_at,
                allow_model_call=True,
            )
            translation_calls += int(called)

    validate_catalog(catalog)
    validate_translation_cache(translations)
    if not dry_run:
        history.append(observed, now)
        output = root / "public" / "data" / "site.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        catalog_path.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write_json(catalog_path, catalog)
        _atomic_write_json(output, payload)
        _atomic_write_json(translations_path, translations)
    return payload


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
