from __future__ import annotations

import unittest

from scripts.migrate_v3_data import content_defaults
from scripts.migrate_v4_data import guide_defaults


class SchemaMigrationTests(unittest.TestCase):
    def test_site_1_2_project_gets_schema_1_3_content_defaults(self) -> None:
        migrated = content_defaults(
            {
                "id": 1,
                "summary_zh": None,
                "summary_source": "github_description",
            }
        )
        self.assertEqual(migrated["readme_language"], "unknown")
        self.assertEqual(migrated["summary_status"], "pending")
        self.assertIsNone(migrated["readme_excerpt"])

    def test_manual_summary_is_ready_after_migration(self) -> None:
        migrated = content_defaults(
            {
                "id": 2,
                "summary_zh": "人工摘要",
                "summary_source": "manual",
            }
        )
        self.assertEqual(migrated["summary_status"], "ready")

    def test_site_1_3_project_gets_schema_1_4_guide_defaults(self) -> None:
        migrated = guide_defaults(
            {
                "id": 3,
                "summary_zh": None,
                "summary_source": "github_description",
            }
        )
        self.assertEqual(migrated["content_url"], "data/projects/3.json")
        self.assertEqual(migrated["guide_source"], "metadata_fallback")
        self.assertEqual(migrated["guide_status"], "partial")


if __name__ == "__main__":
    unittest.main()
