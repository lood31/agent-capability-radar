import { describe, expect, it } from "vitest";
import { canCompare, dataFreshness, filterAndSortProjects, layerCounts, migrateLegacyPreferences, parseCompareIds, projectPath } from "./ecosystemViews";
import type { EcosystemLayer, Project } from "./types";

function project(id: number, layer: EcosystemLayer, subtype: string, score: number): Project {
  return {
    id, full_name: `owner/project-${id}`, url: `https://github.com/owner/project-${id}`, homepage: null,
    description: "Browser research workflow", language: "TypeScript", topics: ["agent"], license: "MIT",
    stars: id * 100, forks: 1, open_issues: 0, created_at: "2026-08-01T00:00:00Z", pushed_at: "2026-08-09T00:00:00Z",
    ecosystem_layer: layer, project_subtype: subtype, use_cases: ["Research & Literature"], functional_capabilities: ["Browser & Computer Use"],
    summary_zh: null, summary_source: "github_description", features: { web_ui: false, api: false, sdk: false, cli: true, docker: false, self_host: false, gpu_required: false }, preview: null,
    content_type: "可运行工具", primary_capability: "Agent Core", capabilities: ["Agent Core"], research_use_cases: [], integration_methods: ["CLI"], platforms: [], local_first: false, external_service_required: false, setup_level: "easy",
    quality_score: score, fit_score: score, recommendation_score: score, score_breakdown: { growth: 1, heat: score, activity: score, community: score, completeness: score, penalty: 0 },
    growth: { day_1: 1, day_7: id, day_30: id * 2, percent_7: 1, sparkline: [] }, recommendation_reasons: [], classification_evidence: [],
  };
}

describe("ecosystem browsing", () => {
  const agents = project(1, "Agents", "Coding Agent", 80);
  const mcp = project(2, "MCP & Connectors", "MCP Server", 90);

  it("filters independently by layer, subtype, use case and text", () => {
    const result = filterAndSortProjects([agents, mcp], { layer: "Agents", subtype: "Coding Agent", useCase: "Research & Literature", query: "browser", sort: "recommended" });
    expect(result.map((item) => item.id)).toEqual([1]);
  });

  it("builds four layer counts including empty layers", () => {
    const counts = layerCounts([agents, mcp]);
    expect([...counts.keys()]).toHaveLength(4);
    expect(counts.get("Skills & Plugins")).toBe(0);
  });

  it("only compares 2–4 projects from one layer", () => {
    expect(canCompare([agents, project(3, "Agents", "General Agent", 70)])).toBe(true);
    expect(canCompare([agents, mcp])).toBe(false);
    expect(canCompare([agents])).toBe(false);
  });

  it("migrates legacy preferences and generates stable paths", () => {
    expect(migrateLegacyPreferences(["Agent Core", "Memory & Knowledge"])).toEqual(["Agents", "Infrastructure"]);
    expect(projectPath(agents)).toBe("./projects/owner/project-1/");
  });

  it("does not turn an empty compare parameter into project zero", () => {
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds("1,2,bad,3,4,5")).toEqual([1, 2, 3, 4]);
  });
});

describe("data freshness", () => {
  const now = Date.parse("2026-08-11T02:00:00Z");

  it("does not present an old live snapshot as live", () => {
    expect(dataFreshness({ collection_status: "live", generated_at: "2026-08-10T13:42:47Z" }, now)).toBe("stale");
  });

  it("keeps recent live snapshots and demo data distinct", () => {
    expect(dataFreshness({ collection_status: "live", generated_at: "2026-08-10T18:00:00Z" }, now)).toBe("live");
    expect(dataFreshness({ collection_status: "demo", generated_at: "2020-01-01T00:00:00Z" }, now)).toBe("demo");
  });
});
