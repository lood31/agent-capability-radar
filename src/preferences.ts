import type { EcosystemLayer, Project } from "./types";

type ScorableProject = Pick<Project, "quality_score" | "fit_score" | "ecosystem_layer">;

export function computePersonalizedScore(project: ScorableProject, preferences: ReadonlySet<EcosystemLayer>): number {
  const preferenceBoost = preferences.has(project.ecosystem_layer) ? 100 : 0;
  return Math.round(project.quality_score * 0.65 + (project.fit_score * 0.65 + preferenceBoost * 0.35) * 0.35);
}
