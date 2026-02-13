# Phase 6: Inline Feedback - Research

**Researched:** 2026-02-12
**Domain:** TipTap BubbleMenu + OpenClaw Gateway streaming + Electron IPC
**Confidence:** HIGH

## Summary

Phase 6 adds AI-powered inline text feedback to the writing editor. The user highlights text, sees a popover, selects an agent (Writer, Researcher, or Jess), types instructions, and receives 2-3 streamed alternative versions. They can accept one (replacing highlighted text) or dismiss.

The standard approach uses TipTap's built-in `BubbleMenu` React component for the popover (already installed as part of `@tiptap/react` v3.19.0), the existing `gateway.sendChatWithCallbacks()` method for streaming agent communication with per-runId isolation, and `editor.commands.insertContentAt()` for replacing selected text with chosen alternatives.

The feedback log (JSONL) uses `fs.promises.appendFile()` in the Electron main process with an IPC handler, stored per-chapter in the project directory.

**Primary recommendation:** Use the existing TipTap BubbleMenu component from `@tiptap/react/menus` with a custom `shouldShow` that checks for non-empty text selection. Use `sendChatWithCallbacks` with project-scoped session keys (`agent:{agentId}:writing:{projectId}`) for streaming. No new npm packages required.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/react` | 3.19.0 | `BubbleMenu` component from `@tiptap/react/menus` | Ships with TipTap, no extra install needed |
| `@tiptap/extension-bubble-menu` | 3.19.0 | Plugin powering BubbleMenu positioning via Floating UI | Already installed as TipTap dependency |
| `@floating-ui/dom` | (transitive) | Positioning engine used by BubbleMenu | Comes with `@tiptap/extension-bubble-menu` |
| `zustand` | 4.4.7 | State management for feedback popover state | Already in use across dashboard |
| `lucide-react` | 0.303.0 | Icons for agent picker, send button, accept/dismiss | Already in use across dashboard |

### Supporting (Already Available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gateway.ts` (existing) | N/A | `sendChatWithCallbacks()` for streaming | Agent communication with per-runId callbacks |
| `electron/paths.ts` (existing) | N/A | `writingMemoryPath()` already defined | Feedback log file paths |
| `fs.promises` (Node.js) | N/A | `appendFile()` for JSONL logging | Append-only feedback log |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap BubbleMenu | Manual `coordsAtPos()` popup | BubbleMenu handles positioning, scroll, resize, focus automatically |
| `sendChatWithCallbacks` | Custom WebSocket listener | Callbacks already solve runId isolation, timeout cleanup |
| JSONL file per chapter | SQLite table | JSONL is simpler, append-only, portable; no schema migration |
| Zustand feedbackStore | React useState in component | Store allows cross-component access (e.g., feedback history panel later) |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/writing/
    ChapterEditor.tsx          # Modified: pass editor to FeedbackPopover
    FeedbackPopover.tsx         # NEW: BubbleMenu-based AI feedback UI
    FeedbackAlternative.tsx     # NEW: Single alternative card (stream + accept/dismiss)
    AgentPicker.tsx             # NEW: Writer/Researcher/Jess selector
  store/
    feedbackStore.ts            # NEW: Zustand store for feedback state
  lib/
    gateway.ts                  # EXISTING: sendChatWithCallbacks (no changes)
electron/
  writing-feedback-service.ts   # NEW: IPC handlers for feedback logging
  writing-project-service.ts    # EXISTING: no changes needed
  paths.ts                      # EXISTING: writingMemoryPath already defined
  preload.ts                    # MODIFIED: add writing.feedback.* IPC bridge
  main.ts                       # MODIFIED: register feedback handlers
```

### Pattern 1: BubbleMenu with Custom shouldShow

**What:** Use TipTap's BubbleMenu React component to show the feedback popover when text is selected.
**When to use:** Always -- this is the primary UI pattern for Phase 6.

```typescript
// Source: @tiptap/react/menus types + official docs
import { BubbleMenu } from '@tiptap/react/menus';

// Inside ChapterEditor, after the EditorContent:
<BubbleMenu
  editor={editor}
  shouldShow={({ editor, from, to }) => {
    // Only show when there's a non-empty text selection
    if (from === to) return false;
    // Don't show for node selections (images, etc.)
    const { empty } = editor.state.selection;
    return !empty;
  }}
  options={{
    placement: 'top',
    offset: { mainAxis: 8 },
    flip: true,
    shift: { padding: 8 },
  }}
>
  <FeedbackPopover editor={editor} />
</BubbleMenu>
```

### Pattern 2: Streaming with sendChatWithCallbacks

**What:** Send highlighted text + instructions to an agent, receive streamed response via per-runId callbacks.
**When to use:** When user sends feedback request.

```typescript
// Source: gateway.ts existing API (verified in codebase)
import { gateway } from '../../lib/gateway';

// Project-scoped session key preserves agent context within project
const sessionKey = `agent:${agentId}:writing:${projectId}`;

let accumulated = '';
const runId = await gateway.sendChatWithCallbacks(
  prompt,
  sessionKey,
  {
    onDelta: (delta) => {
      accumulated += delta;
      // Update streaming UI
      setStreamingContent(accumulated);
    },
    onMessage: (fullContent) => {
      // Final complete message
      setStreamingContent(fullContent);
    },
    onEnd: () => {
      // Parse alternatives from response
      parseAlternatives(accumulated);
      setStreaming(false);
    },
    onError: (error) => {
      setError(error);
      setStreaming(false);
    },
  }
);
```

### Pattern 3: Text Replacement with insertContentAt

**What:** Replace highlighted text with the chosen alternative.
**When to use:** When user clicks "Accept" on an alternative.

```typescript
// Source: TipTap docs - insertContentAt API (verified)
const { from, to } = editor.state.selection;

// Replace the selected range with the chosen alternative
editor
  .chain()
  .focus()
  .insertContentAt({ from, to }, chosenAlternativeText, {
    updateSelection: true,
  })
  .run();
```

### Pattern 4: JSONL Feedback Logging (Electron Main Process)

**What:** Append feedback interaction records to a per-chapter JSONL file.
**When to use:** After each feedback interaction (send, accept, dismiss).

```typescript
// Source: Node.js fs.promises.appendFile + existing paths.ts
import { writingMemoryPath } from './paths';
import * as fs from 'fs';

async function logFeedback(
  projectId: string,
  chapterId: string,
  entry: FeedbackLogEntry
) {
  const logPath = writingMemoryPath(projectId, `feedback-${chapterId}.jsonl`);
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  }) + '\n';
  await fs.promises.appendFile(logPath, line, 'utf-8');
}
```

### Pattern 5: Agent Prompt Construction

**What:** Build the prompt sent to the AI agent with full context (selected text, instructions, chapter content, outline).
**When to use:** Before calling sendChatWithCallbacks.

```typescript
// Construct prompt with context
const prompt = [
  `## Task`,
  `The user has highlighted the following text and wants feedback:`,
  ``,
  `### Selected Text`,
  `"${selectedText}"`,
  ``,
  `### User Instructions`,
  instructions,
  ``,
  `### Chapter Context`,
  chapterContent,
  ``,
  `### Project Outline`,
  outlineData || '(no outline available)',
  ``,
  `## Response Format`,
  `Provide exactly 3 alternative versions of the highlighted text.`,
  `Format each alternative as:`,
  `### Alternative 1`,
  `[rewritten text]`,
  ``,
  `### Alternative 2`,
  `[rewritten text]`,
  ``,
  `### Alternative 3`,
  `[rewritten text]`,
].join('\n');
```

### Anti-Patterns to Avoid

- **Don't use global gateway event listeners for feedback streaming:** The `sendChatWithCallbacks` per-runId approach is already proven in ChatRoomView.tsx. Global listeners cause cross-session bleed.
- **Don't use `setSessionKey()` to switch the gateway's active session:** This would disrupt the main dashboard chat. Use `sendChatWithCallbacks` with explicit sessionKey parameter instead.
- **Don't store feedback in the chapter markdown file:** Keep chapter content separate from metadata/logs. Use the `memory/` directory (already created in project structure).
- **Don't block the editor while streaming:** The feedback popover should stream content while the user can still see and scroll the editor.
- **Don't hand-roll popover positioning:** BubbleMenu uses Floating UI internally and handles scroll tracking, viewport flipping, and resize.
- **Don't create a new WebSocket connection for agents:** Reuse the existing singleton gateway connection with different session keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning near selection | Manual `coordsAtPos` + absolute positioning | `BubbleMenu` from `@tiptap/react/menus` | Handles scroll, resize, flip, viewport edge cases |
| Streaming with runId isolation | Custom WebSocket event filtering | `gateway.sendChatWithCallbacks()` | Already handles runId tracking, timeouts, cleanup |
| Text replacement in editor | Direct ProseMirror transaction manipulation | `editor.commands.insertContentAt()` | Handles undo history, parse options, selection update |
| Feedback log persistence | Custom file write/read with locking | `fs.promises.appendFile()` (JSONL) | Atomic append, no locking needed, one-line-per-entry |
| Agent session management | Custom session spawn/teardown | Gateway session keys (`agent:X:writing:Y`) | Sessions auto-create on first message, persist via gateway |

**Key insight:** Every major technical challenge in this phase has an existing solution either in the TipTap API or in the dashboard's gateway.ts. The sendChatWithCallbacks pattern from ChatRoomView.tsx is the exact model to follow for streaming agent responses.

## Common Pitfalls

### Pitfall 1: BubbleMenu Flickers on Typing After Accept

**What goes wrong:** After accepting an alternative (which replaces text), the editor selection changes, triggering BubbleMenu to show/hide rapidly.
**Why it happens:** `insertContentAt` with `updateSelection: true` creates a new selection, BubbleMenu re-evaluates `shouldShow`.
**How to avoid:** After accepting, either (a) collapse the selection to a cursor position with `editor.commands.setTextSelection(to)`, or (b) add a brief `shouldShow` guard that suppresses the menu for 200ms after an accept action (use a ref flag).
**Warning signs:** BubbleMenu appearing immediately after text replacement.

### Pitfall 2: Session Key Collision With Dashboard Chat

**What goes wrong:** Feedback messages appear in the dashboard's main chat panel or vice versa.
**Why it happens:** Using the same session key as the dashboard chat (`agent:froggo:dashboard`).
**How to avoid:** Use project-scoped session keys: `agent:{agentId}:writing:{projectId}`. This is the same pattern used in ChatRoomView.tsx (`agent:{agentId}:room:{roomId}`).
**Warning signs:** Agent responses appearing in wrong UI panels.

### Pitfall 3: Streaming Content Parsing Before Complete

**What goes wrong:** Trying to parse "Alternative 1" / "Alternative 2" headers from partial streamed content fails.
**Why it happens:** Delta events arrive character-by-character; regex on partial content is unreliable.
**How to avoid:** Stream the full raw response in a single view during streaming. Only parse into separate alternatives in the `onEnd` callback when the full response is available. During streaming, show the raw text accumulating.
**Warning signs:** Partial alternatives showing, content jumping between alternatives.

### Pitfall 4: BubbleMenu updateDelay Feels Sluggish

**What goes wrong:** 250ms default delay makes the popover feel slow to appear.
**Why it happens:** BubbleMenu has a default `updateDelay` of 250ms to avoid flickering.
**How to avoid:** Set `updateDelay={0}` on the BubbleMenu component. The feedback popover is a deliberate interaction (not a tooltip) so instant response is better than debouncing.
**Warning signs:** Users selecting text and waiting for popover.

### Pitfall 5: Jess Agent Not in Dashboard Agents Registry

**What goes wrong:** Jess agent session doesn't exist; messages fail.
**Why it happens:** `dashboard-agents.ts` lists 13 agents but does NOT include Jess. Similarly, `agent-registry.json` has no Jess entry.
**How to avoid:** Add Jess to both `dashboard-agents.ts` (with session key `agent:jess:dashboard`) and `agent-registry.json`. OR, skip dashboard agent pre-spawning for writing agents and let the gateway auto-create sessions on first message (which it does).
**Warning signs:** First feedback request to Jess fails or has very long cold-start delay.

### Pitfall 6: Large Chapter Content Exceeding Context Window

**What goes wrong:** Sending full 10k+ word chapter content as context overflows the model's context window.
**Why it happens:** Prompt includes chapter content + outline + instructions + selected text.
**How to avoid:** Truncate chapter context to a window around the selected text (e.g., 2000 words before/after selection). Include a summary or outline of the full chapter rather than the raw content.
**Warning signs:** API errors about token limits, very slow responses.

### Pitfall 7: Editor Focus Loss When Interacting with Popover

**What goes wrong:** Clicking buttons in the BubbleMenu (agent picker, input field, send button) causes the editor to lose focus and the selection to collapse, hiding the BubbleMenu.
**Why it happens:** BubbleMenu hides on editor blur by default. Focus moving to input/buttons triggers blur.
**How to avoid:** BubbleMenu already has `preventHide` logic for mousedown on the menu element itself. The key is ensuring the popover's interactive elements (input, buttons) are INSIDE the BubbleMenu's DOM tree (rendered as children of `<BubbleMenu>`). This is how TipTap expects it to work.
**Warning signs:** Popover disappearing when clicking the input field or buttons.

## Code Examples

### Example 1: FeedbackPopover Component Structure

```typescript
// src/components/writing/FeedbackPopover.tsx
import { useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Send, Check, X, Bot } from 'lucide-react';
import { gateway } from '../../lib/gateway';
import { useWritingStore } from '../../store/writingStore';
import { useFeedbackStore } from '../../store/feedbackStore';

interface FeedbackPopoverProps {
  editor: Editor;
}

const AGENTS = [
  { id: 'writer', name: 'Writer', icon: '✍️' },
  { id: 'researcher', name: 'Researcher', icon: '🔬' },
  { id: 'jess', name: 'Jess', icon: '💡' },
];

export default function FeedbackPopover({ editor }: FeedbackPopoverProps) {
  const [selectedAgent, setSelectedAgent] = useState('writer');
  const [instructions, setInstructions] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { activeProjectId, activeChapterId, activeChapterContent } = useWritingStore();

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const handleSend = async () => {
    const selectedText = getSelectedText();
    if (!selectedText || !instructions.trim()) return;

    setStreaming(true);
    setStreamContent('');
    setAlternatives([]);
    setError(null);

    const sessionKey = `agent:${selectedAgent}:writing:${activeProjectId}`;
    const prompt = buildPrompt(selectedText, instructions, activeChapterContent);

    let accumulated = '';
    try {
      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          accumulated += delta;
          setStreamContent(accumulated);
        },
        onEnd: () => {
          const parsed = parseAlternatives(accumulated);
          setAlternatives(parsed);
          setStreaming(false);
          // Log the interaction
          logFeedback(selectedText, instructions, selectedAgent, parsed);
        },
        onError: (err) => {
          setError(err);
          setStreaming(false);
        },
      });
    } catch (e: any) {
      setError(e.message);
      setStreaming(false);
    }
  };

  const handleAccept = (alternativeText: string) => {
    const { from, to } = editor.state.selection;
    editor.chain().focus().insertContentAt({ from, to }, alternativeText, {
      updateSelection: true,
    }).run();
    // Reset state
    setAlternatives([]);
    setStreamContent('');
    setInstructions('');
  };

  // ... render UI
}
```

### Example 2: BubbleMenu Integration in ChapterEditor

```typescript
// Modified ChapterEditor.tsx — additions only
import { BubbleMenu } from '@tiptap/react/menus';
import FeedbackPopover from './FeedbackPopover';

// Inside the return, after <EditorContent editor={editor} />:
{editor && (
  <BubbleMenu
    editor={editor}
    shouldShow={({ editor, from, to }) => {
      if (from === to) return false;
      return !editor.state.selection.empty;
    }}
    updateDelay={0}
    options={{
      placement: 'top',
      offset: { mainAxis: 8 },
      flip: true,
      shift: { padding: 8 },
    }}
  >
    <FeedbackPopover editor={editor} />
  </BubbleMenu>
)}
```

### Example 3: Alternative Parsing from Agent Response

```typescript
function parseAlternatives(response: string): string[] {
  // Split on "### Alternative N" headers
  const parts = response.split(/###\s*Alternative\s*\d+\s*/i);
  // First part is preamble, skip it
  const alternatives = parts.slice(1).map(p => p.trim()).filter(Boolean);
  // Ensure we have 1-3 alternatives
  return alternatives.slice(0, 3);
}
```

### Example 4: JSONL Feedback Log Entry Format

```typescript
interface FeedbackLogEntry {
  timestamp: string;        // ISO 8601
  chapterId: string;
  agentId: string;
  selectedText: string;
  instructions: string;
  alternatives: string[];
  accepted: string | null;  // null if dismissed
  selectionRange: { from: number; to: number };
}

// Example log line:
// {"timestamp":"2026-02-12T15:30:00Z","chapterId":"ch-123","agentId":"writer","selectedText":"The sun set slowly","instructions":"Make it more vivid","alternatives":["The sun blazed...","Crimson light...","The horizon burned..."],"accepted":"The sun blazed...","selectionRange":{"from":42,"to":61}}
```

### Example 5: IPC Bridge for Feedback Logging

```typescript
// electron/preload.ts — addition to writing section
feedback: {
  log: (projectId: string, entry: any) =>
    ipcRenderer.invoke('writing:feedback:log', projectId, entry),
  history: (projectId: string, chapterId: string) =>
    ipcRenderer.invoke('writing:feedback:history', projectId, chapterId),
},
```

### Example 6: Feedback Store (Zustand)

```typescript
// src/store/feedbackStore.ts
import { create } from 'zustand';

interface FeedbackState {
  // Active feedback session
  selectedAgent: string;
  instructions: string;
  streaming: boolean;
  streamContent: string;
  alternatives: string[];
  error: string | null;

  // Actions
  setSelectedAgent: (agent: string) => void;
  setInstructions: (text: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  setAlternatives: (alts: string[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  selectedAgent: 'writer',
  instructions: '',
  streaming: false,
  streamContent: '',
  alternatives: [],
  error: null,

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setInstructions: (text) => set({ instructions: text }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  setAlternatives: (alts) => set({ alternatives: alts }),
  setError: (error) => set({ error }),
  reset: () => set({
    instructions: '',
    streaming: false,
    streamContent: '',
    alternatives: [],
    error: null,
  }),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tippy.js for BubbleMenu positioning | Floating UI (@floating-ui/dom) | TipTap v3 | Better positioning, no Tippy.js dependency |
| `@tiptap/extension-bubble-menu` separate install | `BubbleMenu` from `@tiptap/react/menus` | TipTap v3 | Cleaner import, same underlying plugin |
| Manual WebSocket event filtering | `sendChatWithCallbacks` with per-runId | Already in codebase | Proven pattern in ChatRoomView.tsx |

**Deprecated/outdated:**
- Tippy.js integration for BubbleMenu (replaced by Floating UI in TipTap v3)
- `BubbleMenu` imported directly from `@tiptap/react` (now at `@tiptap/react/menus`)

## Open Questions

1. **Jess agent session key format**
   - What we know: Jess exists as an agent (`clawd-jess`/`agent-jess`) but is NOT in `dashboard-agents.ts` or `agent-registry.json`
   - What's unclear: Whether Jess needs to be pre-spawned for writing, or if gateway auto-creates sessions on first message
   - Recommendation: Add Jess to `agent-registry.json` with appropriate writing-focused prompt. Use project-scoped session keys that auto-create -- no need for pre-spawning via dashboard-agents.ts since writing sessions are separate from dashboard sessions.

2. **Outline data availability for context**
   - What we know: FEED-08 requires "outline" in AI context. Current project structure has `project.json` (title, type) and `chapters.json` (chapter list) but no explicit "outline" field.
   - What's unclear: Whether "outline" means the chapter titles/structure or a user-written outline document.
   - Recommendation: Use chapter titles and positions as the outline. If a dedicated outline is needed, that's Phase 7+ territory (memory store).

3. **Memory store data availability**
   - What we know: FEED-08 mentions "memory store data (when available)". The `memory/` directory exists in project structure but is reserved for Phase 7.
   - What's unclear: What memory store data would be available before Phase 7.
   - Recommendation: Build the context assembly to optionally include memory store data if files exist in `memory/`. For now, it will gracefully skip if empty. This makes Phase 7 integration seamless.

4. **Number of alternatives (exactly 3 vs. flexible)**
   - What we know: FEED-03 says "2-3 alternative versions"
   - What's unclear: Whether the AI always produces exactly 3, or if it might produce 2
   - Recommendation: Request 3 in the prompt but handle 1-3 in the parser. UI should render however many alternatives are returned.

## Sources

### Primary (HIGH confidence)
- `@tiptap/extension-bubble-menu` v3.19.0 type definitions - `node_modules/@tiptap/extension-bubble-menu/dist/index.d.ts` (read directly)
- `@tiptap/react` v3.19.0 menus export - `node_modules/@tiptap/react/dist/menus/index.d.ts` (read directly)
- [TipTap BubbleMenu docs](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu) - Configuration, shouldShow, Floating UI options
- [TipTap insertContentAt docs](https://tiptap.dev/docs/editor/api/commands/content/insert-content-at) - Range replacement API
- `src/lib/gateway.ts` - sendChatWithCallbacks API (read directly from codebase)
- `src/components/ChatRoomView.tsx` - Streaming callback pattern (read directly from codebase)
- `electron/dashboard-agents.ts` - Session key format, agent registry (read directly)
- `electron/writing-project-service.ts` - File storage patterns (read directly)
- `electron/paths.ts` - writingMemoryPath already defined (read directly)

### Secondary (MEDIUM confidence)
- [TipTap Custom Menus guide](https://tiptap.dev/docs/editor/getting-started/style-editor/custom-menus) - Menu architecture patterns
- [TipTap setTextSelection docs](https://tiptap.dev/docs/editor/api/commands/selection/set-text-selection) - Selection manipulation

### Tertiary (LOW confidence)
- None -- all findings verified against installed package types or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, APIs verified from type definitions
- Architecture: HIGH -- patterns copied from existing working code (ChatRoomView.tsx, gateway.ts)
- Pitfalls: HIGH -- identified from actual codebase constraints (missing Jess agent, session key format, BubbleMenu behavior)
- Code examples: HIGH -- based on installed TipTap v3.19.0 types and existing gateway.ts API

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable -- all core libraries are locked versions in package.json)
