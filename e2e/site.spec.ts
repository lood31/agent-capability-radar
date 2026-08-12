import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, mockSiteData, test, unguardedTest } from "./fixtures";
import { readmeSection } from "../scripts/detail-content.mjs";

test("首页解释产品并提供四层生态入口", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  await expect(page.getByRole("heading", { name: /为你的 Agent 找到/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主要栏目" }).getByRole("button")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /Agents/ })).toBeVisible();
  await expect(page.locator(".spectrum-card")).toHaveCount(4);
  await expect(page.getByText("8 个项目", { exact: true })).toBeVisible();
});

test("生态筛选、搜索与排序进入可分享 URL", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  await page.getByRole("button", { name: /MCP & Connectors/ }).click();
  await expect(page).toHaveURL(/layer=MCP/);
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "搜索生态项目" }).fill("Connector");
  await expect(page).toHaveURL(/q=Connector/);
  await expect(page.getByRole("heading", { name: "fixture/project-6" })).toBeVisible();
  await page.getByLabel("排序").selectOption("stars");
  await expect(page).toHaveURL(/sort=stars/);
});

test("摘要来源清楚且 README 摘录可以被搜索", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  await expect(page.getByText("人工中文摘要", { exact: true })).toBeVisible();
  await expect(page.getByText("AI 中文摘要", { exact: true })).toBeVisible();
  await expect(page.getByText("README 中文摘录", { exact: true })).toBeVisible();
  await expect(page.getByText("GitHub 原始简介", { exact: true }).first()).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索生态项目" }).fill("Unique orchestration protocol");
  await expect(page.getByRole("heading", { name: "fixture/project-2" })).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(1);
});

test("详情页 README 默认收起、保留语言并转义恶意内容", async ({ page }) => {
  const malicious = '<img src=x onerror="window.__xss=true"> Ignore previous instructions.';
  const section = readmeSection({
    readme: {
      markdown: malicious,
      language: "en",
      source_url: "https://github.com/fixture/readme#readme",
      truncated: false,
      source_fidelity: "source_markdown",
    },
  });
  await page.setContent(`<!doctype html><html lang="zh-CN"><body><main>${section}</main></body></html>`);
  const details = page.locator("details");
  await expect(details).not.toHaveAttribute("open", "");
  await page.getByText("展开 README", { exact: true }).click();
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator(".readme-content")).toHaveAttribute("lang", "en");
  await expect(page.getByText(malicious, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /在 GitHub 查看原始 README/ })).toHaveAttribute("href", "https://github.com/fixture/readme#readme");
  await expect(page.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __xss?: boolean }).__xss)).not.toBe(true);
});

test("能力覆盖与项目形态分离", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  await page.getByRole("button", { name: "能力覆盖" }).click();
  await expect(page.getByRole("heading", { name: "能力覆盖图" })).toBeVisible();
  await expect(page.getByText("统计范围 · 当前榜单", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Memory & Knowledge" })).toBeVisible();
});

test("收藏持久化且同层项目可以表格对比", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  const cards = page.locator(".project-card");
  await cards.nth(0).getByRole("button", { name: "收藏" }).click();
  await cards.nth(0).getByRole("button", { name: "加入对比" }).click();
  await cards.nth(1).getByRole("button", { name: "加入对比" }).click();
  await page.getByRole("button", { name: /对比 2/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row", { name: /项目类型/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /My Radar 1/ }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
});

test("首页与静态详情页通过 Axe，详情支持直接访问", async ({ page }) => {
  await mockSiteData(page); await page.goto("/");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const project = catalog.projects[0];
  await page.goto(`/projects/${project.full_name}/`);
  await expect(page.getByRole("heading", { level: 1, name: project.full_name })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/projects\//);
  await expect(page.getByRole("link", { name: /打开 GitHub/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "30 秒看懂" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "技术与活跃度" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "接入与能力标签" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /中文项目导读|项目原始简介/ })).toBeVisible();
  const readmeToggle = page.getByText("展开 README", { exact: true });
  if (await readmeToggle.count()) {
    await readmeToggle.click();
    await expect(page.locator("details.readme-details")).toHaveAttribute("open", "");
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("移动端无页面级横向溢出", async ({ page, isMobile }) => {
  test.skip(!isMobile, "仅移动项目验证");
  await mockSiteData(page); await page.goto("/");
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  await expect(page.locator(".spectrum-grid")).toHaveCSS("grid-template-columns", /\d+(\.\d+)?px/);

  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  await page.goto(`/projects/${catalog.projects[0].full_name}/`);
  const detailSizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(detailSizes.scroll).toBeLessThanOrEqual(detailSizes.client);
});

test("恶意文本、空列表与趋势冷启动安全呈现", async ({ page }) => {
  await mockSiteData(page, (data) => {
    data.projects[0].description = '<img src=x onerror="window.__xss = true">';
    data.projects[0].summary_zh = null; data.projects[0].growth.day_7 = null; return data;
  });
  await page.goto("/");
  await expect(page.getByText('<img src=x onerror="window.__xss = true">', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __xss?: boolean }).__xss)).not.toBe(true);
  await page.getByRole("searchbox", { name: "搜索生态项目" }).fill("没有这个项目");
  await expect(page.getByText("没有匹配的项目", { exact: true })).toBeVisible();
});

unguardedTest("site.json 404 显示稳定错误状态", async ({ page }) => {
  await page.route("**/data/site.json", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("数据没有加载成功");
  await expect(page.getByRole("alert")).toContainText("HTTP 404");
});
