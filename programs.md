# Agent Capability Radar V2 开发进度

> 状态快照：2026-08-12
> 线上网站：https://lood31.github.io/agent-capability-radar/
> GitHub 仓库：https://github.com/lood31/agent-capability-radar
> 数据 schema：`site.json` 1.4，`catalog.json` 1.2，`translations.json` 1.1，项目内容 1.0

## 1. 产品定位

Agent Capability Radar 面向已经使用或正在构建 Agent 的开发者，发现、理解和比较 GitHub 上的 Agents、Skills、Plugins、MCP 与基础设施。产品坚持真实公开数据、可解释评分、零账号与零数据库；中文说明按人工摘要、中文 README、GitHub Models 自动摘要和 GitHub description 的可信优先级回退，来源始终明确展示。

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

- `npm run build` 从永久 catalog 为全部130条档案生成 `/projects/{owner}/{repo}/` 静态详情页。
- 当前非活跃项目继续保留稳定链接，并显示历史收录状态。
- 每个详情页具有独立 title、description、canonical、Open Graph、Twitter Card 与 SoftwareSourceCode JSON-LD。
- 详情页展示项目形态、用途、能力、技术数据、活跃度、接入特征、摘要来源和同类项目。
- 构建时生成包含首页和130个项目页的131条 sitemap URL。
- Preview 只保留可信可选字段；没有官方来源时不抓取、不伪造图片。

### README 摘录与自动中文摘要

- `site.json` 1.3 与 `catalog.json` 1.1 新增 README 摘录、语言、原文链接、内容 hash、摘要状态、模型和更新时间字段；旧 1.2 数据仍可被前端安全加载。
- README 最多清洗前40,000字符，模型输入最多6,000字符，详情页只保存和展示最多1,200字符的纯文本摘录；HTML、图片、徽章、代码块、表格和纯链接段落不会被渲染。
- 摘要优先级固定为人工 override → 中文 README 摘录 → 当前 hash 的模型摘要 → stale 旧摘要 → GitHub description。
- `data/translations.json` 只按仓库 ID 与 README hash 缓存摘要、模型、时间和标准化错误码，不保存完整 README。
- GitHub Models 使用 `openai/gpt-4.1-mini`，每轮最多20项；403、429、超时或无效 JSON 不阻塞采集和部署，dry-run 不调用模型也不写缓存。
- 首页卡片显示四类摘要来源；详情页显示 README、语言属性、GitHub 原始 README 链接，以及 AI 内容偏差提示。
- 搜索新增中文摘要和 README 摘录；`site.json` 构建体积门禁为600,000字节。

### 中文项目导读与可展开 README

- 详情页删除仅重复标签的“30 秒看懂”，保留顶部简短简介，并将“技术与活跃度”和“接入与能力标签”合并为同一层扫描区域。
- 新增“中文项目导读”，数据结构严格只有 `overview` 与 `capabilities`：前者说明项目是什么及主要解决什么问题，后者列出最多6项主要能力。
- 每个catalog项目具有独立的 `data/projects/{repo-id}.json`，保存结构化导读和仓库README Markdown；主榜单仅保留 `content_url` 与导读来源、状态、更新时间。
- README使用原生 `<details>` 默认收起；原始Markdown不再删除徽章、导航、目录或正文，标题、段落、列表、代码块、表格、安全链接和HTTPS图片均可展示。
- 安全边界只在构建渲染时生效：原始HTML不执行，脚本、iframe和危险协议不可用，远程图片延迟加载且不发送referrer。单个README最多80,000字节，超限按章节截断并链接GitHub全文。
- README内嵌HTML通过白名单渲染：支持居中段落、安全链接、图片、视频和常见排版属性，不再把合法标签显示为文本；事件属性、iframe与危险URL仍会移除。
- 项目内容记录 `source_fidelity`；旧版清洗缓存明确标为非完整原文，只有重新采集到仓库Markdown后才显示原文保真说明。
- GitHub Models现在输出150–300字项目说明和1–6项有README依据的能力，不生成安装方法、使用场景、适用人群、依赖、限制或注意事项。
- `site.json`继续限制600,000字节；单个项目内容限制100,000字节，全部内容限制10,000,000字节。当前130个catalog项目均有独立内容文件。

### 数据与自动化

- 动态最近30天查询、dry-run零写入、失败不覆盖旧数据、Stars历史与永久catalog语义保持不变。
- 当前本地快照发布榜单94项，catalog 共130项：94 active、36 inactive；掉榜项目的首次发现时间与历史排名继续保留。
- 当前人工中文摘要3项，另外91个活跃项目处于待回填状态；本地没有 GitHub Models Token，因此缓存仍为0，首次真实回填将在带 `models: read` 的定时 Actions 中执行。
- 六小时定时采集仍只运行Python测试、采集、提交与部署，不运行完整Playwright或Lighthouse。
- Pull Request 与非定时质量任务执行Python、Vitest、TypeScript、生产构建和Chromium E2E；PR 不采集也不部署，合并到 `main` 后才正式发布。

## 3. 当前验证结果

- Python：49项通过，新增覆盖README结构清洗、语言与导航噪声过滤、80 KB截断、导读字段限制、hash缓存、20项限额、模型失败回退、Schema迁移和dry-run零写入。
- Vitest：20项通过，新增覆盖导读最小结构、Markdown安全链接、危险协议、原始HTML与远程图片过滤。
- Playwright：双设备20项，19通过、1项桌面按设计跳过移动专属断言。
- Playwright 核心流程 `--repeat-each=5`：45通过、5项按设计跳过，无偶发失败；本地固定2 workers，CI固定1 worker。
- E2E覆盖详情页不再出现“30 秒看懂”、导读最小结构、README默认收起及展开、原文语言、安全链接、恶意HTML、Axe和移动端无横向溢出。
- Axe：首页与静态详情页在桌面和Pixel 7均为零违规。
- 生产构建生成130个详情页与131条 sitemap URL；`site.json` 为367,108字节，项目内容约127,572字节，生产 sourcemap 关闭。
- 本地 Lighthouse 13.4.1：Performance 100、Accessibility 100、Best Practices 100、SEO 100、LCP 1.369秒、CLS 0。
- 本地浏览器：`D:\Chromium\chrome-win\chrome.exe`；CI继续安装Playwright匹配的Chromium。

## 4. 发布状态

- 本轮中文导读与可展开README已在本地完成并通过质量门禁，尚未推送或部署。
- 线上网站仍是上一轮 V2 版本；线上 Lighthouse、smoke 与 GitHub Models 最小推理需要在本轮代码发布后重新验收。
- 下一次真实采集会输出Schema 1.4，并开始按每轮最多20项回填结构化导读；需观察Actions中的模型错误码与两个六小时周期的缓存增长。当前缓存记录显示旧模型请求为 `api_error`，本轮已修正API版本并把400/401/404/422拆分为可诊断错误码，但本地无Token，无法完成真实最小推理。

## 5. 暂不实现

- 不增加账号同步、社区、评论、社交Feed或复杂个人主页。
- 不增加自然语言搜索、AI推荐模型或自动生成文章；自动摘要只做有来源标记的 README 信息压缩。
- 不接入第三方埋点；在隐私策略和服务选择明确前只保留本地状态。
- 不缓存不明来源的README图片，不为项目生成虚假Screenshot。
- 暂不移除Schema 1.1遗留字段；清理工作留到Schema 2.0。
- 不修改共享Python依赖、Hermes配置或其他用户文件。

## 6. 关键文件

- 前端：`src/main.ts`、`src/styles.css`、`src/ecosystemViews.ts`
- Schema与采集：`src/types.ts`、`collector/models.py`、`collector/rules.py`、`collector/pipeline.py`
- 数据：`public/data/site.json`、`data/catalog.json`、`data/translations.json`、`data/history/`
- README与导读：`collector/translations.py`、`collector/project_content.py`、`data/projects/`
- 静态页：`scripts/generate-static-pages.mjs`、`scripts/detail-content.mjs`
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
