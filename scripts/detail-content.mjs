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

export function readmeSection(project) {
  if (!project.readme_excerpt) return "";
  const readme = safeUrl(project.readme_url);
  const language = project.readme_language === "en"
    ? "en"
    : project.readme_language === "zh"
      ? "zh-CN"
      : "";
  return `<section class="detail-section readme-section"><div class="readme-heading"><div><span class="eyebrow">README EXCERPT</span><h2>README 原文摘录</h2></div>${readme ? `<a class="secondary-link" href="${escapeHtml(readme)}" target="_blank" rel="noopener noreferrer">查看完整 README ↗</a>` : ""}</div><p class="readme-excerpt"${language ? ` lang="${language}"` : ""}>${escapeHtml(project.readme_excerpt)}</p><p class="source-note">仅展示经过清洗的纯文本摘录；代码、图片、徽章和仓库内嵌 HTML 不会在本站执行。</p></section>`;
}
