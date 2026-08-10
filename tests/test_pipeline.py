from __future__ import annotations

import json
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from collector.models import Classification, Growth, Project, Scores
from collector.pipeline import build_search_query, collect, validate_site_data


class FakeClient:
    def __init__(self, repositories: list[dict[str, Any]]) -> None:
        self.repositories = repositories
        self.queries: list[str] = []

    def search(self, query: str, *, limit: int = 50) -> list[dict[str, Any]]:
        self.queries.append(query)
        return self.repositories[:limit]

    def repository(self, full_name: str) -> dict[str, Any] | None:
        return next((repo for repo in self.repositories if repo["full_name"] == full_name), None)

    def readme(self, full_name: str) -> str:
        return "AI agent framework with a command line interface. " * 30


def collectable_repository() -> dict[str, Any]:
    return {
        "id": 1,
        "name": "agent-tool",
        "full_name": "owner/agent-tool",
        "html_url": "https://github.com/owner/agent-tool",
        "homepage": "https://example.com",
        "description": "An AI agent framework for local workflows",
        "language": "Python",
        "topics": ["ai-agent", "agent-framework"],
        "license": {"spdx_id": "MIT"},
        "stargazers_count": 500,
        "forks_count": 50,
        "open_issues_count": 4,
        "created_at": "2026-07-20T00:00:00Z",
        "pushed_at": "2026-08-08T00:00:00Z",
        "archived": False,
        "fork": False,
    }


def write_config(root: Path) -> None:
    config = root / "config"
    config.mkdir(parents=True)
    (config / "discovery.json").write_text(
        json.dumps(
            {
                "enrich_limit": 10,
                "publish_limit": 10,
                "new_projects_days": 30,
                "searches": [
                    {
                        "query": "archived:false",
                        "limit": 10,
                        "date_field": "created",
                        "window_days": 30,
                    }
                ],
                "exclude": [],
                "overrides": {},
            }
        ),
        encoding="utf-8",
    )


class ValidationTests(unittest.TestCase):
    def test_unsafe_homepage_is_removed_from_output(self) -> None:
        repo = {
            "id": 1,
            "full_name": "owner/repo",
            "html_url": "https://github.com/owner/repo",
            "homepage": "javascript:alert(1)",
            "created_at": "2026-01-01T00:00:00Z",
            "pushed_at": "2026-08-01T00:00:00Z",
        }
        project = Project(
            repo,
            Classification("可运行工具", "Agent Core", ["Agent Core"]),
            Growth(None, None, None, None, []),
            Scores(50, 50, 50, {}, []),
        )
        self.assertIsNone(project.to_site_dict()["homepage"])

    def test_duplicate_repository_is_rejected(self) -> None:
        project = {
            "id": 1,
            "full_name": "owner/repo",
            "url": "https://github.com/owner/repo",
            "quality_score": 50,
            "fit_score": 50,
            "recommendation_score": 50,
            "ecosystem_layer": "Agents",
            "project_subtype": "General Agent",
            "summary_source": "github_description",
            "use_cases": [],
            "functional_capabilities": [],
            "features": {},
        }
        payload = {
            "schema_version": "1.0",
            "generated_at": "2026-08-09T00:00:00Z",
            "collection_status": "live",
            "windows": {"new_projects_days": 30},
            "stats": {},
            "projects": [project, dict(project)],
        }
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_site_data(payload)

    def test_javascript_url_is_rejected(self) -> None:
        payload = {
            "schema_version": "1.0",
            "generated_at": "2026-08-09T00:00:00Z",
            "collection_status": "live",
            "windows": {"new_projects_days": 30},
            "stats": {},
            "projects": [
                {
                    "id": 1,
                    "full_name": "bad/repo",
                    "url": "javascript:alert(1)",
                    "quality_score": 50,
                    "fit_score": 50,
                    "recommendation_score": 50,
                }
            ],
        }
        with self.assertRaisesRegex(ValueError, "Invalid GitHub URL"):
            validate_site_data(payload)


class SearchWindowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 9, 12, tzinfo=UTC)

    def test_dynamic_created_and_pushed_queries(self) -> None:
        created = build_search_query(
            {"query": "stars:>10", "date_field": "created", "window_days": 30},
            self.now,
        )
        pushed = build_search_query(
            {"query": "stars:>10", "date_field": "pushed", "window_days": 7},
            self.now,
        )
        self.assertEqual(created, "stars:>10 created:>2026-07-10")
        self.assertEqual(pushed, "stars:>10 pushed:>2026-08-02")

    def test_invalid_search_window_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "window_days"):
            build_search_query(
                {"query": "stars:>10", "date_field": "created", "window_days": 0},
                self.now,
            )


class CollectionWriteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 9, 12, tzinfo=UTC)

    def test_dry_run_writes_no_data_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_config(root)
            payload = collect(
                root,
                dry_run=True,
                client=FakeClient([collectable_repository()]),
                now=self.now,
            )
            self.assertEqual(payload["windows"]["new_projects_days"], 30)
            self.assertFalse((root / "public" / "data" / "site.json").exists())
            self.assertFalse((root / "data" / "catalog.json").exists())
            self.assertFalse((root / "data" / "history").exists())

    def test_failed_collection_preserves_existing_site(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_config(root)
            site = root / "public" / "data" / "site.json"
            site.parent.mkdir(parents=True)
            site.write_text("previous-data", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "No GitHub candidates"):
                collect(root, client=FakeClient([]), now=self.now)
            self.assertEqual(site.read_text(encoding="utf-8"), "previous-data")

    def test_corrupt_catalog_stops_before_writes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_config(root)
            catalog = root / "data" / "catalog.json"
            catalog.parent.mkdir(parents=True)
            catalog.write_text("{broken", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                collect(
                    root,
                    client=FakeClient([collectable_repository()]),
                    now=self.now,
                )
            self.assertFalse((root / "public" / "data" / "site.json").exists())
            self.assertFalse((root / "data" / "history").exists())


if __name__ == "__main__":
    unittest.main()
