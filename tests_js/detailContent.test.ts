import { describe, expect, it } from "vitest";
import { guideSection, renderSafeMarkdown } from "../scripts/detail-content.mjs";

describe("detail content rendering", () => {
  it("renders safe external links and drops dangerous protocols", () => {
    const html = renderSafeMarkdown("[安全链接](https://example.com) [危险链接](javascript:alert(1))");
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("危险链接");
  });

  it("does not execute raw HTML or render remote images", () => {
    const html = renderSafeMarkdown('<script>alert(1)</script> ![preview](https://example.com/a.png)');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("preview");
  });

  it("guide contains only the overview and capability list", () => {
    const html = guideSection({
      guide_zh: { overview: "这是项目说明。", capabilities: ["能力一", "能力二", "能力三"] },
      guide_source: "manual",
      guide_status: "ready",
      guide_updated_at: null,
    });
    expect(html).toContain("中文项目导读");
    expect(html).toContain("主要能力");
    expect(html).not.toContain("安装方法");
    expect(html).not.toContain("适用人群");
    expect(html).not.toContain("注意事项");
  });
});
