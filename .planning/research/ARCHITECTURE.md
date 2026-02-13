# Architecture Patterns: AI Writing UX Redesign Integration

**Domain:** AI-powered book creation features for existing Electron + React writing module
**Researched:** 2026-02-13
**Confidence:** HIGH (direct source code analysis of existing codebase)

---

## Executive Summary

The existing writing module is a well-structured 2-pane layout (ChapterSidebar + ChapterEditor) with toggleable context/version panels. The new features require three architectural changes: (1) a multi-step wizard flow before the editor, (2) replacing the toggleable 2-pane layout with a permanent 3-pane layout, and (3) adding a conversational AI chat pane that can push content to the TipTap editor. All three integrate cleanly with the existing Electron service layer, Zustand stores, and OpenClaw Gateway WebSocket patterns.

---

## 1. Existing Architecture Map

### 1.1 Layer Stack (Current)

```
Renderer (React + Vite)
  src/components/writing/WritingWorkspace.tsx  -- route: ProjectSelector | ProjectEditor
  src/components/writing/ProjectSelector.tsx   -- project list + create form
  src/components/writing/ProjectEditor.tsx     -- layout: ChapterSidebar | ChapterEditor | [ContextPanel] | [VersionPanel]
  src/components/writing/ChapterEditor.tsx     -- TipTap editor with BubbleMenu (FeedbackPopover)
  src/components/writing/ChapterSidebar.tsx    -- chapter list with dnd-kit drag-n-drop
  src/components/writing/ContextPanel.tsx      -- tabbed: Characters | Timeline | Facts | Sources
  src/components/writing/FeedbackPopover.tsx   -- inline AI feedback (gateway.sendChatWithCallbacks)

Stores (Zustand)
  src/store/writingStore.ts   -- project/chapter CRUD, active state
  src/store/feedbackStore.ts  -- inline feedback UI state (streaming, alternatives)
  src/store/memoryStore.ts    -- characters, timeline, facts (per-project)
  src/store/researchStore.ts  -- research sources, fact-source links (per-project)
  src/store/versionStore.ts   -- version snapshots, diffs

Preload Bridge
  electron/preload.ts         -- window.clawdbot.writing.{project,chapter,feedback,memory,research,version}

Electron Main Process
  electron/writing-project-service.ts   -- project + chapter file CRUD
  electron/writing-feedback-service.ts  -- JSONL feedback logging
  electron/writing-memory-service.ts    -- characters, timeline, facts JSON CRUD
  electron/writing-research-service.ts  -- per-project SQLite research.db
  electron/writing-version-service.ts   -- file-copy snapshots with manifest
  electron/paths.ts                     -- WRITING_PROJECTS_DIR, writingProjectPath(), etc.

AI Communication
  src/lib/gateway.ts          -- Gateway class with sendChatWithCallbacks(message, sessionKey, callbacks)
                              -- sessionKey pattern: "agent:{agentId}:writing:{projectId}"
                              -- Streaming via runId-keyed callbacks (onDelta, onMessage, onEnd, onError)

Storage
  ~/froggo/writing-projects/{projectId}/
    project.json              -- { id, title, type, createdAt, updatedAt }
    chapters.json             -- [{ id, title, filename, position, createdAt, updatedAt }]
    chapters/                 -- 01-slug.md, 02-slug.md, ...
    memory/                   -- characters.json, timeline.json, facts.json, feedback-{chapterId}.jsonl
    versions/{chapterId}/     -- versions.json + v-{timestamp}.md snapshots
    research.db               -- SQLite: sources, fact_sources tables
```

### 1.2 Current Data Flow

```
User action in React component
  --> Zustand store action
    --> window.clawdbot.writing.* (preload bridge)
      --> ipcRenderer.invoke('writing:*')
        --> ipcMain.handle('writing:*') in electron/*-service.ts
          --> File system or SQLite operations
        <-- Return { success: boolean, ... }
      <-- IPC response
    <-- Store state update
  <-- React re-render

AI feedback flow:
  FeedbackPopover.handleSend()
    --> gateway.sendChatWithCallbacks(prompt, sessionKey, { onDelta, onEnd, onError })
      --> WebSocket request('chat.send', { message, sessionKey })
      <-- Streaming events via runId-keyed callbacks
    --> feedbackStore.setStreamContent(accumulated)
    --> feedbackStore.setAlternatives(parsed)
```

### 1.3 Current Layout Flow

```
WritingWorkspace
  |
  +-- (no activeProjectId) --> ProjectSelector
  |                              title input + type picker + project list
  |
  +-- (activeProjectId)   --> ProjectEditor
                               |
                               +-- ChapterSidebar (w-64, border-r)
                               +-- ChapterEditor (flex-1) or empty state
                               +-- [ContextPanel (w-72, border-l)] -- toggled via button
                               +-- [VersionPanel (w-80, border-l)] -- toggled, mutually exclusive with context
```

---

## 2. Integration Plan: Setup Wizard

### 2.1 What Changes

The current project creation is a simple form inside ProjectSelector (title + type picker). The new setup wizard replaces this with a multi-turn AI conversation that produces a richer project structure (genre, themes, chapter outline, character sketches, etc.).

### 2.2 Component Architecture

```
WritingWorkspace (modified)
  |
  +-- (no activeProjectId, no wizardActive) --> ProjectSelector (modified)
  |                                               - "New Project" opens wizard instead of inline form
  |
  +-- (wizardActive)                         --> SetupWizard (NEW)
  |                                               - Multi-step conversational UI
  |                                               - AI chat + structured data collection
  |                                               - On complete: creates project + navigates to editor
  |
  +-- (activeProjectId)                      --> ProjectEditor (redesigned to 3-pane)
```

### 2.3 New Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SetupWizard.tsx` | `src/components/writing/` | Orchestrates the multi-step wizard flow |
| `WizardChat.tsx` | `src/components/writing/` | Chat UI for AI conversation within wizard |
| `WizardStepIndicator.tsx` | `src/components/writing/` | Progress indicator for wizard steps |
| `WizardSummary.tsx` | `src/components/writing/` | Final review before project creation |

### 2.4 Store Changes

**New store: `src/store/wizardStore.ts`**

```typescript
interface WizardState {
  active: boolean;
  step: 'genre' | 'premise' | 'outline' | 'characters' | 'review';
  messages: { role: 'user' | 'assistant'; content: string }[];
  streaming: boolean;
  streamContent: string;

  // Collected data (populated from AI conversation)
  collected: {
    title: string;
    type: 'memoir' | 'novel';
    genre: string;
    premise: string;
    themes: string[];
    chapterOutline: { title: string; synopsis: string }[];
    characters: { name: string; relationship: string; description: string }[];
  };

  // Actions
  startWizard: () => void;
  cancelWizard: () => void;
  sendMessage: (message: string) => Promise<void>;
  setStep: (step: string) => void;
  updateCollected: (data: Partial<WizardState['collected']>) => void;
  finalize: () => Promise<string | null>; // creates project, returns projectId
}
```

**Modified store: `writingStore.ts`**

No structural changes needed. The wizard calls `createProject()` at finalization, then the existing `openProject()` flow takes over. However, `createProject` needs an expanded signature to accept the wizard's richer data (chapter outline, characters, etc.).

### 2.5 Electron Service Changes

**Modified: `writing-project-service.ts`**

Add a new IPC handler for wizard-based project creation that accepts the full wizard output:

```typescript
// New handler
'writing:project:createFromWizard'  // (wizardData) -> { success, project }
```

This handler does everything `createProject` does PLUS:
- Creates initial chapters from the outline
- Populates characters.json from character data
- Writes a premise/themes file for AI context

**Preload bridge addition:**

```typescript
writing: {
  project: {
    // ... existing
    createFromWizard: (data: WizardData) => ipcRenderer.invoke('writing:project:createFromWizard', data),
  }
}
```

### 2.6 AI Communication Pattern

The wizard uses `gateway.sendChatWithCallbacks()` with a dedicated session key:

```typescript
const sessionKey = `agent:writer:writing-wizard:${wizardSessionId}`;
```

This keeps wizard conversations separate from editor feedback sessions. The writer agent handles all wizard conversation. The system prompt includes the current step context and collected data so far.

### 2.7 Build Order

1. `wizardStore.ts` -- state management
2. `SetupWizard.tsx` + child components -- UI
3. `writing-project-service.ts` -- `createFromWizard` handler
4. `preload.ts` -- bridge addition
5. `WritingWorkspace.tsx` -- routing logic
6. `ProjectSelector.tsx` -- "New Project" opens wizard

---

## 3. Integration Plan: 3-Pane Layout

### 3.1 What Changes

Current layout is 2 panes with toggleable right panels:
- ChapterSidebar (left, w-64) + ChapterEditor (center, flex-1) + optional ContextPanel/VersionPanel (right, toggled)

New layout is 3 permanent panes:
- ChapterSidebar (left) + ChatPane (center) + WorkspacePane (right, editor + tools)

### 3.2 Component Architecture

```
ProjectEditor (redesigned)
  |
  +-- ChapterSidebar (left pane, w-56)
  |     - Existing component, slightly narrower
  |     - Chapter list with dnd-kit
  |     - Project header + word count
  |
  +-- ChatPane (center pane, w-96 or resizable) (NEW)
  |     - Persistent AI conversation per project
  |     - Message history with streaming
  |     - Agent picker (writer, researcher, jess)
  |     - "Send to editor" action on AI responses
  |     - Context-aware: knows current chapter, outline, memory
  |
  +-- WorkspacePane (right pane, flex-1) (NEW)
        - Contains ChapterEditor (TipTap)
        - Toolbar area for version/context toggles
        - ContextPanel and VersionPanel as overlays or tabs within workspace
```

### 3.3 New Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `ChatPane.tsx` | `src/components/writing/` | Persistent AI chat for the writing project |
| `ChatMessage.tsx` | `src/components/writing/` | Single message rendering with actions |
| `WorkspacePane.tsx` | `src/components/writing/` | Container for editor + tools |
| `PaneDivider.tsx` | `src/components/writing/` | Resizable divider between panes (optional) |

### 3.4 Modified Components

| Component | Change |
|-----------|--------|
| `ProjectEditor.tsx` | Complete rewrite of layout to 3-pane structure |
| `ChapterSidebar.tsx` | Width reduced from w-64 to w-56, otherwise unchanged |
| `ChapterEditor.tsx` | Mostly unchanged, wrapped by WorkspacePane |
| `ContextPanel.tsx` | Moved into WorkspacePane as toggled overlay/tab |
| `VersionPanel.tsx` | Moved into WorkspacePane as toggled overlay/tab |
| `FeedbackPopover.tsx` | Unchanged -- BubbleMenu inline feedback still works |

### 3.5 Layout CSS Strategy

The 3-pane layout uses flexbox (consistent with existing codebase):

```tsx
// ProjectEditor.tsx (redesigned)
<div className="flex h-full">
  {/* Left pane: chapters */}
  <ChapterSidebar />   {/* w-56, flex-shrink-0 */}

  {/* Center pane: AI chat */}
  <ChatPane />          {/* w-96 or resizable, flex-shrink-0, border-x */}

  {/* Right pane: workspace (editor + tools) */}
  <WorkspacePane />     {/* flex-1, min-w-0 */}
</div>
```

### 3.6 Pane Sizing Considerations

| Pane | Min Width | Default Width | Resizable? |
|------|-----------|---------------|------------|
| ChapterSidebar | 180px | 224px (w-56) | Optional (v2) |
| ChatPane | 320px | 384px (w-96) | Yes (recommended) |
| WorkspacePane | 400px | flex-1 | Grows with window |

At 1440px window width (common laptop):
- Sidebar: 224px
- Chat: 384px
- Workspace: 832px (plenty for TipTap editor)

At 1280px window width (minimum comfortable):
- Sidebar: 224px
- Chat: 384px
- Workspace: 672px (still comfortable)

### 3.7 Build Order

1. `WorkspacePane.tsx` -- wraps existing ChapterEditor + context/version panels
2. `ChatPane.tsx` + `ChatMessage.tsx` -- chat UI (can use ChatPanel.tsx as reference)
3. `ProjectEditor.tsx` -- rewrite layout to 3-pane
4. `ChapterSidebar.tsx` -- width adjustment
5. Optional: `PaneDivider.tsx` for resizable panes

---

## 4. Integration Plan: Conversational Writing Flow

### 4.1 What Changes

Currently, AI interaction is limited to inline feedback (select text, get alternatives via BubbleMenu). The new conversational flow adds a persistent chat that can:
- Generate full passages of text
- Send generated content to the TipTap editor (append, replace selection, new chapter)
- Maintain conversation context across the writing session
- Access project memory (characters, timeline, facts) for context-aware generation

### 4.2 New Store: `src/store/chatPaneStore.ts`

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  actions?: {  // for assistant messages
    canSendToEditor: boolean;
    sentToEditor: boolean;
  };
}

interface ChatPaneState {
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;
  error: string | null;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  setInput: (text: string) => void;
  setSelectedAgent: (agentId: string) => void;
  sendToEditor: (messageId: string, mode: 'append' | 'replace' | 'cursor') => void;
  clearHistory: () => void;
  loadHistory: (projectId: string) => Promise<void>;
}
```

### 4.3 Critical Integration Point: Chat-to-Editor Data Flow

This is the most architecturally significant addition. The ChatPane needs to push content into the TipTap editor without creating tight coupling.

**Pattern: Event-based decoupling via Zustand**

```
ChatPane                                          WorkspacePane / ChapterEditor
  |                                                      |
  | chatPaneStore.sendToEditor(msgId, 'append')          |
  |   --> writingStore.setPendingInsert({                 |
  |         content: messageContent,                     |
  |         mode: 'append'                               |
  |       })                                             |
  |                                                      |
  |                    writingStore.pendingInsert ------> |
  |                                                      | useEffect watches pendingInsert
  |                                                      | editor.commands.insertContent()
  |                                                      | writingStore.clearPendingInsert()
```

**Why this pattern:**
- ChapterEditor already imports `useWritingStore`
- No direct ref passing between sibling components
- Works with React's data flow (state down, events up)
- TipTap insertion happens in the component that owns the editor instance

**WritingStore additions:**

```typescript
// Add to WritingState interface
pendingInsert: {
  content: string;
  mode: 'append' | 'replace' | 'cursor' | 'new-chapter';
  sourceMessageId?: string;
} | null;

setPendingInsert: (insert: PendingInsert) => void;
clearPendingInsert: () => void;
```

**ChapterEditor additions:**

```typescript
// In ChapterEditor.tsx
const { pendingInsert, clearPendingInsert } = useWritingStore();

useEffect(() => {
  if (!pendingInsert || !editor) return;

  switch (pendingInsert.mode) {
    case 'append':
      editor.commands.focus('end');
      editor.commands.insertContent(pendingInsert.content);
      break;
    case 'cursor':
      editor.commands.insertContent(pendingInsert.content);
      break;
    case 'replace':
      if (!editor.state.selection.empty) {
        const { from, to } = editor.state.selection;
        editor.chain().focus().insertContentAt({ from, to }, pendingInsert.content).run();
      } else {
        editor.commands.insertContent(pendingInsert.content);
      }
      break;
  }

  clearPendingInsert();
}, [pendingInsert]);
```

### 4.4 AI Communication Pattern

The ChatPane uses the same `gateway.sendChatWithCallbacks()` as FeedbackPopover, but with a different session key to maintain separate conversation history:

```typescript
const sessionKey = `agent:${selectedAgent}:writing-chat:${activeProjectId}`;
```

**Context injection:** Each message to the AI includes:

1. **System context:** Project type, current chapter title, chapter outline
2. **Memory context:** Characters, timeline, facts (same `buildMemoryContext()` from FeedbackPopover, extracted to shared utility)
3. **Current selection:** If text is selected in the editor, include it as additional context
4. **Conversation history:** Maintained by OpenClaw Gateway via session key

### 4.5 Chat Message Persistence

**Option A (recommended): Gateway session persistence**
OpenClaw Gateway already persists session history. Use `sessions.db` via the existing session key mechanism. No new Electron service needed.

**Option B (fallback): Local JSONL per project**
If Gateway session persistence proves insufficient (e.g., sessions expire), add a JSONL file:

```
~/froggo/writing-projects/{projectId}/memory/chat-history.jsonl
```

With a simple Electron handler:

```typescript
'writing:chat:history'  // (projectId, limit?) -> { success, messages[] }
'writing:chat:append'   // (projectId, message) -> { success }
```

**Recommendation:** Start with Option A. The Gateway already handles this. Only add Option B if chat history loss becomes a user-facing problem.

### 4.6 Shared Utility Extraction

FeedbackPopover and ChatPane both need context building. Extract shared logic:

| Current Location | New Location | What |
|------------------|-------------|------|
| `FeedbackPopover.tsx: buildMemoryContext()` | `src/lib/writingContext.ts` | Memory context string builder |
| `FeedbackPopover.tsx: responseFormat()` | keep in FeedbackPopover | Specific to inline alternatives |
| `FeedbackPopover.tsx: buildPrompt()` | keep in FeedbackPopover | Specific to inline rewrite |
| `AgentPicker.tsx` | unchanged | Reused by both ChatPane and FeedbackPopover |

New utility file `src/lib/writingContext.ts`:

```typescript
export function buildMemoryContext(characters, timeline, facts): string { ... }
export function buildChapterContext(chapterContent, selectionFrom?): string { ... }
export function buildOutlineContext(chapters): string { ... }
export function buildProjectContext(project, chapter, memory): string { ... }
```

### 4.7 Build Order

1. `src/lib/writingContext.ts` -- extract shared context utilities
2. `chatPaneStore.ts` -- chat state management
3. `writingStore.ts` -- add `pendingInsert` mechanism
4. `ChatMessage.tsx` -- message component with "send to editor" action
5. `ChatPane.tsx` -- full chat UI with streaming
6. `ChapterEditor.tsx` -- add `pendingInsert` watcher
7. `FeedbackPopover.tsx` -- refactor to use shared writingContext.ts

---

## 5. Component Dependency Graph

```
WritingWorkspace (entry point)
  |
  +-- ProjectSelector
  |     (no new dependencies)
  |
  +-- SetupWizard (NEW)
  |     +-- WizardChat (uses gateway.sendChatWithCallbacks)
  |     +-- WizardStepIndicator
  |     +-- WizardSummary
  |     +-- wizardStore (NEW)
  |
  +-- ProjectEditor (redesigned)
        |
        +-- ChapterSidebar
        |     (uses writingStore -- unchanged)
        |
        +-- ChatPane (NEW)
        |     +-- ChatMessage (NEW)
        |     +-- AgentPicker (REUSED from existing)
        |     +-- chatPaneStore (NEW)
        |     +-- gateway.sendChatWithCallbacks
        |     +-- writingContext.ts (NEW shared util)
        |     +-- memoryStore, researchStore (for context)
        |     +-- writingStore.setPendingInsert (cross-pane communication)
        |
        +-- WorkspacePane (NEW)
              +-- ChapterEditor
              |     +-- TipTap editor (unchanged)
              |     +-- FeedbackPopover (unchanged)
              |     +-- writingStore.pendingInsert watcher (NEW)
              |
              +-- ContextPanel (moved, toggleable within workspace)
              +-- VersionPanel (moved, toggleable within workspace)
```

---

## 6. IPC Handler Summary

### Existing (No Changes Required)

| Handler | Service |
|---------|---------|
| `writing:project:*` | writing-project-service.ts |
| `writing:chapter:*` | writing-project-service.ts |
| `writing:feedback:*` | writing-feedback-service.ts |
| `writing:memory:*` | writing-memory-service.ts |
| `writing:research:*` | writing-research-service.ts |
| `writing:version:*` | writing-version-service.ts |

### New Handlers

| Handler | Service | Purpose |
|---------|---------|---------|
| `writing:project:createFromWizard` | writing-project-service.ts | Wizard-based project creation |
| `writing:chat:history` | writing-chat-service.ts (if Option B) | Load chat history |
| `writing:chat:append` | writing-chat-service.ts (if Option B) | Append chat message |

### Preload Bridge Additions

```typescript
writing: {
  project: {
    // ... existing
    createFromWizard: (data) => ipcRenderer.invoke('writing:project:createFromWizard', data),
  },
  // Only if Option B for chat persistence:
  chat: {
    history: (projectId, limit?) => ipcRenderer.invoke('writing:chat:history', projectId, limit),
    append: (projectId, message) => ipcRenderer.invoke('writing:chat:append', projectId, message),
  },
}
```

---

## 7. File Storage Changes

### Current Layout

```
~/froggo/writing-projects/{projectId}/
  project.json
  chapters.json
  chapters/
  memory/
  versions/
  research.db
```

### Additions

```
~/froggo/writing-projects/{projectId}/
  project.json          -- add: genre, premise, themes fields
  chapters.json
  chapters/
  memory/
    characters.json
    timeline.json
    facts.json
    feedback-{chapterId}.jsonl
    chat-history.jsonl   -- NEW (only if Option B persistence)
  versions/
  research.db
```

### project.json Schema Extension

```typescript
interface ProjectMeta {
  id: string;
  title: string;
  type: 'memoir' | 'novel';
  // NEW fields from wizard
  genre?: string;
  premise?: string;
  themes?: string[];
  wizardCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Backward compatible: existing projects without wizard fields continue to work. All new fields are optional.

---

## 8. Anti-Patterns to Avoid

### 8.1 Direct Ref Passing Between Panes

**Do NOT** pass a TipTap editor ref from WorkspacePane to ChatPane via React refs or context. This creates tight coupling and breaks when components unmount/remount (e.g., chapter switching).

**Instead:** Use the Zustand `pendingInsert` pattern described in section 4.3.

### 8.2 Shared WebSocket Session Key

**Do NOT** use the same Gateway session key for chat pane and inline feedback. Conversation history from chat would contaminate inline feedback responses and vice versa.

**Instead:** Use distinct session keys:
- Chat pane: `agent:{agentId}:writing-chat:{projectId}`
- Inline feedback: `agent:{agentId}:writing:{projectId}`
- Wizard: `agent:writer:writing-wizard:{wizardSessionId}`

### 8.3 Storing Chat State in writingStore

**Do NOT** add chat messages/streaming state to the existing `writingStore`. It is already at a comfortable complexity level managing project+chapter state.

**Instead:** Create a dedicated `chatPaneStore.ts`. Stores in this codebase are lightweight and purpose-specific (feedbackStore, memoryStore, researchStore, versionStore are all separate).

### 8.4 Monolithic Wizard Component

**Do NOT** build the entire wizard as one 500+ line component. The setup wizard has distinct steps with different UI needs.

**Instead:** Decompose into SetupWizard (orchestrator) + step-specific child components. The wizard store manages step transitions and collected data.

### 8.5 Breaking Existing Inline Feedback

**Do NOT** remove or modify FeedbackPopover's BubbleMenu behavior. The inline AI feedback (select text, get alternatives) is valuable and should coexist with the chat pane.

**Instead:** Both interaction modes serve different purposes:
- Chat pane: generating new content, brainstorming, long discussions
- BubbleMenu: quick inline rewrites of existing text

---

## 9. Suggested Build Order (Phases)

### Phase 1: Foundation

1. Extract `src/lib/writingContext.ts` from FeedbackPopover
2. Add `pendingInsert` to `writingStore.ts`
3. Create `WorkspacePane.tsx` (wrapper around existing ChapterEditor + context/version panels)
4. Verify existing layout still works with WorkspacePane wrapper

**Why first:** These are non-breaking refactors that establish the foundation without changing user-visible behavior.

### Phase 2: 3-Pane Layout

5. Create `chatPaneStore.ts`
6. Create `ChatMessage.tsx`
7. Create `ChatPane.tsx` with AI streaming
8. Rewrite `ProjectEditor.tsx` to 3-pane layout
9. Wire `ChatPane.sendToEditor()` to `writingStore.pendingInsert`
10. Wire `ChapterEditor.tsx` pendingInsert watcher

**Why second:** The 3-pane layout is the core UX change. Building it before the wizard means the editor is ready to receive content from the chat pane.

### Phase 3: Setup Wizard

11. Create `wizardStore.ts`
12. Create `SetupWizard.tsx` + child components
13. Add `createFromWizard` to `writing-project-service.ts`
14. Add preload bridge for wizard creation
15. Modify `WritingWorkspace.tsx` routing
16. Modify `ProjectSelector.tsx` to launch wizard

**Why third:** The wizard is a separate entry-point flow. It depends on the project creation infrastructure but not on the 3-pane layout. Building it after the layout means newly created wizard projects immediately open in the full 3-pane editor.

---

## 10. Testing Strategy

### Unit Tests

| Test | What |
|------|------|
| `writingContext.test.ts` | Context builder functions produce expected format |
| `chatPaneStore.test.ts` | Store actions update state correctly |
| `wizardStore.test.ts` | Step transitions, data collection |
| `pendingInsert.test.ts` | Insert modes (append/replace/cursor) |

### Integration Tests

| Test | What |
|------|------|
| Chat-to-editor flow | ChatPane.sendToEditor -> writingStore.pendingInsert -> editor insertion |
| Wizard project creation | Full wizard flow -> project created with chapters + characters |
| 3-pane layout rendering | All three panes render at different window sizes |

### Manual Verification

| Test | What |
|------|------|
| Pane sizing at 1280px | All panes usable without overflow |
| AI streaming in chat | Messages stream in, no duplicate content |
| Session key isolation | Chat and inline feedback don't contaminate each other |
| Backward compatibility | Existing projects (without wizard data) open correctly |

---

## 11. Sources

All findings are based on direct source code analysis of the following files:

| File | What was analyzed |
|------|------------------|
| `electron/paths.ts` | Storage paths, writing project directory structure |
| `electron/writing-project-service.ts` | Project + chapter CRUD patterns |
| `electron/writing-feedback-service.ts` | JSONL logging pattern |
| `electron/writing-memory-service.ts` | Memory JSON CRUD pattern |
| `electron/writing-research-service.ts` | Per-project SQLite pattern |
| `electron/writing-version-service.ts` | Version snapshot pattern |
| `electron/preload.ts` | Bridge API surface (`window.clawdbot.writing.*`) |
| `electron/main.ts` | Service registration pattern |
| `src/store/writingStore.ts` | Project/chapter state management |
| `src/store/feedbackStore.ts` | Inline feedback UI state |
| `src/store/memoryStore.ts` | Memory data management |
| `src/store/researchStore.ts` | Research source management |
| `src/store/versionStore.ts` | Version state management |
| `src/components/writing/WritingWorkspace.tsx` | Top-level routing |
| `src/components/writing/ProjectEditor.tsx` | Current layout structure |
| `src/components/writing/ProjectSelector.tsx` | Current project creation |
| `src/components/writing/ChapterEditor.tsx` | TipTap editor setup |
| `src/components/writing/ChapterSidebar.tsx` | Chapter list with dnd-kit |
| `src/components/writing/ContextPanel.tsx` | Context panel tabs |
| `src/components/writing/FeedbackPopover.tsx` | AI feedback flow (gateway integration) |
| `src/components/writing/AgentPicker.tsx` | Agent selection UI |
| `src/components/writing/VersionPanel.tsx` | Version management UI |
| `src/lib/gateway.ts` | Gateway WebSocket client, sendChatWithCallbacks |
| `src/components/ChatPanel.tsx` | Existing chat UI (reference for ChatPane) |

Confidence: HIGH -- all recommendations based on verified source code patterns.
