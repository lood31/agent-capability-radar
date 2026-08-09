export const CAPABILITIES = [
  "Agent Core",
  "Skills & Prompts",
  "MCP & Connectors",
  "Browser & Computer Use",
  "Memory & Knowledge",
  "Automation",
  "Evaluation & Safety",
  "Research & Learning",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type View = "recommended" | "capabilities" | "research" | "rising" | "new" | "hot";
export type SetupLevel = "easy" | "medium" | "advanced";

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
  content_type: string;
  primary_capability: Capability;
  capabilities: Capability[];
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
  windows: {
    new_projects_days: number;
  };
  stats: {
    candidates: number;
    published: number;
    history_days: number;
  };
  projects: Project[];
}

export interface CapabilitySummary {
  capability: Capability;
  projectCount: number;
  recentlyUpdated: number;
  growth7: number | null;
  representatives: Project[];
}
