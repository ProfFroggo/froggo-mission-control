# Phase 11: Chat Pane + 3-Pane Layout - Research

**Researched:** 2026-02-13
**Domain:** Resizable panel layout, persistent AI chat pane, chat-to-editor content insertion
**Confidence:** HIGH

## Summary

Phase 11 transforms the writing workspace from a 2-pane layout (ChapterSidebar + ChapterEditor with toggleable context/version panels) into a 3-pane resizable layout (ChapterSidebar | ChatPane | Editor+Context). The chat pane provides persistent, multi-turn AI conversation with streaming responses, agent selection, and one-click content insertion into the TipTap editor.

The implementation requires 3 new npm packages (`react-resizable-panels`, `@tiptap/markdown`, `@tiptap/extensions`), a new Zustand store (`chatPaneStore.ts`), a shared context utility (`writingContext.ts`), a `pendingInsert` mechanism in `writingStore`, and 4-5 new React components. The existing gateway streaming pattern from `FeedbackPopover.tsx` is directly reusable. The existing `ProjectEditor.tsx` (70 lines) is replaced entirely.

**CRITICAL API NOTE:** `react-resizable-panels` v4 renamed its exports. The v4 API uses `Group` (not `PanelGroup`), `Separator` (not `PanelResizeHandle`), `orientation` (not `direction`), and `defaultLayout` (not `autoSaveId`). The project-level STACK.md was written against v3 examples. All code in this research uses the correct v4 API.

**Primary recommendation:** Build the 3-pane layout and chat pane together as one integrated phase. The layout change is the foundation; the chat pane is the payload. They cannot be meaningfully separated.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-resizable-panels` | ^4.6.2 | 3-pane resizable layout with min/max constraints, persistence, keyboard resize, collapsible panels | 1,551 npm dependents. Built by Brian Vaughn (ex-React core team). Zero runtime deps. Powers shadcn/ui Resizable. React 18/19 peer dep. |
| `@tiptap/markdown` | ^3.19.0 | Enables `insertContent(md, {contentType:'markdown'})` for AI-generated prose insertion into TipTap | Official TipTap extension. Must match existing TipTap version (3.19.0). Handles markdown-to-ProseMirror schema conversion. |
| `@tiptap/extensions` | ^3.19.0 | Provides `Selection` extension to keep editor selection visible when chat pane has focus | Official TipTap bundle. Selection extension applies CSS class to selection on blur, solving the focus war between chat input and editor. |

### Supporting (already installed, no new deps)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-markdown` | ^10.1.0 | Render AI streaming responses in chat pane | Chat message display (already installed) |
| `remark-gfm` | ^4.0.1 | GitHub Flavored Markdown in chat messages | Tables, task lists in AI responses (already installed) |
| `zustand` | ^4.4.7 | Chat pane state management (new store) | chatPaneStore.ts (already installed) |
| `lucide-react` | ^0.303.0 | Icons for chat UI (Send, Copy, ArrowDownToLine, etc.) | Chat pane UI elements (already installed) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-resizable-panels` | `allotment` | Lower adoption (113K weekly downloads vs dominant position). Less ecosystem validation. |
| `react-resizable-panels` | CSS Grid + custom drag | 500+ lines custom code to replicate constraints, persistence, keyboard support, collapse logic. Not worth it. |
| `@tiptap/markdown` | `marked` + manual HTML insertion | Would need to convert MD to HTML, then validate against TipTap schema manually. @tiptap/markdown does this in one call. |
| `@tiptap/extensions` (Selection) | Custom ProseMirror plugin | Selection extension is 50 lines of code, well-tested. Custom plugin is error-prone. |
| Custom chat component | Existing `ChatPanel.tsx` (dashboard chat) | ChatPanel has 15+ features the writing chat doesn't need (folders, pins, snooze). Would import unwanted complexity. Build simple. |

**Installation:**
```bash
npm install react-resizable-panels @tiptap/markdown @tiptap/extensions
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/writing/
│   ├── WritingWorkspace.tsx      # (existing, no change)
│   ├── ProjectSelector.tsx       # (existing, no change)
│   ├── ProjectEditor.tsx         # REWRITE — 3-pane layout with react-resizable-panels
│   ├── ChapterSidebar.tsx        # (existing, minor width adjustment)
│   ├── ChapterEditor.tsx         # MODIFY — add Selection extension, pendingInsert watcher, @tiptap/markdown
│   ├── ChatPane.tsx              # NEW — persistent AI chat pane
│   ├── ChatMessage.tsx           # NEW — single message component with actions
│   ├── ChatInput.tsx             # NEW — message input with agent picker
│   ├── ContextPanel.tsx          # (existing, rendered inside editor area as tab)
│   ├── VersionPanel.tsx          # (existing, rendered inside editor area as tab)
│   ├── FeedbackPopover.tsx       # MODIFY — update session key to include :feedback suffix
│   ├── AgentPicker.tsx           # (existing, reused in ChatInput)
│   └── EditorToolbar.tsx         # (existing, no change)
├── store/
│   ├── writingStore.ts           # MODIFY — add pendingInsert mechanism
│   ├── chatPaneStore.ts          # NEW — chat messages, streaming, agent selection, history persistence
│   ├── feedbackStore.ts          # (existing, no change)
│   ├── memoryStore.ts            # (existing, no change)
│   ├── researchStore.ts          # (existing, no change)
│   └── versionStore.ts           # (existing, no change)
├── lib/
│   ├── gateway.ts                # (existing, no change — sendChatWithCallbacks already supports per-request session keys)
│   └── writingContext.ts         # NEW — shared context builders extracted from FeedbackPopover
└── styles/
    └── writing-editor.css        # MODIFY — add .selection class for blurred selection highlight
```

### Pattern 1: 3-Pane Layout with react-resizable-panels v4

**What:** Replace the current flex layout in `ProjectEditor.tsx` with a resizable 3-pane layout.

**CRITICAL: v4 API uses `Group`, `Panel`, `Separator` — NOT `PanelGroup`, `Panel`, `PanelResizeHandle`.**

**Example:**
```tsx
// Source: react-resizable-panels v4 API (verified via GitHub README + docs site)
import { Group, Panel, Separator } from 'react-resizable-panels';

function ProjectEditor() {
  return (
    <Group orientation="horizontal" defaultLayout={[15, 30, 55]}>
      {/* Left: Chapter sidebar — collapsible */}
      <Panel id="chapters" minSize={10} maxSize={25} collapsible collapsedSize={0}>
        <ChapterSidebar />
      </Panel>

      <Separator className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors cursor-col-resize" />

      {/* Center: AI Chat pane — collapsible */}
      <Panel id="chat" minSize={15} maxSize={50} collapsible collapsedSize={0}>
        <ChatPane />
      </Panel>

      <Separator className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors cursor-col-resize" />

      {/* Right: Editor workspace (editor + context/version panels) */}
      <Panel id="editor" minSize={25}>
        {activeChapterId ? <ChapterEditor /> : <EmptyState />}
        {/* Context and Version panels as internal toggles, not additional layout panes */}
      </Panel>
    </Group>
  );
}
```

**Key v4 API details:**
- `defaultLayout` is an array of percentages `[15, 30, 55]` that persists via `onLayoutChanged` callback
- `onLayoutChanged` fires after pointer release (debounced) — use for localStorage persistence
- `onLayoutChange` fires during drag — use for real-time UI updates
- `collapsible` enables collapse when panel is dragged below `minSize`
- `collapsedSize={0}` means fully hidden when collapsed
- `panelRef` provides imperative API: `collapse()`, `expand()`, `isCollapsed()`, `resize(size)`
- `Separator` is styled via className (Tailwind compatible)
- Sizes are percentages by default, but also accept pixel strings: `"200px"`

### Pattern 2: Chat-to-Editor Content Flow via Zustand pendingInsert

**What:** Decouple chat pane from editor using a Zustand-mediated insert mechanism.

**Why:** ChatPane and ChapterEditor are sibling components inside the `Group`. Direct ref passing creates tight coupling. Zustand provides clean cross-component communication.

**Example:**
```tsx
// writingStore.ts — add to existing store
interface PendingInsert {
  content: string;
  mode: 'append' | 'cursor' | 'replace';
  sourceMessageId?: string;
}

// In writingStore state:
pendingInsert: null as PendingInsert | null,
setPendingInsert: (insert: PendingInsert) => set({ pendingInsert: insert }),
clearPendingInsert: () => set({ pendingInsert: null }),

// ChatPane calls:
writingStore.getState().setPendingInsert({
  content: message.content,
  mode: 'append',
  sourceMessageId: message.id,
});

// ChapterEditor watches:
useEffect(() => {
  if (!pendingInsert || !editor) return;
  const md = pendingInsert.content;

  switch (pendingInsert.mode) {
    case 'append':
      editor.chain().focus('end')
        .insertContent(md, { contentType: 'markdown' })
        .run();
      break;
    case 'cursor':
      editor.chain().focus()
        .insertContent(md, { contentType: 'markdown' })
        .run();
      break;
    case 'replace':
      if (!editor.state.selection.empty) {
        const { from, to } = editor.state.selection;
        editor.chain().focus()
          .insertContentAt({ from, to }, md, { contentType: 'markdown' })
          .run();
      } else {
        editor.chain().focus('end')
          .insertContent(md, { contentType: 'markdown' })
          .run();
      }
      break;
  }
  clearPendingInsert();
}, [pendingInsert]);
```

### Pattern 3: Gateway Session Key Namespacing

**What:** Use distinct session key patterns for chat pane, inline feedback, and wizard to prevent context contamination.

**Example:**
```tsx
// Chat pane session keys (persistent multi-turn per project per agent):
const chatSessionKey = `agent:${selectedAgent}:writing:${projectId}:chat`;

// Inline feedback session keys (existing, add :feedback suffix):
const feedbackSessionKey = `agent:${selectedAgent}:writing:${projectId}:feedback`;

// Wizard session keys (future phase):
const wizardSessionKey = `agent:writer:writing:${projectId}:wizard`;
```

**Impact on existing code:** `FeedbackPopover.tsx` line 258 currently uses `agent:${selectedAgent}:writing:${activeProjectId}`. This must be updated to include `:feedback` suffix to prevent session contamination with the new chat pane.

### Pattern 4: Chat History Persistence via JSONL on Disk

**What:** Persist chat messages to a JSONL file per project, loaded on project open.

**Why:** Gateway sessions may expire or be cleaned up. Local persistence ensures chat history survives app restarts.

**Storage location:**
```
~/froggo/writing-projects/{projectId}/memory/chat-history.jsonl
```

**Format:** One JSON object per line, same pattern as existing `feedback-{chapterId}.jsonl`:
```jsonl
{"id":"msg-123","role":"user","content":"Write the opening paragraph","agent":"writer","timestamp":"2026-02-13T10:00:00Z"}
{"id":"msg-124","role":"assistant","content":"The kitchen smelled of...","agent":"writer","timestamp":"2026-02-13T10:00:05Z"}
```

**IPC handlers needed:**
```typescript
'writing:chat:loadHistory'   // (projectId) -> { success, messages[] }
'writing:chat:appendMessage' // (projectId, message) -> { success }
'writing:chat:clearHistory'  // (projectId) -> { success }
```

### Pattern 5: Selection Preservation with TipTap Selection Extension

**What:** Keep editor text selection visually highlighted when user clicks into the chat input.

**Example:**
```tsx
// ChapterEditor.tsx — add Selection extension
import { Selection } from '@tiptap/extensions';

const editor = useEditor({
  extensions: [
    StarterKit.configure({ ... }),
    Highlight,
    Placeholder.configure({ ... }),
    CharacterCount,
    Typography,
    Link.configure({ ... }),
    Selection,                    // NEW: keeps selection visible on blur
    Markdown,                     // NEW: enables contentType: 'markdown'
  ],
  // ... rest unchanged
});
```

```css
/* writing-editor.css — add selection highlight for blurred state */
.ProseMirror .selection {
  background-color: rgba(var(--clawd-accent-rgb), 0.15);
  border-radius: 2px;
}
```

### Anti-Patterns to Avoid

- **Direct ref passing between panes:** Do NOT pass TipTap editor ref from editor pane to chat pane via React refs or context. Use the `pendingInsert` Zustand pattern instead.
- **Shared session keys:** Do NOT use the same gateway session key for chat pane and inline feedback. They contaminate each other's conversation history.
- **Merging chat state into writingStore:** Do NOT add chat messages/streaming to the existing `writingStore`. Create a separate `chatPaneStore.ts` following the `feedbackStore.ts` pattern.
- **Bolting chat pane onto existing layout:** Do NOT add a chat pane to the current flex layout. Replace `ProjectEditor.tsx` entirely with `react-resizable-panels`. The current file is only 70 lines.
- **Importing existing ChatPanel.tsx:** Do NOT reuse the main dashboard `ChatPanel.tsx` for the writing chat. It carries 15+ unneeded features (folders, pins, snooze, notification settings). Build a minimal ~200-line chat component.
- **Auto-inserting AI content:** NEVER insert AI content into the editor without explicit user action ("Insert" button click). Content always flows: Chat -> Review -> Insert.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panel layout | Custom flex + drag handlers | `react-resizable-panels` v4 | Handles constraints, persistence, keyboard, collapse, min/max. 500+ lines to replicate. |
| Markdown-to-TipTap conversion | `marked` + custom HTML sanitization | `@tiptap/markdown` extension | One-call `insertContent(md, {contentType:'markdown'})`. Schema-aware conversion. Handles unsupported elements gracefully. |
| Selection visibility on blur | Custom ProseMirror plugin with decorations | `@tiptap/extensions` Selection | Adds `.selection` CSS class on blur. 50 lines of well-tested code. |
| Chat streaming display | Custom WebSocket handler | Existing `gateway.sendChatWithCallbacks()` | Already proven in FeedbackPopover. Per-runId callbacks. Handles delta, message, end, error events. |
| Chat message rendering | Custom markdown parser | Existing `react-markdown` + `remark-gfm` | Already installed. Handles streaming accumulated content. |
| Layout persistence | Custom localStorage manager | `onLayoutChanged` callback on `Group` + localStorage | Library fires callback with layout array after drag ends. One-liner to persist. |

**Key insight:** The entire chat pane reuses the existing gateway streaming infrastructure. The only new infrastructure is the layout (library), content insertion (library), selection preservation (library), and the chat UI components (custom, ~300 lines total).

## Common Pitfalls

### Pitfall 1: Focus War Between Chat Input and TipTap Editor

**What goes wrong:** User highlights text in editor, clicks chat input to type a message. Editor loses focus, selection collapses, BubbleMenu disappears. Clicking back into editor puts cursor at wrong position (Firefox bug, TipTap #5980).

**Why it happens:** TipTap's BubbleMenu `shouldShow` checks `editor.state.selection.empty` which returns true when editor is unfocused. The existing FeedbackPopover uses `onMouseDown={(e) => e.preventDefault()}` as a workaround, but persistent chat input cannot do this.

**How to avoid:**
1. Add TipTap's `Selection` extension from `@tiptap/extensions` — applies `.selection` CSS class on blur
2. Store editor selection in `writingStore` (`lastEditorSelection: {from, to}`) on every selection change via `onSelectionUpdate` callback
3. When "Insert into editor" is clicked, use stored selection: `editor.chain().focus().insertContentAt(storedSelection, content).run()`
4. Add CSS for `.selection` class to show highlighted background on blurred selection

**Warning signs:** BubbleMenu flickers when clicking chat input. Selection disappears on focus change. Cursor jumps to wrong position after using chat (Firefox).

### Pitfall 2: react-resizable-panels v4 API Breaking Changes

**What goes wrong:** Code examples from v3 tutorials, the project STACK.md, and AI training data use `PanelGroup`, `PanelResizeHandle`, `direction`, and `autoSaveId`. These do NOT exist in v4.

**Why it happens:** v4 renamed components: `PanelGroup` -> `Group`, `PanelResizeHandle` -> `Separator`. Props renamed: `direction` -> `orientation`. Layout persistence changed from `autoSaveId` to `defaultLayout` + `onLayoutChanged`.

**How to avoid:**
- Import `{ Group, Panel, Separator }` from `'react-resizable-panels'`
- Use `orientation="horizontal"` not `direction="horizontal"`
- Use `defaultLayout={[15, 30, 55]}` for initial sizes
- Use `onLayoutChanged` callback + localStorage for persistence
- shadcn/ui's Resizable component is NOT compatible with v4 (see shadcn-ui/ui#9136) — do not use shadcn wrappers

**Warning signs:** TypeScript errors on import. "PanelGroup is not exported" at runtime. `direction` prop silently ignored.

### Pitfall 3: Chat-to-Editor Insertion Corrupts Document or Mispositions Content

**What goes wrong:** AI generates 3 paragraphs in chat. User clicks "Insert". Content lands at random cursor position, splits a sentence, or undo removes all 3 paragraphs atomically.

**Why it happens:** `insertContent` inserts at current cursor position. After clicking in the chat pane, cursor position is unpredictable. Autosave (1500ms debounce) may fire mid-insertion.

**How to avoid:**
1. Always insert at a well-defined position. "Append" = `editor.chain().focus('end').insertContent(...)`. "At cursor" = uses `lastEditorSelection` from store.
2. Use `@tiptap/markdown` for conversion: `insertContent(markdown, { contentType: 'markdown' })`. This handles paragraph/heading/list conversion against TipTap's schema.
3. The entire insert is a single ProseMirror transaction (TipTap chains are atomic) — undo removes the full block, which is correct behavior.
4. Wrap insertion in a version snapshot: call `writing:version:save` before inserting, so user can always restore.

**Warning signs:** Asterisks visible in editor (raw markdown not converted). Content appears mid-sentence. Lists show as `- ` text instead of rendered lists.

### Pitfall 4: Session Key Collision Between Chat and Feedback

**What goes wrong:** Chat pane uses `agent:writer:writing:{projectId}` as session key. FeedbackPopover also uses `agent:writer:writing:{projectId}`. Gateway accumulates both conversations in the same session. Chat context leaks into inline feedback; feedback instructions appear in chat history.

**Why it happens:** FeedbackPopover (line 258) currently uses `agent:${selectedAgent}:writing:${activeProjectId}` — no suffix distinguishing feedback from chat.

**How to avoid:**
1. Chat pane: `agent:${agent}:writing:${projectId}:chat`
2. Feedback: `agent:${agent}:writing:${projectId}:feedback` (update FeedbackPopover line 258)
3. Future wizard: `agent:writer:writing:${projectId}:wizard`

**Warning signs:** Chat shows "Provide 3 alternatives" instructions from feedback. Inline feedback references previous chat conversations.

### Pitfall 5: Layout Breaks at Small Window Widths

**What goes wrong:** 3 panes with minimum widths (sidebar 10% + chat 15% + editor 25% = 50% minimum) work at 1440px but at 1024px (minimum target), panels can be crushed to unusable widths.

**Why it happens:** Percentage-based `minSize` scales with window width. 15% of 1024px = 154px for chat pane, which is very narrow.

**How to avoid:**
1. Set minimum sizes using percentages that work at 1024px: sidebar `minSize={10}` (~100px), chat `minSize={20}` (~200px), editor `minSize={25}` (~250px).
2. Make sidebar and chat both `collapsible` with `collapsedSize={0}`. Users can collapse to reclaim space.
3. Add collapse/expand toggle buttons visible even when panel is collapsed.
4. Test at 1024px, 1280px, 1440px, and 1920px window widths.
5. Consider responsive behavior: at widths below 1200px, auto-collapse sidebar.

**Warning signs:** TipTap toolbar wraps to 2 rows. Chat messages overflow container. BubbleMenu extends outside editor pane.

### Pitfall 6: Chat Context Grows Unbounded in Long Sessions

**What goes wrong:** Over 50+ messages in a session, gateway accumulates full conversation history. Context exceeds model limits, responses degrade (lost-in-the-middle effect), API errors, high token costs.

**Why it happens:** `sendChatWithCallbacks` sends message with session key. Gateway auto-accumulates history. No truncation in existing gateway code.

**How to avoid:**
1. Build context explicitly per message rather than relying on gateway session history: system prompt + chapter context + memory context + last N messages.
2. Set a practical limit of 20-30 messages before suggesting "New conversation" (clear session, start fresh with project context).
3. Show a visual indicator of conversation length (message count or estimated token usage).
4. The gateway has a 180s timeout per request (line 693 in gateway.ts) which provides a natural upper bound.

**Warning signs:** AI responses get slower after 15+ messages. AI "forgets" earlier instructions. Token costs spike.

## Code Examples

### Complete Chat Pane Store

```typescript
// Source: Follows feedbackStore.ts pattern (verified in codebase)
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: string;
  timestamp: number;
  insertedToEditor?: boolean;
}

interface ChatPaneState {
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;
  error: string | null;

  // Actions
  setInput: (text: string) => void;
  setSelectedAgent: (agentId: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setError: (error: string | null) => void;
  markInserted: (messageId: string) => void;
  clearMessages: () => void;
  loadMessages: (messages: ChatMessage[]) => void;
}

export const useChatPaneStore = create<ChatPaneState>((set) => ({
  messages: [],
  input: '',
  streaming: false,
  streamContent: '',
  selectedAgent: 'writer',
  error: null,

  setInput: (text) => set({ input: text }),
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setError: (error) => set({ error }),
  markInserted: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, insertedToEditor: true } : m
      ),
    })),
  clearMessages: () => set({ messages: [], streamContent: '', error: null }),
  loadMessages: (messages) => set({ messages }),
}));
```

### Chat Pane Streaming Pattern

```typescript
// Source: Follows FeedbackPopover.tsx handleSend pattern (verified in codebase)
import { gateway } from '../../lib/gateway';
import { useChatPaneStore } from '../../store/chatPaneStore';
import { useWritingStore } from '../../store/writingStore';
import { buildProjectContext } from '../../lib/writingContext';

async function handleSendMessage() {
  const { input, selectedAgent, setStreaming, setStreamContent, addMessage, setError, setInput } =
    useChatPaneStore.getState();
  const { activeProjectId } = useWritingStore.getState();

  if (!input.trim() || !activeProjectId) return;

  const userMessage: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: input.trim(),
    agent: selectedAgent,
    timestamp: Date.now(),
  };

  addMessage(userMessage);
  setInput('');
  setStreaming(true);
  setStreamContent('');
  setError(null);

  const accumulatedRef = { current: '' };
  const sessionKey = `agent:${selectedAgent}:writing:${activeProjectId}:chat`;
  const context = buildProjectContext(); // shared utility
  const prompt = `${context}\n\nUser: ${userMessage.content}`;

  try {
    await gateway.sendChatWithCallbacks(prompt, sessionKey, {
      onDelta: (delta) => {
        accumulatedRef.current += delta;
        setStreamContent(accumulatedRef.current);
      },
      onEnd: () => {
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: accumulatedRef.current,
          agent: selectedAgent,
          timestamp: Date.now(),
        };
        addMessage(assistantMessage);
        setStreaming(false);
        setStreamContent('');

        // Persist to disk
        persistMessage(activeProjectId, userMessage);
        persistMessage(activeProjectId, assistantMessage);
      },
      onError: (err) => {
        setError(typeof err === 'string' ? err : 'An error occurred');
        setStreaming(false);
      },
    });
  } catch (e: any) {
    setError(e.message || 'Failed to send');
    setStreaming(false);
  }
}
```

### Shared Context Utility

```typescript
// Source: Extracted from FeedbackPopover.tsx buildMemoryContext + buildPrompt (lines 21-160)
// File: src/lib/writingContext.ts

export function buildMemoryContext(
  characters: { name: string; relationship: string; description: string }[],
  timeline: { date: string; description: string }[],
  facts: { claim: string; source: string; status: string }[],
): string {
  // Same implementation as FeedbackPopover.tsx lines 21-53
  const sections: string[] = [];
  if (characters.length > 0) {
    sections.push('### Characters', ...characters.map(c => `- **${c.name}** (${c.relationship}): ${c.description}`));
  }
  if (timeline.length > 0) {
    sections.push('### Timeline', ...timeline.map(t => `- **${t.date}**: ${t.description}`));
  }
  if (facts.length > 0) {
    const icon: Record<string, string> = { verified: 'V', disputed: 'D', unverified: '?' };
    sections.push('### Verified Facts', ...facts.map(f => `- [${icon[f.status] ?? '?'}] ${f.claim} (source: ${f.source})`));
  }
  const result = sections.join('\n');
  return result.length > 2000 ? result.slice(0, 2000) + '\n...(truncated)' : result;
}

export function buildChapterContext(chapterContent: string | null, cursorOffset?: number): string {
  if (!chapterContent) return '(no chapter content)';
  const charOffset = cursorOffset ? Math.min(cursorOffset * 5, chapterContent.length) : 0;
  const windowSize = 8000;
  const start = Math.max(0, charOffset - windowSize);
  const end = Math.min(chapterContent.length, charOffset + windowSize);
  let ctx = chapterContent.slice(start, end);
  if (start > 0) ctx = '...' + ctx;
  if (end < chapterContent.length) ctx += '...';
  return ctx;
}

export function buildOutlineContext(chapters: { title: string; position: number }[]): string {
  if (!chapters || chapters.length === 0) return '(no outline available)';
  return chapters
    .sort((a, b) => a.position - b.position)
    .map((ch, i) => `${i + 1}. ${ch.title}`)
    .join('\n');
}
```

### Layout Persistence

```typescript
// Source: react-resizable-panels v4 API (verified via GitHub docs)
import { Group, Panel, Separator } from 'react-resizable-panels';

const LAYOUT_KEY = 'writing-layout';

function getPersistedLayout(): number[] | undefined {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    return saved ? JSON.parse(saved) : undefined;
  } catch { return undefined; }
}

function ProjectEditor() {
  const defaultLayout = getPersistedLayout() || [15, 30, 55];

  const handleLayoutChanged = (layout: number[]) => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  };

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    >
      {/* ... panels ... */}
    </Group>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PanelGroup` / `PanelResizeHandle` (v3) | `Group` / `Separator` (v4) | react-resizable-panels v4.0.0 | Import names changed, prop names changed. v3 code does not work. |
| `direction` prop | `orientation` prop | react-resizable-panels v4.0.0 | ARIA alignment. |
| `autoSaveId` for persistence | `defaultLayout` + `onLayoutChanged` callback | react-resizable-panels v4.0.0 | Manual persistence gives more control. |
| Community `tiptap-markdown` (aguingand) | Official `@tiptap/markdown` (v3.19.0) | TipTap 3.x | Official extension. Do NOT use community fork. |
| Custom ProseMirror plugin for blur selection | `Selection` extension from `@tiptap/extensions` | TipTap 3.x | Official extension. Adds `.selection` class on blur. |

**Deprecated/outdated:**
- `PanelGroup`, `PanelResizeHandle` component names (v3 only)
- `direction` prop on PanelGroup (v3 only)
- `autoSaveId` prop for layout persistence (v3 only)
- `tiptap-markdown` community package by aguingand (v0.9.0) — superseded by official `@tiptap/markdown`
- shadcn/ui Resizable component is NOT compatible with react-resizable-panels v4 (shadcn-ui/ui#9136)

## Open Questions

1. **Collapsible panel restore UX**
   - What we know: react-resizable-panels supports `collapsible` + `collapsedSize={0}` to fully hide panels
   - What's unclear: When a panel is collapsed to 0 width, there's no visible handle to restore it. Need a toggle button outside the panel.
   - Recommendation: Add collapse/expand toggle buttons in the editor toolbar area or as floating icons at the pane edges. Implement using `panelRef.collapse()` / `panelRef.expand()` imperative API.

2. **Chat history persistence: JSONL vs gateway sessions**
   - What we know: Gateway sessions preserve conversation history via session key. JSONL files provide local persistence.
   - What's unclear: Whether gateway sessions survive app restarts or are cleaned up periodically. The gateway has a 180s request timeout but session lifetime is not documented.
   - Recommendation: Use JSONL on disk as primary storage. Gateway session provides multi-turn context for the AI. Both are needed — JSONL for UI history display, gateway for AI context.

3. **Context/Version panels in 3-pane layout**
   - What we know: Currently ContextPanel (w-72) and VersionPanel (w-80) are toggled as mutually exclusive right-side panels.
   - What's unclear: Where they live in the new 3-pane layout. Options: (a) tabs within the editor pane, (b) overlay panels inside editor pane, (c) a 4th collapsible panel.
   - Recommendation: Make them toggleable overlays within the editor pane, positioned absolutely at the right edge. This avoids adding a 4th panel and keeps the 3-pane structure clean. Toggle buttons remain in the editor toolbar.

4. **@tiptap/markdown beta status**
   - What we know: TipTap docs state the Markdown extension is "in beta." The version is 3.19.0, matching all other TipTap packages.
   - What's unclear: Whether "beta" means API instability or just feature incompleteness.
   - Recommendation: Proceed with it. The `insertContent(md, {contentType:'markdown'})` API is documented and stable. Round-trip test markdown content to verify schema compatibility during implementation.

## Sources

### Primary (HIGH confidence)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) — v4 API, component naming, prop reference
- [react-resizable-panels CHANGELOG](https://github.com/bvaughn/react-resizable-panels/blob/main/CHANGELOG.md) — v4 breaking changes, rename from PanelGroup to Group
- [react-resizable-panels docs](https://react-resizable-panels.vercel.app/) — API reference, examples
- [shadcn-ui/ui#9136](https://github.com/shadcn-ui/ui/issues/9136) — Confirmed v4 breaks shadcn Resizable component
- [TipTap Markdown Basic Usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage) — insertContent with contentType: 'markdown'
- [TipTap insertContent API](https://tiptap.dev/docs/editor/api/commands/content/insert-content) — contentType option: 'json' | 'html' | 'markdown'
- [TipTap Selection Extension](https://tiptap.dev/docs/editor/extensions/functionality/selection) — CSS class on blur, `.selection` class
- Codebase files: `ProjectEditor.tsx` (70 lines, current layout), `FeedbackPopover.tsx` (gateway integration pattern), `writingStore.ts` (store architecture), `feedbackStore.ts` (store pattern), `gateway.ts` (sendChatWithCallbacks API), `ChapterEditor.tsx` (TipTap config), `paths.ts` (file storage paths)

### Secondary (MEDIUM confidence)
- [TipTap Focus Extension](https://tiptap.dev/docs/editor/extensions/functionality/focus) — Focus vs Selection distinction
- [TipTap Selection When Unfocused #4963](https://github.com/ueberdosis/tiptap/discussions/4963) — Community solutions for blur selection
- [TipTap Firefox Focus Bug #5980](https://github.com/ueberdosis/tiptap/issues/5980) — Firefox cursor restoration bug
- [TipTap Streaming Markdown #5563](https://github.com/ueberdosis/tiptap/discussions/5563) — Community confirms streaming into TipTap is complex
- [shadcn-ui/ui#9197](https://github.com/shadcn-ui/ui/issues/9197) — Additional v4 compatibility confirmation

### Tertiary (LOW confidence)
- AI training data on react-resizable-panels — STALE, uses v3 API names. Do not trust without verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, v4 API confirmed via GitHub + shadcn issues, TipTap extensions verified via official docs
- Architecture: HIGH — direct source code analysis of all integration points (ProjectEditor.tsx, FeedbackPopover.tsx, writingStore.ts, gateway.ts, ChapterEditor.tsx)
- Pitfalls: HIGH — v4 API rename verified via multiple sources (shadcn issues, changelog). Focus war documented in TipTap issues. Session key collision verified by reading existing code.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (react-resizable-panels v4 API is stable, TipTap 3.19.0 is current)
