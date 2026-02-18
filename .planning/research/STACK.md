# Stack Research: v2.1 AI-Powered Writing UX Redesign

**Project:** Froggo.app v2.1 -- Conversational AI Book Creation System
**Researched:** 2026-02-13
**Overall Confidence:** HIGH (verified via npm registry, official docs, and codebase inspection)
**Scope:** Stack ADDITIONS for v2.1 only. Existing stack (React 18, TipTap 3.19.0, Zustand, Tailwind, Electron 28, OpenClaw Gateway) is validated and unchanged.

---

## Summary of New Dependencies

| Library | Version | Purpose | New Install? |
|---------|---------|---------|-------------|
| `react-resizable-panels` | ^4.6.2 | 3-pane resizable layout | YES -- new |
| `@tiptap/markdown` | ^3.19.0 | Markdown-to-editor content insertion | YES -- new (same TipTap ecosystem) |

**Total new packages: 2**

Everything else needed for v2.1 is either already installed or should be built as custom components (not libraries).

---

## Feature 1: 3-Pane Resizable Layout

### Decision: `react-resizable-panels` v4.6.2

**Confidence: HIGH** -- verified via npm registry (published Feb 7 2026), GitHub, peer dependencies confirmed React 18 compatible.

**What it does:** Provides `PanelGroup`, `Panel`, and `PanelResizeHandle` components for building IDE-style resizable split layouts. Horizontal and vertical orientations, min/max constraints, collapsible panels, keyboard resize, layout persistence.

**Why this library:**
- 1,551 npm dependents, most popular React resizable panel library by significant margin
- Powers shadcn/ui's Resizable component (ecosystem validation)
- Peer deps: `react ^18.0.0 || ^19.0.0`, `react-dom ^18.0.0 || ^19.0.0` -- exact match with project
- Zero runtime dependencies
- 498KB unpacked (lightweight for what it provides)
- Built by Brian Vaughn (former React core team) -- quality code
- Built-in layout persistence via `autoSaveId` (saves to localStorage)
- Keyboard accessible (arrow keys resize, Enter/Space collapse)
- CSS-in-JS agnostic -- works with Tailwind

**How it maps to our 3-pane layout:**

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

function WritingWorkspace() {
  return (
    <PanelGroup direction="horizontal" autoSaveId="writing-layout">
      {/* Left: Chapter sidebar */}
      <Panel defaultSize={15} minSize={10} maxSize={25} collapsible>
        <ChapterSidebar />
      </Panel>

      <PanelResizeHandle className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors" />

      {/* Center: AI Chat dialogue */}
      <Panel defaultSize={35} minSize={20}>
        <ChatDialoguePane />
      </Panel>

      <PanelResizeHandle className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors" />

      {/* Right: Content workspace (TipTap editor) */}
      <Panel defaultSize={50} minSize={25}>
        <ChapterEditor />
      </Panel>
    </PanelGroup>
  );
}
```

**What it replaces in current code:** The `ProjectEditor.tsx` currently uses a `flex` layout with fixed-width sidebar (`w-64`) and `flex-1` editor. This will be replaced with `PanelGroup` for user-resizable panes.

### Alternatives Considered

| Library | Why Not |
|---------|---------|
| `allotment` | 113K weekly downloads vs react-resizable-panels' dominance. Less ecosystem adoption. Functionally similar but less actively maintained. |
| `react-split-pane` | Older library, less actively maintained. react-resizable-panels supersedes it. |
| CSS `resize` property | No constraints, no persistence, poor UX. Not suitable for application layouts. |
| Custom CSS Grid + drag | Would need to build constraint handling, persistence, keyboard support, collapse logic. 500+ lines of custom code to replicate what react-resizable-panels provides. |
| `react-grid-layout` | Already installed (`^2.2.2`) but wrong tool -- it's for dashboard grids with drag-and-drop rearrangement. The writing workspace needs fixed panel positions with resizable borders, not rearrangeable tiles. |

### Installation

```bash
npm install react-resizable-panels
```

### Integration Notes

- Works with existing Tailwind classes for handle styling
- `autoSaveId` provides free layout persistence (user resizes are remembered)
- Collapsible panels support hiding the chat pane or sidebar with double-click
- No conflict with existing `react-grid-layout` (different use cases, different components)

---

## Feature 2: Streaming Chat That Pushes Content to Editor

### Architecture Decision: Stream into chat pane, insert final content into editor

**Confidence: HIGH** -- validated by TipTap community discussion on streaming markdown and existing gateway infrastructure.

**The key insight:** Streaming markdown progressively into TipTap is genuinely complex (one developer reported "two weeks to get everything right"). The correct architecture is:

1. **Stream AI responses into the chat pane** using existing `react-markdown` for rendering
2. **On user action** ("Accept", "Insert", drag), push the final markdown content into TipTap using `@tiptap/markdown`'s `insertContent` with `contentType: 'markdown'`

This is a UX win, not just an engineering shortcut -- the user sees the full AI response in context, decides what to accept, and explicitly pushes content to the workspace.

### Chat Pane: Use existing `react-markdown` (already installed)

**Confidence: HIGH** -- `react-markdown@10.1.0` is already in `package.json`.

The chat pane renders AI streaming responses as formatted markdown. The existing `react-markdown` handles this well. No new library needed.

**Why NOT Streamdown (`streamdown@2.2.0`):**
- Streamdown is purpose-built for handling incomplete/unterminated markdown during streaming (graceful partial renders)
- However, `react-markdown` already handles streaming adequately when you feed it accumulated content on each delta
- Streamdown adds 69KB unpacked + brings `tailwind-merge`, `marked`, `rehype-*`, `remark-*` as transitive dependencies
- The project already has `react-markdown` + `remark-gfm` installed and working
- The marginal visual improvement of Streamdown's partial-syntax repair is not worth adding a dependency for the v2.1 writing chat
- If streaming rendering quality becomes an issue later, Streamdown can be swapped in (it's a near-drop-in replacement)

**How streaming works with existing infrastructure:**

The gateway already provides `sendChatWithCallbacks()` with `onDelta` callbacks. The `FeedbackPopover.tsx` demonstrates the exact pattern: accumulate deltas in a ref, update state on each delta, render accumulated content. The new chat pane will use the same pattern but render with `react-markdown` instead of raw `<pre>`.

```tsx
// Simplified pattern (already proven in FeedbackPopover.tsx)
const accumulatedRef = useRef('');

await gateway.sendChatWithCallbacks(prompt, sessionKey, {
  onDelta: (delta) => {
    accumulatedRef.current += delta;
    setChatContent(accumulatedRef.current);
  },
  onEnd: () => {
    setFinalContent(accumulatedRef.current);
    setStreaming(false);
  },
});

// In render:
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {chatContent}
</ReactMarkdown>
```

### Editor Content Insertion: `@tiptap/markdown` v3.19.0

**Confidence: HIGH** -- verified via npm (`@tiptap/markdown@3.19.0`), official TipTap docs, and official examples.

**What it adds:** When the `Markdown` extension is registered with the TipTap editor, all content commands (`setContent`, `insertContent`, `insertContentAt`) accept a `contentType: 'markdown'` option. This converts markdown strings to TipTap's internal ProseMirror document format.

**Why this is needed for v2.1:**
- v2.0 stores chapters as HTML (TipTap's `getHTML()` / `setContent(html)`)
- v2.1's chat produces markdown responses from AI agents
- Without `@tiptap/markdown`, we'd need to convert markdown to HTML ourselves before inserting
- With it, insertion is a single call: `editor.commands.insertContent(markdown, { contentType: 'markdown' })`

**How chat content gets pushed to editor:**

```tsx
// User clicks "Insert" on a chat message
const handleInsertToEditor = (markdownContent: string) => {
  // Insert at cursor position (or end of document)
  editor.chain()
    .focus()
    .insertContent(markdownContent, { contentType: 'markdown' })
    .run();
};

// Or replace entire chapter content from AI-generated outline
editor.commands.setContent(markdownContent, {
  contentType: 'markdown',
  emitUpdate: true,
});
```

**Integration with existing ChapterEditor:**

The `ChapterEditor.tsx` already configures TipTap with `StarterKit`, `Highlight`, `Placeholder`, `CharacterCount`, `Typography`, and `Link`. Adding the `Markdown` extension is additive:

```tsx
import { Markdown } from '@tiptap/markdown';

const editor = useEditor({
  extensions: [
    StarterKit.configure({ ... }),
    Markdown,  // Add this
    Highlight,
    Placeholder.configure({ ... }),
    // ... rest unchanged
  ],
});
```

**Dependency:** Only `marked@^17.0.1` (transitive, via @tiptap/markdown). No conflicts with existing packages.

### Installation

```bash
npm install @tiptap/markdown
```

---

## Feature 3: Project Setup Wizard (Conversational AI Planner)

### Decision: Build custom components. No wizard library needed.

**Confidence: HIGH** -- based on analysis of the UX requirement vs what wizard libraries provide.

**Why no library:**

The "setup wizard" described for v2.1 is NOT a traditional multi-step form wizard. It's a **conversational AI planning interface** where:
1. User describes their book idea in natural language
2. AI agent responds with story arc, chapter outline, themes, characters
3. User iterates through conversation ("make chapter 3 about X instead")
4. When satisfied, user confirms and the plan becomes the project structure

This is fundamentally a **chat interface with structured output**, not a form with steps. Libraries like `react-step-wizard`, CoreUI Stepper, or MUI Stepper are designed for static multi-step forms with predefined fields and validation. They would fight the conversational UX, not help it.

**What to build instead:**

```
SetupWizard (container)
  |-- ConversationPane (scrollable chat messages)
  |     |-- UserMessage (user's input)
  |     |-- AgentMessage (AI response, rendered with ReactMarkdown)
  |     |-- PlanPreview (structured plan card extracted from AI response)
  |-- InputBar (text input + send button)
  |-- PlanConfirmation (review & confirm generated plan)
```

The conversation is driven by the existing `gateway.sendChatWithCallbacks()` targeting a Writer agent session. The AI response includes structured plan data (JSON embedded in markdown or parsed from the response). The user confirms the plan, which creates the project structure (chapters, memory entries, project.json).

**What existing infrastructure covers:**
- `gateway.sendChatWithCallbacks()` -- streaming AI responses (existing)
- `chatRoomStore.ts` pattern -- message list with user/agent roles (existing pattern, adaptable)
- `writingStore.ts` -- project creation (`createProject`, `createChapter`) (existing)
- `memoryStore.ts` -- character/timeline/fact creation (existing)
- `react-markdown` + `remark-gfm` -- rendering AI responses (existing)

**What needs to be built:**
- `SetupWizard.tsx` component
- `useSetupWizardStore.ts` Zustand store (conversation state, plan state, wizard stage)
- Plan extraction logic (parse structured data from AI response)
- Plan-to-project conversion (create chapters, memory entries from confirmed plan)

**Estimated custom code:** ~400-600 lines across 3-4 files. This is less than what a wizard library would require in adapter/integration code.

---

## What NOT to Add (and Why)

| Library | Why Not |
|---------|---------|
| `streamdown` | Marginal improvement over existing `react-markdown` for streaming. Adds transitive deps (`tailwind-merge`, `marked`, `rehype-*`). Can upgrade later if needed. |
| `react-step-wizard` / MUI Stepper / CoreUI Stepper | Wrong abstraction. The wizard is conversational, not form-based. These libraries impose step-based navigation that conflicts with freeform AI conversation. |
| `@tiptap/extension-collaboration` / `yjs` | Still single-user. Chat-to-editor is a user-initiated transfer, not real-time collaboration. |
| `ai` (Vercel AI SDK) | The project already has OpenClaw Gateway for all AI communication. Adding Vercel AI SDK would be a competing abstraction for the same functionality. The gateway's `sendChatWithCallbacks` already provides streaming. |
| `@tanstack/react-virtual` | Would be needed if the chat history grows to thousands of messages. For the wizard conversation (10-30 messages) and per-chapter chat (50-100 messages), native scroll is sufficient. Premature optimization. |
| `framer-motion` | Animations for panel transitions and message appearances are nice-to-have, not blocking. Can be added later. Use CSS transitions for v2.1. |
| `tiptap-markdown` (community) | The official `@tiptap/markdown` (v3.19.0) is now available. Don't use the community fork (`tiptap-markdown@0.9.0` by aguingand). |
| `prosemirror-markdown` (direct) | `@tiptap/markdown` wraps this internally via `marked`. Don't install ProseMirror packages directly -- version conflicts with `@tiptap/pm` will occur. |
| Custom resizable panel implementation | `react-resizable-panels` is battle-tested, zero-dep, React 18 compatible. Building custom saves nothing and loses persistence, keyboard support, and constraint handling. |

---

## Installation Summary

```bash
# New for v2.1 (only 2 packages)
npm install react-resizable-panels @tiptap/markdown
```

That's it. Two packages. Everything else is either already installed or built as custom components.

---

## Integration Map: How New Fits With Existing

### Data Flow: Chat to Editor

```
User types in chat input
  -> gateway.sendChatWithCallbacks(prompt, sessionKey)
    -> onDelta: accumulate in ref, setState for ReactMarkdown render
    -> onEnd: parse final content, enable "Insert" button
  -> User clicks "Insert" on a chat message
    -> editor.commands.insertContent(markdown, { contentType: 'markdown' })
    -> TipTap's @tiptap/markdown converts to ProseMirror nodes
    -> Content appears in editor, autosave triggers
```

### Data Flow: Setup Wizard to Project

```
User describes book in wizard chat
  -> gateway.sendChatWithCallbacks(planPrompt, 'agent:writer:setup')
    -> AI returns structured plan (chapters, characters, themes)
  -> User reviews plan, clicks "Create Project"
    -> writingStore.createProject(title, type)
    -> For each chapter: writingStore.createChapter(title)
    -> For each character: memoryStore via IPC
    -> Redirect to 3-pane workspace with new project open
```

### Component Tree (v2.1)

```
WritingWorkspace
  |-- (no project) -> ProjectSelector -> SetupWizard (NEW)
  |-- (has project) -> ResizableLayout (NEW, replaces flex layout)
        |-- PanelGroup (react-resizable-panels)
              |-- Panel: ChapterSidebar (EXISTING, minor updates)
              |-- PanelResizeHandle
              |-- Panel: ChatDialoguePane (NEW)
              |     |-- ChatMessageList
              |     |-- ChatInput
              |-- PanelResizeHandle
              |-- Panel: ChapterEditor (EXISTING, add @tiptap/markdown)
```

### Store Changes

| Store | Change |
|-------|--------|
| `writingStore.ts` | Add `wizardActive` state, plan data fields |
| `feedbackStore.ts` | No change (inline feedback is orthogonal to chat pane) |
| NEW: `chatDialogueStore.ts` | Chat messages, streaming state, per-chapter conversation history |
| `memoryStore.ts` | No change (wizard uses existing API to create entries) |

### Gateway Sessions

| Session Key Pattern | Agent | Purpose |
|--------------------|-------|---------|
| `agent:writer:setup` | Writer | Wizard conversation for project planning |
| `agent:writer:writing:{projectId}` | Writer | Per-project writing chat |
| `agent:researcher:writing:{projectId}` | Researcher | Research-focused writing chat |
| `agent:jess:writing:{projectId}` | Jess | Emotional/therapeutic writing guidance |

These follow the existing pattern from `FeedbackPopover.tsx` (`agent:{agentId}:writing:{projectId}`).

---

## Version Pinning Notes

- `@tiptap/markdown` MUST use `^3.19.0` to match existing TipTap packages. TipTap publishes all packages in lockstep.
- `react-resizable-panels` is independent, `^4.6.2` is safe.
- No changes to existing package versions.

---

## Sources

- [react-resizable-panels on npm](https://www.npmjs.com/package/react-resizable-panels) -- v4.6.2, published Feb 7 2026
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) -- by Brian Vaughn (ex-React core team)
- [react-resizable-panels docs](https://react-resizable-panels.vercel.app/)
- [shadcn/ui Resizable (built on react-resizable-panels)](https://ui.shadcn.com/docs/components/radix/resizable)
- [@tiptap/markdown on npm](https://www.npmjs.com/package/@tiptap/markdown) -- v3.19.0
- [TipTap Markdown docs](https://tiptap.dev/docs/editor/markdown)
- [TipTap Markdown basic usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)
- [TipTap insertContent API](https://tiptap.dev/docs/editor/api/commands/content/insert-content)
- [TipTap streaming discussion #5563](https://github.com/ueberdosis/tiptap/discussions/5563) -- community confirmation that streaming into TipTap is complex
- [Streamdown GitHub](https://github.com/vercel/streamdown) -- evaluated but not selected
- [npm trends: allotment vs react-resizable-panels](https://npmtrends.com/allotment-vs-react-resizable-vs-react-split-pane-vs-react-splitter-layout)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| react-resizable-panels as panel library | HIGH | v4.6.2 verified on npm, React 18 peer dep confirmed, 1551 dependents, shadcn/ui adoption |
| @tiptap/markdown for content insertion | HIGH | v3.19.0 matches existing TipTap version, official extension, `insertContent` with `contentType: 'markdown'` verified in docs |
| No wizard library needed | HIGH | UX requirement is conversational, not form-based. Existing gateway + chat patterns cover it. |
| Streaming in chat pane via react-markdown | HIGH | Pattern already proven in FeedbackPopover.tsx with gateway.sendChatWithCallbacks |
| Streamdown skip decision | MEDIUM | Streamdown works with React 18 (verified peer deps), but the marginal benefit doesn't justify adding it now. Decision could be revisited. |
| Chat-to-editor content flow | HIGH | `insertContent` with `contentType: 'markdown'` is documented in official TipTap examples |
