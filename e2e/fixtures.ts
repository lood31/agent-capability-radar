import { expect, test as base, type Page } from "@playwright/test";

type BrowserGuard = {
  browserGuard: void;
};

export const test = base.extend<BrowserGuard>({
  browserGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => {
      errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
    });

    await use();
    expect(errors, "unexpected browser errors").toEqual([]);
  }, { auto: true }],
});

export { expect } from "@playwright/test";
export { test as unguardedTest } from "@playwright/test";

export async function mockSiteData(page: Page, transform?: (data: SiteData) => SiteData): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile(new URL("../public/data/site.json", import.meta.url), "utf8")) as SiteData;
  const body = deterministicFixture(data);
  const response = transform ? transform(body) : body;
  await page.route("**/data/site.json", (route) => route.fulfill({ json: response }));
}

function deterministicFixture(source: SiteData): SiteData {
  const capabilities = [
    "Agent Core",
    "Skills & Prompts",
    "MCP & Connectors",
    "Browser & Computer Use",
    "Memory & Knowledge",
    "Automation",
    "Evaluation & Safety",
    "Research & Learning",
  ];
  const template = source.projects[0];
  if (!template) throw new Error("site fixture requires at least one project template");
  const projects = capabilities.map((capability, index) => ({
    ...structuredClone(template),
    id: 9_000_000 + index,
    full_name: `fixture/${capability.toLowerCase().replaceAll(/[^a-z]+/g, "-").replaceAll(/^-|-$/g, "")}`,
    url: `https://github.com/fixture/project-${index + 1}`,
    homepage: `https://example.com/project-${index + 1}`,
    description: `Deterministic ${capability} browser fixture`,
    language: "TypeScript",
    topics: [`fixture-${index + 1}`],
    primary_capability: capability,
    capabilities: capability === "MCP & Connectors" ? [capability, "Skills & Prompts"] : [capability],
    quality_score: 90 - index,
    fit_score: 90 - index,
    recommendation_score: 90 - index,
    growth: {
      day_1: index + 1,
      day_7: index + 7,
      day_30: index + 30,
      percent_7: 1,
      sparkline: [100 + index, 110 + index],
    },
  }));
  return {
    ...structuredClone(source),
    collection_status: "live",
    stats: { candidates: projects.length, published: projects.length, history_days: 1 },
    projects,
  };
}

export type SiteData = {
  projects: Array<Record<string, unknown> & {
    full_name: string;
    capabilities: string[];
    primary_capability: string;
    growth: { day_7: number | null; sparkline: number[] };
    homepage: string | null;
    description: string | null;
  }>;
  [key: string]: unknown;
};
