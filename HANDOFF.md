# Repo Cleanup Handoff — 2026-02-12

## Repo
- **Path:** `/Users/worker/clawd-froggo/clawd-dashboard/`
- **Branch:** `dev` (working) / `main` (prod)
- **Remote:** `origin` → `github.com/ProfFroggo/froggo_bot`

## Completed (pushed to GitHub)

1. **Git consolidation** — merged `froggo-main` (46 commits) into `main`, pushed both
2. **Branch cleanup** — deleted `ox-main`, `oxmain`, `fix/process-storm-prevention`, `backup-before-rollback-*`, `backup-inbox-fixes`, `froggo-main` (local + remote)
3. **Branch strategy** — `main` = prod, `dev` = active work. GitHub default = `main`
4. **Dev/prod build pipeline:**
   - `npm run build:dev` → `release/dev/mac-arm64/Froggo Dev.app` (appId: `com.froggo.dev`)
   - `npm run build:prod` → `release/prod/mac-arm64/Froggo.app` (appId: `com.froggo.app`)
   - `electron:build` aliases `build:prod`
   - Dev app title: "Froggo [DEV] v1.0.0" / Prod: "Froggo v1.0.0"
   - Separate userData dirs (different productNames)
5. **Update checker** — prod app checks GitHub Releases API on launch, shows dialog if newer version exists
6. **Version** — bumped to `1.0.0`, package renamed to `froggo-dashboard`
7. **Smartrouter dead code** — removed from `electron/main.ts`
8. **Home dir cleanup** — deleted `~/clawd-coder-OLD-20260210-095300/` (87MB), `~/clawd-lead-engineer.archived/`, `~/Froggo.archived-20260129/`, `~/froggo-memory.db`, `~/froggo.db`

## On Disk (NOT committed yet)

**ESLint/Prettier agent wrote:**
- `.eslintrc.cjs` — ESLint config (TS + React + React Hooks + Prettier compat)
- `.prettierrc` — `{ singleQuote: true, trailingComma: "all", printWidth: 100 }`
- `.prettierignore` — excludes node_modules, dist, release, *.md
- `package.json` — has new lint/format scripts + eslint/prettier devDeps added

**Quick-fixes agent wrote:**
- `.env` — replaced with template (no secrets), actual key moved to `.env.local`
- `.env.local` — has the real Gemini API keys (untracked)
- `.gitignore` — updated with comprehensive patterns (.env, coverage/, .idea/, etc.)
- `tsconfig.json` — `noUnusedLocals: true`, `noUnusedParameters: true`, removed backup-* exclude
- `src/tests/setup.ts` — created with `import '@testing-library/jest-dom';`

## TODO (in priority order)

### Bash commands needed (file edits already done, just need shell):
```bash
cd /Users/worker/clawd-froggo/clawd-dashboard

# 1. Install eslint/prettier deps
npm install

# 2. Stop tracking .env (key already moved to .env.local)
git rm --cached .env

# 3. Delete stale root .md files (keep README, CHANGELOG)
find . -maxdepth 1 -name '*.md' ! -name 'README.md' ! -name 'CHANGELOG.md' ! -name 'HANDOFF.md' -delete

# 4. Delete stale docs/ .md files (keep USER_GUIDE, DOCUMENTATION_INDEX)
find docs/ -name '*.md' ! -name 'USER_GUIDE.md' ! -name 'DOCUMENTATION_INDEX.md' -delete

# 5. Delete dead code
rm -rf _deprecated/ vite.config.optimized.ts src/components/analytics/
rm -f tests/keyboard-shortcuts.test.md

# 6. Commit everything
git add -A
git commit -m "chore: repo cleanup — security, lint, docs, tsconfig, dead code

- Remove .env from tracking (contained exposed Gemini API key)
- Add ESLint + Prettier configuration
- Update .gitignore with comprehensive patterns
- Delete 100+ stale report/task-completion .md files
- Enable noUnusedLocals and noUnusedParameters in tsconfig
- Remove duplicate analytics components, deprecated files, dead configs
- Create missing test setup file

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin dev
```

### Big refactors (30+ min each)
9. **Component reorg** — move 160+ flat files in `src/components/` into feature dirs:
   - `agents/` — AgentAvatar, AgentChatModal, AgentDetailModal, AgentMetricsCard, etc.
   - `inbox/` — InboxPanel, CommsInbox3Pane, ThreadListItem, FolderManager, etc.
   - `tasks/` — Kanban, TaskDetailPanel, PokeModal, WorkerModal
   - `calendar/` — EpicCalendar, CalendarWidget, ContentScheduler, SchedulePanel, etc.
   - `settings/` — EnhancedSettingsPanel, ConfigTab, CronTab, DebugTab, LogsTab, etc.
   - `voice/` — VoiceChatPanel, MeetingsPanel, MeetingScribe, etc.
   - `analytics/` — AnalyticsDashboard, PerformanceBenchmarks, ProductivityHeatmap, etc.
   - `chat/` — ChatPanel
   - `notifications/` — NotificationsPanel, NotificationsPanelV2, GlobalNotificationSettings
   - `hr/` — HRSection, HRAgentCreationModal, HRReportsModal
   - `library/` — LibraryPanel, LibraryFilesTab, LibrarySkillsTab, LibraryTemplatesTab
   - `social/` — XPanel, SocialSchedulePanel
   - `common/` — BaseModal, ConfirmDialog, ErrorBoundary, Icon, Tooltip, Skeleton, etc.
10. **Split `electron/main.ts`** (7,393 lines) — extract IPC handlers, AI service, update checker into separate modules
11. **Split `src/store/store.ts`** (1,347 lines) — break into feature slices

## Exposed API Key (ROTATE THIS)
```
GEMINI_API_KEY=AIzaSyCziHu8LUZ6RXmt-4lu_NzgEfczM0DC1RE
```
This is in `.env` which is tracked in git history. Rotate via Google AI Studio.

## How to Resume
```bash
claude --dangerously-skip-permissions
```
Then: "Continue repo cleanup from HANDOFF.md"
