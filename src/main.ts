import "./styles.css";
import { computePersonalizedScore } from "./preferences";
import {
  canCompare,
  dataFreshness,
  filterAndSortProjects,
  layerCounts,
  migrateLegacyPreferences,
  parseCompareIds,
  projectPath,
} from "./ecosystemViews";
import {
  ECOSYSTEM_LAYERS,
  type BrowseFilters,
  type EcosystemLayer,
  type Project,
  type SiteData,
  type SortMode,
  type View,
} from "./types";

const LAYER_COPY: Record<EcosystemLayer, { short: string; description: string; code: string }> = {
  Agents: { short: "Agents", code: "A", description: "可运行 Agent、专业 Agent 与开发框架" },
  "Skills & Plugins": { short: "Skills", code: "S", description: "为现有 Agent 增加可复用工作能力" },
  "MCP & Connectors": { short: "MCP", code: "M", description: "连接数据、工具与外部服务" },
  Infrastructure: { short: "Infra", code: "I", description: "记忆、编排、评测、可观测与安全" },
};

const VIEW_LABELS: Array<[View, string]> = [
  ["discover", "发现"], ["trending", "趋势"], ["capabilities", "能力覆盖"],
  ["saved", "My Radar"], ["compare", "对比"],
];

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App root not found");
const app: HTMLDivElement = appRoot;

const state: {
  data: SiteData | null;
  view: View;
  filters: BrowseFilters;
  trendWindow: "day_1" | "day_7" | "day_30";
  saved: Set<number>;
  recent: number[];
  compare: Set<number>;
  preferences: Set<EcosystemLayer>;
} = {
  data: null,
  view: "discover",
  filters: { layer: null, subtype: "", useCase: "", query: "", sort: "recommended" },
  trendWindow: "day_7",
  saved: new Set(loadNumberList("agent-radar-saved")),
  recent: loadNumberList("agent-radar-recent"),
  compare: new Set(),
  preferences: new Set(loadPreferences()),
};

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(className: string, text: string, action: () => void): HTMLButtonElement {
  const element = node("button", className, text);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}

function loadNumberList(key: string): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)).slice(0, 24) : [];
  } catch { return []; }
}

function loadPreferences(): EcosystemLayer[] {
  try {
    const current = JSON.parse(localStorage.getItem("agent-radar-ecosystem-preferences") ?? "null");
    if (Array.isArray(current)) return migrateLegacyPreferences(current);
    const legacy = JSON.parse(localStorage.getItem("agent-radar-preferences") ?? "[]");
    const migrated = migrateLegacyPreferences(Array.isArray(legacy) ? legacy : []);
    const result = migrated.length ? migrated : [...ECOSYSTEM_LAYERS];
    localStorage.setItem("agent-radar-ecosystem-preferences", JSON.stringify(result));
    return result;
  } catch { return [...ECOSYSTEM_LAYERS]; }
}

function persistNumberSet(key: string, values: Iterable<number>): void {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000));
  return days === 0 ? "今天更新" : days === 1 ? "昨天更新" : `${days} 天前更新`;
}

function projectSummary(project: Project): string {
  return project.summary_zh?.trim() || project.description?.trim() || "该项目暂未提供可验证的简介。";
}

function readUrlState(): void {
  const params = new URLSearchParams(location.search);
  const view = params.get("view") as View | null;
  if (VIEW_LABELS.some(([candidate]) => candidate === view)) state.view = view!;
  const layer = params.get("layer") as EcosystemLayer | null;
  state.filters.layer = ECOSYSTEM_LAYERS.includes(layer as EcosystemLayer) ? layer : null;
  state.filters.subtype = params.get("subtype") ?? "";
  state.filters.useCase = params.get("usecase") ?? "";
  state.filters.query = params.get("q") ?? "";
  const sort = params.get("sort") as SortMode | null;
  if (["recommended", "trending", "stars", "updated", "newest"].includes(sort ?? "")) state.filters.sort = sort!;
  const period = params.get("period");
  if (["day_1", "day_7", "day_30"].includes(period ?? "")) state.trendWindow = period as typeof state.trendWindow;
  state.compare = new Set(parseCompareIds(params.get("compare")));
}

function writeUrlState(replace = false): void {
  const params = new URLSearchParams();
  if (state.view !== "discover") params.set("view", state.view);
  if (state.filters.layer) params.set("layer", state.filters.layer);
  if (state.filters.subtype) params.set("subtype", state.filters.subtype);
  if (state.filters.useCase) params.set("usecase", state.filters.useCase);
  if (state.filters.query) params.set("q", state.filters.query);
  if (state.filters.sort !== "recommended") params.set("sort", state.filters.sort);
  if (state.view === "trending") params.set("period", state.trendWindow);
  if (state.compare.size) params.set("compare", [...state.compare].join(","));
  const url = `${location.pathname}${params.size ? `?${params}` : ""}`;
  history[replace ? "replaceState" : "pushState"](null, "", url);
}

function setView(view: View): void {
  state.view = view;
  if (view === "trending") state.filters.sort = "trending";
  writeUrlState();
  render();
}

function allProjects(): Project[] { return state.data?.projects ?? []; }

function visibleProjects(): Project[] {
  let projects = filterAndSortProjects(allProjects(), state.filters);
  if (state.view === "saved") projects = projects.filter((project) => state.saved.has(project.id));
  if (state.view === "trending") {
    const key = state.trendWindow;
    projects.sort((a, b) => (b.growth[key] ?? -1) - (a.growth[key] ?? -1));
  }
  if (state.filters.sort === "recommended") {
    projects.sort((a, b) => computePersonalizedScore(b, state.preferences) - computePersonalizedScore(a, state.preferences));
  }
  return projects;
}

function renderHeader(root: HTMLElement): void {
  const header = node("header", "site-header");
  const brand = node("a", "brand"); brand.href = "./";
  brand.append(node("span", "brand-mark", "AR"), node("span", "brand-name", "Agent Capability Radar"));
  const freshness = state.data ? dataFreshness(state.data) : null;
  const statusLabel = freshness === "live" ? "LIVE" : freshness === "demo" ? "DEMO DATA" : "STALE DATA";
  const status = node("span", `data-status ${freshness ?? "stale"}`, state.data ? `${statusLabel} · ${new Date(state.data.generated_at).toLocaleString("zh-CN")}` : "CONNECTING");
  status.title = state.data ? `Snapshot generated ${new Date(state.data.generated_at).toISOString()}` : "Loading snapshot";
  header.append(brand, status);
  const nav = node("nav", "top-nav"); nav.setAttribute("aria-label", "主要栏目");
  for (const [view, label] of VIEW_LABELS) {
    const count = view === "saved" ? ` ${state.saved.size}` : view === "compare" ? ` ${state.compare.size}` : "";
    const item = button(view === state.view ? "nav-item active" : "nav-item", `${label}${count}`, () => setView(view));
    if (view === state.view) item.setAttribute("aria-current", "page");
    nav.append(item);
  }
  root.append(header, nav);
}

function renderHero(): HTMLElement {
  const hero = node("section", "hero");
  const copy = node("div", "hero-copy");
  copy.append(node("span", "eyebrow", "GITHUB AGENT ECOSYSTEM · VERIFIED SIGNALS"));
  const heading = node("h1"); heading.append("为你的 Agent 找到", node("span", "accent", "下一项开源能力"), "。");
  copy.append(heading, node("p", "hero-lead", "发现和比较 GitHub 上的 Agents、Skills、Plugins、MCP 与基础设施。先看清它是什么，再决定是否接入。"));
  const search = node("label", "search-box");
  search.append(node("span", "search-icon", "⌕"));
  const input = node("input"); input.type = "search"; input.value = state.filters.query;
  input.placeholder = "搜索项目、用例、能力或技术"; input.setAttribute("aria-label", "搜索生态项目");
  input.addEventListener("input", () => { state.filters.query = input.value; writeUrlState(true); renderContent(); });
  search.append(input); copy.append(search);

  const data = state.data!;
  const stats = node("dl", "hero-stats");
  [["当前榜单", data.stats.published], ["候选项目", data.stats.candidates], ["历史数据", `${data.stats.history_days} 天`]].forEach(([term, value]) => {
    stats.append(node("div", "stat-cell")); const cell = stats.lastElementChild!;
    cell.append(node("dt", "", String(term)), node("dd", "", typeof value === "number" ? formatNumber(value) : value));
  });
  hero.append(copy, stats);
  return hero;
}

function renderSpectrum(): HTMLElement {
  const section = node("section", "spectrum"); section.setAttribute("aria-labelledby", "spectrum-title");
  const top = node("div", "section-heading");
  const copy = node("div"); copy.append(node("span", "eyebrow", "ECOSYSTEM LAYERS"), node("h2", "", "先选择项目形态")); copy.querySelector("h2")!.id = "spectrum-title";
  top.append(copy, node("p", "section-copy", "项目是什么，与它能做什么，分开浏览。")); section.append(top);
  const counts = layerCounts(allProjects()); const grid = node("div", "spectrum-grid");
  ECOSYSTEM_LAYERS.forEach((layer, index) => {
    const active = state.filters.layer === layer;
    const item = button(active ? "spectrum-card active" : "spectrum-card", "", () => {
      state.filters.layer = active ? null : layer; state.filters.subtype = ""; state.filters.useCase = ""; state.view = "discover"; writeUrlState(); render();
    });
    item.setAttribute("aria-pressed", String(active));
    item.append(node("span", "spectrum-code", `${String(index + 1).padStart(2, "0")} / ${LAYER_COPY[layer].code}`), node("strong", "", layer), node("span", "spectrum-description", LAYER_COPY[layer].description), node("span", "spectrum-count", `${counts.get(layer) ?? 0} 项`));
    grid.append(item);
  });
  section.append(grid); return section;
}

function selectControl(labelText: string, value: string, options: string[], onChange: (value: string) => void): HTMLLabelElement {
  const label = node("label", "filter-control"); label.append(node("span", "", labelText));
  const select = node("select"); select.value = value;
  select.append(new Option("全部", "")); options.forEach((option) => select.append(new Option(option, option)));
  select.addEventListener("change", () => onChange(select.value)); label.append(select); return label;
}

function renderFilters(): HTMLElement {
  const controls = node("div", "filter-bar");
  const source = state.filters.layer ? allProjects().filter((p) => p.ecosystem_layer === state.filters.layer) : allProjects();
  const subtypes = [...new Set(source.map((p) => p.project_subtype))].sort();
  const useCases = [...new Set(source.flatMap((p) => p.use_cases))].sort();
  controls.append(
    selectControl("项目类型", state.filters.subtype, subtypes, (value) => { state.filters.subtype = value; writeUrlState(true); renderContent(); }),
    selectControl("使用场景", state.filters.useCase, useCases, (value) => { state.filters.useCase = value; writeUrlState(true); renderContent(); }),
  );
  const sortLabel = node("label", "filter-control"); sortLabel.append(node("span", "", "排序"));
  const sort = node("select");
  const modes: Array<[SortMode, string]> = [["recommended", "综合推荐"], ["trending", "7日增长"], ["stars", "Stars"], ["updated", "最近更新"], ["newest", "最新创建"]];
  modes.forEach(([value, label]) => sort.append(new Option(label, value))); sort.value = state.filters.sort;
  sort.addEventListener("change", () => { state.filters.sort = sort.value as SortMode; writeUrlState(true); renderContent(); });
  sortLabel.append(sort); controls.append(sortLabel);
  const clear = button("clear-button", "清除筛选", () => { state.filters = { layer: null, subtype: "", useCase: "", query: "", sort: "recommended" }; writeUrlState(); render(); });
  controls.append(clear); return controls;
}

function markRecent(project: Project): void {
  state.recent = [project.id, ...state.recent.filter((id) => id !== project.id)].slice(0, 12);
  localStorage.setItem("agent-radar-recent", JSON.stringify(state.recent));
}

function toggleSaved(project: Project): void {
  state.saved.has(project.id) ? state.saved.delete(project.id) : state.saved.add(project.id);
  persistNumberSet("agent-radar-saved", state.saved); renderContent(); renderHeaderCounts();
}

function toggleCompare(project: Project): void {
  if (state.compare.has(project.id)) state.compare.delete(project.id);
  else {
    const selected = allProjects().filter((item) => state.compare.has(item.id));
    if (state.compare.size >= 4 || (selected.length && !selected.every((item) => item.ecosystem_layer === project.ecosystem_layer))) return;
    state.compare.add(project.id);
  }
  writeUrlState(true); renderContent(); renderHeaderCounts();
}

function renderHeaderCounts(): void {
  const old = app.querySelector(".top-nav");
  if (!old) return;
  const holder = node("div"); renderHeader(holder); old.replaceWith(holder.querySelector(".top-nav")!);
}

function projectCard(project: Project, rank: number): HTMLElement {
  const card = node("article", "project-card");
  const side = node("div", "rank-box"); side.append(node("span", "rank-label", "SIGNAL"), node("strong", "rank-number", String(rank).padStart(2, "0")));
  const body = node("div", "project-body");
  const category = node("div", "project-category"); category.append(node("span", "layer-pill", project.ecosystem_layer), node("span", "subtype", project.project_subtype));
  const heading = node("h2", "project-title"); const title = node("a", "", project.full_name); title.href = projectPath(project); title.addEventListener("click", () => markRecent(project)); heading.append(title);
  body.append(category, heading, node("p", "project-description", projectSummary(project)));
  const tags = node("ul", "tag-list");
  [...project.functional_capabilities, ...project.use_cases].slice(0, 3).forEach((tag) => tags.append(node("li", "", tag)));
  if (tags.children.length) body.append(tags);
  const meta = node("div", "project-meta");
  meta.append(node("span", "", `★ ${formatNumber(project.stars)}`), node("span", project.growth.day_7 && project.growth.day_7 > 0 ? "growth-positive" : "", project.growth.day_7 === null ? "7日数据积累中" : `+${formatNumber(project.growth.day_7)} / 7天`), node("span", "", project.language ?? "多语言"), node("span", "", project.license ?? "License 未识别"), node("span", "", relativeTime(project.pushed_at)));
  body.append(meta);
  const actions = node("div", "card-actions");
  const detail = node("a", "details-link", "查看详情 ↗"); detail.href = projectPath(project); detail.addEventListener("click", () => markRecent(project));
  const save = button(state.saved.has(project.id) ? "icon-button active" : "icon-button", state.saved.has(project.id) ? "已收藏" : "收藏", () => toggleSaved(project)); save.setAttribute("aria-pressed", String(state.saved.has(project.id)));
  const compare = button(state.compare.has(project.id) ? "icon-button active" : "icon-button", state.compare.has(project.id) ? "已加入对比" : "加入对比", () => toggleCompare(project)); compare.setAttribute("aria-pressed", String(state.compare.has(project.id)));
  actions.append(detail, save, compare);
  const score = node("div", "score-orbit"); score.style.setProperty("--score", `${project.recommendation_score * 3.6}deg`); score.append(node("strong", "", String(project.recommendation_score)), node("span", "", "推荐"));
  card.append(side, body, score, actions); return card;
}

function renderProjectList(): HTMLElement {
  const section = node("section", "project-region"); section.id = "project-list";
  const projects = visibleProjects(); const heading = node("div", "list-heading");
  const title = state.view === "saved" ? "我的收藏" : state.view === "trending" ? "增长信号" : state.filters.layer ?? "全部生态项目";
  const copy = node("div"); copy.append(node("span", "eyebrow", "CURRENT CATALOG"), node("h2", "", title));
  const count = node("span", "result-count", `${projects.length} 个项目`); count.setAttribute("aria-live", "polite"); heading.append(copy, count); section.append(heading);
  if (state.view === "trending") section.append(renderTrendTabs());
  section.append(renderFilters());
  const list = node("div", "project-list");
  if (!projects.length) {
    const empty = node("div", "empty-state"); empty.append(node("strong", "", state.view === "saved" ? "还没有收藏项目" : "没有匹配的项目"), node("p", "", "尝试清除一个筛选条件，或切换到其他生态层。")); list.append(empty);
  } else projects.forEach((project, index) => list.append(projectCard(project, index + 1)));
  section.append(list); return section;
}

function renderTrendTabs(): HTMLElement {
  const tabs = node("div", "period-tabs"); tabs.setAttribute("aria-label", "趋势周期");
  const options: Array<[typeof state.trendWindow, string]> = [["day_1", "24H"], ["day_7", "7 Days"], ["day_30", "30 Days"]];
  options.forEach(([value, label]) => {
    const item = button(value === state.trendWindow ? "period-button active" : "period-button", label, () => { state.trendWindow = value; writeUrlState(true); renderContent(); });
    item.setAttribute("aria-pressed", String(value === state.trendWindow)); tabs.append(item);
  }); return tabs;
}

function renderCapabilities(): HTMLElement {
  const section = node("section", "project-region");
  const heading = node("div", "list-heading"); const copy = node("div");
  copy.append(node("span", "eyebrow", "FUNCTIONAL COVERAGE"), node("h2", "", "能力覆盖图"), node("p", "section-copy", "统计当前榜单中的功能标签；它回答“能做什么”，不再承担项目类型导航。"));
  heading.append(copy, node("span", "result-count", "统计范围 · 当前榜单")); section.append(heading);
  const capabilities = [...new Set(allProjects().flatMap((project) => project.functional_capabilities))].sort();
  const grid = node("div", "capability-grid");
  capabilities.forEach((capability, index) => {
    const projects = allProjects().filter((project) => project.functional_capabilities.includes(capability));
    const card = node("article", "capability-card");
    card.append(node("span", "spectrum-code", `${String(index + 1).padStart(2, "0")} / CAPABILITY`), node("h3", "", capability), node("strong", "capability-total", `${projects.length} 项`));
    const bar = node("span", "coverage-track"); const fill = node("span", "coverage-fill"); fill.style.width = `${Math.min(100, projects.length)}%`; bar.append(fill); card.append(bar);
    const reps = node("ul", "representatives"); projects.slice(0, 3).forEach((p) => reps.append(node("li", "", p.full_name))); card.append(reps); grid.append(card);
  }); section.append(grid); return section;
}

function renderCompare(): HTMLElement {
  const section = node("section", "project-region compare-region");
  const projects = allProjects().filter((project) => state.compare.has(project.id));
  const heading = node("div", "list-heading"); const copy = node("div"); copy.append(node("span", "eyebrow", "2–4 PROJECTS · SAME LAYER"), node("h2", "", "技术选型对比")); heading.append(copy, node("span", "result-count", `${projects.length}/4 已选择`)); section.append(heading);
  if (!canCompare(projects)) {
    const empty = node("div", "empty-state"); empty.append(node("strong", "", "请选择同一生态层的 2–4 个项目"), node("p", "", "从项目卡点击“加入对比”；不同项目形态不会被强行放进同一张表。")); section.append(empty); return section;
  }
  const wrapper = node("div", "table-scroll"); const table = node("table", "compare-table");
  const head = node("tr"); head.append(node("th", "", "维度")); projects.forEach((p) => head.append(node("th", "", p.full_name))); const thead = node("thead"); thead.append(head); table.append(thead);
  const body = node("tbody");
  const rows: Array<[string, (p: Project) => string]> = [
    ["项目类型", (p) => p.project_subtype], ["Stars", (p) => formatNumber(p.stars)], ["7日增长", (p) => p.growth.day_7 === null ? "积累中" : `+${formatNumber(p.growth.day_7)}`], ["语言", (p) => p.language ?? "未识别"], ["License", (p) => p.license ?? "未识别"], ["上手门槛", (p) => p.setup_level], ["最近更新", (p) => relativeTime(p.pushed_at)], ["推荐分", (p) => String(p.recommendation_score)],
  ];
  rows.forEach(([label, get]) => { const row = node("tr"); row.append(node("th", "", label)); projects.forEach((p) => row.append(node("td", "", get(p)))); body.append(row); }); table.append(body); wrapper.append(table); section.append(wrapper); return section;
}

function renderContent(): void {
  const old = app.querySelector(".project-region");
  const next = state.view === "capabilities" ? renderCapabilities() : state.view === "compare" ? renderCompare() : renderProjectList();
  old?.replaceWith(next);
}

function renderFooter(root: HTMLElement): void {
  const footer = node("footer", "site-footer");
  footer.append(node("p", "", "公开 GitHub 数据 · 人工摘要明确标注 · 不伪造项目预览"), node("p", "mono", state.data ? `schema ${state.data.schema_version} · ${state.data.stats.history_days} 天历史` : "等待数据")); root.append(footer);
}

function render(): void {
  app.replaceChildren(); renderHeader(app); const main = node("main"); main.id = "main-content"; main.tabIndex = -1;
  main.append(renderHero(), renderSpectrum(), state.view === "capabilities" ? renderCapabilities() : state.view === "compare" ? renderCompare() : renderProjectList()); app.append(main); renderFooter(app);
}

async function bootstrap(): Promise<void> {
  app.replaceChildren(node("div", "loading-screen", "正在校准生态信号…"));
  try {
    const response = await fetch("./data/site.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json() as SiteData; readUrlState(); render();
    addEventListener("popstate", () => { readUrlState(); render(); });
  } catch (error) {
    const failure = node("main", "fatal-state"); failure.setAttribute("role", "alert");
    failure.append(node("strong", "", "数据没有加载成功"), node("p", "", "请确认 public/data/site.json 存在，然后刷新页面。"), node("code", "", String(error))); app.replaceChildren(failure);
  }
}

void bootstrap();
