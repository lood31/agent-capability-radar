import "./styles.css";
import { computePersonalizedScore } from "./preferences";
import { buildCapabilitySummaries, isWithinDays, matchesCapability } from "./projectViews";
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
  includeRelated: boolean;
  query: string;
  prefs: Set<Capability>;
  selected: Project | null;
} = {
  data: null,
  view: "recommended",
  capability: null,
  includeRelated: false,
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
    if (
      state.capability
      && !matchesCapability(project, state.capability, state.includeRelated)
    ) return false;
    if (!query) return true;
    return [project.full_name, project.description ?? "", project.language ?? "", ...project.topics]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(query);
  });

  if (state.view === "research" && !state.capability) {
    projects = projects.filter((project) =>
      matchesCapability(project, "Research & Learning", state.includeRelated),
    );
  }
  if (state.view === "new") {
    projects = projects.filter((project) =>
      isWithinDays(project.created_at, now, state.data!.windows.new_projects_days),
    );
  }

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
      state.includeRelated = false;
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
      state.includeRelated = false;
      state.view = "capabilities";
      render();
    });
    const signal = node("span", state.prefs.has(capability) ? "rail-signal on" : "rail-signal");
    item.append(signal, node("span", "rail-label", CAPABILITY_SHORT[capability]), node("span", "rail-arrow", "↗"));
    item.setAttribute("aria-pressed", String(active));
    aside.append(item);
  }
  const customize = button("customize-button", "调整我的关注能力", () => openPreferences(customize));
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
  const dots = node("span", "capability-dots");
  dots.setAttribute("aria-hidden", "true");
  for (const capability of CAPABILITIES) {
    const dot = node("span", project.capabilities.includes(capability) ? "cap-dot active" : "cap-dot");
    dots.append(dot);
  }
  const related = project.capabilities.filter((item) => item !== project.primary_capability);
  const capabilityLabel = node(
    "span",
    "capability-name",
    `主要能力 · ${CAPABILITY_SHORT[project.primary_capability]}`,
  );
  capabilityLine.append(dots, capabilityLabel);
  if (related.length) {
    capabilityLine.append(
      node("span", "related-capabilities", `相关 · ${related.map((item) => CAPABILITY_SHORT[item]).join(" / ")}`),
    );
  }

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
  const details = button("details-button", "查看能力详情 ↗", () => openProject(project, details));
  trend.append(details);
  card.append(rankBox, body, trend);
  card.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    openProject(project, card);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject(project, card);
    }
  });
  return card;
}

function projectRegion(): HTMLElement {
  if (state.view === "capabilities" && !state.capability) {
    return capabilityMapRegion();
  }
  const section = node("section", "project-region");
  section.id = "project-list";
  const projects = filteredProjects();
  const heading = node("div", "section-heading");
  const headingCopy = node("div");
  const title = state.capability ? CAPABILITY_SHORT[state.capability] : VIEW_LABELS.find(([view]) => view === state.view)?.[1] ?? "项目";
  headingCopy.append(node("span", "eyebrow", "实时能力信号"), node("h2", "", title));
  const headingTools = node("div", "heading-tools");
  if (state.capability) headingTools.append(relatedProjectsToggle());
  const count = node("span", "result-count", `${projects.length} 个项目`);
  count.setAttribute("aria-live", "polite");
  headingTools.append(count);
  heading.append(headingCopy, headingTools);
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

function relatedProjectsToggle(): HTMLElement {
  const label = node("label", "related-toggle");
  const input = node("input");
  input.type = "checkbox";
  input.checked = state.includeRelated;
  input.addEventListener("change", () => {
    state.includeRelated = input.checked;
    renderProjectRegion();
  });
  label.append(input, node("span", "toggle-track"), node("span", "toggle-label", "包含相关项目"));
  return label;
}

function capabilityMapRegion(): HTMLElement {
  const section = node("section", "project-region capability-map-region");
  section.id = "capability-map";
  const heading = node("div", "section-heading capability-map-heading");
  const headingCopy = node("div");
  headingCopy.append(
    node("span", "eyebrow", "八轨能力信号"),
    node("h2", "", "能力地图"),
    node("p", "section-copy", "按主要能力统计当前榜单覆盖。选择一条轨道，查看该分类的代表项目。"),
  );
  const scope = node("span", "result-count", "统计范围 · 当前榜单");
  scope.setAttribute("aria-live", "polite");
  heading.append(headingCopy, scope);
  section.append(heading);

  const source = state.data?.projects.filter((project) => {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    if (!query) return true;
    return [project.full_name, project.description ?? "", project.language ?? "", ...project.topics]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(query);
  }) ?? [];
  const summaries = buildCapabilitySummaries(
    source,
    Date.now(),
    state.data?.windows.new_projects_days ?? 30,
  );
  const maxCount = Math.max(1, ...summaries.map((item) => item.projectCount));
  const grid = node("div", "capability-map-grid");
  summaries.forEach((summary, index) => {
    const card = button("capability-map-card", "", () => {
      state.capability = summary.capability;
      state.includeRelated = false;
      render();
      document.querySelector("#main-content")?.scrollIntoView();
    });
    card.setAttribute(
      "aria-label",
      `${summary.capability}，当前榜单 ${summary.projectCount} 个项目`,
    );
    const top = node("span", "map-card-topline");
    top.append(
      node("span", "map-index", String(index + 1).padStart(2, "0")),
      node("span", "map-count", `${summary.projectCount} 项`),
    );
    const title = node("strong", "map-title", summary.capability);
    const coverage = node("span", "coverage-track");
    const coverageFill = node("span", "coverage-fill");
    coverageFill.style.width = `${(summary.projectCount / maxCount) * 100}%`;
    coverage.append(coverageFill);
    const signals = node("span", "map-signals");
    signals.append(
      node("span", "", `${summary.recentlyUpdated} 个近期更新`),
      node(
        "span",
        summary.growth7 !== null && summary.growth7 > 0 ? "growth-positive" : "",
        summary.growth7 === null ? "7 日数据积累中" : `7 日 +${formatNumber(summary.growth7)} Stars`,
      ),
    );
    const representatives = node("span", "map-projects");
    if (summary.representatives.length) {
      summary.representatives.forEach((project) =>
        representatives.append(node("span", "map-project", project.full_name)),
      );
    } else {
      representatives.append(node("span", "map-project empty", "当前榜单尚无主分类项目"));
    }
    card.append(top, title, coverage, signals, representatives, node("span", "map-enter", "进入轨道 ↗"));
    grid.append(card);
  });
  section.append(grid);
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

function openProject(project: Project, trigger: HTMLElement): void {
  state.selected = project;
  const drawer = node("dialog", "detail-drawer");
  drawer.setAttribute("aria-labelledby", "drawer-title");
  const close = button("drawer-close", "关闭 ×", () => drawer.close());
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
  const capabilityGrid = node("dl", "setup-grid");
  const related = project.capabilities.filter((item) => item !== project.primary_capability);
  capabilityGrid.append(
    node("dt", "", "主要能力"),
    node("dd", "", project.primary_capability),
    node("dt", "", "相关能力"),
    node("dd", "", related.join(" · ") || "无"),
  );
  capabilitySection.append(capabilityGrid);

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
  showDialog(drawer, trigger);
}

function drawerSection(title: string): HTMLElement {
  const section = node("section", "drawer-section");
  section.append(node("h3", "", title));
  return section;
}

function openPreferences(trigger: HTMLElement): void {
  const panel = node("dialog", "preference-panel");
  panel.setAttribute("aria-labelledby", "preference-title");
  const close = button("drawer-close", "关闭 ×", () => panel.close());
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
    panel.close();
    render();
  });
  panel.append(choices, save);
  showDialog(panel, trigger);
}

function showDialog(dialog: HTMLDialogElement, trigger: HTMLElement): void {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      document.body.classList.remove("drawer-open");
      state.selected = null;
      trigger.focus();
    },
    { once: true },
  );
  document.body.append(dialog);
  document.body.classList.add("drawer-open");
  dialog.showModal();
}

function render(): void {
  app.replaceChildren();
  renderHeader(app);
  const main = node("main");
  main.id = "main-content";
  main.tabIndex = -1;
  main.append(renderHero());
  const layout = node("div", "main-layout");
  layout.append(renderRail(), projectRegion());
  main.append(layout);
  app.append(main);
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
    failure.setAttribute("role", "alert");
    failure.append(node("strong", "", "数据没有加载成功"), node("p", "", "请确认 public/data/site.json 存在，然后刷新页面。"), node("code", "", String(error)));
    app.replaceChildren(failure);
  }
}

void bootstrap();
