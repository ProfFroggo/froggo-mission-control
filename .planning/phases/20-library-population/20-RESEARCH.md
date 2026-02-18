# Phase 20: Library Population & Tagging - Research

**Researched:** 2026-02-18
**Domain:** Electron IPC + React UI (Library panel, skills system, file tagging)
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 20 targets three gaps in the existing Library panel: (1) the Skills tab shows empty state because `window.clawdbot?.skills?.list()` has no preload binding or IPC handler, (2) library files have no way to update tags/category/project after upload, and (3) the category picker is limited to 6 categories (`draft`, `document`, `media`, `strategy`, `research`, `other`) instead of the required 9.

The codebase already has rich skill data in two places: the `agent_skills` DB table (66 rows, per-agent with proficiency 1-10) and the `skill_evolution` DB table (38 rows, system-wide with proficiency 0-1). Agent workspaces also contain `skills/` directories with `SKILL.md` files describing capabilities. The Library file system uses a `library` DB table with `tags` (JSON array) and `category` (text) columns -- both already exist but have no update IPC handlers.

**Primary recommendation:** Wire up missing IPC for skills display (read from `agent_skills` and filesystem SKILL.md files), add `library:update` IPC handler for file tagging, and expand the category enum in both the frontend type and the upload auto-detect logic.

## Standard Stack

### Core

No new libraries needed. Everything is built on existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron IPC | (existing) | Main-renderer communication | Already used for all library/agent handlers |
| better-sqlite3 | (existing) | DB queries for skills and library | Already the DB driver throughout `electron/main.ts` |
| React + TypeScript | (existing) | UI components | Existing renderer stack |
| Tailwind + clawd tokens | (existing) | Styling | Dark mode design system already in place |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (existing) | Icons | Category icons, skill display |
| gray-matter | (if needed) | Parse YAML frontmatter in SKILL.md | Only if extracting metadata from SKILL.md frontmatter |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter for SKILL.md parsing | Simple regex/string split | SKILL.md files use `---` YAML frontmatter (see github SKILL.md); gray-matter is cleaner but adds a dependency. Simple string split is sufficient if only extracting name/description from frontmatter. |
| Reading SKILL.md files at runtime | Pre-indexing skills into DB | Runtime reads are simpler but slower; DB indexing adds complexity but is faster for display. Given ~50 skill files total, runtime reads are fine. |

**Installation:**
```bash
# No new packages needed
# If gray-matter is desired: npm install gray-matter
```

## Architecture Patterns

### Recommended Project Structure

No new files needed. Changes touch existing files:

```
electron/
├── main.ts           # Add: library:update IPC, skills:list IPC (or dedicated service file)
├── preload.ts        # Add: library.update(), skills.list() bindings
└── paths.ts          # Already has LIBRARY_DIR, agentWorkspace()

src/components/
├── LibrarySkillsTab.tsx  # Rewrite: read real skills, display per-agent
├── LibraryFilesTab.tsx   # Add: tag/category editing UI, expand categories
└── LibraryPanel.tsx      # No changes needed
```

**Per project conventions** (from CLAUDE.md): New IPC handlers should go in dedicated service files under `electron/`. If the skills IPC is small (2-3 handlers), adding to main.ts is acceptable. If larger, create `electron/library-service.ts`.

### Pattern 1: IPC Handler for Skills List

**What:** New IPC handler that aggregates skills from `agent_skills` DB table and optionally SKILL.md files from agent workspaces.
**When to use:** When LibrarySkillsTab loads.
**Example:**

```typescript
// In electron/main.ts (or electron/library-service.ts)
ipcMain.handle('skills:list', async () => {
  try {
    // Primary source: agent_skills table (66 rows, per-agent, proficiency 1-10)
    const dbSkills = prepare(`
      SELECT as2.agent_id, as2.skill_name, as2.proficiency, as2.success_count,
             as2.failure_count, as2.last_used, as2.notes,
             ar.name as agent_name, ar.emoji as agent_emoji
      FROM agent_skills as2
      LEFT JOIN agent_registry ar ON as2.agent_id = ar.id
      ORDER BY as2.agent_id, as2.proficiency DESC
    `).all();

    return { success: true, skills: dbSkills };
  } catch (error: any) {
    return { success: false, error: error.message, skills: [] };
  }
});
```

### Pattern 2: Library File Update Handler

**What:** IPC handler to update file metadata (tags, category, project name).
**When to use:** When user edits tags/category in the file detail view.
**Example:**

```typescript
ipcMain.handle('library:update', async (_, fileId: string, updates: {
  category?: string;
  tags?: string[];
  project?: string;
}) => {
  try {
    if (updates.category) {
      prepare('UPDATE library SET category = ?, updated_at = datetime("now") WHERE id = ?')
        .run(updates.category, fileId);
    }
    if (updates.tags !== undefined) {
      prepare('UPDATE library SET tags = ?, updated_at = datetime("now") WHERE id = ?')
        .run(JSON.stringify(updates.tags), fileId);
    }
    // project could be stored in tags JSON or a new column
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

### Pattern 3: Expanded Category Enum

**What:** Expand file categories from 6 to 9+.
**Current categories:** `draft`, `document`, `media`, `strategy`, `research`, `other`
**Required categories:** Marketing, UI/Design, Dev, Research, Finance, Test Logs, Content, Social, Other
**Example mapping:**

```typescript
type FileCategory =
  | 'marketing'   // Marketing
  | 'design'      // UI/Design
  | 'dev'         // Dev
  | 'research'    // Research
  | 'finance'     // Finance
  | 'test-logs'   // Test Logs
  | 'content'     // Content
  | 'social'      // Social
  | 'other';      // Other

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  marketing:  { icon: TrendingUp, color: 'text-pink-400 bg-pink-500/10', label: 'Marketing' },
  design:     { icon: Palette,    color: 'text-purple-400 bg-purple-500/10', label: 'UI/Design' },
  dev:        { icon: Code,       color: 'text-green-400 bg-green-500/10', label: 'Dev' },
  research:   { icon: Search,     color: 'text-cyan-400 bg-cyan-500/10', label: 'Research' },
  finance:    { icon: DollarSign, color: 'text-amber-400 bg-amber-500/10', label: 'Finance' },
  'test-logs': { icon: TestTube,  color: 'text-orange-400 bg-orange-500/10', label: 'Test Logs' },
  content:    { icon: FileText,   color: 'text-blue-400 bg-blue-500/10', label: 'Content' },
  social:     { icon: Share2,     color: 'text-indigo-400 bg-indigo-500/10', label: 'Social' },
  other:      { icon: File,       color: 'text-clawd-text-dim bg-clawd-bg0/10', label: 'Other' },
};
```

### Anti-Patterns to Avoid

- **Don't create a separate skills DB table:** `agent_skills` already has 66 rows of real data. Don't duplicate into `skill_evolution` or a new table. Use `agent_skills` as the primary source.
- **Don't read all SKILL.md files synchronously on every tab load:** Cache results or read lazily. There are ~50 SKILL.md files across 12+ agents.
- **Don't hardcode category lists in multiple places:** Define the category config once and import it in both the filter UI and the category picker.
- **Don't break existing library data:** 4 files already exist with categories `strategy`, `research`, `test`. Map old categories to new ones (e.g., `strategy` -> `marketing`, `draft` -> `content`, `document` -> `content`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Regex parser | `gray-matter` npm package or simple string split on `---` | Edge cases with multi-line values, nested YAML |
| Skills proficiency display | Custom progress bars | Reuse existing pattern from `LibrarySkillsTab.tsx` proficiency bar | Already has color coding and labels |
| Category picker dropdown | Custom dropdown from scratch | Use existing `<select>` pattern from `LibraryTemplatesTab` | Consistent with rest of app |

**Key insight:** This phase is primarily a "wiring" phase -- connecting existing data (DB tables, SKILL.md files) to existing UI patterns (skill cards, category filters) through missing IPC handlers.

## Common Pitfalls

### Pitfall 1: skills?.list() Silent Failure

**What goes wrong:** `window.clawdbot?.skills?.list()` currently resolves to `undefined?.list()` which silently returns `undefined`, causing the empty state.
**Why it happens:** No `skills:` namespace exists in preload.ts. The optional chaining masks the error.
**How to avoid:** Add the `skills` namespace to preload.ts AND add the corresponding IPC handler.
**Warning signs:** Skills tab shows "No skills tracked" even though `agent_skills` has 66 rows.

### Pitfall 2: Two Competing Skills Tables

**What goes wrong:** `skill_evolution` (38 rows, proficiency 0.0-1.0, system-wide) and `agent_skills` (66 rows, proficiency 1-10, per-agent) have different schemas and scales.
**Why it happens:** They were created at different times for different purposes. `skill_evolution` is used by `agents:getDetails` IPC. `agent_skills` is used by `AgentSkillsModal`.
**How to avoid:** Use `agent_skills` as the primary source for the Library Skills tab -- it has per-agent attribution and is more granular. `skill_evolution` could be shown as a secondary "system capabilities" view.
**Warning signs:** Proficiency percentages look wrong because one table uses 0-1 and the other uses 1-10.

### Pitfall 3: Category Migration

**What goes wrong:** Existing library files have categories `strategy`, `research`, `test` which don't match the new required categories.
**Why it happens:** The old category set was different from the new requirement.
**How to avoid:** The new category set includes `research` (preserved), and `strategy` maps to `marketing`. Run a migration UPDATE for old data. Keep backward compatibility -- if an unknown category is in the DB, fall back to `other`.
**Warning signs:** Old files show with wrong or missing category badges.

### Pitfall 4: uploadBuffer Not Wired

**What goes wrong:** `LibraryFilesTab` drag-drop calls `window.clawdbot?.library?.uploadBuffer()` which doesn't exist in preload.
**Why it happens:** uploadBuffer was never implemented. Drag-drop silently fails.
**How to avoid:** Either add `uploadBuffer` to preload + IPC, or use a different approach (write temp file, then use existing upload flow).
**Warning signs:** Drag-drop appears to work (shows toast) but files never appear.

### Pitfall 5: Project Name as Tags vs Column

**What goes wrong:** LIB-02 requires tagging with "project name" but the library table has no `project` column.
**Why it happens:** The table was designed with generic `tags` JSON array but no structured project field.
**How to avoid:** Two options: (a) add a `project` column to the library table via ALTER TABLE, or (b) store project name as a specially-prefixed tag (e.g., `project:DegenDome`). Option (a) is cleaner.
**Warning signs:** Project filtering doesn't work if stored inconsistently.

## Code Examples

### Current Skills Data in DB (agent_skills table)

```sql
-- 66 rows, per-agent, proficiency 1-10
SELECT agent_id, skill_name, proficiency FROM agent_skills LIMIT 5;
-- coder|TypeScript|8
-- coder|React|8
-- coder|Node.js|8
-- researcher|Web research|9
-- writer|Technical writing|8
```

### Current Library DB Schema

```sql
CREATE TABLE library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  size INTEGER,
  mime_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  linked_tasks TEXT,  -- JSON array of task IDs
  tags TEXT           -- JSON array of strings
);
```

### SKILL.md File Format (OpenClaw standard)

```yaml
---
name: github
description: "Interact with GitHub using the `gh` CLI."
metadata:
  openclaw:
    emoji: "\U0001F419"
    requires:
      bins: ["gh"]
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub...
```

### Existing Agent Skills IPC (agents:getDetails)

```typescript
// In main.ts line 6873 - already queries skill_evolution
const skillsCmd = `sqlite3 "${froggoDbPath}" "SELECT skill_name as name, proficiency, last_used, success_count, failure_count FROM skill_evolution ORDER BY proficiency DESC" -json`;
```

### Preload Binding Pattern (from existing library handlers)

```typescript
// In preload.ts - pattern to follow
library: {
  list: (category?: string) => ipcRenderer.invoke('library:list', category),
  upload: () => ipcRenderer.invoke('library:upload'),
  update: (fileId: string, updates: any) => ipcRenderer.invoke('library:update', fileId, updates),
  // ... existing handlers
},
skills: {
  list: () => ipcRenderer.invoke('skills:list'),
},
```

## Existing State Inventory

### Skills Data Sources (3 sources)

| Source | Location | Count | Per-Agent | Proficiency Scale | Notes |
|--------|----------|-------|-----------|-------------------|-------|
| `agent_skills` table | froggo.db | 66 rows | Yes | 1-10 integer | Primary: has agent_id, success/failure counts |
| `skill_evolution` table | froggo.db | 38 rows | No (system-wide) | 0.0-1.0 float | Secondary: used by agents:getDetails |
| `skills/*/SKILL.md` files | ~/agent-{name}/skills/ | ~50 files across 12 agents | Yes (by directory) | N/A | Descriptive capability docs with frontmatter |

### Agent Skill Files Inventory

| Agent | Skills Directory | Skill Names |
|-------|-----------------|-------------|
| chief | 3 skills | auditor, model-usage, session-logs |
| coder | 5 skills | coding-agent, github, model-usage, session-logs, tmux |
| designer | 3 skills | canvas, openai-image-gen, video-frames |
| finance-manager | 4 skills | 1password, model-usage, session-logs, things-mac |
| froggo | 2 skills | social-media-manager, x-research |
| hr | 6 skills | discord, notion, session-logs, slack, things-mac, trello |
| jess | 6 skills | openai-whisper-api, session-logs, spotify-player, summarize, voice-call, weather |
| researcher | 4 skills | session-logs, summarize, weather, (README) |
| senior-coder | 5 skills | coding-agent, github, model-usage, session-logs, tmux |
| social-manager | 4 skills | discord, session-logs, slack, weather |
| voice | 4 skills | openai-whisper-api, sherpa-onnx-tts, summarize, voice-call |
| writer | 7 skills | apple-notes, nano-pdf, notion, obsidian, openai-image-gen, summarize, (README) |

### Library Files Current State

| Metric | Value |
|--------|-------|
| Library table rows | 4 |
| Task attachment rows | 804 |
| Library categories in DB | strategy, research, test |
| Library directory files | 8 (including reports/) |
| Current frontend categories | draft, document, media, strategy, research, other |
| Required categories | Marketing, UI/Design, Dev, Research, Finance, Test Logs, Content, Social, Other |

### Missing IPC Wiring

| Frontend Call | Preload Binding | IPC Handler | Status |
|---------------|----------------|-------------|--------|
| `window.clawdbot?.skills?.list()` | MISSING | MISSING | Causes empty skills tab |
| `window.clawdbot?.library?.uploadBuffer()` | MISSING | MISSING | Drag-drop silently fails |
| `library:update` (tags/category) | MISSING | MISSING | No way to edit file metadata |

## Open Questions

1. **Should skills display merge both DB tables?**
   - What we know: `agent_skills` has per-agent data (66 rows), `skill_evolution` has system-wide data (38 rows). They overlap on skill names but have different proficiency scales.
   - What's unclear: Does the user want to see both, or just per-agent skills?
   - Recommendation: Use `agent_skills` as primary (it's per-agent and has more data). Optionally show `skill_evolution` as "System Capabilities" section.

2. **Should SKILL.md file content be displayed in skills tab?**
   - What we know: SKILL.md files contain rich documentation about each skill (commands, workflows, examples). The DB tables only have skill names and proficiency scores.
   - What's unclear: Is the skills tab meant to show operational skill docs, or just proficiency tracking?
   - Recommendation: Show DB proficiency data as the main view. Add a "View Details" link that reads and displays the SKILL.md content for each skill.

3. **Project name storage: new column vs tag prefix?**
   - What we know: Library table has `tags` (JSON array) but no `project` column. LIB-02 requires project name tagging.
   - What's unclear: Whether to ALTER TABLE or use tag convention.
   - Recommendation: Add `project` TEXT column via ALTER TABLE -- it's cleaner for filtering and the column already conceptually fits (inbox messages have a `project` field too).

4. **Category migration for existing data**
   - What we know: 4 library files exist with categories `strategy`, `research`, `test`. 804 task attachments use categories `deliverable`, `output`, `planning`, `reference`.
   - What's unclear: Exact mapping from old to new categories.
   - Recommendation: `research` stays as `research`. `strategy` maps to `marketing`. `test` maps to `test-logs`. `draft`/`document` map to `content`. Task attachment categories are separate and should remain unchanged (they describe attachment role, not content type).

## Sources

### Primary (HIGH confidence)

All findings are from direct codebase inspection:

- `electron/main.ts` lines 4108-4350 -- Library IPC handlers (list, upload, delete, link, view, download)
- `electron/main.ts` lines 6860-6953 -- Agent skills IPC (getDetails, addSkill, updateSkill)
- `electron/preload.ts` lines 327-335 -- Library preload bindings
- `electron/preload.ts` -- No `skills:` namespace exists
- `electron/paths.ts` -- LIBRARY_DIR = `~/froggo/library`
- `src/components/LibraryPanel.tsx` -- Tab container (files, templates, skills, resources)
- `src/components/LibraryFilesTab.tsx` -- File browser with category filter
- `src/components/LibrarySkillsTab.tsx` -- Skills display (currently broken, calls missing API)
- `src/components/LibraryTemplatesTab.tsx` -- Template manager (local state, not persisted)
- `src/components/AgentSkillsModal.tsx` -- Reads `agent_skills` table via `db.exec`
- `src/components/SkillsTab.tsx` -- Gateway skills management (different from Library skills)
- Database: `agent_skills` (66 rows), `skill_evolution` (38 rows), `library` (4 rows), `task_attachments` (804 rows)
- Agent workspaces: `~/agent-{name}/skills/*/SKILL.md` (~50 files across 12 agents)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing patterns
- Architecture: HIGH -- all IPC patterns well-established in codebase
- Pitfalls: HIGH -- directly verified via codebase inspection (missing bindings confirmed)

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable codebase patterns, no external dependencies)
