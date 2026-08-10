# Errors

## [ERR-20260810-001] migrate_v2_data

**Logged**: 2026-08-10T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
Direct execution of a script under `scripts/` could not import the repository-local `collector` package.

### Error
```text
ModuleNotFoundError: No module named 'collector'
```

### Context
- Command: `python scripts\migrate_v2_data.py`
- Environment: Windows PowerShell, repository root working directory

### Suggested Fix
Insert the resolved repository root into `sys.path` before importing repository-local modules.

### Metadata
- Reproducible: yes
- Related Files: scripts/migrate_v2_data.py

### Resolution
- **Resolved**: 2026-08-10T00:00:00+08:00
- **Notes**: The migration script now resolves and inserts its repository root before local imports.

---

## [ERR-20260810-010] python-regression

**Logged**: 2026-08-10T00:50:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A legacy metadata-priority test used an `awesome-*` repository name that is intentionally excluded by V2 policy.

### Error
```text
test_repository_metadata_outranks_broad_readme_mentions expected a result but received None
```

### Context
- The test's purpose is metadata-versus-README weighting, not resource-directory inclusion.

### Suggested Fix
Use a non-resource MCP toolkit fixture for metadata weighting; keep resource-directory behavior in its dedicated test.

### Metadata
- Reproducible: yes
- Related Files: tests/test_rules.py

### Resolution
- **Resolved**: 2026-08-10T00:50:00+08:00
- **Notes**: The fixture now isolates the behavior it intends to test.

---

## [ERR-20260810-008] playwright-process-exit

**Logged**: 2026-08-10T00:35:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
All browser assertions completed under unbounded local concurrency, but Playwright did not exit before the command limit.

### Error
```text
16 tests completed, then the command timed out without the Playwright summary.
```

### Context
- Local custom Chromium initially ran 12 workers.
- CI already used one worker.

### Suggested Fix
Bound local concurrency to two workers.

### Metadata
- Reproducible: yes
- Related Files: playwright.config.ts

### Resolution
- **Resolved**: 2026-08-10T00:40:00+08:00
- **Notes**: Two-worker runs completed normally; the five-repeat suite finished 75 passed and 5 expected skips.

---

## [ERR-20260810-009] lighthouse-temp-cleanup

**Logged**: 2026-08-10T00:45:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Lighthouse completed its audit but Chrome Launcher could not delete its Windows temporary directory.

### Error
```text
EPERM, Permission denied: C:\Users\ASUS\AppData\Local\Temp\lighthouse.*
```

### Context
- Lighthouse 13.4.1 with the user-provided Chromium.
- The JSON report was fully written before cleanup failed.

### Suggested Fix
Read and validate the completed report, use an isolated browser profile, and treat launcher cleanup separately from audit validity.

### Metadata
- Reproducible: yes
- Related Files: test-results/lighthouse-v2.json

### Resolution
- **Resolved**: 2026-08-10T00:45:00+08:00
- **Notes**: Report verified at 100/100/100/100, LCP 1.375 seconds, CLS 0; preview process was terminated.

---

## [ERR-20260810-007] playwright-e2e

**Logged**: 2026-08-10T00:30:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
An empty compare query string was coerced to numeric project ID zero, inflating the selected-project count.

### Error
```text
Playwright waited for "对比 2" while the UI showed "对比 3" with only two real projects selected.
```

### Context
- Command: local Chromium Playwright suite
- Root cause: `Number("") === 0` during URL-state parsing.

### Suggested Fix
Discard empty tokens before numeric conversion.

### Metadata
- Reproducible: yes
- Related Files: src/main.ts, e2e/site.spec.ts

### Resolution
- **Resolved**: 2026-08-10T00:30:00+08:00
- **Notes**: Empty compare tokens are now filtered before conversion.

---

## [ERR-20260810-006] python-regression

**Logged**: 2026-08-10T00:25:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A legacy duplicate-ID fixture failed V2 field validation before reaching its intended duplicate assertion.

### Error
```text
AssertionError: Duplicate does not match Invalid ecosystem_layer for owner/repo
```

### Context
- Command: `python -m unittest discover -s tests -v`
- Production validation correctly requires the additive Schema 1.2 fields.

### Suggested Fix
Enrich the test fixture rather than weakening production validation.

### Metadata
- Reproducible: yes
- Related Files: tests/test_pipeline.py

### Resolution
- **Resolved**: 2026-08-10T00:25:00+08:00
- **Notes**: The duplicate fixture now conforms to Schema 1.2.

---

## [ERR-20260810-005] static-page-generator

**Logged**: 2026-08-10T00:20:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
Using a file URL pathname directly duplicated the Windows drive prefix during static-page generation.

### Error
```text
ENOENT: mkdir 'D:\\D:\\find_hot_agent\\dist\\projects\\...'
```

### Context
- Command: `npm.cmd run build`
- `URL.pathname` is not a native Windows filesystem path.

### Suggested Fix
Convert file URLs with Node's `fileURLToPath` before passing them to path utilities.

### Metadata
- Reproducible: yes
- Related Files: scripts/generate-static-pages.mjs

### Resolution
- **Resolved**: 2026-08-10T00:20:00+08:00
- **Notes**: Static output now uses `fileURLToPath(dist)`.

---

## [ERR-20260810-004] typescript-build

**Logged**: 2026-08-10T00:15:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Schema migration exposed nullable DOM narrowing and legacy test-type compatibility gaps.

### Error
```text
TS18047 app is possibly null; legacy Capability exports and V2 fixture fields were missing.
```

### Context
- Command: `npm.cmd run build`
- The production build type-checks test files as well as application code.

### Suggested Fix
Use a narrowed non-null app root, retain legacy capability types for one compatibility release, and enrich test fixtures with V2 fields.

### Metadata
- Reproducible: yes
- Related Files: src/types.ts, src/main.ts, src/preferences.test.ts, src/projectViews.test.ts

### Resolution
- **Resolved**: 2026-08-10T00:15:00+08:00
- **Notes**: Added the compatibility surface and V2 fixture fields.

---

## [ERR-20260810-003] typescript-build

**Logged**: 2026-08-10T00:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
The first V2 build found a missing closing parenthesis in compare-table rendering.

### Error
```text
src/main.ts(343,153): error TS1005: ')' expected.
```

### Context
- Command: `npm.cmd run build`
- Related code: nested `forEach` calls in compare-row rendering

### Suggested Fix
Close the inner `projects.forEach` call before appending the row.

### Metadata
- Reproducible: yes
- Related Files: src/main.ts

### Resolution
- **Resolved**: 2026-08-10T00:10:00+08:00
- **Notes**: Corrected the nested call syntax before rerunning the build.

---

## [ERR-20260810-002] migrate_v2_data

**Logged**: 2026-08-10T00:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
Legacy published projects without a current metadata-domain signal could not be enriched by the stricter classifier.

### Error
```text
ValueError: Unable to migrate paperclipai/paperclip
```

### Context
- Existing published records are already vetted but may not satisfy newly tightened discovery gates from stored metadata alone.

### Suggested Fix
Seed migration with the record's legacy classification fields while deriving new V2 fields.

### Metadata
- Reproducible: yes
- Related Files: scripts/migrate_v2_data.py
- See Also: ERR-20260810-001

### Resolution
- **Resolved**: 2026-08-10T00:05:00+08:00
- **Notes**: Legacy classification is now supplied only as migration context; new collections still use strict discovery rules.

---

## [ERR-20260810-011] git-fetch

**Logged**: 2026-08-10T22:30:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Fetching the latest main branch failed during the GitHub TLS handshake while resolving PR conflicts.

### Error
```text
fatal: unable to access 'https://github.com/lood31/agent-capability-radar.git/': schannel: failed to receive handshake, SSL/TLS connection failed
```

### Context
- Command: `git -c safe.directory=D:/find_hot_agent fetch origin main`
- The preceding branch push succeeded, so this may be a transient GitHub or Windows Schannel failure.

### Suggested Fix
Retry the same scoped fetch once; if it remains unavailable, use a read-only GitHub API fallback for the required refs/files.

### Metadata
- Reproducible: unknown
- Related Files: data/catalog.json, public/data/site.json

### Resolution
- **Resolved**: 2026-08-10T22:31:00+08:00
- **Notes**: The same scoped fetch succeeded on the next attempt.

---

## [ERR-20260810-012] playwright-e2e-browser-path

**Logged**: 2026-08-10T22:32:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Local E2E startup could not find Playwright's managed Chromium because the local executable path was omitted.

### Error
```text
browserType.launch: Executable doesn't exist at ...chromium_headless_shell.exe
```

### Context
- Command: `npm.cmd run test:e2e`
- The project intentionally supports the user's local Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

### Suggested Fix
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=D:\Chromium\chrome-win\chrome.exe` for local E2E runs.

### Metadata
- Reproducible: yes
- Related Files: playwright.config.ts

### Resolution
- **Resolved**: 2026-08-10T22:32:00+08:00
- **Notes**: The rerun passed 15 tests with one expected desktop skip.

---

## [ERR-20260810-013] powershell-git-stash-reference

**Logged**: 2026-08-10T22:33:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
PowerShell parsed an unquoted `stash@{0}` reference instead of passing it literally to Git.

### Error
```text
error: unknown switch `e'
```

### Context
- Command: `git stash pop stash@{0}`

### Suggested Fix
Quote stash references in PowerShell, for example `git stash pop 'stash@{0}'`.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

### Resolution
- **Resolved**: 2026-08-10T22:33:00+08:00
- **Notes**: The quoted command restored the tracked error log and dropped the stash normally.

---

## [ERR-20260810-014] powershell-convertfrom-json

**Logged**: 2026-08-10T22:34:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Windows PowerShell 5.1 failed to parse the large valid site and catalog JSON files during a read-only count check.

### Error
```text
ConvertFrom-Json: The array passed in is invalid; expected ','.
```

### Context
- The collector's Python validator had already accepted the same `site.json` with 95 projects.

### Suggested Fix
Use the project's Python JSON parser for large dataset verification when PowerShell 5.1 cannot handle the payload.

### Metadata
- Reproducible: yes
- Related Files: data/catalog.json, public/data/site.json

### Resolution
- **Resolved**: 2026-08-10T22:34:00+08:00
- **Notes**: Python confirmed Schema 1.2, 95 published projects, 108 catalog records, and 840 history lines.

---
