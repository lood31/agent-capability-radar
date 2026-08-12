import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[char]);
}

function safeUrl(value, base) {
  if (String(value ?? "").startsWith("#")) return String(value);
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function repositoryBases(fullName) {
  const repo = String(fullName ?? "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return {};
  return {
    linkBase: `https://github.com/${repo}/blob/HEAD/`,
    imageBase: `https://raw.githubusercontent.com/${repo}/HEAD/`,
  };
}

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false });
markdown.renderer.rules.image = (tokens, index, options, env) => {
  const src = safeUrl(tokens[index].attrGet("src"), env.imageBase);
  const alt = escapeHtml(tokens[index].content || "");
  if (!src) return alt;
  const title = tokens[index].attrGet("title");
  return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${title ? ` title="${escapeHtml(title)}"` : ""}>`;
};
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = safeUrl(tokens[index].attrGet("href"), env.linkBase);
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

export function renderSafeMarkdown(value, fullName) {
  const safeSource = String(value ?? "").replace(
    /\[([^\]]+)\]\(\s*(?:javascript|data|vbscript):[^\n)]*\)\)?/gi,
    "$1",
  );
  const bases = repositoryBases(fullName);
  const rendered = markdown.render(safeSource, bases);
  return sanitizeHtml(rendered, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img", "video", "source",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      p: ["align"],
      div: ["align"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      video: ["src", "width", "height", "controls", "preload", "poster"],
      source: ["src", "type"],
      code: ["class"],
      pre: ["tabindex"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "src", "poster"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        const href = safeUrl(attributes.href, bases.linkBase);
        if (!href) return { tagName: "span", attribs: {} };
        if (href.startsWith("#")) return { tagName: "a", attribs: { href } };
        return { tagName: "a", attribs: { href, target: "_blank", rel: "noopener noreferrer" } };
      },
      img: (_tagName, attributes) => {
        const src = safeUrl(attributes.src, bases.imageBase);
        if (!src) return { tagName: "span", attribs: {} };
        const decorativeIcon = validDimension(attributes.width) && Number(attributes.width) <= 64;
        return {
          tagName: "img",
          attribs: {
            src,
            alt: decorativeIcon ? "" : attributes.alt || "",
            ...(attributes.title ? { title: attributes.title } : {}),
            ...(validDimension(attributes.width) ? { width: attributes.width } : {}),
            ...(validDimension(attributes.height) ? { height: attributes.height } : {}),
            loading: "lazy",
            decoding: "async",
            referrerpolicy: "no-referrer",
          },
        };
      },
      video: (_tagName, attributes) => {
        const src = safeUrl(attributes.src, bases.imageBase);
        return {
          tagName: "video",
          attribs: {
            ...(src ? { src } : {}),
            ...(validDimension(attributes.width) ? { width: attributes.width } : {}),
            ...(validDimension(attributes.height) ? { height: attributes.height } : {}),
            ...(attributes.controls !== undefined ? { controls: "" } : {}),
            preload: "none",
          },
        };
      },
      source: (_tagName, attributes) => {
        const src = safeUrl(attributes.src, bases.imageBase);
        return { tagName: "source", attribs: src ? { src, ...(attributes.type ? { type: attributes.type } : {}) } : {} };
      },
      pre: () => ({ tagName: "pre", attribs: { tabindex: "0" } }),
    },
  }).replace(/<th>\s*<\/th>/g, '<td aria-hidden="true"></td>');
}

function validDimension(value) {
  return /^\d{1,4}$/.test(String(value ?? ""));
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
  const note = readme.source_fidelity === "source_markdown"
    ? readme.truncated
      ? "README 内容超过 80 KB，本站仅按章节边界截断；请前往 GitHub 查看完整原文。"
      : "内容来自仓库 README；本站保留 Markdown 正文并进行安全渲染，原始 HTML 不执行，危险链接不可点击。"
    : "当前展示的是旧版摘要缓存，不是完整原文；请前往 GitHub 查看原始 README，本站将在下一次数据采集后更新。";
  return `<section class="detail-section readme-section" aria-labelledby="readme-title"><div class="readme-heading"><div><span class="eyebrow">README</span><h2 id="readme-title">README</h2></div>${sourceUrl ? `<a class="secondary-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看原始 README ↗</a>` : ""}</div><details class="readme-details"><summary>展开 README</summary><div class="readme-content"${language ? ` lang="${language}"` : ""}>${renderSafeMarkdown(readme.markdown, content.full_name)}</div></details><p class="source-note">${note}</p></section>`;
}
