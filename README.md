# Agent 能力雷达

为大学生和 Agent 使用者发现值得接入的开源能力。网站用 GitHub 公开数据、历史 Stars 快照和透明规则自动生成，不调用 AI 摘要。

## 本地运行

```powershell
npm install
npm run dev
```

采集器只依赖 Python 3.12 标准库：

```powershell
$env:GITHUB_TOKEN = "github-token"
python -m collector --dry-run
python -m collector
```

未提供 Token 时也能读取公开仓库，但 GitHub API 限额更低。`--dry-run` 会执行搜索、分类和校验，不写入数据文件。

## 测试与构建

```powershell
python -m unittest discover -s tests -v
python -m collector --validate public/data/site.json
npm test
npm run build
```

## 数据规则

- 搜索与人工覆盖：`config/discovery.json`
- 月度历史快照：`data/history/YYYY-MM.jsonl`
- 前端数据：`public/data/site.json`
- 定时采集和 Pages 部署：`.github/workflows/site.yml`

仓库启用 GitHub Pages 时，在 **Settings → Pages → Source** 选择 **GitHub Actions**。

