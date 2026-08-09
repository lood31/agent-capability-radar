# Agent 能力雷达开发进度

> 状态快照：2026-08-09
> 线上网站：https://lood31.github.io/agent-capability-radar/
> GitHub 仓库：https://github.com/lood31/agent-capability-radar
> 数据 schema：`site.json` 1.1，`catalog.json` 1.0

## 1. 产品目标

Agent 能力雷达面向大学生和 Agent 使用者，用 GitHub 公开数据与透明规则发现可增强 Agent、研究和知识工作的开源项目。项目坚持零账号、零数据库、零付费服务，不使用 AI 生成摘要。

## 2. 本轮已完成

### 数据采集与永久档案

- GitHub 搜索支持 `date_field` 与 `window_days`，采集器在运行时生成最近 30 天的 `created:` / `pushed:` 条件，不再写死日期。
- `site.json.windows.new_projects_days` 成为前端“新项目”窗口的唯一数据源。
- 新增 `data/catalog.json`，保存所有曾进入发布榜单的项目。
- catalog 记录最新项目数据以及 `first_seen`、`last_seen`、`last_rank`、`best_rank`、`active`、`last_score`。
- 掉榜项目保留并转为非活跃；重新入榜沿用最初的 `first_seen` 和历史最佳排名。
- dry-run 只构建和校验结果，不写 `site.json`、catalog 或 Stars 历史。
- 空候选、损坏 catalog 或采集失败时，不覆盖已有站点数据。
- 自动化提交范围包含 `site.json`、catalog 与月度 Stars 快照。

### 分类浏览与能力地图

- 能力筛选默认严格匹配 `primary_capability`。
- 进入具体能力后可主动开启“包含相关项目”，开启后才匹配次要 `capabilities`。
- “研究学习”遵循相同的主分类规则。
- 修正示例 MCP 项目的错误 Skills 标签。
- 项目卡片与详情明确区分“主要能力”和“相关能力”，圆点仅作为装饰信号。
- “能力地图”已实现为八张能力信号卡，不再复用普通项目列表。
- 每张卡展示当前榜单项目数、相对覆盖度、前三个代表项目、近期更新数和 7 日 Stars 增长状态。
- 能力地图明确标注统计范围为“当前榜单”；桌面两列、移动一列，点击后进入严格主分类列表。

### 无障碍、SEO 与前端质量

- 品牌链接使用可见文字作为无障碍名称，删除不一致的 `aria-label`。
- 跳过链接稳定指向 `#main-content`，搜索结果数量使用 `aria-live="polite"`。
- 项目详情与偏好面板改为原生 `<dialog>`，支持 Escape、模态背景、Tab 焦点约束和关闭后焦点恢复。
- 移动交互目标不小于 44px，并保留真正关闭动画的 `prefers-reduced-motion` 分支。
- 小号橙色与青绿色文字使用 WCAG AA 深色变量，亮色继续用于装饰。
- 生产构建关闭 sourcemap。
- 增加 canonical、Open Graph、Twitter Card、robots.txt、sitemap.xml、WebSite JSON-LD、referrer policy 与基础 CSP。
- 保留 GitHub Pages 控制的缓存策略和现有小体积阻塞 CSS，不做无收益优化。

### 自动化质量门禁

- 项目正式依赖 `@playwright/test` 1.62.1 与 `@axe-core/playwright` 4.12.1，版本由 lockfile 固定。
- Playwright 测试生产构建与 `vite preview`，覆盖桌面 Chromium 和 Pixel 7。
- 本地零重试；CI 重试一次、单 worker；首次重试保存 trace，失败保存截图。
- E2E 自动捕获 `console.error`、`pageerror` 与失败请求。
- 覆盖首页、搜索、六栏目、八轨地图、严格/相关分类、两个 dialog、移动端溢出、404、空列表、冷启动趋势、恶意文本和 axe 扫描。
- GitHub Actions 在非定时采集事件执行 Python、Vitest、TypeScript/生产构建与 Chromium E2E；六小时定时采集不运行完整浏览器测试或 Lighthouse。
- CI 使用 `npx playwright install --with-deps chromium`，不依赖 Codex/Hermes 内部浏览器包。

## 3. 当前验证结果

- Python：20 项通过。
- Vitest：6 项通过。
- Playwright：双设备 16 项；核心全集 `--repeat-each=5` 共执行 80 次，75 通过，5 次为桌面项目按设计跳过移动专用断言，无偶发失败。
- axe：首页/能力地图、项目详情 dialog、偏好 dialog 在桌面与移动端均为零违规。
- TypeScript 严格检查和 Vite 生产构建通过；生产 sourcemap 已关闭。
- 本地 Lighthouse 13.4.1：Performance 100、Accessibility 100、Best Practices 100、SEO 100、LCP 1.21 秒、CLS 0。
- 线上 Lighthouse 13.4.1：Performance 97、Accessibility 100、Best Practices 100、SEO 100、LCP 1.36 秒、CLS 0。
- 桌面 1440px 与移动 412px 已人工查看；移动 Hero 标题裁切问题已修正。
- 线上 Playwright 移动 smoke：HTTP 200、8 张能力卡、无横向溢出、无 console/page/network 错误。

## 4. 真实采集与线上状态

- 已完成两次 `workflow_dispatch` 真实采集并部署，`collection_status` 为 `live`。
- 每轮发现 254 个候选、发布 100 个项目；采集日志无 API 请求告警。
- 第二轮校正了 README 偶然关键词导致的误报：`awesome-python`、`awesome-go`、`serverless` 已掉榜。
- catalog 当前共 106 条：100 条 active、6 条 inactive；掉榜项目仍保留首轮 `first_seen`，在线验证了永久档案语义。
- Stars 历史已产生两批共 240 行快照，`history_days` 为 1。
- GitHub API 验收时 core 剩余 4962/5000、search 剩余 30/30。
- 远端质量任务、正式 Chromium E2E 和 GitHub Pages 部署均已通过。
- 尚未自然到达下一次六小时 cron；定时路径已配置为只运行 Python 测试、采集、数据提交和部署，不运行完整 Playwright/Lighthouse。

## 5. 暂不实现的边界

- catalog 先作为数据基础，本轮不开发“曾经收录”网页。
- catalog 只保存曾进入发布榜单的项目，不保存全部搜索候选。
- 不引入 AI、账号、数据库或第三方付费服务。
- 不处理稳定项目 URL、项目对比、收藏、导出、组合筛选和历史排名页面。
- 不修改共享 Python 依赖或 Hermes 配置。

## 6. 关键文件

- 前端：`src/main.ts`、`src/styles.css`、`src/projectViews.ts`
- 数据 schema：`src/types.ts`、`public/data/site.json`、`data/catalog.json`
- 采集：`collector/pipeline.py`、`collector/catalog.py`
- 搜索配置：`config/discovery.json`
- Python 测试：`tests/`
- 前端单元测试：`src/*.test.ts`
- 浏览器测试：`e2e/`、`playwright.config.ts`
- 自动化：`.github/workflows/site.yml`

## 7. 常用验证命令

```powershell
python -m unittest discover -s tests -v
python -m collector --validate public/data/site.json
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run test:e2e:repeat
```

真实采集前可在本地使用 dry-run；GitHub Actions 使用仓库自动提供的 `secrets.GITHUB_TOKEN`：

```powershell
$env:GITHUB_TOKEN = "你的 GitHub Token"
python -m collector --dry-run
```
