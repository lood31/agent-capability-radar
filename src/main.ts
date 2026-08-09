import "./styles.css";
import { computePersonalizedScore } from "./preferences";
import { CAPABILITIES, type Capability, type Project, type SiteData, type View } from "./types";

const CAPABILITY_SHORT: Record<Capability, string> = {
  "Agent Core": "Agent",
  "Skills & Prompts": "Skills",
  "MCP & Connectors": "MCP",
  "Browser & Computer Use": "Browser",
  "Memory & Knowledge": "Memory",
  Automation: "Flow",
  "Evaluation & Safety": "Safety",
  "Research & Learning": "Research",
};

const VIEW_LABELS: Array<[View, string]> = [
  ["recommended", "为我推荐"],
  ["capabilities", "能力地图"],
  ["research", "研究学习"],
  ["rising", "增长最快"],
  ["new", "新项目"],
  ["hot", "全站热门"],
];

const DEFAULT_PREFS: Capability[] = [
  "Agent Core",
  "Skills & Prompts",
  "MCP & Connectors",
  "Browser & Computer Use",
  "Memory & Knowledge",
  "Research & Learning",
];

const state: {
  data: SiteData | null;
  view: View;
  capability: Capability | null;
  query: string;
  prefs: Set<Capability>;
  selected: Project | null;
} = {
  data: null,
  view: "recommended",
  capability: null,
  query: "",
  prefs: new Set(loadPrefs()),
  selected: null,
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App root not found");
const app: HTMLDivElement = appRoot;

function loadPrefs(): Capability[] {
  try {
    const stored = JSON.parse(localStorage.getItem("agent-radar-preferences") ?? "[]") as string[];
    const valid = stored.filter((item): item is Capability => CAPABILITIES.includes(item as Capability));
    return valid.length ? valid : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(): void {
  localStorage.setItem("agent-radar-preferences", JSON.stringify([...state.prefs]));
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = node("button", className, text);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "今天更新";
  if (days === 1) return "昨天更新";
  return `${days} 天前更新`;
}

function safeExternalUrl(value: string | null, githubOnly = false): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (githubOnly && parsed.hostname !== 'github.com') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function personalizedScore(project: Project): number {
  return computePersonalizedScore(project, state.prefs);
}

function filteredProjects(): Project[] {
  if (!state.data) return [];
  const query = state.query.trim().toLocaleLowerCase("zh-CN");
  const now = Date.now();
  let projects = state.data.projects.filter((project) => {
    if (state.capability && !project.capabilities.includes(state.capability)) return false;
    if (!query) return true;
    return [project.full_name, project.description ?? "", project.language ?? "", ...project.topics]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(query);
  });

  if (state.view === "research") projects = projects.filter((p) => p.capabilities.includes("Research & Learning"));
  if (state.view === "new") projects = projects.filter((p) => now - new Date(p.created_at).getTime() <= 90 * 86_400_000);

  return projects.sort((a, b) => {
    if (state.view === "rising") return (b.growth.day_7 ?? -1) - (a.growth.day_7 ?? -1);
    if (state.view === "hot") return b.quality_score - a.quality_score;
    if (state.view === "new") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return personalizedScore(b) - personalizedScore(a);
  });
}

function sparkline(values: number[], label: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("sparkline");
  svg.setAttribute("viewBox", "0 0 112 32");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const safe = values.filter(Number.isFinite);
  if (safe.length < 2) return svg;
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;
  const points = safe.map((value, index) => `${(index / (safe.length - 1)) * 108 + 2},${29 - ((value - min) / range) * 24}`).join(" ");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(line);
  return svg;
}

function renderHeader(root: HTMLElement): void {
  const header = node("header", "site-header");
  const brand = node("a", "brand");
  brand.href = "./";
  brand.setAttribute("aria-label", "Agent 能力雷达首页");
  brand.append(node("span", "brand-mark", "AR"), node("span", "brand-name", "Agent 能力雷达"));

  const status = node("div", "data-status");
  const statusDot = node("span", `status-dot ${state.data?.collection_status ?? "stale"}`);
  const statusText = state.data
    ? `${state.data.collection_status === "demo" ? "示例数据" : "数据在线"} · ${new Date(state.data.generated_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "正在连接数据";
  status.append(statusDot, node("span", "", statusText));
  header.append(brand, status);

  const nav = node("nav", "top-nav");
  nav.setAttribute("aria-label", "主要栏目");
  for (const [view, label] of VIEW_LABELS) {
    const item = button(view === state.view ? "nav-item active" : "nav-item", label, () => {
      state.view = view;
      state.capability = view === "research" ? "Research & Learning" : null;
      render();
    });
    item.setAttribute("aria-current", view === state.view ? "page" : "false");
    nav.append(item);
  }
  root.append(header, nav);
}

function renderRail(): HTMLElement {
  const aside = node("aside", "capability-rail");
  const heading = node("div", "rail-heading");
  heading.append(node("span", "eyebrow", "能力轨道"), node("span", "rail-count", `${state.prefs.size}/8 已关注`));
  aside.append(heading);
  for (const capability of CAPABILITIES) {
    const active = state.capability === capability;
    const item = button(active ? "rail-item active" : "rail-item", "", () => {
      state.capability = active ? null : capability;
      state.view = capability === "Research & Learning" ? "research" : "capabilities";
      render();
    });
    const signal = node("span", state.prefs.has(capability) ? "rail-signal on" : "rail-signal");
    item.append(signal, node("span", "rail-label", CAPABILITY_SHORT[capability]), node("span", "rail-arrow", "↗"));
    item.setAttribute("aria-pressed", String(active));
    aside.append(item);
  }
  const customize = button("customize-button", "调整我的关注能力", () => openPreferences());
  aside.append(customize);
  return aside;
}

function renderHero(): HTMLElement {
  const hero = node("section", "hero");
  const copy = node("div", "hero-copy");
  copy.append(
    node("span", "eyebrow", "你的开源能力补给站"),
    node("h1", "", "今天，给你的 Agent 装上什么？"),
    node("p", "hero-lead", "从 Skills、MCP 到研究工作流，用可验证的信号找到真正值得接入的开源能力。"),
  );
  const search = node("label", "search-box");
  search.append(node("span", "search-icon", "⌕"));
  const input = node("input");
  input.type = "search";
  input.placeholder = "搜索项目、语言或 topic";
  input.value = state.query;
  input.setAttribute("aria-label", "搜索项目");
  input.addEventListener("input", () => {
    state.query = input.value;
    renderProjectRegion();
  });
  search.append(input);
  copy.append(search);

  const top = filteredProjects()[0];
  const signal = node("div", "hero-signal");
  signal.append(node("span", "eyebrow", "当前最强信号"));
  if (top) {
    signal.append(node("strong", "signal-project", top.full_name), node("span", "signal-score", `${personalizedScore(top)} 匹配`));
    const track = node("div", "signal-track");
    for (const capability of CAPABILITIES) {
      const dot = node("span", top.capabilities.includes(capability) ? "track-node active" : "track-node");
      dot.title = CAPABILITY_SHORT[capability];
      track.append(dot);
    }
    signal.append(track, node("p", "signal-reason", top.recommendation_reasons[0] ?? "符合你的关注方向"));
  } else {
    signal.append(node("p", "signal-reason", "调整筛选，发现新的能力信号。"));
  }
  hero.append(copy, signal);
  return hero;
}

function projectCard(project: Project, rank: number): HTMLElement {
  const card = node("article", "project-card");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `查看 ${project.full_name} 详情`);
  const rankBox = node("div", "rank-box");
  rankBox.append(node("span", "rank-label", "SIGNAL"), node("strong", "rank-number", String(rank).padStart(2, "0")));

  const body = node("div", "project-body");
  const header = node("div", "project-header");
  const titleWrap = node("div");
  titleWrap.append(node("span", "project-type", project.content_type), node("h2", "project-title", project.full_name));
  const score = node("div", "score-orbit");
  score.style.setProperty("--score", `${personalizedScore(project) * 3.6}deg`);
  score.append(node("strong", "", String(personalizedScore(project))), node("span", "", "匹配"));
  header.append(titleWrap, score);

  const description = node("p", "project-description", project.description || "该项目暂未提供描述。");
  const capabilityLine = node("div", "capability-line");
  for (const capability of CAPABILITIES) {
    const dot = node("span", project.capabilities.includes(capability) ? "cap-dot active" : "cap-dot");
    dot.setAttribute("aria-label", `${CAPABILITY_SHORT[capability]}${project.capabilities.includes(capability) ? "：匹配" : "：未匹配"}`);
    capabilityLine.append(dot);
  }
  const capabilityLabel = node("span", "capability-name", CAPABILITY_SHORT[project.primary_capability]);
  capabilityLine.append(capabilityLabel);

  const reason = node("p", "recommendation-reason", project.recommendation_reasons[0] ?? "符合当前筛选条件");
  const meta = node("div", "project-meta");
  meta.append(
    node("span", "", `★ ${formatNumber(project.stars)}`),
    node("span", project.growth.day_7 !== null && project.growth.day_7 > 0 ? "growth-positive" : "", project.growth.day_7 === null ? "7 日数据积累中" : `↗ ${formatNumber(project.growth.day_7)} / 7天`),
    node("span", "", project.language ?? "多语言"),
    node("span", "", relativeTime(project.pushed_at)),
  );
  body.append(header, description, capabilityLine, reason, meta);

  const trend = node("div", "trend-box");
  trend.append(node("span", "trend-label", "30D SIGNAL"), sparkline(project.growth.sparkline, `${project.full_name} 近期 Stars 趋势`));
  const details = button("details-button", "查看能力详情 ↗", () => openProject(project));
  trend.append(details);
  card.append(rankBox, body, trend);
  card.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    openProject(project);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject(project);
    }
  });
  return card;
}

function projectRegion(): HTMLElement {
  const section = node("section", "project-region");
  section.id = "project-list";
  const projects = filteredProjects();
  const heading = node("div", "section-heading");
  const headingCopy = node("div");
  const title = state.capability ? CAPABILITY_SHORT[state.capability] : VIEW_LABELS.find(([view]) => view === state.view)?.[1] ?? "项目";
  headingCopy.append(node("span", "eyebrow", "实时能力信号"), node("h2", "", title));
  heading.append(headingCopy, node("span", "result-count", `${projects.length} 个项目`));
  section.append(heading);
  const list = node("div", "project-list");
  if (!projects.length) {
    const empty = node("div", "empty-state");
    empty.append(node("strong", "", "没有匹配的项目"), node("p", "", "换一个关键词或清除能力筛选后再试。"));
    list.append(empty);
  } else {
    projects.forEach((project, index) => list.append(projectCard(project, index + 1)));
  }
  section.append(list);
  return section;
}

function renderProjectRegion(): void {
  const current = document.querySelector(".project-region");
  const replacement = projectRegion();
  current?.replaceWith(replacement);
}

function renderFooter(root: HTMLElement): void {
  const footer = node("footer", "site-footer");
  footer.append(
    node("p", "", "由 GitHub 公开数据与透明规则生成，不使用 AI 摘要。"),
    node("p", "mono", state.data ? `schema ${state.data.schema_version} · ${state.data.stats.history_days} 天历史` : "等待数据"),
  );
  root.append(footer);
}

function openProject(project: Project): void {
  state.selected = project;
  const overlay = node("div", "drawer-overlay");
  const drawer = node("aside", "detail-drawer");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "drawer-title");
  const close = button("drawer-close", "关闭 ×", closeDrawer);
  const intro = node("div", "drawer-intro");
  intro.append(node("span", "project-type", project.content_type), node("h2", "", project.full_name));
  intro.querySelector("h2")!.id = "drawer-title";
  intro.append(node("p", "", project.description || "该项目暂未提供描述。"));

  const scores = node("div", "drawer-scores");
  [["质量", project.quality_score], ["适配", project.fit_score], ["推荐", personalizedScore(project)]].forEach(([label, value]) => {
    const box = node("div", "drawer-score");
    box.append(node("strong", "", String(value)), node("span", "", String(label)));
    scores.append(box);
  });

  const capabilitySection = drawerSection("增强的能力");
  const chips = node("div", "chips");
  project.capabilities.forEach((item) => chips.append(node("span", "chip", item)));
  capabilitySection.append(chips);

  const why = drawerSection("为什么推荐");
  const reasonList = node("ul", "reason-list");
  project.recommendation_reasons.forEach((item) => reasonList.append(node("li", "", item)));
  why.append(reasonList);

  const setup = drawerSection("接入信息");
  const setupGrid = node("dl", "setup-grid");
  const rows: Array<[string, string]> = [
    ["配置难度", { easy: "容易", medium: "中等", advanced: "进阶" }[project.setup_level]],
    ["运行平台", project.platforms.join(" · ") || "未识别"],
    ["接入方式", project.integration_methods.join(" · ") || "未识别"],
    ["本地优先", project.local_first ? "是" : "否或未知"],
    ["外部服务", project.external_service_required ? "需要" : "未发现强制依赖"],
  ];
  rows.forEach(([term, value]) => setupGrid.append(node("dt", "", term), node("dd", "", value)));
  setup.append(setupGrid);

  const evidence = drawerSection("分类依据");
  evidence.append(node("p", "drawer-evidence", project.classification_evidence.join("；") || "由仓库公开元数据判定。"));

  const actions = node("div", "drawer-actions");
  const github = node("a", "primary-link", "打开 GitHub ↗");
  github.href = safeExternalUrl(project.url, true) ?? "https://github.com";
  github.target = "_blank";
  github.rel = "noopener noreferrer";
  actions.append(github);
  const safeHomepage = safeExternalUrl(project.homepage);
  if (safeHomepage) {
    const homepage = node("a", "secondary-link", "项目主页");
    homepage.href = safeHomepage;
    homepage.target = "_blank";
    homepage.rel = "noopener noreferrer";
    actions.append(homepage);
  }
  drawer.append(close, intro, scores, capabilitySection, why, setup, evidence, actions);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDrawer();
  });
  overlay.append(drawer);
  document.body.append(overlay);
  document.body.classList.add("drawer-open");
  close.focus();
  document.addEventListener("keydown", escapeDrawer);
}

function drawerSection(title: string): HTMLElement {
  const section = node("section", "drawer-section");
  section.append(node("h3", "", title));
  return section;
}

function escapeDrawer(event: KeyboardEvent): void {
  if (event.key === "Escape") closeDrawer();
}

function closeDrawer(): void {
  document.querySelector(".drawer-overlay")?.remove();
  document.body.classList.remove("drawer-open");
  document.removeEventListener("keydown", escapeDrawer);
  state.selected = null;
}

function openPreferences(): void {
  const overlay = node("div", "drawer-overlay");
  const panel = node("section", "preference-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "preference-title");
  const close = button("drawer-close", "关闭 ×", () => overlay.remove());
  panel.append(close, node("span", "eyebrow", "只保存在这个浏览器"), node("h2", "", "你想增强哪些能力？"), node("p", "panel-copy", "选择会立即改变“为我推荐”的排序，不需要账号。"));
  panel.querySelector("h2")!.id = "preference-title";
  const choices = node("div", "preference-grid");
  for (const capability of CAPABILITIES) {
    const label = node("label", "preference-choice");
    const input = node("input");
    input.type = "checkbox";
    input.checked = state.prefs.has(capability);
    input.addEventListener("change", () => {
      if (input.checked) state.prefs.add(capability);
      else state.prefs.delete(capability);
      savePrefs();
    });
    label.append(input, node("span", "", capability));
    choices.append(label);
  }
  const save = button("primary-button", "保存并重新排序", () => {
    overlay.remove();
    render();
  });
  panel.append(choices, save);
  overlay.append(panel);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.append(overlay);
  close.focus();
}

function render(): void {
  app.replaceChildren();
  renderHeader(app);
  app.append(renderHero());
  const layout = node("main", "main-layout");
  layout.append(renderRail(), projectRegion());
  app.append(layout);
  renderFooter(app);
}

async function bootstrap(): Promise<void> {
  app.replaceChildren(node("div", "loading-screen", "正在扫描开源能力信号…"));
  try {
    const response = await fetch("./data/site.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = (await response.json()) as SiteData;
    render();
  } catch (error) {
    const failure = node("main", "fatal-state");
    failure.append(node("strong", "", "数据没有加载成功"), node("p", "", "请确认 public/data/site.json 存在，然后刷新页面。"), node("code", "", String(error)));
    app.replaceChildren(failure);
  }
}

void bootstrap();
