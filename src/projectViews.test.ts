import { describe, expect, it } from "vitest";
import {
  buildCapabilitySummaries,
  isWithinDays,
  matchesCapability,
} from "./projectViews";
import type { Capability, Project } from "./types";

function project(
  id: number,
  primary: Capability,
  capabilities: Capability[],
  score = 80,
): Project {
  return {
    id,
    full_name: `owner/project-${id}`,
    url: `https://github.com/owner/project-${id}`,
    homepage: null,
    description: "Test project",
    language: "TypeScript",
    topics: [],
    license: "MIT",
    stars: 100,
    forks: 10,
    open_issues: 1,
    created_at: "2026-07-15T00:00:00Z",
    pushed_at: "2026-08-08T00:00:00Z",
    content_type: "可运行工具",
    primary_capability: primary,
    capabilities,
    research_use_cases: [],
    integration_methods: [],
    platforms: [],
    local_first: false,
    external_service_required: false,
    setup_level: "easy",
    quality_score: score,
    fit_score: score,
    recommendation_score: score,
    score_breakdown: {
      growth: null,
      heat: score,
      activity: score,
      community: score,
      completeness: score,
      penalty: 0,
    },
    growth: { day_1: null, day_7: 5, day_30: null, percent_7: null, sparkline: [] },
    recommendation_reasons: [],
    classification_evidence: [],
  };
}

describe("capability browsing", () => {
  const mcpProject = project(
    1,
    "MCP & Connectors",
    ["MCP & Connectors", "Skills & Prompts"],
  );

  it("uses the primary capability by default", () => {
    expect(matchesCapability(mcpProject, "Skills & Prompts", false)).toBe(false);
    expect(matchesCapability(mcpProject, "MCP & Connectors", false)).toBe(true);
  });

  it("can include related capabilities explicitly", () => {
    expect(matchesCapability(mcpProject, "Skills & Prompts", true)).toBe(true);
  });

  it("uses an inclusive recent-days boundary", () => {
    const now = Date.parse("2026-08-09T00:00:00Z");
    expect(isWithinDays("2026-07-10T00:00:00Z", now, 30)).toBe(true);
    expect(isWithinDays("2026-07-09T23:59:59Z", now, 30)).toBe(false);
  });

  it("always creates eight summaries including empty categories", () => {
    const summaries = buildCapabilitySummaries(
      [
        mcpProject,
        project(2, "MCP & Connectors", ["MCP & Connectors"], 90),
      ],
      Date.parse("2026-08-09T00:00:00Z"),
      30,
    );
    expect(summaries).toHaveLength(8);
    const mcp = summaries.find((item) => item.capability === "MCP & Connectors");
    expect(mcp?.projectCount).toBe(2);
    expect(mcp?.representatives[0].id).toBe(2);
    expect(summaries.find((item) => item.capability === "Automation")?.projectCount).toBe(0);
  });
});
