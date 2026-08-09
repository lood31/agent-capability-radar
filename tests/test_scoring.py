from __future__ import annotations

import unittest
from datetime import UTC, datetime

from collector.models import Classification, Growth
from collector.scoring import score_project


class ScoringTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 9, 12, tzinfo=UTC)
        self.repo = {
            "id": 1,
            "full_name": "owner/project",
            "description": "Useful project",
            "stargazers_count": 1_000,
            "forks_count": 100,
            "open_issues_count": 10,
            "pushed_at": "2026-08-08T12:00:00Z",
            "license": {"spdx_id": "MIT"},
            "topics": ["mcp-server"],
            "homepage": "https://example.com",
            "archived": False,
            "fork": False,
        }
        self.classification = Classification(
            content_type="MCP Server",
            primary_capability="MCP & Connectors",
            capabilities=["MCP & Connectors"],
            integration_methods=["MCP"],
            platforms=["Windows"],
        )

    def test_cold_start_has_no_growth_score(self) -> None:
        scores = score_project(
            self.repo,
            self.classification,
            Growth(None, None, None, None, [1_000]),
            "README " * 200,
            self.now,
        )
        self.assertIsNone(scores.breakdown["growth"])
        self.assertGreater(scores.quality, 0)

    def test_growth_increases_quality(self) -> None:
        cold = score_project(self.repo, self.classification, Growth(None, None, None, None, [1_000]), "README " * 200, self.now)
        hot = score_project(self.repo, self.classification, Growth(100, 500, None, 100.0, [500, 1_000]), "README " * 200, self.now)
        self.assertGreater(hot.quality, cold.quality)
        self.assertIn("过去 7 天新增 500 Stars", hot.reasons)

    def test_scores_stay_in_range(self) -> None:
        scores = score_project(self.repo, self.classification, Growth(1, 5, 20, 0.5, [980, 1_000]), "", self.now)
        self.assertTrue(0 <= scores.quality <= 100)
        self.assertTrue(0 <= scores.fit <= 100)
        self.assertTrue(0 <= scores.recommendation <= 100)


if __name__ == "__main__":
    unittest.main()

