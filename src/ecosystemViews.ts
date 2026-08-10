import { ECOSYSTEM_LAYERS, type BrowseFilters, type EcosystemLayer, type Project } from "./types";

const DAY_MS = 86_400_000;

export function projectPath(project: Pick<Project, "full_name">): string {
  return `./projects/${project.full_name.split("/").map(encodeURIComponent).join("/")}/`;
}

export function searchText(project: Project): string {
  return [
    project.full_name,
    project.description ?? "",
    project.summary_zh ?? "",
    project.ecosystem_layer,
    project.project_subtype,
    ...project.use_cases,
    ...project.functional_capabilities,
    project.language ?? "",
    ...project.topics,
  ].join(" ").toLocaleLowerCase("zh-CN");
}

export function filterAndSortProjects(projects: readonly Project[], filters: BrowseFilters): Project[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return projects.filter((project) => {
    if (filters.layer && project.ecosystem_layer !== filters.layer) return false;
    if (filters.subtype && project.project_subtype !== filters.subtype) return false;
    if (filters.useCase && !project.use_cases.includes(filters.useCase)) return false;
    return !query || searchText(project).includes(query);
  }).sort((a, b) => {
    if (filters.sort === "trending") return (b.growth.day_7 ?? -1) - (a.growth.day_7 ?? -1);
    if (filters.sort === "stars") return b.stars - a.stars;
    if (filters.sort === "updated") return Date.parse(b.pushed_at) - Date.parse(a.pushed_at);
    if (filters.sort === "newest") return Date.parse(b.created_at) - Date.parse(a.created_at);
    return b.recommendation_score - a.recommendation_score;
  });
}

export function layerCounts(projects: readonly Project[]): Map<EcosystemLayer, number> {
  return new Map(ECOSYSTEM_LAYERS.map((layer) => [layer, projects.filter((project) => project.ecosystem_layer === layer).length]));
}

export function isWithinDays(value: string, now: number, days: number): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp <= days * DAY_MS;
}

export function canCompare(projects: readonly Project[]): boolean {
  if (projects.length < 2 || projects.length > 4) return false;
  const layers = new Set(projects.map((project) => project.ecosystem_layer));
  return layers.size === 1;
}

export function migrateLegacyPreferences(values: readonly string[]): EcosystemLayer[] {
  const mapping: Record<string, EcosystemLayer> = {
    "Agent Core": "Agents",
    "Skills & Prompts": "Skills & Plugins",
    "MCP & Connectors": "MCP & Connectors",
    "Browser & Computer Use": "Agents",
    "Memory & Knowledge": "Infrastructure",
    Automation: "Infrastructure",
    "Evaluation & Safety": "Infrastructure",
    "Research & Learning": "Agents",
  };
  return [...new Set(values.map((value) => ECOSYSTEM_LAYERS.includes(value as EcosystemLayer) ? value as EcosystemLayer : mapping[value]).filter(Boolean))];
}

export function parseCompareIds(value: string | null): number[] {
  return (value ?? "").split(",").filter(Boolean).map(Number).filter(Number.isInteger).slice(0, 4);
}
