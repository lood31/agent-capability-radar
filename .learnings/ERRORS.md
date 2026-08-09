# Errors

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
