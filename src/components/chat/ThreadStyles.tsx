"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  useMessage,
  useComposerRuntime,
} from "@assistant-ui/react";
import {
  Send,
  Loader2,
  Copy,
  Check,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  ChevronDown,
  Square,
  Paperclip,
  Mic,
  MicOff,
  ChevronRight as CollapseChevron,
  Terminal,
  Wrench,
  CheckCircle2,
  XCircle,
  Brain,
  FolderOpen,
  Expand,
  FileText,
  FileCode2,
  Image as ImageIcon,
  Network,
  Database,
  Search,
  Globe,
  Zap,
  Bot,
  ListChecks,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect, useMemo, createContext, useContext } from "react";
import MarkdownMessage from "../MarkdownMessage";
import { useArtifactStore, type Artifact, type ArtifactType } from "../../store/artifactStore";
import { useArtifactOpen } from "../../hooks/useArtifactOpen";
import { approvalApi } from "../../lib/api";
import { getApprovalTypeConfig } from "../../lib/approvalTypes";

// Context so MarkdownMessage inside assistant-ui thread gets artifact support
const ArtifactOpenContext = createContext<((lang: string, code: string) => void) | undefined>(undefined);
function useArtifactOpenCtx() { return useContext(ArtifactOpenContext); }

// ─────────────────────────────────────────────────────────────────
// CSS keyframes — injected once on load
// ─────────────────────────────────────────────────────────────────

let _cssInjected = false;
export function ensureCSS() {
  if (_cssInjected || typeof document === "undefined") return;
  _cssInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes aui-thinking-dot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
      40%           { transform: scale(1);   opacity: 1;   }
    }
    @keyframes aui-cursor-blink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }
    @keyframes aui-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    @keyframes aui-slide-in {
      from { opacity: 0; max-height: 0; }
      to   { opacity: 1; max-height: 400px; }
    }
    .aui-message-enter { animation: aui-fade-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
    .aui-action-bar { opacity: 0; transition: opacity 0.12s; }
    .aui-message-root:hover .aui-action-bar,
    .aui-message-root:focus-within .aui-action-bar { opacity: 1; }
    .aui-user-bubble {
      background: color-mix(in srgb, var(--mission-control-accent) 11%, transparent);
      border: 1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent);
    }
    .aui-thinking-dot-span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--mission-control-accent);
      display: inline-block;
      animation: aui-thinking-dot 1.2s ease-in-out infinite;
    }
    .aui-streaming-cursor {
      display: inline-block; width: 2px; height: 0.85em;
      margin-left: 2px; background: var(--mission-control-accent);
      vertical-align: text-bottom; border-radius: 1px;
      animation: aui-cursor-blink 0.8s step-end infinite;
    }
    .aui-action-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 6px;
      border: 1px solid transparent; background: transparent;
      color: var(--mission-control-text-dim); cursor: pointer;
      transition: color 0.12s, background-color 0.12s;
    }
    .aui-action-btn:hover {
      background: color-mix(in srgb, var(--mission-control-border) 60%, transparent);
      color: var(--mission-control-text);
    }
    .aui-action-btn-active {
      color: var(--mission-control-accent);
      background: color-mix(in srgb, var(--mission-control-accent) 10%, transparent);
    }
    .aui-action-btn-copied { color: var(--color-success); }
    .aui-branch-picker-prev,
    .aui-branch-picker-next {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; border-radius: 4px;
      border: 1px solid transparent; background: transparent;
      color: var(--mission-control-text-dim); cursor: pointer;
      transition: color 0.12s, background-color 0.12s;
    }
    .aui-branch-picker-prev:hover,
    .aui-branch-picker-next:hover {
      background: color-mix(in srgb, var(--mission-control-border) 60%, transparent);
      color: var(--mission-control-text);
    }
    .aui-composer-root {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0;
      background: var(--mission-control-surface);
      border: 1px solid var(--mission-control-border);
      border-radius: 14px;
      transition: border-color 180ms, box-shadow 180ms;
      overflow: hidden;
    }
    .aui-composer-root:focus-within {
      border-color: var(--mission-control-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--mission-control-accent) 18%, transparent);
    }
    .aui-composer-input {
      display: block; width: 100%;
      background: transparent; border: none; outline: none;
      resize: none; color: var(--mission-control-text);
      font-size: var(--font-size-2); line-height: 1.6;
      font-family: inherit; padding: 12px 16px 4px;
    }
    .aui-composer-input::placeholder { color: color-mix(in srgb, var(--mission-control-text-dim) 60%, transparent); }
    .aui-composer-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px 8px; gap: 6px;
    }
    .aui-composer-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: transparent; color: var(--mission-control-text-dim);
      cursor: pointer; flex-shrink: 0;
      transition: color 0.12s, background-color 0.12s;
    }
    .aui-composer-icon-btn:hover {
      background: color-mix(in srgb, var(--mission-control-border) 50%, transparent);
      color: var(--mission-control-text);
    }
    .aui-composer-icon-btn:disabled { opacity: 0.35; pointer-events: none; }
    .aui-composer-icon-btn-active {
      background: color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
      color: var(--color-error, #ef4444);
      animation: aui-mic-pulse 1.5s ease-in-out infinite;
    }
    @keyframes aui-mic-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    /* Listening state: red border + glow on composer root */
    .aui-composer-root.aui-listening {
      border-color: var(--color-error, #ef4444);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent);
    }
    .aui-listening-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 16px; font-size: 12px; font-weight: 500;
      color: var(--color-error, #ef4444);
      background: color-mix(in srgb, var(--color-error, #ef4444) 8%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
      animation: aui-mic-pulse 1.5s ease-in-out infinite;
    }
    .aui-listening-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--color-error, #ef4444);
      animation: aui-mic-pulse 1s ease-in-out infinite;
    }
    .aui-send-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--mission-control-accent); color: white;
      border: none; flex-shrink: 0;
      transition: opacity 0.15s, transform 0.1s;
    }
    .aui-send-btn:not(:disabled):hover { opacity: 0.88; transform: scale(1.04); }
    .aui-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .aui-send-btn:not(:disabled) { cursor: pointer; }
    .aui-stop-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      background: color-mix(in srgb, var(--color-error) 12%, transparent);
      color: var(--color-error);
      border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
      flex-shrink: 0; cursor: pointer;
      transition: background 0.12s;
    }
    .aui-stop-btn:hover {
      background: color-mix(in srgb, var(--color-error) 20%, transparent);
    }
    .aui-scroll-to-bottom:disabled {
      display: none;
    }
    .aui-scroll-to-bottom {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px;
      padding: 5px 14px 5px 10px;
      border-radius: 999px;
      background: var(--mission-control-surface);
      border: 1px solid var(--mission-control-border);
      color: var(--mission-control-text-dim);
      font-size: 12px; font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 16px color-mix(in srgb, black 20%, transparent);
      transition: color 0.12s, border-color 0.12s, box-shadow 0.12s;
      z-index: 10; letter-spacing: 0.01em;
      white-space: nowrap;
    }
    .aui-scroll-to-bottom:hover {
      border-color: var(--mission-control-accent);
      color: var(--mission-control-text);
      box-shadow: 0 4px 20px color-mix(in srgb, black 30%, transparent);
    }
    /* Tool group — chain style */
    .aui-tool-group {
      margin: 6px 0; border-radius: 10px; overflow: hidden;
      border: 1px solid var(--mission-control-border);
      animation: aui-fade-in 0.15s ease both;
    }
    .aui-tool-group-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; cursor: pointer; user-select: none;
      background: color-mix(in srgb, var(--mission-control-border) 18%, transparent);
      transition: background 0.12s; border: none; width: 100%; text-align: left;
    }
    .aui-tool-group-header:hover {
      background: color-mix(in srgb, var(--mission-control-border) 32%, transparent);
    }
    .aui-tool-group-body { border-top: 1px solid var(--mission-control-border); }
    /* Each tool row */
    .aui-tool-row {
      display: flex; align-items: stretch;
      padding-left: 12px; padding-right: 12px;
      cursor: pointer; transition: background 0.1s;
    }
    .aui-tool-row:hover {
      background: color-mix(in srgb, var(--mission-control-border) 15%, transparent);
    }
    /* Vertical connector line */
    .aui-tool-row-line {
      width: 1px; flex-shrink: 0; margin-right: 10px;
      background: var(--mission-control-border); align-self: stretch;
    }
    .aui-tool-row:first-child .aui-tool-row-line { margin-top: 16px; }
    .aui-tool-done-row .aui-tool-row-line { margin-bottom: 16px; }
    /* Row content */
    .aui-tool-row-content {
      display: flex; align-items: center; gap: 6px;
      flex: 1; min-width: 0; padding: 6px 0;
    }
    /* Result / file badges */
    .aui-result-badge {
      font-size: 10px; padding: 1px 5px; border-radius: 4px; flex-shrink: 0;
      background: color-mix(in srgb, var(--mission-control-border) 50%, transparent);
      color: var(--mission-control-text-dim);
    }
    .aui-file-chip {
      font-size: 10px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
      border: 1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent);
      background: color-mix(in srgb, var(--mission-control-accent) 7%, transparent);
      color: color-mix(in srgb, var(--mission-control-accent) 75%, var(--mission-control-text));
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* Expanded detail inside a row */
    .aui-tool-row-detail {
      padding: 8px 12px 8px 35px;
      background: color-mix(in srgb, var(--mission-control-bg) 60%, transparent);
      border-top: 1px solid var(--mission-control-border);
    }
    .aui-tool-code {
      font-family: ui-monospace, 'SF Mono', Consolas, monospace;
      font-size: 11px; line-height: 1.6; color: var(--mission-control-text);
      white-space: pre-wrap; word-break: break-all;
      max-height: 200px; overflow-y: auto;
    }
    /* Thinking block */
    .aui-thinking-block {
      font-size: 12px; border-radius: 8px; overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-review) 18%, transparent);
      background: color-mix(in srgb, var(--color-review) 5%, transparent);
      margin: 4px 0;
      animation: aui-fade-in 0.15s ease both;
    }
    .aui-thinking-header {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px; cursor: pointer;
      user-select: none;
    }
    .aui-thinking-body {
      padding: 8px 12px;
      border-top: 1px solid color-mix(in srgb, var(--color-review) 12%, transparent);
      font-size: 12px; line-height: 1.6;
      color: color-mix(in srgb, var(--mission-control-text) 75%, transparent);
      font-style: italic;
      max-height: 300px; overflow-y: auto;
      white-space: pre-wrap;
    }
    /* Char count */
    .aui-char-count { font-size: 10px; tabular-nums; color: var(--mission-control-text-dim); opacity: 0.5; }
    .aui-char-count-warn { color: var(--color-warning); opacity: 1; }
    .aui-char-count-over { color: var(--color-error); opacity: 1; }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────
// MarkdownText — assistant content renderer
// ─────────────────────────────────────────────────────────────────

export function MarkdownText({ text }: { text: string }) {
  const onArtifactOpen = useArtifactOpenCtx();
  return <MarkdownMessage content={text} onArtifactOpen={onArtifactOpen} />;
}

// ─────────────────────────────────────────────────────────────────
// Streaming indicators
// ─────────────────────────────────────────────────────────────────

function ThinkingDots() {
  ensureCSS();
  return (
    <span className="inline-flex items-center gap-[5px] py-1" aria-label="Agent is thinking">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="aui-thinking-dot-span" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function StreamingCursor() {
  ensureCSS();
  return <span aria-hidden className="aui-streaming-cursor" />;
}

function AssistantStreamState() {
  const isRunning = useMessage((s) => s.status?.type === "running");
  const hasText = useMessage((s) =>
    s.content.some((p: any) => p.type === "text" && p.text?.trim?.())
  );
  if (!isRunning) return null;
  return hasText ? <StreamingCursor /> : <ThinkingDots />;
}

// ─────────────────────────────────────────────────────────────────
// Tool display name — converts raw tool names to human-readable labels
// ─────────────────────────────────────────────────────────────────

function getToolDisplayName(name: string, inputStr?: string): string {
  let input: Record<string, any> = {};
  if (inputStr) {
    try { input = JSON.parse(inputStr); } catch (err) { console.warn('[ThreadStyles] Non-critical: not JSON:', err); }
  }

  // ── MCP tools: "mcp_server_tool-name" ─────────────────────────
  if (name.startsWith('mcp_')) {
    // Priority: description/query/title in the input (agent-provided human label)
    const label = input.description || input.query || input.title || input.name;
    if (label && typeof label === 'string' && label.trim().length > 0 && label.length < 100) {
      return label.trim();
    }

    // Server-specific fallbacks
    if (name.includes('mixpanel'))  return input.event_name ? `Mixpanel: ${input.event_name}` : 'Querying Mixpanel';
    if (name.includes('supabase')) {
      if (name.includes('execute_sql'))   return 'Running database query';
      if (name.includes('list_tables'))   return 'Listing tables';
      if (name.includes('apply_migration')) return 'Applying migration';
      if (name.includes('get_logs'))      return 'Fetching logs';
      return 'Supabase';
    }
    if (name.includes('birdeye'))   return 'Fetching market data';
    if (name.includes('n8n'))       return 'Automation workflow';
    if (name.includes('google'))    return 'Google Workspace';
    if (name.includes('solana'))    return 'Solana query';
    // Generic: strip "mcp_server_" prefix and clean up
    return name.replace(/^mcp_[^_]+_/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Standard Claude Code / built-in tools ─────────────────────
  const file = (input.path || input.file_path || '') as string;
  const filename = file ? file.split('/').pop() : '';

  switch (name) {
    case 'str_replace_editor':
    case 'Edit':         return filename ? `Editing ${filename}` : 'Editing file';
    case 'Write':
    case 'create_file':  return filename ? `Writing ${filename}` : 'Writing file';
    case 'Read':
    case 'read_file':    return filename ? `Reading ${filename}` : 'Reading file';
    case 'Glob':         return input.pattern ? `Finding: ${input.pattern}` : 'Finding files';
    case 'Grep':         return input.pattern ? `Searching code for: ${String(input.pattern).slice(0, 40)}` : 'Searching code';
    case 'Bash':
    case 'bash': {
      const cmd = (input.command || input.cmd || '') as string;
      const desc = input.description as string | undefined;
      if (desc) return desc;
      if (cmd) return cmd.trim().replace(/\s+/g, ' ').slice(0, 60);
      return 'Running command';
    }
    case 'WebSearch':
    case 'web_search':   return input.query ? `Searching: ${String(input.query).slice(0, 50)}` : 'Web search';
    case 'WebFetch':     return input.url ? `Fetching ${new URL(input.url as string).hostname}` : 'Fetching URL';
    case 'Agent':        return input.description ? String(input.description).slice(0, 60) : 'Spawning agent';
    case 'TodoWrite':    return 'Updating tasks';
    case 'TaskCreate':
    case 'TaskUpdate':   return 'Task management';
    default:
      // Last resort: clean up the raw name
      return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

// ─────────────────────────────────────────────────────────────────
// Tool call block — collapsible
// ─────────────────────────────────────────────────────────────────

// ── Tool group helpers ──────────────────────────────────────────

export type ToolItem = { name: string; input?: string; result?: string; isError?: boolean; id?: string };

export type GroupedItem =
  | { kind: 'thinking'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'tools'; tools: ToolItem[]; hasRunning: boolean };

export function groupParsedItems(items: ParsedItem[], isRunning: boolean): GroupedItem[] {
  const groups: GroupedItem[] = [];
  let toolBuf: ToolItem[] = [];

  const flushTools = () => {
    if (toolBuf.length === 0) return;
    const hasRunning = isRunning && toolBuf.some(t => t.result === undefined);
    groups.push({ kind: 'tools', tools: toolBuf, hasRunning });
    toolBuf = [];
  };

  for (const item of items) {
    if (item.kind === 'tool') {
      toolBuf.push(item);
    } else {
      flushTools();
      if (item.kind === 'thinking') groups.push({ kind: 'thinking', text: item.text });
      else groups.push({ kind: 'text', text: item.text });
    }
  }
  flushTools();
  return groups;
}

function generateGroupSummary(tools: ToolItem[]): string {
  let edits = 0, reads = 0, writes = 0, searches = 0, cmds = 0;
  const mcpServers: string[] = [];

  for (const t of tools) {
    const n = t.name.toLowerCase();
    if (['str_replace_editor', 'edit'].includes(n)) edits++;
    else if (['read', 'read_file'].includes(n)) reads++;
    else if (['write', 'create_file'].includes(n)) writes++;
    else if (['grep', 'glob', 'websearch', 'web_search', 'webfetch'].includes(n)) searches++;
    else if (n === 'bash') cmds++;
    else if (n === 'todowrite') { /* ignore todo updates in summary */ }
    else if (n.startsWith('mcp_')) {
      const server = n.split('_')[1];
      if (!mcpServers.includes(server)) mcpServers.push(server);
    }
  }

  const parts: string[] = [];
  if (edits)   parts.push(edits   === 1 ? 'Edited a file'   : `Edited ${edits} files`);
  if (writes)  parts.push(writes  === 1 ? 'Created a file'  : `Created ${writes} files`);
  if (reads)   parts.push(reads   === 1 ? 'Read a file'     : `Read ${reads} files`);
  if (searches) parts.push('Searched code');
  if (cmds)    parts.push(cmds    === 1 ? 'Ran a command'   : `Ran ${cmds} commands`);
  mcpServers.forEach(s => parts.push(`Called ${s}`));

  if (!parts.length) return `Used ${tools.length} tool${tools.length > 1 ? 's' : ''}`;
  return parts.join(', ');
}

function getToolIcon(name: string): typeof FileText {
  const n = name.toLowerCase();
  if (['read', 'read_file'].includes(n)) return FileText;
  if (['write', 'create_file'].includes(n)) return FileCode2;
  if (['str_replace_editor', 'edit'].includes(n)) return Edit3;
  if (n === 'grep') return Search;
  if (n === 'glob') return FolderOpen;
  if (n === 'bash') return Terminal;
  if (n === 'websearch' || n === 'web_search') return Globe;
  if (n === 'webfetch') return Globe;
  if (n === 'agent') return Bot;
  if (n === 'todowrite') return ListChecks;
  if (n.startsWith('mcp_supabase')) return Database;
  if (n.startsWith('mcp_')) return Zap;
  return Wrench;
}

function getFileChip(name: string, inputStr?: string): string | null {
  if (!inputStr) return null;
  let input: Record<string, unknown> = {};
  try { input = JSON.parse(inputStr); } catch { return null; }
  const p = (input.path || input.file_path || input.filePath) as string | undefined;
  if (p && typeof p === 'string') return p.split('/').pop() || null;
  return null;
}

// ── Inline Approval Card ───────────────────────────────────────
// Detects approval_create tool results and renders approve/reject buttons inline

function isApprovalTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'approval_create' || n.endsWith('approval_create');
}

function parseApprovalResult(result?: string): { id: string } | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (parsed?.success && parsed?.id) return { id: parsed.id };
  } catch { /* not JSON */ }
  return null;
}

function parseApprovalInput(input?: string): { type: string; title: string; content: string; context?: string } | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed?.type && parsed?.title && parsed?.content) return parsed;
  } catch { /* not JSON */ }
  return null;
}

function InlineApprovalCard({ tool }: { tool: ToolItem }) {
  const approval = parseApprovalResult(tool.result);
  const details = parseApprovalInput(tool.input);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(false);

  if (!approval || !details) return null;

  const config = getApprovalTypeConfig(details.type);

  const handleAction = async (action: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await approvalApi.respond(approval.id, action);
      setStatus(action);
    } catch (err) {
      console.warn('[InlineApprovalCard] Failed to respond:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="my-2 rounded-xl border border-[var(--mission-control-border)] bg-[var(--mission-control-surface)] overflow-hidden"
      style={{ animation: 'aui-fade-in 0.2s ease-out both' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--mission-control-border)]">
        <ListChecks size={14} className="text-[var(--mission-control-accent)] flex-shrink-0" />
        <span className="text-[12px] font-semibold text-[var(--mission-control-text)] flex-1 truncate">
          {details.title}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.className}`}>
          {config.label}
        </span>
      </div>

      {/* Content preview */}
      <div className="px-3 py-2">
        <p className="text-[12px] text-[var(--mission-control-text-dim)] line-clamp-3 whitespace-pre-wrap">
          {details.content.slice(0, 300)}{details.content.length > 300 ? '...' : ''}
        </p>
        {details.context && (
          <p className="text-[11px] text-[var(--mission-control-text-dim)] mt-1 opacity-70 italic truncate">
            {details.context}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--mission-control-border)]">
        {status === 'pending' ? (
          <>
            <button
              type="button"
              onClick={() => handleAction('approved')}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={13} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleAction('rejected')}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/20 hover:bg-[var(--color-error)]/20 transition-colors disabled:opacity-50"
            >
              <XCircle size={13} />
              Reject
            </button>
            {loading && <Loader2 size={13} className="animate-spin text-[var(--mission-control-text-dim)]" />}
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            {status === 'approved' ? (
              <CheckCircle2 size={14} className="text-[var(--color-success)]" />
            ) : (
              <XCircle size={14} className="text-[var(--color-error)]" />
            )}
            <span className={`text-[12px] font-medium ${status === 'approved' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {status === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ToolGroupBlock ──────────────────────────────────────────────

export function ToolGroupBlock({ tools, hasRunning }: { tools: ToolItem[]; hasRunning: boolean }) {
  ensureCSS();
  // Start expanded while running so progress is visible; collapsed once done
  const [expanded, setExpanded] = useState(hasRunning);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  useEffect(() => { if (hasRunning) setExpanded(true); }, [hasRunning]);

  const allDone = !hasRunning && tools.every(t => t.result !== undefined || t.isError);
  const hasError = tools.some(t => t.isError);
  const summary = generateGroupSummary(tools);

  const toggleRow = (i: number) =>
    setOpenRows(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const summaryIcon = hasRunning ? (
    <Loader2 size={13} className="animate-spin text-mission-control-accent flex-shrink-0" />
  ) : hasError ? (
    <XCircle size={13} className="text-error flex-shrink-0" />
  ) : allDone ? (
    <CheckCircle2 size={13} className="text-success flex-shrink-0" />
  ) : (
    <Wrench size={13} className="text-mission-control-text-dim flex-shrink-0" />
  );

  return (
    <div className="aui-tool-group">
      <button
        type="button"
        className="aui-tool-group-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        {summaryIcon}
        <span className="text-[11px] font-medium text-mission-control-text-dim flex-1 truncate">{summary}</span>
        <ChevronDown
          size={12}
          className="text-mission-control-text-dim flex-shrink-0 transition-[transform] duration-150"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {expanded && (
        <div className="aui-tool-group-body">
          {tools.map((tool, i) => {
            // Render inline approval card for approval_create tools with successful result
            if (isApprovalTool(tool.name) && parseApprovalResult(tool.result)) {
              return <InlineApprovalCard key={i} tool={tool} />;
            }

            const Icon = getToolIcon(tool.name);
            const label = getToolDisplayName(tool.name, tool.input);
            const chip = getFileChip(tool.name, tool.input);
            const isToolRunning = hasRunning && tool.result === undefined && !tool.isError;
            const rowOpen = openRows.has(i);
            const hasDetail = !!(tool.input || tool.result);

            return (
              <div key={i}>
                <div
                  className={`aui-tool-row ${i === 0 ? 'first' : ''} ${!allDone && i === tools.length - 1 ? 'aui-tool-done-row' : ''}`}
                  onClick={() => hasDetail && toggleRow(i)}
                  role={hasDetail ? 'button' : undefined}
                >
                  <div className="aui-tool-row-line" />
                  <div className="aui-tool-row-content">
                    {isToolRunning ? (
                      <Loader2 size={12} className="animate-spin text-mission-control-accent flex-shrink-0" />
                    ) : tool.isError ? (
                      <XCircle size={12} className="text-error flex-shrink-0" />
                    ) : tool.result !== undefined ? (
                      <Icon size={12} className="text-mission-control-text-dim flex-shrink-0" />
                    ) : (
                      <Icon size={12} className="text-mission-control-text-dim flex-shrink-0 opacity-50" />
                    )}
                    <span className="text-[11px] text-mission-control-text truncate flex-1">{label}</span>
                    {tool.result !== undefined && !isToolRunning && (
                      <span className="aui-result-badge">{tool.isError ? 'Error' : 'Result'}</span>
                    )}
                    {chip && <span className="aui-file-chip">{chip}</span>}
                    {hasDetail && (
                      <CollapseChevron
                        size={10}
                        className="text-mission-control-text-dim flex-shrink-0 transition-[transform] duration-100"
                        style={{ transform: rowOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      />
                    )}
                  </div>
                </div>
                {rowOpen && hasDetail && (
                  <div className="aui-tool-row-detail">
                    {tool.input && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Input</p>
                        <pre className="aui-tool-code">{tool.input}</pre>
                      </>
                    )}
                    {tool.result && (
                      <>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mt-2.5 mb-1 ${tool.isError ? 'text-error' : 'text-mission-control-text-dim'}`}>
                          {tool.isError ? 'Error' : 'Result'}
                        </p>
                        <pre className={`aui-tool-code ${tool.isError ? 'text-error' : ''}`}>{tool.result}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {allDone && (
            <div className="aui-tool-row aui-tool-done-row">
              <div className="aui-tool-row-line" />
              <div className="aui-tool-row-content">
                <CheckCircle2 size={12} className="text-success flex-shrink-0" />
                <span className="text-[11px] text-mission-control-text-dim">Done</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Thinking block — collapsible
// ─────────────────────────────────────────────────────────────────

export function ThinkingBlock({ text }: { text: string }) {
  ensureCSS();
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;

  // Split into individual thought chunks (separated by double newlines)
  const chunks = text.split(/\n\n+/).filter(c => c.trim());

  return (
    <div className="aui-thinking-block">
      <div
        className="aui-thinking-header"
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
      >
        <Brain size={12} className="flex-shrink-0 text-review" />
        <span className="text-[11px] font-medium text-review">Thinking</span>
        <span className="text-[10px] ml-1 text-review/55">
          {chunks.length > 1 ? `${chunks.length} thoughts` : `${text.length} chars`}
        </span>
        <CollapseChevron
          size={11}
          style={{ color: 'color-mix(in srgb, var(--color-review) 55%, transparent)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          className="ml-auto flex-shrink-0 transition-[transform] duration-150"
        />
      </div>
      {open && (
        <div className="aui-thinking-body">
          {chunks.length > 1 ? (
            <div className="flex flex-col gap-3">
              {chunks.map((chunk, i) => (
                <div key={i} className="flex gap-2">
                  <span
                    className="text-[10px] font-mono flex-shrink-0 mt-0.5 w-4 text-right"
                    style={{ color: 'color-mix(in srgb, var(--color-review) 45%, transparent)' }}
                  >
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <MarkdownMessage content={chunk.trim()} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MarkdownMessage content={text} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Action bars
// ─────────────────────────────────────────────────────────────────

function AssistantActionBar() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="aui-action-bar flex items-center gap-0.5 mt-1.5 min-h-[28px]">
      <ActionBarPrimitive.Copy
        copiedDuration={1500}
        onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className={`aui-action-btn ${copied ? "aui-action-btn-copied" : ""}`}
        title="Copy"
        aria-label="Copy message"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </ActionBarPrimitive.Copy>

      <ActionBarPrimitive.FeedbackPositive
        className="aui-action-btn"
        title="Good response"
        aria-label="Good response"
      >
        <ThumbsUp size={12} />
      </ActionBarPrimitive.FeedbackPositive>

      <ActionBarPrimitive.FeedbackNegative
        className="aui-action-btn"
        title="Bad response"
        aria-label="Bad response"
      >
        <ThumbsDown size={12} />
      </ActionBarPrimitive.FeedbackNegative>

      <ActionBarPrimitive.Reload
        className="aui-action-btn"
        title="Regenerate"
        aria-label="Regenerate response"
      >
        <RefreshCw size={12} />
      </ActionBarPrimitive.Reload>

      <BranchPickerPrimitive.Root hideWhenSingleBranch style={{ display: "contents" }}>
        <div className="flex items-center gap-0.5 border-l border-[var(--mission-control-border)] pl-1.5 ml-0.5">
          <BranchPickerPrimitive.Previous className="aui-branch-picker-prev" aria-label="Previous branch">
            <ChevronLeft size={11} />
          </BranchPickerPrimitive.Previous>
          <span className="text-[10px] text-[var(--mission-control-text-dim)] min-w-[22px] text-center">
            <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
          </span>
          <BranchPickerPrimitive.Next className="aui-branch-picker-next" aria-label="Next branch">
            <ChevronRight size={11} />
          </BranchPickerPrimitive.Next>
        </div>
      </BranchPickerPrimitive.Root>
    </div>
  );
}

function UserActionBar() {
  // ExternalStoreRuntime does not support message editing — only show copy.
  return (
    <div className="aui-action-bar flex items-center justify-end mt-1 min-h-[26px]">
      <ActionBarPrimitive.Copy
        className="aui-action-btn"
        title="Copy message"
        aria-label="Copy message"
      >
        <Copy size={12} />
      </ActionBarPrimitive.Copy>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Message bubbles
// ─────────────────────────────────────────────────────────────────

export type ParsedItem =
  | { kind: 'thinking'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; input?: string; result?: string; isError?: boolean; id?: string };

/**
 * Parses raw text content that may contain serialized ContentBlock[] JSON.
 * Returns ordered items preserving the original block sequence so that tool
 * calls appear inline between text segments (not lumped after all text).
 */
export function parseMessageContent(text: string): { items: ParsedItem[]; isParsed: boolean } {
  try {
    if (text.startsWith("[")) {
      const blocks = JSON.parse(text);
      if (Array.isArray(blocks) && blocks[0]?.type) {
        const items: ParsedItem[] = [];
        const toolResults: Record<string, { content: string; isError: boolean }> = {};

        // First pass: collect tool results keyed by tool_use_id
        for (const b of blocks) {
          if (b.type === "tool_result") {
            const id = b.tool_use_id ?? "";
            let content = "";
            if (typeof b.content === "string") content = b.content;
            else if (Array.isArray(b.content)) {
              content = b.content.filter((r: any) => r.type === "text").map((r: any) => r.text ?? "").join("\n");
            }
            toolResults[id] = { content: content.slice(0, 2000), isError: !!b.is_error };
          }
        }

        // Second pass: build items in original block order
        for (const b of blocks) {
          if (b.type === "text" && b.text?.trim()) {
            items.push({ kind: 'text', text: b.text });
          } else if (b.type === "thinking" && b.thinking?.trim()) {
            items.push({ kind: 'thinking', text: b.thinking });
          } else if (b.type === "tool_use") {
            const tr = toolResults[b.id ?? ""];
            items.push({
              kind: 'tool',
              name: b.name ?? "unknown",
              input: b.input ? JSON.stringify(b.input, null, 2) : undefined,
              result: tr?.content,
              isError: tr?.isError,
              id: b.id,
            });
          }
        }

        return { items, isParsed: true };
      }
    }
  } catch (err) { console.warn('[ThreadStyles] Non-critical: fall through:', err); }

  return { items: [{ kind: 'text', text }], isParsed: false };
}

// ─────────────────────────────────────────────────────────────────
// Artifact cards — shown at bottom of assistant messages
// ─────────────────────────────────────────────────────────────────

const ARTIFACT_TYPE_ICONS: Record<ArtifactType, typeof FileText> = {
  file: FileCode2,
  text: FileText,
  diagram: Network,
  image: ImageIcon,
  data: Database,
  code: FileCode2,
};

function isLibraryFilePath(content: string): boolean {
  return (
    (content.startsWith('/') || content.startsWith('~')) &&
    /\/mission-control\/library\//.test(content)
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const { selectArtifact, setCollapsed } = useArtifactStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPath = artifact.type === 'file' && isLibraryFilePath(artifact.content);
  const lang = artifact.metadata?.language?.toUpperCase();
  const typeLabel = [
    artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1),
    lang,
  ].filter(Boolean).join(' · ');
  const Icon = ARTIFACT_TYPE_ICONS[artifact.type] ?? FileText;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const openInPanel = () => {
    setCollapsed(false);
    selectArtifact(artifact.id);
    setMenuOpen(false);
  };

  const copyPath = () => {
    navigator.clipboard.writeText(artifact.content);
    setMenuOpen(false);
  };

  const revealInFinder = async () => {
    setMenuOpen(false);
    await fetch('/api/library/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: artifact.content }),
    }).catch(() => { /* non-critical */ });
  };

  return (
    <div
      className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--mission-control-border)] bg-[var(--mission-control-surface)] hover:border-[var(--mission-control-accent)]/30 transition-colors cursor-pointer select-none"
      onClick={openInPanel}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openInPanel(); }}
    >
      {/* File type icon */}
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-[var(--mission-control-border)] bg-[var(--mission-control-bg)]">
        <Icon size={16} className="text-[var(--mission-control-accent)]" />
      </div>

      {/* Title + type */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold leading-snug truncate text-[var(--mission-control-text)]">
          {artifact.title}
        </div>
        <div className="text-[11px] text-[var(--mission-control-text-dim)]">{typeLabel}</div>
      </div>

      {/* Action button + dropdown */}
      <div
        className="flex items-center gap-1 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={openInPanel}
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--mission-control-accent)]/10 text-[var(--mission-control-accent)] border border-[var(--mission-control-accent)]/20 hover:bg-[var(--mission-control-accent)]/20 transition-colors"
        >
          Open
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[var(--mission-control-border)] text-[var(--mission-control-text-dim)] hover:text-[var(--mission-control-text)] hover:bg-[var(--mission-control-border)]/40 transition-colors"
            aria-label="More options"
          >
            <ChevronDown size={13} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--mission-control-surface)] border border-[var(--mission-control-border)] rounded-xl shadow-xl z-50 py-1.5 min-w-[168px]">
              <button
                type="button"
                onClick={openInPanel}
                className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2.5 text-[var(--mission-control-text)] hover:bg-[var(--mission-control-bg)] transition-colors"
              >
                <Expand size={13} className="text-[var(--mission-control-text-dim)]" />
                Open in Artifacts
              </button>
              <button
                type="button"
                onClick={copyPath}
                className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2.5 text-[var(--mission-control-text)] hover:bg-[var(--mission-control-bg)] transition-colors"
              >
                <Copy size={13} className="text-[var(--mission-control-text-dim)]" />
                Copy Path
              </button>
              {isPath && (
                <button
                  type="button"
                  onClick={revealInFinder}
                  className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2.5 text-[var(--mission-control-text)] hover:bg-[var(--mission-control-bg)] transition-colors"
                >
                  <FolderOpen size={13} className="text-[var(--mission-control-text-dim)]" />
                  Show in Finder
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageArtifactCards() {
  const messageId = useMessage((s: any) => s.id as string);
  const allArtifacts = useArtifactStore(s => s.artifacts);
  const messageArtifacts = useMemo(
    () => allArtifacts.filter(a => a.messageId === messageId),
    [allArtifacts, messageId]
  );

  if (messageArtifacts.length === 0) return null;

  return (
    <div>
      {messageArtifacts.map(artifact => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

export function AssistantMessageBubble() {
  ensureCSS();
  const isRunning = useMessage((s) => s.status?.type === "running");
  return (
    <MessagePrimitive.Root className="aui-message-root aui-message-enter flex flex-col max-w-full">
      <div className="max-w-[67%]">
        <div className="text-[var(--font-size-2)] leading-[1.7] text-[var(--mission-control-text)] break-words py-0.5">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }: { text: string }) => {
                const { items } = parseMessageContent(text);
                const groups = groupParsedItems(items, isRunning);
                return (
                  <>
                    {groups.map((group, i) => {
                      if (group.kind === 'thinking') {
                        return <ThinkingBlock key={`think-${i}`} text={group.text} />;
                      }
                      if (group.kind === 'tools') {
                        return (
                          <ToolGroupBlock
                            key={`tools-${i}`}
                            tools={group.tools}
                            hasRunning={group.hasRunning}
                          />
                        );
                      }
                      return <MarkdownText key={`text-${i}`} text={group.text} />;
                    })}
                  </>
                );
              },
            }}
          />
          <AssistantStreamState />
        </div>
        <MessageArtifactCards />
        <ActionBarPrimitive.Root hideWhenRunning autohide="never" style={{ display: "contents" }}>
          <AssistantActionBar />
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

export function UserMessageBubble() {
  ensureCSS();
  return (
    <MessagePrimitive.Root className="aui-message-root aui-message-enter flex flex-col items-end">
      <div className="max-w-[78%] flex flex-col items-end">
        <div className="aui-user-bubble rounded-[18px_18px_4px_18px] px-4 py-2.5 text-[var(--font-size-2)] leading-[1.65] text-[var(--mission-control-text)] break-words">
          <MessagePrimitive.Content />
        </div>
        <ActionBarPrimitive.Root autohide="not-last" style={{ display: "contents" }}>
          <UserActionBar />
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
// Scroll-to-bottom button
// ─────────────────────────────────────────────────────────────────

function ScrollToBottomButton() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <button type="button" className="aui-scroll-to-bottom" aria-label="Scroll to latest">
        <ChevronDown size={13} />
        <span>Latest</span>
      </button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

// ─────────────────────────────────────────────────────────────────
// Composer — integrated textarea + action buttons
// ─────────────────────────────────────────────────────────────────

interface ComposerProps {
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onAttach?: () => void;
  isListening?: boolean;
  onToggleVoice?: () => void;
  onStop?: () => void;
}

export function MissionControlComposer({
  placeholder,
  disabled,
  loading,
  onAttach,
  isListening,
  onToggleVoice,
  onStop,
}: ComposerProps) {
  ensureCSS();
  const isRunning = loading;
  const composerRuntime = useComposerRuntime();

  return (
    <ComposerPrimitive.Root className={`aui-composer-root ${isListening ? 'aui-listening' : ''}`}>
      {/* Recording indicator bar — visible when mic is active */}
      {isListening && (
        <div className="aui-listening-bar">
          <span className="aui-listening-dot" />
          Recording — speak now, click mic to stop
        </div>
      )}
      {/* Textarea — always enabled so users can type queued messages while agent streams */}
      <ComposerPrimitive.Input
        className="aui-composer-input min-h-[22px] max-h-[160px] overflow-auto"
        placeholder={isListening ? "Listening… speak or click mic to stop" : isRunning ? "Type to queue next message…" : (placeholder ?? "Message… (Enter to send, Shift+Enter for newline)")}
        submitMode="enter"
        disabled={disabled && !isRunning}
        rows={1}
        autoFocus
        onKeyDown={(e) => {
          // ComposerPrimitive.Input blocks Enter submit during isRunning.
          // Intercept Enter to manually trigger queue send.
          if (isRunning && e.key === 'Enter' && !e.shiftKey && composerRuntime.getState().text.trim()) {
            e.preventDefault();
            composerRuntime.send();
          }
        }}
      />

      {/* Footer row with icons + send */}
      <div className="aui-composer-footer">
        {/* Left: attachment + voice */}
        <div className="flex items-center gap-0.5">
          {onAttach && (
            <button
              type="button"
              onClick={onAttach}
              title="Attach file"
              aria-label="Attach file"
              className="aui-composer-icon-btn"
            >
              <Paperclip size={15} />
            </button>
          )}
          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              title={isListening ? "Stop voice input" : "Start voice input"}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              aria-pressed={isListening}
              className={`aui-composer-icon-btn ${isListening ? "aui-composer-icon-btn-active" : ""}`}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
        </div>

        {/* Right: stop + send/queue */}
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generation"
              title="Stop (Escape)"
              className="aui-stop-btn"
            >
              <Square size={14} fill="currentColor" />
            </button>
          )}
          {isRunning ? (
            /* Manual queue button — ComposerPrimitive.Send disables itself during isRunning,
               so we bypass it and call composerRuntime.send() directly to trigger the queue path. */
            <button
              type="button"
              onClick={() => { if (composerRuntime.getState().text.trim()) composerRuntime.send(); }}
              disabled={disabled}
              aria-label="Queue message"
              title="Queue (Enter)"
              className="aui-send-btn"
            >
              <Send size={15} />
            </button>
          ) : (
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                disabled={disabled}
                aria-label="Send message"
                title="Send (Enter)"
                className="aui-send-btn"
              >
                <Send size={15} />
              </button>
            </ComposerPrimitive.Send>
          )}
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
// Thread — root with auto-scroll viewport + scroll-to-bottom
// ─────────────────────────────────────────────────────────────────

export function MissionControlThread() {
  ensureCSS();
  const handleArtifactOpen = useArtifactOpen();
  return (
    <ArtifactOpenContext.Provider value={handleArtifactOpen}>
    <ThreadPrimitive.Root className="flex flex-col h-full">
      {/* Wrap viewport in relative container so scroll-to-bottom button positions correctly */}
      <div className="relative flex-1 min-h-0">
        <ThreadPrimitive.Viewport className="h-full overflow-y-auto px-6 pt-6 pb-4 scroll-smooth">
          <ThreadPrimitive.Empty>
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-4">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
                style={{
                  background: "color-mix(in srgb, var(--mission-control-accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)",
                }}
              >
                <MessageSquare size={22} className="text-[var(--mission-control-accent)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-mission-control-text-dim">Start a conversation</p>
                <p className="text-xs text-mission-control-text-dim mt-1 opacity-70">Send a message to your agent</p>
              </div>
            </div>
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessageBubble,
              AssistantMessage: AssistantMessageBubble,
            }}
          />
        </ThreadPrimitive.Viewport>

        {/* Scroll-to-bottom — absolute inside relative viewport wrapper */}
        <ScrollToBottomButton />
      </div>
    </ThreadPrimitive.Root>
    </ArtifactOpenContext.Provider>
  );
}
