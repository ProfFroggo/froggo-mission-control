---
phase: 01-security-hardening
plan: 01
subsystem: security
tags: [electron-safeStorage, secrets, PII, IPC, keychain, gog-cli]

# Dependency graph
requires: []
provides:
  - "electron/secret-store.ts — keychain-backed secret storage via Electron safeStorage"
  - "IPC bridge for API key management (settings:getApiKey, settings:storeApiKey, settings:hasApiKey, settings:deleteApiKey)"
  - "Zero hardcoded secrets or PII in src/ and electron/"
  - "Dynamic Google account discovery via gog CLI (replaces hardcoded email arrays)"
affects: [02-broken-features, 03-functional-gaps, 04-ux-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Secret storage via Electron safeStorage to ~/.openclaw/credentials/dashboard/{key}.enc"
    - "Async IPC bridge for API keys: window.clawdbot.settings.getApiKey(key)"
    - "Dynamic gog CLI account discovery: gog auth list --json instead of hardcoded arrays"
    - "useUserSettings Zustand store for PII with empty defaults for fresh installs"

key-files:
  created:
    - "electron/secret-store.ts"
  modified:
    - "electron/x-api-client.ts"
    - "electron/connected-accounts-service.ts"
    - "electron/main.ts"
    - "electron/accounts-service.ts"
    - "electron/calendar-service.ts"
    - "src/components/VoiceChatPanel.tsx"
    - "src/components/TeamVoiceMeeting.tsx"
    - "src/components/QuickActions.tsx"
    - "src/components/MeetingsPanel.tsx"
    - "src/components/MeetingScribe.tsx"
    - "src/components/MeetingTranscribe.tsx"
    - "src/lib/gateway.ts"
    - "src/store/userSettings.ts"
    - "src/components/EnhancedSettingsPanel.tsx"
    - "src/components/SettingsPanel.tsx"
    - "src/components/MorningBrief.tsx"
    - "src/components/CalendarWidget.tsx"
    - "src/components/QuickModals.tsx"
    - "src/components/CommsInbox3Pane.tsx"
    - "src/components/ConnectedAccountsPanel.tsx"
    - "src/lib/priorityScoring.ts"
    - "src/lib/smartAccountSelector.ts"
    - "src/lib/folderRules.ts"
    - "electron/preload.ts"
    - "src/types/global.d.ts"

key-decisions:
  - "Used Electron safeStorage (OS keychain) for secret storage instead of .env files (env files don't survive electron-builder)"
  - "Async IPC bridge pattern for API keys since safeStorage only available in main process"
  - "Dynamic gog CLI discovery for Google accounts instead of hardcoded arrays"
  - "Empty defaults in userSettings store — existing users unaffected via localStorage persistence"

patterns-established:
  - "Secret store pattern: storeSecret/getSecret/hasSecret/deleteSecret with filesystem-safe key sanitization"
  - "API key loading: async getGeminiApiKey() checks env vars first, then IPC to main process"
  - "Account discovery: getDefaultGogEmail() and getGoogleAccounts() query gog auth list --json dynamically"

# Metrics
duration: ~45min
completed: 2026-02-11
---

# Phase 1 Plan 01: Credential & PII Removal Summary

**Electron safeStorage secret store, async IPC API key bridge, dynamic gog CLI account discovery, and complete PII removal across 25 source files**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-02-11T21:48:00Z
- **Completed:** 2026-02-11T22:33:26Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- Created `electron/secret-store.ts` with keychain-backed encryption for API tokens
- Removed all 8 hardcoded secrets: Twitter Bearer, X Access Token, 2 Gemini API keys (across 6 files), gateway token, and AES encryption key
- Removed all hardcoded PII: emails, phone numbers, names, family details across 16+ files
- Replaced 3 hardcoded Google account arrays with dynamic `gog auth list --json` discovery
- Added 4 IPC handlers + preload bridge for settings API key management
- Zero grep hits for any known secret or PII pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create secret store and migrate all hardcoded tokens** - `bd3939a` (feat)
2. **Task 2: Replace all hardcoded PII with settings store references** - `f3e02de` (feat)

## Files Created/Modified

### Created
- `electron/secret-store.ts` - Keychain-backed secret storage (storeSecret, getSecret, hasSecret, deleteSecret)

### Modified (Token Removal - Task 1)
- `electron/x-api-client.ts` - Removed hardcoded Bearer/Access tokens, added initXApiTokens() from secret store
- `electron/connected-accounts-service.ts` - Replaced AES-256-CBC + hardcoded key with safeStorage encrypt/decrypt
- `src/lib/gateway.ts` - Cleared hardcoded DEFAULT_TOKEN constant
- `src/components/VoiceChatPanel.tsx` - Async Gemini key loading via IPC
- `src/components/TeamVoiceMeeting.tsx` - Async Gemini key loading via IPC
- `src/components/QuickActions.tsx` - Async Gemini key loading via IPC
- `src/components/MeetingsPanel.tsx` - Async Gemini key loading via IPC
- `src/components/MeetingScribe.tsx` - Async Gemini key loading via IPC
- `src/components/MeetingTranscribe.tsx` - Async Gemini key loading via IPC
- `electron/main.ts` - Added IPC handlers, getDefaultGogEmail() helper, dynamic account discovery
- `electron/preload.ts` - Added settings IPC bridge
- `src/types/global.d.ts` - Added settings type declarations

### Modified (PII Removal - Task 2)
- `src/store/userSettings.ts` - Empty defaults for name, email, phone, emailAccounts
- `src/components/EnhancedSettingsPanel.tsx` - Dynamic calendar account from settings
- `src/components/SettingsPanel.tsx` - Dynamic calendar account from settings
- `src/components/MorningBrief.tsx` - Dynamic calendar account and greeting name
- `src/components/CalendarWidget.tsx` - Dynamic calendar account from settings
- `src/components/QuickModals.tsx` - Dynamic calendar account from settings
- `src/components/CommsInbox3Pane.tsx` - Empty default email accounts
- `src/components/ConnectedAccountsPanel.tsx` - Generic example emails
- `src/lib/priorityScoring.ts` - Removed PII from IMPORTANT_SENDERS
- `src/lib/smartAccountSelector.ts` - Generic examples in selection rules
- `src/lib/folderRules.ts` - Generic *.example.com in rule templates
- `electron/accounts-service.ts` - Dynamic gog CLI account discovery
- `electron/calendar-service.ts` - Dynamic gog CLI account discovery

## Decisions Made

1. **Electron safeStorage over .env files** - .env files don't survive electron-builder packaging. safeStorage uses the OS keychain (macOS Keychain) which persists across builds.
2. **Async IPC bridge for API keys** - safeStorage only available in main process, so components use `await window.clawdbot.settings.getApiKey('gemini')` which calls through IPC.
3. **Dynamic gog CLI discovery** - Instead of hardcoding Google account emails, query `gog auth list --json` at runtime. Works for any user without code changes.
4. **Empty defaults in userSettings** - Existing users unaffected (Zustand persist loads from localStorage). Fresh installs show empty fields, prompting user to configure in Settings.
5. **Sync loadApiKey replaced with async pattern** - Components that used `useRef(loadApiKey())` changed to `useRef('')` + `useEffect` with async IPC call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async loadApiKey in useRef initializer**
- **Found during:** Task 1 (Gemini key migration)
- **Issue:** `loadApiKey()` changed from sync to async but was called in `useRef(loadApiKey())` which cannot accept a Promise
- **Fix:** Changed to `useRef('')` + `useEffect` that loads key asynchronously
- **Files modified:** VoiceChatPanel.tsx, TeamVoiceMeeting.tsx
- **Verification:** TypeScript compiles, no runtime errors
- **Committed in:** bd3939a

**2. [Rule 1 - Bug] Fixed await inside non-async Promise executor**
- **Found during:** Task 1 (MeetingsPanel Gemini key migration)
- **Issue:** `await getGeminiApiKey()` placed inside `new Promise((resolve, reject) => { ... })` — executor is not async
- **Fix:** Moved await before Promise constructor, passed key as variable
- **Files modified:** MeetingsPanel.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** bd3939a

**3. [Rule 2 - Missing Critical] Extended PII removal to 3 additional electron service files**
- **Found during:** Task 2 verification
- **Issue:** Plan listed 13 files for PII removal, but `electron/main.ts`, `electron/accounts-service.ts`, and `electron/calendar-service.ts` also contained hardcoded email arrays not in the plan's file list
- **Fix:** Added `getDefaultGogEmail()` helper to main.ts, replaced all hardcoded fallback emails with dynamic gog CLI lookup across all 3 files
- **Files modified:** electron/main.ts, electron/accounts-service.ts, electron/calendar-service.ts
- **Verification:** Zero grep hits for any known PII string
- **Committed in:** f3e02de

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness and complete PII removal. No scope creep.

## Issues Encountered
- Async conversion of 6 Gemini API key loading functions required different patterns depending on context (useRef, useEffect, Promise constructor, IIFE wrapper) — each handled individually.

## User Setup Required

After this plan, users need to configure their API keys and personal details:
1. **Settings > API Keys**: Store Gemini API key (previously hardcoded)
2. **Settings > Profile**: Set name, email, phone (previously hardcoded)
3. **X API tokens**: Store via Settings or set `X_BEARER_TOKEN` / `X_ACCESS_TOKEN` env vars

Existing users with localStorage data retain their settings automatically.

## Next Phase Readiness
- Secret store infrastructure ready for use by any future feature needing secure credential storage
- IPC bridge pattern established for main-process-only APIs
- Plan 01-02 (gateway + IPC audit) can proceed — no blockers
- Full app build verification pending (npm run electron:build) — deferred to phase verification

---
*Phase: 01-security-hardening*
*Completed: 2026-02-11*
