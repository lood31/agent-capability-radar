from __future__ import annotations

import unittest

from collector.project_content import (
    README_MARKDOWN_MAX_BYTES,
    build_project_content,
    prepare_readme_markdown,
    validate_project_content,
)


class ProjectContentTests(unittest.TestCase):
    def test_source_markdown_is_preserved_without_silent_cleanup(self) -> None:
        raw = """
[![Build](https://img.shields.io/build.svg)](https://example.com)
🇺🇸 English | 🇨🇳 简体中文 | 🇯🇵 日本語 | 🇰🇷 한국어
[Docs](https://docs.example.com) | [Discord](https://discord.example.com) | [Website](https://example.com)

# Agent Tool

Agent Tool solves fragmented agent workflows while keeping project evidence visible.

![Screenshot](https://example.com/remote.png)
<script>alert('xss')</script>
"""
        markdown, truncated = prepare_readme_markdown(raw)
        self.assertFalse(truncated)
        self.assertEqual(markdown, raw)

    def test_cleaner_preserves_useful_markdown_structure(self) -> None:
        raw = """
# Project

## Features

- First capability
- Second capability

```python
print("safe text")
```

| Name | Value |
| --- | --- |
| mode | local |

[Documentation](https://example.com/docs)
"""
        markdown, _ = prepare_readme_markdown(raw)
        self.assertIn("## Features", markdown)
        self.assertIn("- First capability", markdown)
        self.assertIn("```python", markdown)
        self.assertIn("| Name | Value |", markdown)
        self.assertIn("[Documentation](https://example.com/docs)", markdown)

    def test_source_markdown_keeps_navigation_text(self) -> None:
        markdown, _ = prepare_readme_markdown(
            "Quickstart · Docs · GitHub · Discord · Twitter · Website\n\nActual project overview."
        )
        self.assertIn("Quickstart", markdown)
        self.assertIn("Actual project overview", markdown)

    def test_oversized_readme_is_truncated_within_budget(self) -> None:
        raw = "# Overview\n\n" + ("Useful project overview. " * 2500) + "\n\n## Later\n\n" + ("x" * 90_000)
        markdown, truncated = prepare_readme_markdown(raw)
        self.assertTrue(truncated)
        self.assertLessEqual(len(markdown.encode("utf-8")), README_MARKDOWN_MAX_BYTES)
        self.assertNotIn("## Later", markdown)

    def test_project_content_accepts_only_overview_and_capabilities(self) -> None:
        project = {
            "id": 1,
            "full_name": "owner/repo",
            "guide_zh": {
                "overview": "这是一个用于验证中文项目导读结构的项目说明。",
                "capabilities": ["能力一", "能力二", "能力三"],
            },
            "guide_source": "manual",
            "guide_status": "ready",
            "guide_updated_at": "2026-08-12T00:00:00Z",
            "readme_language": "zh",
            "readme_hash": "a" * 64,
            "readme_url": "https://github.com/owner/repo#readme",
        }
        payload = build_project_content(project, readme_markdown="# README", readme_truncated=False)
        validate_project_content(payload)
        self.assertEqual(payload["readme"]["source_fidelity"], "source_markdown")
        payload["guide_zh"]["installation"] = "不要出现"
        with self.assertRaisesRegex(ValueError, "Chinese project guide"):
            validate_project_content(payload)


if __name__ == "__main__":
    unittest.main()
