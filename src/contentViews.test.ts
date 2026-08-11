import { describe, expect, it } from "vitest";
import { projectSummary, readmeLang, summarySourceLabel } from "./contentViews";
import type { Project } from "./types";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1, full_name: "owner/repo", url: "https://github.com/owner/repo", homepage: null,
    description: "Original English description", language: "TypeScript", topics: [], license: "MIT",
    stars: 10, forks: 1, open_issues: 0, created_at: "2026-08-01T00:00:00Z", pushed_at: "2026-08-10T00:00:00Z",
    ecosystem_layer: "Agents", project_subtype: "Coding Agent", use_cases: [], functional_capabilities: [],
    summary_zh: null, summary_source: "github_description", features: { web_ui: false, api: false, sdk: false, cli: true, docker: false, self_host: false, gpu_required: false }, preview: null,
    content_type: "可运行工具", primary_capability: "Agent Core", capabilities: ["Agent Core"], research_use_cases: [], integration_methods: [], platforms: [], local_first: true, external_service_required: false, setup_level: "easy",
    quality_score: 80, fit_score: 80, recommendation_score: 80, score_breakdown: { growth: null, heat: 80, activity: 80, community: 80, completeness: 80, penalty: 0 },
    growth: { day_1: null, day_7: null, day_30: null, percent_7: null, sparkline: [] }, recommendation_reasons: [], classification_evidence: [],
    ...overrides,
  };
}

describe("project content presentation", () => {
  it("uses Chinese summaries before the GitHub description", () => {
    expect(projectSummary(project({ summary_zh: "中文摘要", summary_source: "manual" }))).toBe("中文摘要");
    expect(projectSummary(project())).toBe("Original English description");
  });

  it("labels all summary sources and stale model output", () => {
    expect(summarySourceLabel(project({ summary_source: "manual" }))).toBe("人工中文摘要");
    expect(summarySourceLabel(project({ summary_source: "github_models", summary_status: "ready" }))).toBe("AI 中文摘要");
    expect(summarySourceLabel(project({ summary_source: "github_models", summary_status: "stale" }))).toBe("AI 摘要 · 待更新");
    expect(summarySourceLabel(project({ summary_source: "readme_zh" }))).toBe("README 中文摘录");
    expect(summarySourceLabel(project())).toBe("GitHub 原始简介");
  });

  it("maps detected README languages to valid HTML language tags", () => {
    expect(readmeLang(project({ readme_language: "en" }))).toBe("en");
    expect(readmeLang(project({ readme_language: "zh" }))).toBe("zh-CN");
    expect(readmeLang(project({ readme_language: "mixed" }))).toBeUndefined();
  });
});
