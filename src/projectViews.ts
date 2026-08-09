import {
  CAPABILITIES,
  type Capability,
  type CapabilitySummary,
  type Project,
} from "./types";

const DAY_MS = 86_400_000;

export function matchesCapability(
  project: Project,
  capability: Capability,
  includeRelated: boolean,
): boolean {
  return includeRelated
    ? project.capabilities.includes(capability)
    : project.primary_capability === capability;
}

export function isWithinDays(value: string, now: number, days: number): boolean {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= days * DAY_MS;
}

export function buildCapabilitySummaries(
  projects: readonly Project[],
  now: number,
  recentDays: number,
): CapabilitySummary[] {
  return CAPABILITIES.map((capability) => {
    const primaryProjects = projects.filter(
      (project) => project.primary_capability === capability,
    );
    const growth = primaryProjects
      .map((project) => project.growth.day_7)
      .filter((value): value is number => value !== null);
    return {
      capability,
      projectCount: primaryProjects.length,
      recentlyUpdated: primaryProjects.filter((project) =>
        isWithinDays(project.pushed_at, now, recentDays),
      ).length,
      growth7: growth.length ? growth.reduce((sum, value) => sum + value, 0) : null,
      representatives: [...primaryProjects]
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, 3),
    };
  });
}
