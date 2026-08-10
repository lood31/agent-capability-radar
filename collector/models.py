from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import urlparse


CAPABILITIES = (
    "Agent Core",
    "Skills & Prompts",
    "MCP & Connectors",
    "Browser & Computer Use",
    "Memory & Knowledge",
    "Automation",
    "Evaluation & Safety",
    "Research & Learning",
)

ECOSYSTEM_LAYERS = (
    "Agents",
    "Skills & Plugins",
    "MCP & Connectors",
    "Infrastructure",
)

PROJECT_SUBTYPES = (
    "General Agent", "Coding Agent", "Research & Science Agent", "Data Agent",
    "Computer Use Agent", "Multi-Agent System", "Agent Framework",
    "Agent Skill", "Plugin", "Workflow Pack", "MCP Server", "Connector",
    "Agent Tool Adapter", "Memory & Knowledge", "Automation & Orchestration",
    "Evaluation & Observability", "Safety & Sandbox",
)


def safe_external_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value.strip()


@dataclass(slots=True)
class Classification:
    content_type: str
    primary_capability: str
    capabilities: list[str]
    research_use_cases: list[str] = field(default_factory=list)
    integration_methods: list[str] = field(default_factory=list)
    platforms: list[str] = field(default_factory=list)
    local_first: bool = False
    external_service_required: bool = False
    setup_level: str = "medium"
    evidence: list[str] = field(default_factory=list)
    confidence: int = 0
    ecosystem_layer: str = "Agents"
    project_subtype: str = "General Agent"
    use_cases: list[str] = field(default_factory=list)
    functional_capabilities: list[str] = field(default_factory=list)
    summary_zh: str | None = None
    summary_source: str = "github_description"
    features: dict[str, bool] = field(default_factory=dict)
    preview: dict[str, str] | None = None


@dataclass(slots=True)
class Growth:
    day_1: int | None
    day_7: int | None
    day_30: int | None
    percent_7: float | None
    sparkline: list[int]


@dataclass(slots=True)
class Scores:
    quality: int
    fit: int
    recommendation: int
    breakdown: dict[str, float | int | None]
    reasons: list[str]


@dataclass(slots=True)
class Project:
    repository: dict[str, Any]
    classification: Classification
    growth: Growth
    scores: Scores

    def to_site_dict(self) -> dict[str, Any]:
        repo = self.repository
        license_data = repo.get("license") or {}
        result: dict[str, Any] = {
            "id": int(repo["id"]),
            "full_name": str(repo["full_name"]),
            "url": str(repo["html_url"]),
            "homepage": safe_external_url(repo.get("homepage")),
            "description": repo.get("description") or None,
            "language": repo.get("language") or None,
            "topics": list(repo.get("topics") or []),
            "license": license_data.get("spdx_id") or license_data.get("name") or None,
            "stars": int(repo.get("stargazers_count", 0)),
            "forks": int(repo.get("forks_count", 0)),
            "open_issues": int(repo.get("open_issues_count", 0)),
            "created_at": str(repo["created_at"]),
            "pushed_at": str(repo["pushed_at"]),
            "content_type": self.classification.content_type,
            "ecosystem_layer": self.classification.ecosystem_layer,
            "project_subtype": self.classification.project_subtype,
            "use_cases": self.classification.use_cases,
            "functional_capabilities": self.classification.functional_capabilities,
            "summary_zh": self.classification.summary_zh,
            "summary_source": self.classification.summary_source,
            "features": self.classification.features,
            "preview": self.classification.preview,
            "primary_capability": self.classification.primary_capability,
            "capabilities": self.classification.capabilities,
            "research_use_cases": self.classification.research_use_cases,
            "integration_methods": self.classification.integration_methods,
            "platforms": self.classification.platforms,
            "local_first": self.classification.local_first,
            "external_service_required": self.classification.external_service_required,
            "setup_level": self.classification.setup_level,
            "quality_score": self.scores.quality,
            "fit_score": self.scores.fit,
            "recommendation_score": self.scores.recommendation,
            "score_breakdown": self.scores.breakdown,
            "growth": asdict(self.growth),
            "recommendation_reasons": self.scores.reasons,
            "classification_evidence": self.classification.evidence,
        }
        return result
