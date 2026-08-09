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
  const body = transform ? transform(structuredClone(data)) : data;
  await page.route("**/data/site.json", (route) => route.fulfill({ json: body }));
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
