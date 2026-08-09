from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Any

from collector.models import Classification, Growth, Scores


def _clamp(value: float) -> int:
    return round(max(0, min(100, value)))


def _log_score(value: int, ceiling: int) -> float:
    return min(100, math.log10(max(0, value) + 1) / math.log10(ceiling + 1) * 100)


def _days_since(value: str, now: datetime) -> int:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return max(0, (now - parsed).days)


def score_project(
    repo: dict[str, Any],
    classification: Classification,
    growth: Growth,
    readme: str,
    now: datetime | None = None,
) -> Scores:
    now = now or datetime.now(UTC)
    stars = int(repo.get("stargazers_count", 0))
    forks = int(repo.get("forks_count", 0))
    heat = _clamp(_log_score(stars, 100_000) * 0.78 + _log_score(forks, 20_000) * 0.22)

    pushed_days = _days_since(str(repo["pushed_at"]), now)
    activity = _clamp(100 - min(100, pushed_days * 2.1))
    community = _clamp(_log_score(forks, 12_000) * 0.72 + min(28, math.sqrt(max(stars, 0)) / 4))
    completeness_flags = [
        bool(repo.get("description")),
        bool(repo.get("license")),
        bool(repo.get("topics")),
        bool(repo.get("homepage")),
        len(readme.strip()) >= 600,
    ]
    completeness = round(sum(completeness_flags) / len(completeness_flags) * 100)

    growth_score: int | None = None
    if growth.day_7 is not None:
        relative = growth.percent_7 or 0
        absolute = _log_score(growth.day_7, 10_000)
        growth_score = _clamp(absolute * 0.58 + min(100, relative * 5) * 0.42)
    elif growth.day_1 is not None:
        growth_score = _clamp(_log_score(growth.day_1 * 7, 10_000))

    penalty = 0
    if repo.get("archived"):
        penalty += 50
    if repo.get("fork"):
        penalty += 30
    if pushed_days > 180:
        penalty += min(30, round((pushed_days - 180) / 20))
    if not repo.get("license"):
        penalty += 8
    if len(readme.strip()) < 250:
        penalty += 8

    values: dict[str, int | None] = {
        "growth": growth_score,
        "heat": heat,
        "activity": activity,
        "community": community,
        "completeness": completeness,
    }
    weights = {"growth": 0.30, "heat": 0.25, "activity": 0.20, "community": 0.15, "completeness": 0.10}
    available_weight = sum(weight for key, weight in weights.items() if values[key] is not None)
    quality = _clamp(
        sum((values[key] or 0) * weight for key, weight in weights.items()) / available_weight
        - penalty
    )

    fit = 35
    fit += min(24, len(classification.capabilities) * 7)
    fit += min(12, len(classification.integration_methods) * 4)
    fit += 10 if "Windows" in classification.platforms or "Web" in classification.platforms else 0
    fit += 8 if classification.research_use_cases else 0
    fit += 6 if classification.local_first else 0
    fit -= 8 if classification.external_service_required else 0
    fit -= {"easy": 0, "medium": 4, "advanced": 12}[classification.setup_level]
    fit = _clamp(fit)
    recommendation = _clamp(quality * 0.65 + fit * 0.35)

    reasons: list[str] = []
    if "MCP" in classification.integration_methods:
        reasons.append("提供 MCP Server，可直接接入 Agent")
    if classification.research_use_cases:
        reasons.append(f"适合{classification.research_use_cases[0]}")
    if classification.local_first:
        reasons.append("支持本地或自托管运行")
    if "Windows" in classification.platforms:
        reasons.append("文档中提供 Windows 支持信号")
    if growth.day_7 is not None and growth.day_7 > 0:
        reasons.append(f"过去 7 天新增 {growth.day_7:,} Stars")
    if activity >= 85:
        reasons.append("最近仍在活跃更新")
    if not reasons:
        reasons.append(f"与 {classification.primary_capability} 能力高度相关")
    if classification.setup_level == "advanced":
        reasons.append("部署涉及进阶基础设施")
    elif classification.setup_level == "medium":
        reasons.append("配置成本中等")

    return Scores(
        quality=quality,
        fit=fit,
        recommendation=recommendation,
        breakdown={**values, "penalty": penalty},
        reasons=reasons[:4],
    )

