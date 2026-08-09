import type { Capability, Project } from "./types";

type ScorableProject = Pick<Project, "quality_score" | "fit_score" | "capabilities">;

export function computePersonalizedScore(project: ScorableProject, preferences: ReadonlySet<Capability>): number {
  const matched = project.capabilities.filter((item) => preferences.has(item)).length;
  const preferenceBoost = preferences.size
    ? Math.min(100, (matched / Math.min(3, preferences.size)) * 100)
    : 0;
  return Math.round(
    project.quality_score * 0.65
      + (project.fit_score * 0.65 + preferenceBoost * 0.35) * 0.35,
  );
}

