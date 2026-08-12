export const ECOSYSTEM_LAYERS = [
  "Agents",
  "Skills & Plugins",
  "MCP & Connectors",
  "Infrastructure",
] as const;

export const CAPABILITIES = [
  "Agent Core", "Skills & Prompts", "MCP & Connectors", "Browser & Computer Use",
  "Memory & Knowledge", "Automation", "Evaluation & Safety", "Research & Learning",
] as const;

export type EcosystemLayer = (typeof ECOSYSTEM_LAYERS)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type SummarySource = "manual" | "github_models" | "readme_zh" | "github_description";
export type SummaryStatus = "ready" | "pending" | "stale" | "unavailable";
export type ReadmeLanguage = "zh" | "en" | "mixed" | "unknown";
export type GuideSource = "manual" | "github_models" | "readme_zh" | "metadata_fallback";
export type GuideStatus = "ready" | "partial" | "stale" | "unavailable";
export type SetupLevel = "easy" | "medium" | "advanced";
export type View = "discover" | "trending" | "capabilities" | "saved" | "compare";
export type SortMode = "recommended" | "trending" | "stars" | "updated" | "newest";

export interface ScoreBreakdown {
  growth: number | null;
  heat: number;
  activity: number;
  community: number;
  completeness: number;
  penalty: number;
}

export interface GrowthData {
  day_1: number | null;
  day_7: number | null;
  day_30: number | null;
  percent_7: number | null;
  sparkline: number[];
}

export interface ProjectFeatures {
  web_ui: boolean;
  api: boolean;
  sdk: boolean;
  cli: boolean;
  docker: boolean;
  self_host: boolean;
  gpu_required: boolean;
}

export interface ProjectPreview {
  type: string;
  url: string;
  source: string;
}

export interface Project {
  id: number;
  full_name: string;
  url: string;
  homepage: string | null;
  description: string | null;
  language: string | null;
  topics: string[];
  license: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  created_at: string;
  pushed_at: string;
  ecosystem_layer: EcosystemLayer;
  project_subtype: string;
  use_cases: string[];
  functional_capabilities: string[];
  summary_zh: string | null;
  summary_source: SummarySource;
  readme_excerpt?: string | null;
  readme_language?: ReadmeLanguage;
  readme_url?: string | null;
  readme_hash?: string | null;
  summary_status?: SummaryStatus;
  summary_model?: string | null;
  summary_updated_at?: string | null;
  content_url?: string | null;
  guide_source?: GuideSource;
  guide_status?: GuideStatus;
  guide_updated_at?: string | null;
  features: ProjectFeatures;
  preview: ProjectPreview | null;
  content_type: string;
  primary_capability: string;
  capabilities: string[];
  research_use_cases: string[];
  integration_methods: string[];
  platforms: string[];
  local_first: boolean;
  external_service_required: boolean;
  setup_level: SetupLevel;
  quality_score: number;
  fit_score: number;
  recommendation_score: number;
  score_breakdown: ScoreBreakdown;
  growth: GrowthData;
  recommendation_reasons: string[];
  classification_evidence: string[];
}

export interface SiteData {
  schema_version: string;
  generated_at: string;
  collection_status: "live" | "demo" | "stale";
  windows: { new_projects_days: number };
  stats: { candidates: number; published: number; history_days: number };
  projects: Project[];
}

export interface BrowseFilters {
  layer: EcosystemLayer | null;
  subtype: string;
  useCase: string;
  query: string;
  sort: SortMode;
}

export interface CapabilitySummary {
  capability: Capability;
  projectCount: number;
  recentlyUpdated: number;
  growth7: number | null;
  representatives: Project[];
}
