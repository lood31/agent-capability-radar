# Agent Capability Radar V2 开发进度

> 状态快照：2026-08-10
> 线上网站：https://lood31.github.io/agent-capability-radar/
> GitHub 仓库：https://github.com/lood31/agent-capability-radar
> 数据 schema：`site.json` 1.2，`catalog.json` 1.0

## 1. 产品定位

Agent Capability Radar 面向已经使用或正在构建 Agent 的开发者，发现、理解和比较 GitHub 上的 Agents、Skills、Plugins、MCP 与基础设施。产品坚持真实公开数据、可解释评分、零账号、零数据库、零付费服务；中文摘要只允许版本控制中的人工覆盖，否则回退到 GitHub description。

首页核心命题已经调整为：**为你的 Agent 找到下一项开源能力。**

## 2. V2 已完成

### Schema 1.2 与四层生态分类

- 新增 `ecosystem_layer`、`project_subtype`、`use_cases`、`functional_capabilities`、`summary_zh`、`summary_source`、`features` 与可选 `preview`。
- 旧 `primary_capability`、`capabilities`、`content_type` 继续输出一轮，保证 catalog、历史数据和旧消费者兼容。
- 一级分类固定为 Agents、Skills & Plugins、MCP & Connectors、Infrastructure。
- Agent 成品、专业 Agent 与 Framework 通过二级类型区分；Research 只作为 Agent 子类型或 Use Case。
- MCP、Skill、Memory、Evaluation 等明确形态优先于泛化的 `agent` 关键词，README 只作为低权重补充。
- 普通 `awesome-*` 与资源目录不进入当前榜单；官方资源入口必须通过 `include_resource` 显式例外。
- 当前配置包含3条人工中文摘要覆盖，并明确输出 `summary_source=manual`。

### 开发者优先的发现体验

- 首页使用四张生态频谱卡作为一级入口，显示当前榜单真实数量。
- 原八轨能力地图降级为“功能能力覆盖图”，只回答项目能做什么，不再混用项目形态。
- 搜索覆盖名称、GitHub description、人工中文摘要、生态层、子类型、Use Case、功能能力、语言和 topics。
- 项目类型、Use Case、排序、搜索、生态层与对比选择进入 URL，可收藏和分享。
- 项目卡展示生态层、子类型、可信摘要、Stars、7日增长、语言、License、上手门槛与最多3个能力/场景标签。
- localStorage 支持收藏、My Radar、最近浏览与旧能力偏好的四层迁移。
- Compare 支持同一生态层2–4个项目，以技术数据表为主；不同项目形态不会被强行比较。
- 趋势支持24小时、7日、30日窗口，历史不足时明确显示“数据积累中”。

### 永久静态详情页

- `npm run build` 从永久 catalog 为全部106条档案生成 `/projects/{owner}/{repo}/` 静态详情页。
- 当前非活跃项目继续保留稳定链接，并显示历史收录状态。
- 每个详情页具有独立 title、description、canonical、Open Graph、Twitter Card 与 SoftwareSourceCode JSON-LD。
- 详情页展示项目形态、用途、能力、技术数据、活跃度、接入特征、摘要来源和同类项目。
- 构建时生成包含首页和106个项目页的107条 sitemap URL。
- Preview 只保留可信可选字段；没有官方来源时不抓取、不伪造图片。

### 数据与自动化

- 动态最近30天查询、dry-run零写入、失败不覆盖旧数据、Stars历史与永久catalog语义保持不变。
- 当前发布榜单95项：Agents 53、MCP & Connectors 20、Skills & Plugins 13、Infrastructure 9。
- catalog 共106项：95 active、11 inactive；普通资源目录掉榜但首次发现时间与历史排名保留。
- 六小时定时采集仍只运行Python测试、采集、提交与部署，不运行完整Playwright或Lighthouse。
- 非定时质量任务继续执行Python、Vitest、TypeScript、生产构建和Chromium E2E。

## 3. 当前验证结果

- Python：24项通过，覆盖四层分类、子类型、人工摘要、资源目录例外、动态查询、catalog、dry-run与失败保护。
- Vitest：11项通过，覆盖四层筛选、搜索、排序、计数、同层对比、旧偏好迁移与空compare参数。
- Playwright：双设备16项，15通过、1项桌面按设计跳过移动专属断言。
- Playwright `--repeat-each=5`：75通过、5项按设计跳过，无偶发失败；本地固定2 workers，CI固定1 worker。
- E2E 覆盖四层入口、URL筛选、收藏、同层对比、能力覆盖、静态详情深链、恶意文本、404、移动端溢出和自动浏览器错误收集。
- Axe：首页与静态详情页在桌面和Pixel 7均为零违规。
- 生产构建生成106个详情页与107条 sitemap URL，生产 sourcemap 关闭。
- 本地 Lighthouse 13.4.1：Performance 100、Accessibility 100、Best Practices 100、SEO 100、LCP 1.375秒、CLS 0。
- 本地浏览器：`D:\Chromium\chrome-win\chrome.exe`；CI继续安装Playwright匹配的Chromium。

## 4. 发布状态

- 本轮V2改动已在本地完成并通过质量门禁，尚未提交、推送或部署。
- 线上网站仍是上一轮V1版本；线上Lighthouse和线上smoke需要在本轮代码发布后重新验收。
- 下一次真实采集会直接输出Schema 1.2，并持续维护95项以上的动态榜单和永久catalog。

## 5. 暂不实现

- 不增加账号同步、社区、评论、社交Feed或复杂个人主页。
- 不增加AI摘要、自然语言搜索、AI推荐模型或自动生成文章。
- 不接入第三方埋点；在隐私策略和服务选择明确前只保留本地状态。
- 不缓存不明来源的README图片，不为项目生成虚假Screenshot。
- 暂不移除Schema 1.1遗留字段；清理工作留到Schema 2.0。
- 不修改共享Python依赖、Hermes配置或其他用户文件。

## 6. 关键文件

- 前端：`src/main.ts`、`src/styles.css`、`src/ecosystemViews.ts`
- Schema与采集：`src/types.ts`、`collector/models.py`、`collector/rules.py`、`collector/pipeline.py`
- 数据：`public/data/site.json`、`data/catalog.json`、`data/history/`
- 静态页：`scripts/generate-static-pages.mjs`
- 搜索与人工覆盖：`config/discovery.json`
- 测试：`tests/`、`src/*.test.ts`、`e2e/`
- 自动化：`playwright.config.ts`、`.github/workflows/site.yml`

## 7. 常用验证命令

```powershell
python -m unittest discover -s tests -v
python -m collector --validate public/data/site.json
npm.cmd test
npm.cmd run build
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "D:\Chromium\chrome-win\chrome.exe"
npm.cmd run test:e2e
npm.cmd run test:e2e:repeat
```

真实采集前使用 dry-run；GitHub Actions 使用仓库自动提供的 `secrets.GITHUB_TOKEN`：

```powershell
$env:GITHUB_TOKEN = "你的 GitHub Token"
python -m collector --dry-run
```
