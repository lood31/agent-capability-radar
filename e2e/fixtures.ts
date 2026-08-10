import { expect, test as base, type Page } from "@playwright/test";

type BrowserGuard = { browserGuard: void };

export const test = base.extend<BrowserGuard>({
  browserGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
    await use();
    expect(errors, "unexpected browser errors").toEqual([]);
  }, { auto: true }],
});

export { expect } from "@playwright/test";
export { test as unguardedTest } from "@playwright/test";

export async function mockSiteData(page: Page, transform?: (data: SiteData) => SiteData): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const source = JSON.parse(await readFile(new URL("../public/data/site.json", import.meta.url), "utf8")) as SiteData;
  const data = deterministicFixture(source);
  await page.route("**/data/site.json", (route) => route.fulfill({ json: transform ? transform(data) : data }));
}

function deterministicFixture(source: SiteData): SiteData {
  const template = source.projects[0];
  if (!template) throw new Error("site fixture requires a project template");
  const variants = [
    ["Agents", "Coding Agent", "Coding", "Coding & Developer Tools"],
    ["Agents", "Research & Science Agent", "Research & Literature", "Search & Research"],
    ["Skills & Plugins", "Agent Skill", "Agent Development", "Coding & Developer Tools"],
    ["Skills & Plugins", "Plugin", "Automation", "Automation & Orchestration"],
    ["MCP & Connectors", "MCP Server", "Agent Development", "Memory & Knowledge"],
    ["MCP & Connectors", "Connector", "Knowledge Management", "Memory & Knowledge"],
    ["Infrastructure", "Memory & Knowledge", "Knowledge Management", "Memory & Knowledge"],
    ["Infrastructure", "Evaluation & Observability", "Agent Development", "Evaluation, Observability & Safety"],
  ];
  const projects = variants.map(([layer, subtype, useCase, capability], index) => ({
    ...structuredClone(template), id: 9_000_000 + index,
    full_name: `fixture/project-${index + 1}`, url: `https://github.com/fixture/project-${index + 1}`,
    homepage: `https://example.com/project-${index + 1}`, description: `Deterministic ${subtype} browser fixture`,
    summary_zh: index === 0 ? "帮助开发者完成代码任务的可验证测试项目。" : null,
    summary_source: index === 0 ? "manual" : "github_description",
    ecosystem_layer: layer, project_subtype: subtype, use_cases: [useCase], functional_capabilities: [capability],
    language: "TypeScript", topics: [`fixture-${index + 1}`], quality_score: 90 - index, fit_score: 90 - index,
    recommendation_score: 90 - index, growth: { day_1: index ? index + 1 : null, day_7: index ? index + 7 : null, day_30: index ? index + 30 : null, percent_7: 1, sparkline: [] },
  }));
  return { ...structuredClone(source), collection_status: "live", stats: { candidates: 8, published: 8, history_days: 30 }, projects };
}

export type SiteData = { projects: Array<Record<string, any>>; [key: string]: any };
