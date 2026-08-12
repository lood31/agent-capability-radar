from __future__ import annotations

import io
import json
import unittest
import urllib.error
from unittest.mock import patch

from collector.translations import (
    GitHubModelsClient,
    TranslationError,
    analyse_readme,
    detect_language,
    empty_translation_cache,
    resolve_project_content,
)


ENGLISH_README = """
[![Build](https://img.shields.io/badge/build-pass-green)](https://example.com)

# Agent Tool

Agent Tool is an open-source framework for building local coding agents. It connects reusable
tools, keeps task context, and provides a command line workflow for developers.

```python
print('<script>alert(1)</script>')
```

## Installation

Run the package manager command.
"""


class StubTranslator:
    model = "test/model"

    def generate_guide(
        self, full_name: str, description: str | None, readme: str
    ) -> dict[str, object]:
        return {
            "overview": (
                "这是一个用于构建本地编码代理的开源框架，主要解决代理开发过程中工具连接、任务上下文维护和工作流组织分散的问题。"
                "项目把常用的代理运行能力整合到统一的开发接口中，让仓库中已有的工具和任务状态能够被持续复用，并通过清晰的数据结构"
                "向开发者呈现代理执行过程。"
                "它通过一致的项目模型汇总仓库中的关键功能，让各项代理能力能够被清楚识别、独立比较，并追溯到README中的原始说明。"
            ),
            "capabilities": ["连接可复用代理工具", "维护任务上下文", "组织代理执行流程"],
        }


class FailingTranslator:
    model = "test/model"

    def generate_guide(
        self, full_name: str, description: str | None, readme: str
    ) -> dict[str, object]:
        raise TranslationError("network_error", stop_batch=True)


class Response:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload

    def __enter__(self) -> Response:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload, ensure_ascii=False).encode()


class ReadmeTests(unittest.TestCase):
    def test_readme_is_cleaned_hashed_and_language_detected(self) -> None:
        info = analyse_readme("owner/repo", ENGLISH_README)
        self.assertEqual(info.language, "en")
        self.assertIn("open-source framework", info.excerpt or "")
        self.assertNotIn("shields.io", info.excerpt or "")
        self.assertNotIn("<script>", info.excerpt or "")
        self.assertEqual(len(info.content_hash or ""), 64)
        self.assertEqual(info.url, "https://github.com/owner/repo#readme")

    def test_excerpt_uses_at_most_two_meaningful_paragraphs(self) -> None:
        readme = "\n\n".join(
            [
                "First meaningful paragraph explains what this agent project does for developers.",
                "Second meaningful paragraph describes the project capabilities and local workflow.",
                "Third meaningful paragraph must remain available to the model but not the excerpt.",
            ]
        )
        info = analyse_readme("owner/paragraphs", readme)
        self.assertIn("Second meaningful", info.excerpt or "")
        self.assertNotIn("Third meaningful", info.excerpt or "")
        self.assertIn("Third meaningful", info.model_text)

    def test_language_detection_handles_chinese_and_mixed_text(self) -> None:
        self.assertEqual(detect_language("这是一个帮助开发者构建代理工作流的开源项目，支持本地运行和工具扩展。"), "zh")
        self.assertEqual(detect_language("Agent 框架支持本地开发和工具连接，适合 coding workflow。"), "mixed")

    def test_manual_summary_wins_without_model_call(self) -> None:
        project = {
            "id": 1,
            "full_name": "owner/repo",
            "description": "Agent tool",
            "summary_zh": "人工摘要",
            "summary_source": "manual",
        }
        called, stopped = resolve_project_content(
            project,
            analyse_readme("owner/repo", ENGLISH_README),
            empty_translation_cache(),
            translator=StubTranslator(),
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertFalse(called)
        self.assertFalse(stopped)
        self.assertEqual(project["summary_zh"], "人工摘要")
        self.assertEqual(project["summary_status"], "ready")

    def test_chinese_readme_is_used_without_model_call_and_stays_within_limit(self) -> None:
        project = {
            "id": 2,
            "full_name": "owner/chinese",
            "description": "Agent tool",
            "summary_zh": None,
            "summary_source": "github_description",
        }
        chinese = "这是一个帮助开发者构建本地智能代理的开源项目，支持工具连接、任务编排和命令行工作流。" * 30
        translator = StubTranslator()
        called, stopped = resolve_project_content(
            project,
            analyse_readme("owner/chinese", chinese),
            empty_translation_cache(),
            translator=translator,
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertFalse(called)
        self.assertFalse(stopped)
        self.assertEqual(project["summary_source"], "readme_zh")
        self.assertLessEqual(len(project["summary_zh"]), 160)

    def test_cached_summary_becomes_stale_then_refreshes(self) -> None:
        cache = empty_translation_cache()
        cache["projects"]["1"] = {
            "full_name": "owner/repo",
            "readme_hash": "old",
            "summary_zh": "这是一个已有的中文自动摘要，内容足够长且用于验证 README 变化后会被明确标记为过期状态。",
            "model": "test/model",
            "generated_at": "2026-08-10T00:00:00Z",
            "status": "ready",
            "last_error_code": None,
        }
        project = {
            "id": 1,
            "full_name": "owner/repo",
            "description": "Agent tool",
            "summary_zh": None,
            "summary_source": "github_description",
        }
        info = analyse_readme("owner/repo", ENGLISH_README)
        resolve_project_content(
            project,
            info,
            cache,
            translator=None,
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=False,
        )
        self.assertEqual(project["summary_status"], "stale")
        called, _ = resolve_project_content(
            project,
            info,
            cache,
            translator=StubTranslator(),
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertTrue(called)
        self.assertEqual(project["summary_status"], "ready")
        self.assertEqual(cache["projects"]["1"]["readme_hash"], info.content_hash)

    def test_matching_hash_uses_cache_without_model_call(self) -> None:
        info = analyse_readme("owner/cached", ENGLISH_README)
        cache = empty_translation_cache()
        cached_summary = "这是一个已经缓存的自动中文摘要，README 内容未变化时应直接复用，不应再次调用模型或消耗推理额度。"
        cache["projects"]["5"] = {
            "full_name": "owner/cached",
            "readme_hash": info.content_hash,
            "summary_zh": cached_summary,
            "model": "test/model",
            "generated_at": "2026-08-10T00:00:00Z",
            "status": "ready",
            "last_error_code": None,
        }
        project = {
            "id": 5,
            "full_name": "owner/cached",
            "description": "Agent tool",
            "summary_zh": None,
            "summary_source": "github_description",
        }
        translator = StubTranslator()
        called, stopped = resolve_project_content(
            project,
            info,
            cache,
            translator=translator,
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertFalse(called)
        self.assertFalse(stopped)
        self.assertEqual(project["summary_zh"], cached_summary)
        self.assertEqual(project["summary_status"], "ready")

    def test_failed_refresh_keeps_stale_summary_and_stops_batch(self) -> None:
        cache = empty_translation_cache()
        old_summary = "这是一个已有的中文自动摘要，在重新翻译失败时必须继续保留，避免页面退回空白或未经说明的英文内容。"
        cache["projects"]["4"] = {
            "full_name": "owner/stale",
            "readme_hash": "old",
            "summary_zh": old_summary,
            "model": "test/model",
            "generated_at": "2026-08-10T00:00:00Z",
            "status": "ready",
            "last_error_code": None,
        }
        project = {
            "id": 4,
            "full_name": "owner/stale",
            "description": "Agent tool",
            "summary_zh": None,
            "summary_source": "github_description",
        }
        called, stopped = resolve_project_content(
            project,
            analyse_readme("owner/stale", ENGLISH_README),
            cache,
            translator=FailingTranslator(),
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertTrue(called)
        self.assertTrue(stopped)
        self.assertEqual(project["summary_zh"], old_summary)
        self.assertEqual(project["summary_status"], "stale")

    def test_no_translator_falls_back_without_creating_cache_record(self) -> None:
        cache = empty_translation_cache()
        project = {
            "id": 3,
            "full_name": "owner/no-token",
            "description": "English agent description",
            "summary_zh": None,
            "summary_source": "github_description",
        }
        called, stopped = resolve_project_content(
            project,
            analyse_readme("owner/no-token", ENGLISH_README),
            cache,
            translator=None,
            generated_at="2026-08-11T00:00:00Z",
            allow_model_call=True,
        )
        self.assertFalse(called)
        self.assertFalse(stopped)
        self.assertEqual(project["summary_source"], "github_description")
        self.assertEqual(project["summary_status"], "pending")
        self.assertEqual(cache["projects"], {})


class GitHubModelsClientTests(unittest.TestCase):
    def test_forbidden_stops_translation_batch(self) -> None:
        error = urllib.error.HTTPError("url", 403, "forbidden", {}, io.BytesIO())
        with patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaises(TranslationError) as caught:
                GitHubModelsClient("token").generate_guide("owner/repo", None, "readme")
        self.assertEqual(caught.exception.code, "forbidden")
        self.assertTrue(caught.exception.stop_batch)

    def test_rate_limit_retries_twice_then_stops_batch(self) -> None:
        error = urllib.error.HTTPError("url", 429, "limited", {}, io.BytesIO())
        with (
            patch("urllib.request.urlopen", side_effect=error) as request,
            patch("time.sleep"),
        ):
            with self.assertRaises(TranslationError) as caught:
                GitHubModelsClient("token").generate_guide("owner/repo", None, "readme")
        self.assertEqual(request.call_count, 3)
        self.assertEqual(caught.exception.code, "rate_limited")
        self.assertTrue(caught.exception.stop_batch)

    def test_invalid_model_json_is_rejected(self) -> None:
        response = Response({"choices": [{"message": {"content": "not-json"}}]})
        with (
            patch("urllib.request.urlopen", return_value=response) as request,
            patch("time.sleep"),
        ):
            with self.assertRaises(TranslationError) as caught:
                GitHubModelsClient("token").generate_guide("owner/repo", None, "readme")
        self.assertEqual(request.call_count, 3)
        self.assertEqual(caught.exception.code, "invalid_response")
        self.assertTrue(caught.exception.stop_batch)

    def test_timeout_retries_twice_then_stops_batch(self) -> None:
        with (
            patch("urllib.request.urlopen", side_effect=TimeoutError) as request,
            patch("time.sleep"),
        ):
            with self.assertRaises(TranslationError) as caught:
                GitHubModelsClient("token").generate_guide("owner/repo", None, "readme")
        self.assertEqual(request.call_count, 3)
        self.assertEqual(caught.exception.code, "network_error")
        self.assertTrue(caught.exception.stop_batch)


if __name__ == "__main__":
    unittest.main()
