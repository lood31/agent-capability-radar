import { describe, expect, it } from "vitest";
import { guideSection, readmeSection, renderSafeMarkdown } from "../scripts/detail-content.mjs";

describe("detail content rendering", () => {
  it("renders safe external links and drops dangerous protocols", () => {
    const html = renderSafeMarkdown("[安全链接](https://example.com) [危险链接](javascript:alert(1))");
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("危险链接");
  });

  it("preserves safe images and relative links without executing raw HTML", () => {
    const html = renderSafeMarkdown(
      '<script>alert(1)</script>\n\n![preview](./docs/a.png)\n\n[Guide](./docs/start.md)',
      "owner/repo",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain('<img src="https://raw.githubusercontent.com/owner/repo/HEAD/docs/a.png"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('href="https://github.com/owner/repo/blob/HEAD/docs/start.md"');
    expect(html).not.toContain("onerror=");
  });

  it("does not describe legacy cleaned content as original README", () => {
    const legacy = readmeSection({
      full_name: "owner/repo",
      readme: { markdown: "Legacy excerpt", source_url: "https://github.com/owner/repo#readme" },
    });
    expect(legacy).toContain("旧版摘要缓存，不是完整原文");

    const source = readmeSection({
      full_name: "owner/repo",
      readme: { markdown: "# README", source_fidelity: "source_markdown" },
    });
    expect(source).toContain("保留 Markdown 正文并进行安全渲染");
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
