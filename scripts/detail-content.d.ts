export function escapeHtml(value: unknown): string;
export function readmeSection(project: {
  readme_excerpt?: string | null;
  readme_language?: "zh" | "en" | "mixed" | "unknown";
  readme_url?: string | null;
}): string;
