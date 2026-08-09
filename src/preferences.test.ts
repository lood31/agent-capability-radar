import { describe, expect, it } from "vitest";
import { computePersonalizedScore } from "./preferences";
import type { Capability } from "./types";

describe("computePersonalizedScore", () => {
  const project = {
    quality_score: 80,
    fit_score: 70,
    capabilities: ["MCP & Connectors", "Automation"] as Capability[],
  };

  it("boosts projects matching selected capabilities", () => {
    const matching = computePersonalizedScore(project, new Set<Capability>(["MCP & Connectors"]));
    const unrelated = computePersonalizedScore(project, new Set<Capability>(["Research & Learning"]));
    expect(matching).toBeGreaterThan(unrelated);
  });

  it("returns a stable score for no preferences", () => {
    expect(computePersonalizedScore(project, new Set())).toBe(68);
  });
});

