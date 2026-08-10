import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const origin = "https://lood31.github.io/agent-capability-radar";
const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const assets = await readdir(new URL("../dist/assets/", import.meta.url));
const cssAsset = assets.find((name) => name.endsWith(".css"));
if (!cssAsset) throw new Error("Production CSS asset not found");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[char]);
const cleanText = (value, fallback = "未识别") => escapeHtml(value || fallback);
const projectRoute = (project) => project.full_name.split("/").map(encodeURIComponent).join("/");
const projectUrl = (project) => `${origin}/projects/${projectRoute(project)}/`;
const relativeProjectUrl = (project) => `../../../projects/${projectRoute(project)}/`;
const summary = (project) => project.summary_zh || project.description || "该项目暂未提供可验证的简介。";
const safeUrl = (value) => {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};

function detailHtml(project, similar) {
  const title = `${project.full_name}｜Agent Capability Radar`;
  const description = String(summary(project)).slice(0, 155);
  const features = Object.entries(project.features || {}).filter(([, enabled]) => enabled).map(([name]) => name.replaceAll("_", " "));
  const tags = [...(project.functional_capabilities || []), ...(project.use_cases || [])];
  const github = safeUrl(project.url);
  const homepage = safeUrl(project.homepage);
  const structured = JSON.stringify({
    "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: project.full_name,
    description: summary(project), codeRepository: github, url: projectUrl(project),
    programmingLanguage: project.language || undefined, license: project.license || undefined,
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow">
<meta name="theme-color" content="#f4f7fb"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests">
<link rel="canonical" href="${projectUrl(project)}"><link rel="stylesheet" href="../../../assets/${cssAsset}">
<meta property="og:type" content="website"><meta property="og:locale" content="zh_CN"><meta property="og:url" content="${projectUrl(project)}">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">
<title>${escapeHtml(title)}</title><script type="application/ld+json">${structured}</script>
</head><body><a class="skip-link" href="#main-content">跳到主要内容</a>
<div id="app" class="detail-page"><header class="site-header"><a class="brand" href="../../../"><span class="brand-mark">AR</span><span class="brand-name">Agent Capability Radar</span></a><span class="data-status">CATALOG ARCHIVE</span></header>
<main id="main-content" tabindex="-1">
<nav class="detail-breadcrumb" aria-label="面包屑"><a href="../../../">首页</a><span>/</span><span>${cleanText(project.ecosystem_layer)}</span><span>/</span><span aria-current="page">${cleanText(project.full_name)}</span></nav>
<section class="detail-hero"><div><span class="layer-pill">${cleanText(project.ecosystem_layer)}</span><h1>${cleanText(project.full_name)}</h1><p>${escapeHtml(summary(project))}</p><div class="detail-actions">${github ? `<a class="details-link" href="${escapeHtml(github)}" target="_blank" rel="noopener noreferrer">打开 GitHub ↗</a>` : ""}${homepage ? `<a class="secondary-link" href="${escapeHtml(homepage)}" target="_blank" rel="noopener noreferrer">项目主页 ↗</a>` : ""}</div></div><div class="project-signal"><span class="eyebrow">RECOMMENDATION SIGNAL</span><strong>${Number(project.recommendation_score || project.last_score || 0)}</strong><span>${project.active ? "当前榜单活跃" : "历史收录 · 当前非活跃"}</span></div></section>
<section class="detail-grid"><article><span class="eyebrow">WHAT IT IS</span><h2>30 秒看懂</h2><dl class="detail-facts"><div><dt>项目类型</dt><dd>${cleanText(project.project_subtype)}</dd></div><div><dt>主要用途</dt><dd>${cleanText((project.use_cases || []).join(" · "), "尚未识别")}</dd></div><div><dt>功能能力</dt><dd>${cleanText((project.functional_capabilities || []).join(" · "), "尚未识别")}</dd></div><div><dt>上手门槛</dt><dd>${cleanText(project.setup_level)}</dd></div></dl></article><article><span class="eyebrow">DEVELOPER DATA</span><h2>技术与活跃度</h2><dl class="detail-facts"><div><dt>Stars / Forks</dt><dd>${Number(project.stars).toLocaleString("zh-CN")} / ${Number(project.forks).toLocaleString("zh-CN")}</dd></div><div><dt>语言 / License</dt><dd>${cleanText(project.language)} / ${cleanText(project.license)}</dd></div><div><dt>最近更新</dt><dd>${cleanText(project.pushed_at)}</dd></div><div><dt>首次收录</dt><dd>${cleanText(project.first_seen)}</dd></div></dl></article></section>
<section class="detail-section"><span class="eyebrow">VERIFIED SIGNALS</span><h2>接入与能力标签</h2><ul class="detail-tags">${[...features, ...tags].map((tag) => `<li>${escapeHtml(tag)}</li>`).join("") || "<li>暂无已验证标签</li>"}</ul><p class="source-note">中文摘要来源：${project.summary_source === "manual" ? "人工审核覆盖" : "GitHub 原始 description 回退"}。页面不生成未经验证的项目预览。</p></section>
<section class="detail-section"><span class="eyebrow">SIMILAR PROJECTS</span><h2>继续探索同类项目</h2><div class="similar-grid">${similar.map((item) => `<a href="${relativeProjectUrl(item)}"><span>${escapeHtml(item.project_subtype)}</span><strong>${escapeHtml(item.full_name)}</strong><small>★ ${Number(item.stars).toLocaleString("zh-CN")}</small></a>`).join("") || "<p>当前 catalog 暂无同类项目。</p>"}</div></section>
</main><footer class="site-footer"><p>公开 GitHub 数据 · 永久 catalog 档案</p><p class="mono">schema 1.2</p></footer></div></body></html>`;
}

for (const project of catalog.projects) {
  const segments = projectRoute(project).split("/");
  const directory = join(fileURLToPath(dist), "projects", ...segments);
  await mkdir(directory, { recursive: true });
  const similar = catalog.projects.filter((item) => item.id !== project.id && item.ecosystem_layer === project.ecosystem_layer && item.project_subtype === project.project_subtype).sort((a, b) => Number(b.last_score) - Number(a.last_score)).slice(0, 3);
  await writeFile(join(directory, "index.html"), detailHtml(project, similar), "utf8");
}

const urls = [`${origin}/`, ...catalog.projects.map(projectUrl)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(new URL("../dist/sitemap.xml", import.meta.url), sitemap, "utf8");
