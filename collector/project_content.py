from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any


PROJECT_CONTENT_SCHEMA_VERSION = "1.0"
PROJECT_CONTENT_MAX_BYTES = 100_000
PROJECT_CONTENT_TOTAL_MAX_BYTES = 10_000_000
README_MARKDOWN_MAX_BYTES = 80_000
GUIDE_SOURCES = {"manual", "github_models", "readme_zh", "metadata_fallback"}
GUIDE_STATUSES = {"ready", "partial", "stale", "unavailable"}

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_HTML_BLOCK = re.compile(
    r"<(?:script|style|iframe|object|embed|svg|picture)\b.*?</(?:script|style|iframe|object|embed|svg|picture)>",
    re.IGNORECASE | re.DOTALL,
)
_HTML_TAG = re.compile(r"<[^>]+>")
_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_REFERENCE_IMAGE = re.compile(r"!\[([^\]]*)\]\[[^\]]*\]")
_FLAG = re.compile(r"[\U0001F1E6-\U0001F1FF]{2}")
_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_LINK = re.compile(r"\[[^\]]+\]\([^)]+\)")
_REFERENCE_LINK = re.compile(r"^\s*\[[^\]]+\]:\s*\S+")
_LANGUAGE_WORDS = {
    "english", "简体中文", "繁體中文", "中文", "日本語", "한국어", "français",
    "deutsch", "español", "português", "русский", "italiano", "polski", "türkçe",
}
_NAV_WORDS = {
    "docs", "documentation", "quickstart", "github", "discord", "twitter", "website",
    "community", "blog", "demo", "homepage", "roadmap",
}
_SKIP_SECTIONS = {
    "table of contents", "contents", "目录", "目錄", "sponsors", "sponsor", "赞助",
    "contributors", "contributing", "acknowledgements", "acknowledgments",
}
_CAPABILITY_ZH = {
    "Coding & Developer Tools": "编程与开发工具",
    "Browser & Computer Use": "浏览器与计算机操作",
    "Search & Research": "搜索与研究",
    "Memory & Knowledge": "记忆与知识管理",
    "Automation & Orchestration": "自动化与任务编排",
    "Evaluation, Observability & Safety": "评估、可观测性与安全",
    "Agent Communication": "Agent 通信与协作",
    "Data & Analytics": "数据与分析",
}


def clean_readme_markdown(raw: str) -> tuple[str, bool]:
    """Return conservative Markdown suitable for build-time rendering."""
    source = _HTML_BLOCK.sub("", _HTML_COMMENT.sub("", raw.replace("\r\n", "\n")))
    output: list[str] = []
    in_code = False
    fence = ""
    skipped_heading_level: int | None = None

    for source_line in source.splitlines():
        stripped = source_line.strip()
        if stripped.startswith(("```", "~~~")):
            marker = stripped[:3]
            if not in_code:
                in_code, fence = True, marker
            elif marker == fence:
                in_code, fence = False, ""
            if skipped_heading_level is None:
                output.append(source_line.rstrip())
            continue
        if in_code:
            if skipped_heading_level is None:
                output.append(source_line.rstrip())
            continue

        heading = _HEADING.match(stripped)
        if heading:
            level = len(heading.group(1))
            title = _plain_text(heading.group(2)).strip().casefold()
            if skipped_heading_level is not None and level <= skipped_heading_level:
                skipped_heading_level = None
            if title in _SKIP_SECTIONS:
                skipped_heading_level = level
                continue
        if skipped_heading_level is not None:
            continue
        if is_readme_noise_line(stripped):
            continue

        line = _IMAGE.sub(r"\1", source_line)
        line = _REFERENCE_IMAGE.sub(r"\1", line)
        line = _HTML_TAG.sub("", line)
        line = html.unescape(line).rstrip()
        output.append(line)

    cleaned = _collapse_blank_lines("\n".join(output)).strip()
    encoded = cleaned.encode("utf-8")
    if len(encoded) <= README_MARKDOWN_MAX_BYTES:
        return cleaned, False
    return _truncate_at_section(cleaned, README_MARKDOWN_MAX_BYTES), True


def build_project_content(
    project: dict[str, Any],
    *,
    readme_markdown: str,
    readme_truncated: bool,
) -> dict[str, Any]:
    guide = project.get("guide_zh") or metadata_guide(project)
    payload = {
        "schema_version": PROJECT_CONTENT_SCHEMA_VERSION,
        "project_id": int(project["id"]),
        "full_name": str(project["full_name"]),
        "guide_zh": guide,
        "guide_source": project.get("guide_source", "metadata_fallback"),
        "guide_status": project.get("guide_status", "partial"),
        "guide_updated_at": project.get("guide_updated_at"),
        "readme": {
            "language": project.get("readme_language", "unknown"),
            "hash": project.get("readme_hash"),
            "source_url": project.get("readme_url"),
            "markdown": readme_markdown,
            "truncated": bool(readme_truncated),
        },
    }
    validate_project_content(payload)
    return payload


def validate_project_content(payload: dict[str, Any]) -> None:
    if payload.get("schema_version") != PROJECT_CONTENT_SCHEMA_VERSION:
        raise ValueError("Unsupported project content schema")
    if not isinstance(payload.get("project_id"), int):
        raise ValueError("Invalid project content id")
    guide = payload.get("guide_zh")
    if not isinstance(guide, dict) or set(guide) != {"overview", "capabilities"}:
        raise ValueError("Invalid Chinese project guide")
    overview = guide.get("overview")
    capabilities = guide.get("capabilities")
    if not isinstance(overview, str) or not overview.strip() or len(overview) > 300:
        raise ValueError("Invalid guide overview")
    if not isinstance(capabilities, list) or len(capabilities) > 6:
        raise ValueError("Invalid guide capabilities")
    if any(not isinstance(item, str) or not item.strip() or len(item) > 80 for item in capabilities):
        raise ValueError("Invalid guide capability")
    if payload.get("guide_source") not in GUIDE_SOURCES:
        raise ValueError("Invalid guide source")
    if payload.get("guide_status") not in GUIDE_STATUSES:
        raise ValueError("Invalid guide status")
    readme = payload.get("readme")
    if not isinstance(readme, dict) or not isinstance(readme.get("markdown"), str):
        raise ValueError("Invalid project README")
    if len(readme["markdown"].encode("utf-8")) > README_MARKDOWN_MAX_BYTES:
        raise ValueError("Project README exceeds content budget")
    size = len((json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if size > PROJECT_CONTENT_MAX_BYTES:
        raise ValueError(f"Project content exceeds {PROJECT_CONTENT_MAX_BYTES} bytes: {size}")


def write_project_content(path: Path, payload: dict[str, Any]) -> None:
    validate_project_content(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def metadata_guide(
    project: dict[str, Any], *, overview: str | None = None
) -> dict[str, Any]:
    overview = str(
        overview
        or project.get("summary_zh")
        or project.get("description")
        or "该项目暂未提供足够的README信息，无法生成完整中文导读。"
    ).strip()[:300]
    capabilities = [
        _CAPABILITY_ZH.get(str(item).strip(), str(item).strip())[:80]
        for item in project.get("functional_capabilities", [])[:6]
        if str(item).strip()
    ]
    return {"overview": overview, "capabilities": capabilities}


def is_readme_noise_line(line: str) -> bool:
    if not line:
        return False
    lowered = _plain_text(line).casefold()
    if "shields.io" in lowered or line.startswith("[![") or _REFERENCE_LINK.match(line):
        return True
    language_hits = sum(word in lowered for word in _LANGUAGE_WORDS)
    if _FLAG.search(line) and (language_hits >= 1 or "|" in line):
        return True
    if language_hits >= 3:
        return True
    links = len(_LINK.findall(line))
    nav_hits = sum(re.search(rf"\b{re.escape(word)}\b", lowered) is not None for word in _NAV_WORDS)
    if nav_hits >= 4 and len(line) <= 200:
        return True
    if links >= 3 or (links >= 2 and nav_hits >= 2):
        return True
    if line.startswith(("<img", "<picture", "<div align=", "<p align=")):
        return True
    return False


def _plain_text(value: str) -> str:
    value = _IMAGE.sub(r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = _HTML_TAG.sub("", value)
    return html.unescape(value)


def _collapse_blank_lines(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", value)


def _truncate_at_section(value: str, limit: int) -> str:
    lines = value.splitlines()
    kept: list[str] = []
    last_heading_index: int | None = None
    for line in lines:
        candidate = "\n".join([*kept, line]).encode("utf-8")
        if len(candidate) > limit:
            break
        if line.startswith("#"):
            last_heading_index = len(kept)
        kept.append(line)
    if last_heading_index not in {None, 0}:
        kept = kept[:last_heading_index]
    result = "\n".join(kept).rstrip()
    if not result:
        result = value.encode("utf-8")[:limit].decode("utf-8", errors="ignore").rstrip()
    return result
