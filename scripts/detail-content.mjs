import MarkdownIt from "markdown-it";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[char]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
markdown.renderer.rules.image = (tokens, index) => escapeHtml(tokens[index].content || "");
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = safeUrl(tokens[index].attrGet("href"));
  if (!href) {
    tokens[index].meta = { unsafe: true };
    return "";
  }
  tokens[index].attrSet("href", href);
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, index, options);
};
markdown.renderer.rules.link_close = (tokens, index, options, env, self) => {
  const opener = [...tokens.slice(0, index)].reverse().find((token) => token.type === "link_open");
  return opener?.meta?.unsafe ? "" : self.renderToken(tokens, index, options);
};

export function renderSafeMarkdown(value) {
  const safeSource = String(value ?? "").replace(
    /\[([^\]]+)\]\(\s*(?:javascript|data|vbscript):[^\n)]*\)\)?/gi,
    "$1",
  );
  return markdown.render(safeSource);
}

export function guideSection(content) {
  const guide = content?.guide_zh;
  if (!guide?.overview) return "";
  const capabilities = Array.isArray(guide.capabilities) ? guide.capabilities.slice(0, 6) : [];
  const labels = {
    manual: "人工中文导读",
    github_models: content.guide_status === "stale" ? "AI 中文导读 · 待更新" : "AI 中文导读",
    readme_zh: "README 中文导读",
    metadata_fallback: "GitHub 数据回退",
  };
  const updated = content.guide_updated_at
    ? new Date(content.guide_updated_at).toLocaleDateString("zh-CN", { timeZone: "UTC" })
    : null;
  const hasChineseOverview = /[\u3400-\u9fff]/.test(guide.overview);
  const title = content.guide_source === "metadata_fallback" && !hasChineseOverview
    ? "项目原始简介"
    : "中文项目导读";
  return `<section class="detail-section guide-section" aria-labelledby="guide-title"><span class="eyebrow">PROJECT GUIDE</span><h2 id="guide-title">${title}</h2><p class="guide-overview">${escapeHtml(guide.overview)}</p>${capabilities.length ? `<div class="guide-capability-panel"><h3>主要能力</h3><ul class="guide-capabilities">${capabilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}<p class="source-note">来源：${escapeHtml(labels[content.guide_source] || "项目元数据")}${updated ? ` · ${escapeHtml(updated)} 更新` : ""}${content.guide_source === "github_models" ? "。自动生成内容可能存在偏差，请以 README 原文为准。" : ""}</p></section>`;
}

export function readmeSection(content) {
  const readme = content?.readme;
  if (!readme?.markdown) return "";
  const sourceUrl = safeUrl(readme.source_url);
  const language = readme.language === "en" ? "en" : readme.language === "zh" ? "zh-CN" : "";
  return `<section class="detail-section readme-section" aria-labelledby="readme-title"><div class="readme-heading"><div><span class="eyebrow">README</span><h2 id="readme-title">README 原文</h2></div>${sourceUrl ? `<a class="secondary-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看完整 README ↗</a>` : ""}</div><details class="readme-details"><summary>展开 README 原文</summary><div class="readme-content"${language ? ` lang="${language}"` : ""}>${renderSafeMarkdown(readme.markdown)}</div></details>${readme.truncated ? `<p class="source-note">README 内容较长，本站已按完整章节截断，请前往 GitHub 查看全文。</p>` : `<p class="source-note">README 已经过安全清洗；远程图片、徽章和仓库内嵌 HTML 不会在本站执行。</p>`}</section>`;
}
