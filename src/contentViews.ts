import type { Project } from "./types";

export function projectSummary(project: Project): string {
  return project.summary_zh?.trim()
    || project.description?.trim()
    || "该项目暂未提供可验证的简介。";
}

export function summarySourceLabel(project: Project): string {
  if (project.summary_source === "manual") return "人工中文摘要";
  if (project.summary_source === "github_models") {
    return project.summary_status === "stale" ? "AI 摘要 · 待更新" : "AI 中文摘要";
  }
  if (project.summary_source === "readme_zh") return "README 中文摘录";
  return "GitHub 原始简介";
}

export function readmeLang(project: Project): "en" | "zh-CN" | undefined {
  if (project.readme_language === "en") return "en";
  if (project.readme_language === "zh") return "zh-CN";
  return undefined;
}
