# Phase 12: Setup Wizard - Research

**Researched:** 2026-02-13
**Domain:** Conversational AI wizard for book project planning with structured data extraction
**Confidence:** HIGH

## Summary

Phase 12 adds a conversational AI wizard to the project creation flow. Users start a new book project, provide a brain dump description, and converse with an AI agent that proposes a story arc, chapter outline, themes, and character profiles. The wizard produces structured data (chapters, characters, timeline) that atomically creates a fully-populated project with memory store entries -- no manual re-entry needed.

The implementation builds on Phase 11's chat infrastructure (`gateway.sendChatWithCallbacks`, `chatPaneStore` pattern, streaming UI, agent preambles). The core technical challenge is **structured data extraction from multi-turn AI conversation** -- getting the AI to produce parseable JSON for chapters, characters, and timeline from a natural conversational flow. Since the OpenClaw Gateway's `sendChatWithCallbacks` does not support tool-calling or `output_config`, structured extraction must happen at the **prompt level** (AI returns JSON within markdown code blocks, client parses it).

The wizard is a new UI flow in `WritingWorkspace.tsx` -- a state between "no project selected" (ProjectSelector) and "project open" (ProjectEditor). It renders a chat-like interface for the AI conversation alongside a live preview of the extracted plan. Wizard state persists to `wizard-state.json` on disk after every AI turn, enabling resume after app restart. On completion, a new atomic IPC handler (`writing:project:createFromWizard`) creates the project with all chapters, characters, and timeline in one operation.

**Primary recommendation:** Use prompt-level structured extraction with a two-phase approach: (1) conversational planning phase where AI and user discuss the book freely, (2) extraction phase where the AI is prompted to produce a structured JSON plan from the conversation. The user reviews and edits the extracted plan in a form UI before confirming project creation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | ^4.4.7 | `wizardStore.ts` for wizard state management | Already installed. Follows `chatPaneStore.ts` and `feedbackStore.ts` patterns. |
| `zod` | ^4.3.6 | Validate wizard output JSON before project creation | Already installed. Used for schema validation of AI-extracted structured data. |
| `react-markdown` | ^10.1.0 | Render AI streaming responses in wizard chat | Already installed. Same as ChatPane pattern. |

### Supporting (already installed, no new deps)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.303.0 | Icons for wizard UI (Wand2, BookOpen, Users, etc.) | Wizard step indicators, buttons |
| `gateway.ts` | existing | `sendChatWithCallbacks` for AI conversation | All wizard AI interactions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt-level JSON extraction | Claude API tool-calling (`strict: true`) | Gateway doesn't expose tool params. Would require gateway modification or direct API calls. Prompt extraction is sufficient for wizard's batch-extraction pattern. |
| Manual JSON parsing | `zod` schema validation | Zod already installed, provides typed validation + error messages. `JSON.parse` alone is fragile. |
| Wizard form library (react-step-wizard) | Custom step state in Zustand | Wizard is conversational, not form-based. Step libraries add wrong abstraction. Simple `step` state in store is sufficient. |
| Streaming structured output | Post-conversation extraction | Extracting structure after each turn adds latency and complexity. Better: let conversation flow freely, extract once when user says "done planning." |

**Installation:**
```bash
# No new packages needed. All dependencies already installed.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/writing/
│   ├── WritingWorkspace.tsx          # MODIFY — add wizard routing (wizardActive → SetupWizard)
│   ├── ProjectSelector.tsx           # MODIFY — add "New Project with AI" button
│   ├── SetupWizard.tsx               # NEW — wizard orchestrator (chat + plan preview + review)
│   ├── WizardChat.tsx                # NEW — chat UI for wizard conversation (reuses ChatMessage/ChatInput patterns)
│   ├── WizardPlanPreview.tsx         # NEW — live sidebar showing extracted plan (chapters, characters)
│   ├── WizardReview.tsx              # NEW — editable review form before project creation
│   └── ... (existing components unchanged)
├── store/
│   ├── wizardStore.ts                # NEW — wizard state, messages, extracted plan, step management
│   └── ... (existing stores unchanged)
├── lib/
│   ├── wizardPrompts.ts              # NEW — agent-specialized system prompts and extraction prompts
│   └── wizardSchema.ts              # NEW — Zod schemas for wizard plan validation
electron/
├── writing-project-service.ts        # MODIFY — add createFromWizard IPC handler
├── writing-wizard-service.ts         # NEW — wizard state persistence (wizard-state.json CRUD)
├── preload.ts                        # MODIFY — add wizard bridge methods
└── paths.ts                          # MODIFY — add wizardStatePath helper
```

### Pattern 1: Wizard State Machine

**What:** The wizard follows a simple state machine: `idle` -> `braindump` -> `conversation` -> `extracting` -> `review` -> `creating` -> `complete`.

**When to use:** Always. Every wizard interaction follows this flow.

**Example:**
```typescript
// wizardStore.ts
type WizardStep = 'idle' | 'braindump' | 'conversation' | 'extracting' | 'review' | 'creating' | 'complete';

interface WizardPlan {
  title: string;
  type: string;  // 'memoir' | 'novel' | 'fantasy' | 'scifi' | 'thriller' | etc.
  genre: string;
  premise: string;
  themes: string[];
  storyArc: string;
  chapters: { title: string; synopsis: string }[];
  characters: { name: string; role: string; description: string; traits: string[] }[];
  timeline: { date: string; description: string }[];
}

interface WizardState {
  step: WizardStep;
  sessionId: string | null;       // wizard session ID for gateway session key
  messages: ChatMessage[];         // conversation history
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;           // 'writer' for novels, 'jess' for memoirs
  plan: WizardPlan | null;         // extracted plan (populated after extraction step)
  extractionError: string | null;  // if JSON parsing fails
  error: string | null;

  // Actions
  startWizard: () => void;
  cancelWizard: () => void;
  sendMessage: (text: string) => void;
  extractPlan: () => void;         // trigger AI to produce structured JSON
  updatePlan: (updates: Partial<WizardPlan>) => void;  // user edits in review
  finalize: () => Promise<string | null>;  // create project, return projectId
  resumeWizard: (savedState: any) => void;
}
```

### Pattern 2: Prompt-Level Structured Extraction

**What:** Since the OpenClaw Gateway's `sendChatWithCallbacks` does not expose Claude's tool-calling API or `output_config` parameter, structured data extraction happens through prompting. The wizard uses a two-phase approach: free conversation, then explicit extraction.

**CRITICAL: The gateway `chat.send` method only accepts `{message, sessionKey, idempotencyKey}`. There is no way to pass `tools`, `output_config`, or `tool_choice` through the gateway. Structured output must be prompt-engineered.**

**Example:**
```typescript
// wizardPrompts.ts

// Phase 1: Conversational planning prompt (used during braindump + conversation steps)
export function buildConversationPrompt(agent: string, brainDump: string, existingPlan: string): string {
  const preamble = agent === 'jess'
    ? 'You are Jess, a therapist and editorial guide helping plan a memoir...'
    : 'You are a skilled writing assistant helping plan a book...';

  return [
    preamble,
    '',
    '## Your Role',
    'Help the user plan their book through conversation. Ask clarifying questions.',
    'Propose structure, characters, themes. Be collaborative, not prescriptive.',
    'Keep track of what has been decided so far.',
    '',
    existingPlan ? `## Decisions So Far\n${existingPlan}\n` : '',
    '## User\'s Book Idea',
    brainDump,
  ].join('\n');
}

// Phase 2: Extraction prompt (used when user clicks "Generate Plan")
export function buildExtractionPrompt(conversationSummary: string): string {
  return [
    'Based on our conversation, produce a structured book plan.',
    'Return ONLY a JSON code block with the following structure.',
    'Do not include any text outside the JSON block.',
    '',
    '```json',
    '{',
    '  "title": "Book Title",',
    '  "type": "memoir|novel|fantasy|scifi|thriller|romance|literary|nonfiction",',
    '  "genre": "Specific genre description",',
    '  "premise": "One paragraph premise",',
    '  "themes": ["theme1", "theme2"],',
    '  "storyArc": "Multi-paragraph story arc summary",',
    '  "chapters": [',
    '    {"title": "Chapter Title", "synopsis": "Brief chapter synopsis"}',
    '  ],',
    '  "characters": [',
    '    {"name": "Name", "role": "protagonist|antagonist|supporting|narrator",',
    '     "description": "Description", "traits": ["trait1", "trait2"]}',
    '  ],',
    '  "timeline": [',
    '    {"date": "Time marker", "description": "What happens"}',
    '  ]',
    '}',
    '```',
    '',
    '## Conversation Summary',
    conversationSummary,
  ].join('\n');
}

// Parse JSON from AI response (handles ```json...``` blocks)
export function parseWizardPlan(response: string): WizardPlan | null {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    return wizardPlanSchema.parse(parsed);  // Zod validation
  } catch {
    return null;
  }
}
```

### Pattern 3: Wizard State Persistence for Resume

**What:** Persist wizard state to disk after every AI turn so the user can resume after app restart.

**Storage:** `~/froggo/writing-projects/_wizard-state/{sessionId}/wizard-state.json`

**Why not project directory:** The project doesn't exist yet during the wizard. Use a temporary wizard-state directory. Clean up on wizard completion or cancellation.

**Example:**
```typescript
// electron/writing-wizard-service.ts
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { WRITING_PROJECTS_DIR } from './paths';

const WIZARD_STATE_DIR = path.join(WRITING_PROJECTS_DIR, '_wizard-state');

async function saveWizardState(sessionId: string, state: any) {
  const dir = path.join(WIZARD_STATE_DIR, sessionId);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, 'wizard-state.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );
  return { success: true };
}

async function loadWizardState(sessionId: string) {
  try {
    const filepath = path.join(WIZARD_STATE_DIR, sessionId, 'wizard-state.json');
    const raw = await fs.promises.readFile(filepath, 'utf-8');
    return { success: true, state: JSON.parse(raw) };
  } catch (err: any) {
    if (err.code === 'ENOENT') return { success: true, state: null };
    return { success: false, error: err.message };
  }
}

async function listPendingWizards() {
  // Returns list of incomplete wizard sessions for resume prompt
  try {
    await fs.promises.mkdir(WIZARD_STATE_DIR, { recursive: true });
    const entries = await fs.promises.readdir(WIZARD_STATE_DIR, { withFileTypes: true });
    const wizards = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const stateFile = path.join(WIZARD_STATE_DIR, entry.name, 'wizard-state.json');
        const raw = await fs.promises.readFile(stateFile, 'utf-8');
        const state = JSON.parse(raw);
        if (state.step !== 'complete') {
          wizards.push({ sessionId: entry.name, ...state });
        }
      } catch { /* skip invalid entries */ }
    }
    return { success: true, wizards };
  } catch (e: any) {
    return { success: false, error: e.message, wizards: [] };
  }
}

async function deleteWizardState(sessionId: string) {
  try {
    await fs.promises.rm(path.join(WIZARD_STATE_DIR, sessionId), { recursive: true, force: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function registerWritingWizardHandlers() {
  ipcMain.handle('writing:wizard:save', async (_, sessionId, state) => saveWizardState(sessionId, state));
  ipcMain.handle('writing:wizard:load', async (_, sessionId) => loadWizardState(sessionId));
  ipcMain.handle('writing:wizard:list', async () => listPendingWizards());
  ipcMain.handle('writing:wizard:delete', async (_, sessionId) => deleteWizardState(sessionId));
  console.log('[writing-wizard] IPC handlers registered');
}
```

### Pattern 4: Atomic Project Creation from Wizard

**What:** A single IPC handler that creates the entire project (project.json, chapters, characters, timeline) atomically from wizard output.

**Example:**
```typescript
// writing-project-service.ts — new handler
async function createProjectFromWizard(wizardData: {
  title: string;
  type: string;
  genre: string;
  premise: string;
  themes: string[];
  storyArc: string;
  chapters: { title: string; synopsis: string }[];
  characters: { name: string; role: string; description: string; traits: string[] }[];
  timeline: { date: string; description: string }[];
}) {
  const id = generateProjectId();
  const projectDir = writingProjectPath(id);
  const now = new Date().toISOString();

  try {
    // Create directory structure
    await ensureDir(projectDir);
    await ensureDir(path.join(projectDir, 'chapters'));
    await ensureDir(path.join(projectDir, 'memory'));
    await ensureDir(path.join(projectDir, 'versions'));

    // Write project.json with extended metadata
    const meta = {
      id, title: wizardData.title, type: wizardData.type,
      genre: wizardData.genre, premise: wizardData.premise,
      themes: wizardData.themes, storyArc: wizardData.storyArc,
      wizardComplete: true, createdAt: now, updatedAt: now,
    };
    await writeJson(path.join(projectDir, 'project.json'), meta);

    // Write chapters.json and chapter files
    const chapters = wizardData.chapters.map((ch, i) => {
      const position = i + 1;
      const paddedPos = String(position).padStart(2, '0');
      const filename = `${paddedPos}-${slugify(ch.title)}.md`;
      return {
        id: generateChapterId(), title: ch.title, filename, position,
        synopsis: ch.synopsis, createdAt: now, updatedAt: now,
      };
    });
    await writeJson(path.join(projectDir, 'chapters.json'), chapters);
    for (const ch of chapters) {
      await fs.promises.writeFile(
        writingChapterPath(id, ch.filename), '', 'utf-8'
      );
    }

    // Write characters.json
    const characters = wizardData.characters.map(c => ({
      id: `char-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: c.name, relationship: c.role, description: c.description,
      traits: c.traits, createdAt: now, updatedAt: now,
    }));
    await writeJson(path.join(projectDir, 'memory', 'characters.json'), characters);

    // Write timeline.json
    const timeline = wizardData.timeline.map((t, i) => ({
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      date: t.date, description: t.description, chapterRefs: [],
      position: i, createdAt: now, updatedAt: now,
    }));
    await writeJson(path.join(projectDir, 'memory', 'timeline.json'), timeline);

    return { success: true, project: meta };
  } catch (e: any) {
    // Cleanup on failure
    try { await fs.promises.rm(projectDir, { recursive: true, force: true }); } catch {}
    return { success: false, error: e.message };
  }
}
```

### Pattern 5: Agent-Specialized Wizard Prompts (WIZARD-09)

**What:** Use different agents and prompts depending on the book type. Jess for memoir emotional arc, Writer for novel plot structure.

**Example:**
```typescript
// wizardPrompts.ts
export const WIZARD_AGENTS: Record<string, { id: string; name: string; preamble: string }> = {
  memoir: {
    id: 'jess',
    name: 'Jess',
    preamble: [
      'You are Jess, helping plan a memoir. Focus on:',
      '- Emotional arc: what transformation does the reader witness?',
      '- Boundary awareness: what to reveal vs. protect',
      '- Timeline structure: chronological vs. thematic ordering',
      '- Key characters: relationships and their evolution',
      '- Sensitive disclosure pacing: when to reveal difficult truths',
    ].join('\n'),
  },
  novel: {
    id: 'writer',
    name: 'Writer',
    preamble: [
      'You are a skilled writing assistant helping plan a novel. Focus on:',
      '- Plot structure: inciting incident, rising action, climax, resolution',
      '- Character development: protagonist arc, antagonist motivation',
      '- World-building: setting, rules, atmosphere',
      '- Chapter pacing: scene breaks, tension management',
      '- Theme integration: how themes emerge through plot and character',
    ].join('\n'),
  },
};

export function getWizardAgent(bookType: string) {
  if (bookType === 'memoir') return WIZARD_AGENTS.memoir;
  return WIZARD_AGENTS.novel;  // default for all other types
}
```

### Pattern 6: WritingWorkspace Routing with Wizard State

**What:** Modify WritingWorkspace to support three states: project list, wizard, or project editor.

**Example:**
```typescript
// WritingWorkspace.tsx (modified)
export default function WritingWorkspace() {
  const { activeProjectId, activeProject, loadProjects } = useWritingStore();
  const { step: wizardStep } = useWizardStore();

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Wizard active — show wizard UI
  if (wizardStep !== 'idle') {
    return <SetupWizard />;
  }

  // No active project — show project list
  if (!activeProjectId || !activeProject) {
    return <ProjectSelector />;
  }

  // Active project — full editor
  return <div className="h-full bg-clawd-bg"><ProjectEditor /></div>;
}
```

### Anti-Patterns to Avoid

- **Parsing free-form AI conversation into structured data at the end:** Do NOT try to extract chapters/characters from 20 turns of natural conversation. Use a dedicated extraction step with a structured prompt.
- **Tool-calling through the gateway:** Do NOT try to pass `tools` parameter through `gateway.sendChatWithCallbacks`. The gateway `chat.send` method does not support it. Use prompt-level extraction instead.
- **Wizard state in localStorage:** Do NOT store wizard state in localStorage. The wizard conversation could be 50KB+ of messages. Use file-based persistence via IPC (following the chat-history JSONL pattern).
- **Creating project during wizard conversation:** Do NOT call `createProject` during the conversation phase. Wait until the user reviews and confirms the plan, then create everything atomically.
- **Single extraction attempt:** Do NOT assume the first extraction will produce valid JSON. Have a retry mechanism: if parsing fails, send a follow-up message asking the AI to fix the JSON.
- **Modifying existing `createProject` signature:** Do NOT change the existing `createProject(title, type)` function. Add a new `createProjectFromWizard` handler. The quick-create flow (WIZARD-07) must keep working.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON validation from AI output | Manual field checks | `zod` schema validation | Already installed. Handles nested objects, arrays, optional fields. Provides typed errors on validation failure. |
| Chat streaming in wizard | Custom WebSocket handler | Existing `gateway.sendChatWithCallbacks()` | Proven in ChatPane and FeedbackPopover. Per-runId callbacks. Same streaming pattern. |
| Chat message rendering | Custom markdown parser | Existing `react-markdown` + `ChatMessage` component | Reuse the Phase 11 ChatMessage component directly. |
| Step indicator UI | Step wizard library | Simple `step` state + Tailwind | Wizard is 5 steps. A 3-line conditional render is simpler than a library. |
| File persistence | Custom serialization | `JSON.stringify` + `fs.promises.writeFile` | Same pattern as every other writing service. No need for anything fancier. |
| Agent selection logic | Complex routing | Simple `if (type === 'memoir') 'jess' else 'writer'` | WIZARD-09 only requires 2 agent specializations. Don't over-engineer. |

**Key insight:** The wizard is primarily a UI orchestration problem, not a technology problem. The hard part is prompt engineering for reliable JSON extraction and the UX flow for review/edit. All infrastructure (gateway streaming, file persistence, Zustand stores, IPC patterns) is already proven.

## Common Pitfalls

### Pitfall 1: AI Returns Prose Instead of JSON During Extraction

**What goes wrong:** The extraction prompt asks for JSON, but the AI returns a mix of prose and JSON, or JSON that doesn't match the schema. `JSON.parse()` fails. User sees an error after a 30-second wait.

**Why it happens:** LLMs naturally produce prose. Even with explicit "return ONLY JSON" instructions, the model may add preamble text like "Here's the plan:" before the JSON block. The gateway session accumulates conversation context that biases toward conversational output.

**How to avoid:**
1. Use a dedicated extraction step with a fresh gateway session key: `agent:{agent}:writing:wizard-extract:{sessionId}`. This isolates the extraction from the conversational context.
2. Parse JSON from markdown code blocks (`\`\`\`json ... \`\`\``), not the raw response. This tolerates preamble text.
3. If parsing fails, retry ONCE with a follow-up message: "The previous response could not be parsed. Please return ONLY a JSON code block with no other text."
4. If retry also fails, show the user the raw response and a manual "Try again" button.
5. Validate with Zod schema. On validation failure, show which fields are missing/wrong and let the user fix in the review form.

**Warning signs:** `JSON.parse` errors in console. Extraction spinner never resolves. Plan preview shows empty fields.

### Pitfall 2: Wizard State Lost on Navigation

**What goes wrong:** User is 15 turns into planning, clicks sidebar to check Kanban board, returns to writing tab -- wizard is reset to step 1. All conversation and extracted data gone.

**Why it happens:** `WritingWorkspace` remounts when navigating away. `wizardStore` resets to initial state. No persistence layer between component mounts.

**How to avoid:**
1. Persist wizard state to disk after every AI turn via `writing:wizard:save` IPC.
2. On `WritingWorkspace` mount, check for pending wizard state via `writing:wizard:list` IPC.
3. If pending wizard found, offer "Resume wizard?" prompt before showing ProjectSelector.
4. Add navigation guard: when wizard is active and user tries to navigate away, show "Wizard in progress. Leave?" confirmation.
5. Store conversation messages in the wizard state file (not just extracted plan).

**Warning signs:** User complaints about lost planning sessions. Wizard state file missing after navigation.

### Pitfall 3: Wizard Creates Duplicate or Partial Projects

**What goes wrong:** User clicks "Create Project" button, network is slow, they click again. Two projects created. Or: creation fails after writing chapters.json but before characters.json. Project exists with chapters but no characters.

**Why it happens:** No idempotency on the create button. No atomicity on the multi-file write.

**How to avoid:**
1. Disable the "Create Project" button immediately on click. Set `step: 'creating'` in store.
2. Use the `createProjectFromWizard` handler which writes all files before returning success.
3. On any write failure, clean up the entire project directory (rollback).
4. After successful creation, delete the wizard state file and set `step: 'complete'`.
5. Show a loading state during creation with a "Creating project..." message.

**Warning signs:** Duplicate projects in the list. Projects with 0 characters but populated chapters.

### Pitfall 4: Project Type Expansion Breaks Existing Code

**What goes wrong:** WIZARD-11 requires expanding project type beyond 'memoir' | 'novel'. But `ProjectMeta.type` is typed as `'memoir' | 'novel'` throughout the codebase. Adding new types causes TypeScript errors or silent mismatches.

**Why it happens:** The type union is hardcoded in `writing-project-service.ts` (line 23), `writingStore.ts` (line 8), and `ProjectSelector.tsx` (type buttons).

**How to avoid:**
1. Change the type field to `string` with a known-values pattern: `type: string` in the TypeScript interface, with a `KNOWN_TYPES` constant for UI rendering.
2. Existing memoir/novel projects continue working. New types from the wizard (fantasy, scifi, etc.) are stored as-is.
3. `ProjectSelector.tsx` quick-create keeps only memoir/novel buttons (WIZARD-07 specifies existing form remains).
4. The wizard can set any type string. The review form shows a text input or dropdown for type.
5. Display type with `capitalize()` in the UI -- no need for a type-to-label mapping for every genre.

**Warning signs:** TypeScript errors on `type: 'fantasy'`. Type badge shows "unknown" for wizard-created projects.

### Pitfall 5: Conversation Context Grows Too Large for Extraction

**What goes wrong:** After 30+ turns of planning conversation, the AI's context is full. The extraction prompt plus the accumulated conversation exceeds the model's context window. The AI produces a truncated or degraded plan.

**Why it happens:** `sendChatWithCallbacks` uses a gateway session that accumulates all messages. Long wizard sessions (30 min+) produce large context.

**How to avoid:**
1. For the extraction step, use a SEPARATE gateway session key (not the conversation session). Build the extraction prompt explicitly with a SUMMARY of the conversation decisions, not the full message history.
2. Before extraction, build a conversation summary: concatenate key decisions (not full messages) into a compact context string.
3. Limit the summary to ~4000 characters. Focus on: decided title, type, confirmed chapters, confirmed characters, agreed themes.
4. Show a message count indicator in the wizard UI. After 20 messages, suggest "Ready to generate your plan?"

**Warning signs:** Extraction produces fewer chapters/characters than discussed. AI response is slow during extraction. Missing details in extracted plan.

## Code Examples

### Zod Schema for Wizard Plan Validation

```typescript
// src/lib/wizardSchema.ts
import { z } from 'zod';

export const wizardChapterSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string(),
});

export const wizardCharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string(),
  description: z.string(),
  traits: z.array(z.string()),
});

export const wizardTimelineSchema = z.object({
  date: z.string(),
  description: z.string(),
});

export const wizardPlanSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  genre: z.string(),
  premise: z.string(),
  themes: z.array(z.string()),
  storyArc: z.string(),
  chapters: z.array(wizardChapterSchema).min(1),
  characters: z.array(wizardCharacterSchema),
  timeline: z.array(wizardTimelineSchema),
});

export type WizardPlan = z.infer<typeof wizardPlanSchema>;
```

### Gateway Session Key for Wizard

```typescript
// Conversation session (persistent multi-turn):
const conversationSessionKey = `agent:${agentId}:writing:wizard:${sessionId}`;

// Extraction session (one-shot, separate from conversation):
const extractionSessionKey = `agent:${agentId}:writing:wizard-extract:${sessionId}`;
```

### Wizard Store with Persistence

```typescript
// src/store/wizardStore.ts
import { create } from 'zustand';
import type { WizardPlan } from '../lib/wizardSchema';
import type { ChatMessage } from './chatPaneStore';

type WizardStep = 'idle' | 'braindump' | 'conversation' | 'extracting' | 'review' | 'creating' | 'complete';

interface WizardState {
  step: WizardStep;
  sessionId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;
  brainDump: string;
  plan: WizardPlan | null;
  extractionError: string | null;
  error: string | null;

  // Actions
  startWizard: () => void;
  cancelWizard: () => void;
  setStep: (step: WizardStep) => void;
  setBrainDump: (text: string) => void;
  setSelectedAgent: (agent: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setPlan: (plan: WizardPlan | null) => void;
  updatePlan: (updates: Partial<WizardPlan>) => void;
  setExtractionError: (err: string | null) => void;
  setError: (err: string | null) => void;
  clearMessages: () => void;
  loadState: (state: Partial<WizardState>) => void;
  reset: () => void;
}

const bridge = () => (window as any).clawdbot?.writing?.wizard;

export const useWizardStore = create<WizardState>((set, get) => ({
  step: 'idle',
  sessionId: null,
  messages: [],
  streaming: false,
  streamContent: '',
  selectedAgent: 'writer',
  brainDump: '',
  plan: null,
  extractionError: null,
  error: null,

  startWizard: () => {
    const sessionId = `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ step: 'braindump', sessionId, messages: [], plan: null, error: null });
  },
  cancelWizard: async () => {
    const { sessionId } = get();
    if (sessionId) {
      try { await bridge()?.delete(sessionId); } catch {}
    }
    set({ step: 'idle', sessionId: null, messages: [], plan: null, error: null,
          streaming: false, streamContent: '', brainDump: '' });
  },
  setStep: (step) => set({ step }),
  setBrainDump: (text) => set({ brainDump: text }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setPlan: (plan) => set({ plan }),
  updatePlan: (updates) => set((s) => ({
    plan: s.plan ? { ...s.plan, ...updates } : null,
  })),
  setExtractionError: (err) => set({ extractionError: err }),
  setError: (err) => set({ error: err }),
  clearMessages: () => set({ messages: [], streamContent: '' }),
  loadState: (state) => set(state),
  reset: () => set({
    step: 'idle', sessionId: null, messages: [], streaming: false,
    streamContent: '', selectedAgent: 'writer', brainDump: '',
    plan: null, extractionError: null, error: null,
  }),
}));
```

### Persist After Every AI Turn

```typescript
// In the wizard chat send handler, after AI response completes:
async function persistWizardState() {
  const state = useWizardStore.getState();
  if (!state.sessionId) return;
  try {
    await bridge()?.save(state.sessionId, {
      step: state.step,
      sessionId: state.sessionId,
      messages: state.messages,
      selectedAgent: state.selectedAgent,
      brainDump: state.brainDump,
      plan: state.plan,
    });
  } catch {
    // Persistence failure is non-critical but should be logged
    console.warn('[wizard] Failed to persist state');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Form-based setup wizard (react-step-wizard) | Conversational AI wizard | 2024+ (Sudowrite, Novelcrafter) | Wizard is a conversation, not a form. Step libraries are wrong abstraction. |
| Tool-calling for structured extraction | Prompt-level JSON extraction | N/A (gateway limitation) | OpenClaw gateway doesn't expose tool params. Prompt extraction with JSON code blocks is the practical approach. |
| Project type as union type `'memoir' \| 'novel'` | Project type as `string` with known-values constant | This phase | Enables WIZARD-11 (genre beyond memoir/novel) without breaking TypeScript. |
| Single `createProject(title, type)` | Dual path: quick-create + `createFromWizard` | This phase | Quick-create preserved (WIZARD-07). Wizard gets atomic bulk creation. |

**Deprecated/outdated:**
- Rigid step-based wizard libraries: Wrong abstraction for conversational planning
- Client-side tool-calling through gateway: Not supported by OpenClaw Gateway's `chat.send` API

## Open Questions

1. **Extraction reliability without tool-calling**
   - What we know: Prompt-level extraction with JSON code blocks works for single-shot extraction. The AI reliably produces JSON when explicitly asked for it.
   - What's unclear: How reliably the AI produces valid JSON that passes Zod validation after a 20+ turn conversation. The extraction prompt quality is critical.
   - Recommendation: Build the extraction with retry logic (one auto-retry on parse failure). During implementation, test with real conversations and refine the extraction prompt. If extraction fails >10% of the time, consider using a separate direct Claude API call (bypassing the gateway) for the extraction step only.

2. **Wizard resume across app restarts**
   - What we know: File-based persistence of wizard state works (proven by chat-history JSONL pattern). Gateway sessions may survive restarts.
   - What's unclear: Whether the gateway session for the wizard conversation survives an app restart. If it does, the AI retains multi-turn context. If it doesn't, the AI starts fresh and only has the persisted wizard state as context.
   - Recommendation: Always persist the full message history in wizard-state.json. On resume, rebuild the conversation context from persisted messages in the system prompt, regardless of whether the gateway session survived. This makes resume robust to gateway session expiry.

3. **How many genres to support (WIZARD-11)**
   - What we know: Current codebase hardcodes `'memoir' | 'novel'`. The requirement says "select or let AI infer the genre/type beyond memoir/novel."
   - What's unclear: Whether to show a fixed genre list or let the user type anything.
   - Recommendation: Show a dropdown with common genres (memoir, novel, fantasy, sci-fi, thriller, romance, literary fiction, nonfiction) plus a "Other" option that accepts free text. The AI can also suggest a genre during conversation. Store as `string` in project.json -- no enum constraint.

## Sources

### Primary (HIGH confidence)
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- JSON schema enforcement, Zod integration, constrained decoding
- [Claude Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) -- Tool-calling API (not usable through gateway, but informs prompt design)
- Codebase files (verified by direct reading):
  - `src/lib/gateway.ts` -- `sendChatWithCallbacks` API (no tool params)
  - `src/store/chatPaneStore.ts` -- Zustand store pattern for chat
  - `src/store/feedbackStore.ts` -- Zustand store pattern (simple, focused)
  - `src/store/writingStore.ts` -- Bridge pattern, project state management
  - `src/components/writing/ChatPane.tsx` -- Streaming chat pattern
  - `src/components/writing/ProjectSelector.tsx` -- Current create flow (title + type)
  - `src/components/writing/WritingWorkspace.tsx` -- Routing between selector/editor
  - `electron/writing-project-service.ts` -- Project/chapter CRUD, file layout
  - `electron/writing-memory-service.ts` -- Characters/timeline/facts CRUD
  - `electron/writing-chat-service.ts` -- JSONL persistence pattern
  - `electron/paths.ts` -- Path resolver (writingProjectPath, writingMemoryPath)
  - `electron/preload.ts` -- Bridge namespace structure
  - `electron/main.ts` -- IPC handler registration pattern

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` -- Prior pitfall analysis (C1, H1, H4, M2, I1, I3 all relevant)
- `.planning/research/ARCHITECTURE.md` -- Prior architecture analysis (wizard store interface, component structure)
- `.planning/research/SUMMARY.md` -- Prior research summary (wizard phase recommendations)
- `.planning/phases/11-chat-layout/11-RESEARCH.md` -- Phase 11 patterns (gateway streaming, session keys, store architecture)

### Tertiary (LOW confidence)
- [Agenta Guide to Structured Outputs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms) -- General LLM structured output patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new packages needed. All infrastructure proven in Phase 11.
- Architecture: HIGH -- Direct codebase analysis of all integration points. Store/IPC/preload patterns verified.
- Pitfalls: HIGH -- Gateway limitation (no tool-calling) verified by reading gateway.ts. State persistence patterns proven by chat-history service. Extraction reliability is the main risk, mitigated by retry + review step.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (all dependencies stable, gateway API unlikely to change)
