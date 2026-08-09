from __future__ import annotations

import unittest

from collector.models import Classification, Growth, Project, Scores
from collector.pipeline import validate_site_data


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
        }
        payload = {
            "schema_version": "1.0",
            "generated_at": "2026-08-09T00:00:00Z",
            "collection_status": "live",
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


if __name__ == "__main__":
    unittest.main()
