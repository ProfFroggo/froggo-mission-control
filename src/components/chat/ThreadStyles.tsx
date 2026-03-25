"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  useMessage,
  useComposer,
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
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import MarkdownMessage from "../MarkdownMessage";

// ─────────────────────────────────────────────────────────────────
// CSS keyframes — injected once on load
// ─────────────────────────────────────────────────────────────────

let _cssInjected = false;
function ensureCSS() {
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
      background: color-mix(in srgb, var(--mission-control-accent) 12%, transparent);
      color: var(--mission-control-accent);
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
    /* Tool call block */
    .aui-tool-block {
      font-size: 12px; border-radius: 8px; overflow: hidden;
      border: 1px solid var(--mission-control-border);
      margin: 6px 0;
      animation: aui-fade-in 0.15s ease both;
    }
    .aui-tool-header {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; cursor: pointer;
      background: color-mix(in srgb, var(--mission-control-border) 20%, transparent);
      user-select: none;
      transition: background 0.12s;
    }
    .aui-tool-header:hover {
      background: color-mix(in srgb, var(--mission-control-border) 35%, transparent);
    }
    .aui-tool-body {
      padding: 10px 12px;
      background: color-mix(in srgb, var(--mission-control-bg) 60%, transparent);
      border-top: 1px solid var(--mission-control-border);
      overflow: hidden;
    }
    .aui-tool-code {
      font-family: ui-monospace, 'SF Mono', Consolas, monospace;
      font-size: 11px; line-height: 1.6;
      color: var(--mission-control-text);
      white-space: pre-wrap; word-break: break-all;
      max-height: 240px; overflow-y: auto;
    }
    /* Thinking block */
    .aui-thinking-block {
      font-size: 12px; border-radius: 8px; overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-info) 25%, transparent);
      background: color-mix(in srgb, var(--color-info) 4%, transparent);
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
      border-top: 1px solid color-mix(in srgb, var(--color-info) 20%, transparent);
      font-size: 12px; line-height: 1.6;
      color: color-mix(in srgb, var(--mission-control-text) 70%, transparent);
      font-style: italic;
      max-height: 200px; overflow-y: auto;
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

function MarkdownText({ text }: { text: string }) {
  return <MarkdownMessage content={text} />;
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
// Tool call block — collapsible
// ─────────────────────────────────────────────────────────────────

interface ToolBlockProps {
  name: string;
  input?: string;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
}

function ToolBlock({ name, input, result, isError, isRunning }: ToolBlockProps) {
  ensureCSS();
  const [open, setOpen] = useState(false);
  const hasDetails = !!(input || result);

  const statusIcon = isRunning ? (
    <Loader2 size={12} className="animate-spin text-[var(--color-info)]" />
  ) : isError ? (
    <XCircle size={12} className="text-[var(--color-error)] flex-shrink-0" />
  ) : result !== undefined ? (
    <CheckCircle2 size={12} className="text-[var(--color-success)] flex-shrink-0" />
  ) : (
    <Wrench size={12} className="text-mission-control-text-dim flex-shrink-0" />
  );

  return (
    <div
      className="aui-tool-block"
      style={isError ? { borderColor: 'color-mix(in srgb, var(--color-error) 30%, transparent)' } : undefined}
    >
      <div
        className="aui-tool-header"
        onClick={() => hasDetails && setOpen(o => !o)}
        role={hasDetails ? "button" : undefined}
        aria-expanded={hasDetails ? open : undefined}
      >
        {statusIcon}
        <Terminal size={11} className="text-mission-control-text-dim flex-shrink-0" />
        <span className="font-mono text-[11px] font-medium text-mission-control-text flex-1 truncate">{name}</span>
        {isRunning && (
          <span className="text-[10px] text-[var(--color-info)] font-medium ml-auto flex-shrink-0">Running…</span>
        )}
        {hasDetails && !isRunning && (
          <CollapseChevron
            size={11}
            className="text-mission-control-text-dim flex-shrink-0 ml-auto transition-[transform] duration-150"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        )}
      </div>
      {open && hasDetails && (
        <div className="aui-tool-body">
          {input && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1.5">Input</p>
              <pre className="aui-tool-code">{input}</pre>
            </>
          )}
          {result && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-3 mb-1.5">
                {isError ? 'Error' : 'Result'}
              </p>
              <pre className={`aui-tool-code ${isError ? 'text-[var(--color-error)]' : ''}`}>{result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Thinking block — collapsible
// ─────────────────────────────────────────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
  ensureCSS();
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;

  return (
    <div className="aui-thinking-block">
      <div
        className="aui-thinking-header"
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
      >
        <Brain size={12} className="text-[var(--color-info)] flex-shrink-0" />
        <span className="text-[11px] font-medium text-[var(--color-info)]">Thinking</span>
        <span className="text-[10px] text-[var(--color-info)]/60 ml-1">
          {text.length > 0 ? `${text.length} chars` : ''}
        </span>
        <CollapseChevron
          size={11}
          className="text-[var(--color-info)]/60 ml-auto flex-shrink-0 transition-[transform] duration-150"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </div>
      {open && (
        <div className="aui-thinking-body">{text}</div>
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
  return (
    <div className="aui-action-bar flex items-center justify-end mt-1 min-h-[26px]">
      <ActionBarPrimitive.Edit
        className="aui-action-btn"
        title="Edit message"
        aria-label="Edit message"
      >
        <Edit3 size={12} />
      </ActionBarPrimitive.Edit>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Message bubbles
// ─────────────────────────────────────────────────────────────────

/**
 * Parses raw text content that may contain serialized ContentBlock[] JSON.
 * Returns { textParts, toolCalls, thinkingBlocks } for structured rendering.
 */
function parseMessageContent(text: string) {
  try {
    if (text.startsWith("[")) {
      const blocks = JSON.parse(text);
      if (Array.isArray(blocks) && blocks[0]?.type) {
        const textParts: string[] = [];
        const toolCalls: { name: string; input?: string; result?: string; isError?: boolean; id?: string }[] = [];
        const thinkingBlocks: string[] = [];
        const toolResults: Record<string, { content: string; isError: boolean }> = {};

        // First pass: collect tool results
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

        // Second pass: build structured output
        for (const b of blocks) {
          if (b.type === "text" && b.text?.trim()) {
            textParts.push(b.text);
          } else if (b.type === "thinking" && b.thinking?.trim()) {
            thinkingBlocks.push(b.thinking);
          } else if (b.type === "tool_use") {
            const tr = toolResults[b.id ?? ""];
            toolCalls.push({
              name: b.name ?? "unknown",
              input: b.input ? JSON.stringify(b.input, null, 2) : undefined,
              result: tr?.content,
              isError: tr?.isError,
              id: b.id,
            });
          }
        }

        return { textParts, toolCalls, thinkingBlocks, isParsed: true };
      }
    }
  } catch { /* fall through */ }

  return { textParts: [text], toolCalls: [], thinkingBlocks: [], isParsed: false };
}

export function AssistantMessageBubble() {
  ensureCSS();
  return (
    <MessagePrimitive.Root className="aui-message-root aui-message-enter flex flex-col max-w-full">
      <div className="text-[var(--font-size-2)] leading-[1.7] text-[var(--mission-control-text)] break-words py-0.5">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }: { text: string }) => {
              const { textParts, toolCalls, thinkingBlocks } = parseMessageContent(text);
              return (
                <>
                  {thinkingBlocks.map((t, i) => (
                    <ThinkingBlock key={`think-${i}`} text={t} />
                  ))}
                  {toolCalls.map((tc, i) => (
                    <ToolBlock
                      key={`tool-${i}-${tc.id ?? tc.name}`}
                      name={tc.name}
                      input={tc.input}
                      result={tc.result}
                      isError={tc.isError}
                    />
                  ))}
                  {textParts.filter(Boolean).map((t, i) => (
                    <MarkdownText key={`text-${i}`} text={t} />
                  ))}
                </>
              );
            },
          }}
        />
        <AssistantStreamState />
      </div>
      <ActionBarPrimitive.Root hideWhenRunning autohide="never" style={{ display: "contents" }}>
        <AssistantActionBar />
      </ActionBarPrimitive.Root>
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
}

export function MissionControlComposer({
  placeholder,
  disabled,
  loading,
  onAttach,
  isListening,
  onToggleVoice,
}: ComposerProps) {
  ensureCSS();
  const isRunning = loading;

  return (
    <ComposerPrimitive.Root className="aui-composer-root">
      {/* Textarea */}
      <ComposerPrimitive.Input
        className="aui-composer-input min-h-[22px] max-h-[160px] overflow-auto"
        placeholder={placeholder ?? "Message… (Enter to send, Shift+Enter for newline)"}
        submitMode="enter"
        disabled={disabled}
        rows={1}
        autoFocus
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

        {/* Right: stop or send */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <ComposerPrimitive.Cancel asChild>
              <button
                type="button"
                aria-label="Stop generation"
                title="Stop (Escape)"
                className="aui-stop-btn"
              >
                <Square size={14} fill="currentColor" />
              </button>
            </ComposerPrimitive.Cancel>
          ) : (
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                disabled={disabled}
                aria-label="Send message"
                title="Send (Enter)"
                className="aui-send-btn"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
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
  return (
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
  );
}
