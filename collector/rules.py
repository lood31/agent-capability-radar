from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from collector.models import CAPABILITIES, Classification


CAPABILITY_SIGNALS: dict[str, tuple[str, ...]] = {
    "Agent Core": (
        "ai agent", "autonomous agent", "agent framework", "multi-agent", "coding agent",
        "swe agent", "agentic", "agent-framework",
    ),
    "Skills & Prompts": (
        "agent skill", "agent skills", "skill pack", "prompt workflow", "prompt library",
        "claude skill", "codex skill",
    ),
    "MCP & Connectors": (
        "model context protocol", "mcp", "mcp server", "mcp-server", "mcp servers", "tool connector",
    ),
    "Browser & Computer Use": (
        "browser agent", "browser automation", "computer use", "web automation", "playwright",
        "desktop agent",
    ),
    "Memory & Knowledge": (
        "agent memory", "long-term memory", "knowledge base", "knowledge graph", "rag",
        "retrieval augmented", "vector database",
    ),
    "Automation": (
        "workflow automation", "agent workflow", "task automation", "orchestration", "scheduler",
    ),
    "Evaluation & Safety": (
        "agent evaluation", "llm evaluation", "observability", "sandbox", "guardrail",
        "agent security", "tracing",
    ),
    "Research & Learning": (
        "research assistant", "paper reading", "literature review", "citation", "bibliography",
        "academic writing", "research workflow", "scientific literature", "pdf reader",
        "reference manager", "note taking", "spaced repetition",
    ),
}

RESEARCH_USE_CASES: dict[str, tuple[str, ...]] = {
    "论文检索与阅读": ("paper", "arxiv", "literature", "semantic scholar", "pdf reader"),
    "文献与引用管理": ("citation", "bibliography", "reference manager", "zotero"),
    "知识与笔记整理": ("knowledge base", "note taking", "second brain", "markdown notes"),
    "研究数据与复现": ("reproducible research", "research data", "jupyter", "notebook"),
    "学术写作": ("academic writing", "latex", "scientific writing"),
    "学习工作流": ("spaced repetition", "flashcard", "study workflow"),
}

CONTENT_SIGNALS: list[tuple[str, tuple[str, ...]]] = [
    ("MCP Server", ("mcp server", "mcp-server", "model context protocol")),
    ("Skill Pack", ("agent skill", "agent skills", "skill pack", "claude skill")),
    ("浏览器扩展", ("browser extension", "chrome extension", "webextension")),
    ("资源目录", ("awesome list", "curated list", "awesome-")),
    ("模板或工作流", ("workflow template", "starter template", "automation template")),
    ("Framework / SDK", ("framework", "sdk", "library")),
]

AMBIGUOUS_AGENT = re.compile(r"\b(user|travel|real estate|insurance|support) agent\b")
DOMAIN_SCOPE = re.compile(
    r"\b(ai|llm|agents?|agentic|mcp|rag)\b|"
    r"browser automation|computer use|knowledge base|knowledge graph|"
    r"workflow automation|research assistant|citation|bibliography|reference manager",
)


def _normalise_text(repo: dict[str, Any], readme: str) -> tuple[str, str, str, set[str]]:
    topics = {str(topic).lower().replace("-", " ") for topic in repo.get("topics") or []}
    metadata = " ".join(
        [
            str(repo.get("name") or ""),
            str(repo.get("description") or ""),
            " ".join(topics),
        ]
    ).lower().replace("_", " ")
    metadata = re.sub(r"\s+", " ", metadata)
    readme_text = re.sub(r"\s+", " ", readme[:20_000].lower().replace("_", " "))
    return f"{metadata} {readme_text}", metadata, readme_text, topics


def _matches(text: str, signals: tuple[str, ...]) -> list[str]:
    return [signal for signal in signals if signal in text]


def classify(
    repo: dict[str, Any],
    readme: str = "",
    override: dict[str, Any] | None = None,
) -> Classification | None:
    override = override or {}
    if override.get("exclude") or repo.get("archived") or repo.get("fork"):
        return None

    text, metadata_text, readme_text, topics = _normalise_text(repo, readme)
    forced = override.get("capabilities")
    if not forced and not DOMAIN_SCOPE.search(metadata_text):
        return None

    scores: dict[str, int] = defaultdict(int)
    evidence: dict[str, list[str]] = defaultdict(list)
    for capability, signals in CAPABILITY_SIGNALS.items():
        metadata_matches = _matches(metadata_text, signals)
        readme_matches = _matches(readme_text, signals)
        scores[capability] += len(metadata_matches) * 3 + len(readme_matches)
        evidence[capability].extend((metadata_matches + readme_matches)[:3])
        topic_matches = [signal for signal in signals if signal in topics]
        scores[capability] += len(topic_matches) * 2

    if AMBIGUOUS_AGENT.search(text) and max(scores.values(), default=0) < 2:
        return None

    if forced:
        capabilities = [item for item in forced if item in CAPABILITIES]
    else:
        capabilities = [name for name in CAPABILITIES if scores[name] >= 2]
    if not capabilities:
        return None

    primary = override.get("primary_capability")
    if primary not in capabilities:
        primary = max(capabilities, key=lambda item: scores[item])

    content_type = override.get("content_type")
    if not content_type:
        content_type = "可运行工具"
        for candidate, signals in CONTENT_SIGNALS:
            if _matches(text, signals):
                content_type = candidate
                break

    research_use_cases = [
        name for name, signals in RESEARCH_USE_CASES.items() if _matches(text, signals)
    ]
    integrations: list[str] = []
    for label, signals in {
        "MCP": ("mcp server", "model context protocol"),
        "CLI": ("command line", " cli ", "pip install", "npm install"),
        "API": ("rest api", "graphql", " api "),
        "Docker": ("docker", "docker compose"),
        "浏览器扩展": ("browser extension", "chrome extension"),
    }.items():
        if _matches(f" {text} ", signals):
            integrations.append(label)

    platforms: list[str] = []
    for label, signals in {
        "Windows": ("windows", "powershell", ".exe"),
        "macOS": ("macos", "mac os", "homebrew"),
        "Linux": ("linux", "ubuntu"),
        "Web": ("web app", "hosted", "browser extension"),
        "Docker": ("docker",),
    }.items():
        if _matches(text, signals):
            platforms.append(label)

    setup_level = "easy"
    if "Docker" in integrations or len(integrations) == 0:
        setup_level = "medium"
    if any(token in text for token in ("kubernetes", "self-host cluster", "gpu required")):
        setup_level = "advanced"

    local_first = any(token in text for token in ("local first", "local-first", "self-hosted", "offline"))
    external_required = any(
        token in text for token in ("requires api key", "openai api key", "anthropic api key")
    )
    primary_evidence = evidence.get(primary, [])
    rendered_evidence = [f"命中 {item}" for item in primary_evidence[:3]]
    if repo.get("topics"):
        rendered_evidence.append(f"Topics: {', '.join(repo['topics'][:4])}")

    return Classification(
        content_type=str(content_type),
        primary_capability=str(primary),
        capabilities=capabilities,
        research_use_cases=research_use_cases,
        integration_methods=integrations,
        platforms=platforms,
        local_first=local_first,
        external_service_required=external_required,
        setup_level=setup_level,
        evidence=rendered_evidence,
        confidence=min(100, max(scores.values()) * 18 + len(capabilities) * 6),
    )
