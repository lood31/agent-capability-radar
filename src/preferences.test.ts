import { describe, expect, it } from "vitest";
import { computePersonalizedScore } from "./preferences";
import type { EcosystemLayer } from "./types";

describe("computePersonalizedScore", () => {
  const project = {
    quality_score: 80,
    fit_score: 70,
    ecosystem_layer: "MCP & Connectors" as EcosystemLayer,
  };

  it("boosts projects matching selected capabilities", () => {
    const matching = computePersonalizedScore(project, new Set<EcosystemLayer>(["MCP & Connectors"]));
    const unrelated = computePersonalizedScore(project, new Set<EcosystemLayer>(["Agents"]));
    expect(matching).toBeGreaterThan(unrelated);
  });

  it("returns a stable score for no preferences", () => {
    expect(computePersonalizedScore(project, new Set())).toBe(68);
  });
});
