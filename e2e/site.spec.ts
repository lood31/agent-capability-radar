import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";
import { expect, mockSiteData, test, unguardedTest } from "./fixtures";

async function waitForAnimations(locator: Locator): Promise<void> {
  await locator.evaluate(async (element: Element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
}

test("首页加载、搜索和六个栏目切换", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今天，给你的 Agent 装上什么？" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主要栏目" }).getByRole("button")).toHaveCount(6);

  await page.getByRole("searchbox", { name: "搜索项目" }).fill("zotero");
  await expect(page.getByRole("heading", { name: "zotero/zotero" })).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(1);

  await page.getByRole("searchbox", { name: "搜索项目" }).fill("");
  for (const label of ["能力地图", "研究学习", "增长最快", "新项目", "全站热门", "为我推荐"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("八轨地图使用严格主分类，相关项目需主动开启", async ({ page }) => {
  await mockSiteData(page, (data) => {
    const mcp = data.projects.find((project) => project.full_name === "modelcontextprotocol/servers")!;
    mcp.capabilities.push("Skills & Prompts");
    return data;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "能力地图", exact: true }).click();
  await expect(page.locator(".capability-map-card")).toHaveCount(8);
  await expect(page.getByText("统计范围 · 当前榜单", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Skills & Prompts，/ }).click();
  await expect(page.getByRole("heading", { name: "modelcontextprotocol/servers" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "包含相关项目" }).check();
  await expect(page.getByRole("heading", { name: "modelcontextprotocol/servers" })).toBeVisible();
});

test("项目详情 dialog 支持 Escape 并恢复焦点", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /查看能力详情/ }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("主要能力", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("偏好 dialog 约束焦点并在关闭后恢复", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "调整我的关注能力" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "你想增强哪些能力？" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("页面与两个 dialog 通过 axe 扫描", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "能力地图", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "为我推荐", exact: true }).click();
  await page.getByRole("button", { name: /查看能力详情/ }).first().click();
  const detailsDialog = page.getByRole("dialog");
  await waitForAnimations(detailsDialog);
  expect((await new AxeBuilder({ page }).include("dialog").analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "调整我的关注能力" }).click();
  await waitForAnimations(page.getByRole("dialog"));
  expect((await new AxeBuilder({ page }).include("dialog").analyze()).violations).toEqual([]);
});

test("移动布局没有页面级横向溢出", async ({ page, isMobile }) => {
  test.skip(!isMobile, "仅移动项目验证");
  await page.goto("/");
  await page.getByRole("button", { name: "能力地图", exact: true }).click();
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  await expect(page.locator(".capability-map-grid")).toHaveCSS("grid-template-columns", /\d+(\.\d+)?px/);
});

test("空列表、冷启动趋势和恶意文本 fixture 可安全呈现", async ({ page }) => {
  await mockSiteData(page, (data) => {
    const project = data.projects[0];
    project.full_name = "fixture/malicious";
    project.description = '<img src=x onerror="window.__xss = true">';
    project.homepage = "javascript:alert(1)";
    project.growth.day_7 = null;
    project.growth.sparkline = [];
    data.projects = [project];
    return data;
  });
  await page.goto("/");
  await expect(page.getByText('<img src=x onerror="window.__xss = true">', { exact: true })).toBeVisible();
  await expect(page.getByText("7 日数据积累中", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __xss?: boolean }).__xss)).not.toBe(true);

  await page.getByRole("button", { name: /查看能力详情/ }).click();
  await expect(page.getByRole("link", { name: "项目主页" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "搜索项目" }).fill("没有这个项目");
  await expect(page.getByText("没有匹配的项目", { exact: true })).toBeVisible();
});

unguardedTest("site.json 404 显示稳定错误状态", async ({ page }) => {
  await page.route("**/data/site.json", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("数据没有加载成功");
  await expect(page.getByRole("alert")).toContainText("HTTP 404");
});
