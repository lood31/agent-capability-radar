from __future__ import annotations

import unittest

from collector.catalog import build_catalog, validate_catalog


def project(repo_id: int, name: str, score: int) -> dict[str, object]:
    return {
        "id": repo_id,
        "full_name": name,
        "url": f"https://github.com/{name}",
        "recommendation_score": score,
    }


class CatalogTests(unittest.TestCase):
    def test_catalog_preserves_dropped_and_reentered_projects(self) -> None:
        empty = {"schema_version": "1.0", "updated_at": None, "projects": []}
        first = build_catalog(
            empty,
            [project(1, "owner/one", 80), project(2, "owner/two", 70)],
            "2026-08-09T00:00:00Z",
        )
        second = build_catalog(
            first,
            [project(2, "owner/two", 90)],
            "2026-08-10T00:00:00Z",
        )
        by_id = {item["id"]: item for item in second["projects"]}
        self.assertFalse(by_id[1]["active"])
        self.assertEqual(by_id[1]["last_rank"], 1)
        self.assertEqual(by_id[1]["last_seen"], "2026-08-09T00:00:00Z")
        self.assertTrue(by_id[2]["active"])
        self.assertEqual(by_id[2]["best_rank"], 1)

        third = build_catalog(
            second,
            [project(2, "owner/two", 91), project(1, "owner/one", 85)],
            "2026-08-11T00:00:00Z",
        )
        reentered = next(item for item in third["projects"] if item["id"] == 1)
        self.assertTrue(reentered["active"])
        self.assertEqual(reentered["first_seen"], "2026-08-09T00:00:00Z")
        self.assertEqual(reentered["last_rank"], 2)
        self.assertEqual(reentered["best_rank"], 1)

    def test_duplicate_catalog_repository_is_rejected(self) -> None:
        entry = {
            **project(1, "owner/one", 80),
            "first_seen": "2026-08-09T00:00:00Z",
            "last_seen": "2026-08-09T00:00:00Z",
            "last_rank": 1,
            "best_rank": 1,
            "active": True,
            "last_score": 80,
        }
        with self.assertRaisesRegex(ValueError, "Duplicate catalog"):
            validate_catalog(
                {
                    "schema_version": "1.0",
                    "updated_at": "2026-08-09T00:00:00Z",
                    "projects": [entry, dict(entry)],
                }
            )

    def test_invalid_catalog_metadata_is_rejected(self) -> None:
        entry = {
            **project(1, "owner/one", 80),
            "first_seen": "2026-08-10T00:00:00Z",
            "last_seen": "2026-08-09T00:00:00Z",
            "last_rank": 1,
            "best_rank": 1,
            "active": True,
            "last_score": 80,
        }
        with self.assertRaisesRegex(ValueError, "first_seen is after"):
            validate_catalog(
                {
                    "schema_version": "1.0",
                    "updated_at": "2026-08-10T00:00:00Z",
                    "projects": [entry],
                }
            )
