# Errors

## [ERR-20260809-010] push-raced-data-commit

**Logged**: 2026-08-09T19:56:00+08:00
**Priority**: low
**Status**: resolved
**Area**: git

### Summary
An E2E fix push was rejected because the queued collection workflow published a data commit first.

### Error
```
! [rejected] main -> main (fetch first)
```

### Context
- The workflow is intentionally allowed to commit refreshed data to `main`.
- The local change and bot data change touched separate files.

### Suggested Fix
Rebase the local commit onto the bot commit and push the resulting fast-forward history.

### Metadata
- Reproducible: yes
- Related Files: public/data/site.json, data/catalog.json, data/history/2026-08.jsonl

### Resolution
- **Resolved**: 2026-08-09T19:56:00+08:00
- **Notes**: Rebased cleanly onto bot commit `5e5d460` without overwriting collected data.

---

## [ERR-20260809-009] e2e-live-data-coupling

**Logged**: 2026-08-09T19:54:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: testing

### Summary
The first CI run against collected data exposed two E2E tests that depended on repositories from the original demo dataset.

### Error
```
getByRole('heading', { name: 'zotero/zotero' }): element(s) not found
Cannot read properties of undefined (reading 'capabilities')
```

### Context
- Production data is expected to change on every collection.
- The failing tests assumed `zotero/zotero` and `modelcontextprotocol/servers` were always published.
- The quality gate correctly prevented deployment of the classifier-only push.

### Suggested Fix
Build deterministic project fixtures from the current schema while keeping the production build and data-fetch boundary real.

### Metadata
- Reproducible: yes
- Related Files: e2e/fixtures.ts, e2e/site.spec.ts

### Resolution
- **Resolved**: 2026-08-09T19:55:00+08:00
- **Notes**: E2E now generates eight stable capability projects and no longer depends on current leaderboard membership.

---

## [ERR-20260809-008] native-command-gate-not-stopping

**Logged**: 2026-08-09T19:44:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
A PowerShell staging script continued to `git commit` after `git diff --cached --check` reported trailing whitespace.

### Error
```
programs.md:3: trailing whitespace.
```

### Context
- PowerShell did not automatically stop on the non-zero exit code from the native Git command.
- The issue was limited to three Markdown line-break spaces and did not affect runtime behavior.

### Suggested Fix
Check `$LASTEXITCODE` explicitly after native command gates before continuing.

### Metadata
- Reproducible: yes
- Related Files: programs.md

### Resolution
- **Resolved**: 2026-08-09T19:44:00+08:00
- **Notes**: Removed the trailing spaces and amended the local commit before pushing.

---

## [ERR-20260809-007] vitest-e2e-discovery

**Logged**: 2026-08-09T19:24:00+08:00
**Priority**: low
**Status**: resolved
**Area**: testing

### Summary
Vitest discovered the Playwright `e2e/site.spec.ts` file and tried to execute it as a unit-test suite.

### Error
```
Playwright Test did not expect test() to be called here.
```

### Context
- All six frontend unit tests passed before Vitest reported the unrelated E2E suite failure.
- Playwright tests require the Playwright runner and production preview server.

### Suggested Fix
Limit Vitest discovery to frontend unit tests under `src/**/*.test.ts`.

### Metadata
- Reproducible: yes
- Related Files: vitest.config.ts, e2e/site.spec.ts

### Resolution
- **Resolved**: 2026-08-09T19:24:00+08:00
- **Notes**: Added a dedicated Vitest include pattern.

---

## [ERR-20260809-006] playwright-browser-install-timeout

**Logged**: 2026-08-09T19:12:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tooling

### Summary
The first project-local Chromium installation exceeded the 120-second command limit.

### Error
```
command timed out after 124033 milliseconds
```

### Context
- `@playwright/test` and `@axe-core/playwright` installed successfully.
- The Playwright browser cache contained no completed browser directory after the timeout.
- Retrying through both `npx.cmd` and the project CLI remained silent and left only a stale `__dirlock`.

### Suggested Fix
Keep CI on the version-matched Chromium install. Use the explicit local executable override only to validate the suite while the Windows cache issue is investigated.

### Metadata
- Reproducible: unknown
- Related Files: package.json, package-lock.json

---

## [ERR-20260809-005] skill-path-resolution

**Logged**: 2026-08-09T19:02:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
The Python skill was first opened through a shorthand path that does not exist on disk.

### Error
```
Get-Content: Cannot find path C:\Users\ASUS\.codex\skills\python-pro\SKILL.md
```

### Context
- The available-skill catalog maps `python-pro` to a source-prefixed directory.
- The failed read did not modify the repository.

### Suggested Fix
Resolve skill paths from the available-skill catalog before opening `SKILL.md`.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-08-09T19:03:00+08:00
- **Notes**: Reopened the skill from `sickn33-antigravity-awesome-skills-python-pro/SKILL.md`.

---

## [ERR-20260809-001] frontend-build

**Logged**: 2026-08-09T16:30:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
The first TypeScript build lost the DOM root null narrowing and Vitest had no test files.

### Error
```
TS18047: 'app' is possibly 'null'.
No test files found, exiting with code 1.
```

### Context
- Commands: `npm run build` and `npm test`
- Fresh Vite and TypeScript project

### Suggested Fix
Bind the narrowed root to a non-null constant and extract personalized scoring into a testable pure module.

### Metadata
- Reproducible: yes
- Related Files: src/main.ts, src/preferences.ts

### Resolution
- **Resolved**: 2026-08-09T17:22:00+08:00
- **Notes**: Bound the app root after narrowing and added a pure preference scoring module with Vitest coverage.

---

## [ERR-20260809-004] github-pages-enablement

**Logged**: 2026-08-09T17:47:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
The initial deployment build succeeded, but `actions/configure-pages` failed because Pages is not enabled on the new repository.

### Error
```
Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions.
```

### Context
- Workflow run: 31306670712
- Repository: lood31/agent-capability-radar
- `npm ci` and `npm run build` both succeeded.

### Suggested Fix
Enable GitHub Pages with `build_type=workflow`, rerun the failed workflow, and verify the published URL.

### Metadata
- Reproducible: yes
- Related Files: .github/workflows/site.yml

### Resolution
- **Resolved**: 2026-08-09T17:50:00+08:00
- **Notes**: Enabled Pages with `build_type=workflow`; rerun 31306670712 deployed successfully.

---

## [ERR-20260809-003] git-safe-directory

**Logged**: 2026-08-09T17:28:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
Git status was blocked because the sandbox account differs from the Windows workspace owner.

### Error
```
fatal: detected dubious ownership in repository at 'D:/find_hot_agent'
```

### Context
- The repository was initialized successfully as `main`.
- Global Git configuration belongs to the user's system environment and was not changed.

### Suggested Fix
Use `git -c safe.directory=D:/find_hot_agent ...` for sandbox-only inspection.

### Metadata
- Reproducible: yes
- Related Files: .git

### Resolution
- **Resolved**: 2026-08-09T17:28:00+08:00
- **Notes**: Used a command-scoped safe.directory override; no global configuration was mutated. The reverse ownership check also applies when the host ASUS account runs `gh` against the sandbox-owned `.git`, so `GIT_CONFIG_COUNT` is injected only for that process.

---

## [ERR-20260809-002] windows-preview-launch

**Logged**: 2026-08-09T17:25:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
PowerShell `Start-Process` failed because the inherited environment contains both `Path` and `PATH` keys.

### Error
```
Start-Process: An item with the same key has already been added. Key: PATH
```

### Context
- Attempted to launch `npm run preview` in a hidden child process on Windows.

### Suggested Fix
Use a single-process Node visual QA script that owns both the static server and Playwright lifecycle.

### Metadata
- Reproducible: yes
- Related Files: dist/index.html

### Resolution
- **Resolved**: 2026-08-09T17:27:00+08:00
- **Notes**: Replaced the background preview process with an ephemeral Node HTTP server in the visual check. Windows ESM imports use `file:///C:/...` URLs.

---
