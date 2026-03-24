"use client";

import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive, ActionBarPrimitive, useMessage } from "@assistant-ui/react";
import { Send, Loader2, MessageSquare, Copy, Check } from "lucide-react";
import { useState } from "react";
import MarkdownMessage from "../MarkdownMessage";
import { Spinner } from "../LoadingStates";

// ──────────────────────────────────────────────────────────
// Text renderer — wraps MarkdownMessage for assistant content
// ──────────────────────────────────────────────────────────

function AssistantTextPart({ text }: { text: string }) {
  return <MarkdownMessage content={text} />;
}

// ──────────────────────────────────────────────────────────
// Streaming indicator — shown below assistant content while running
// ──────────────────────────────────────────────────────────

function StreamingIndicator() {
  const isRunning = useMessage((s) => s.status?.type === "running");
  if (!isRunning) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Spinner size={14} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Copy button — shown on hover for assistant messages
// ──────────────────────────────────────────────────────────

function AssistantCopyButton() {
  const [copied, setCopied] = useState(false);

  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <ActionBarPrimitive.Copy
        copiedDuration={1500}
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="p-1.5 rounded-md bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/40 transition-all"
        aria-label="Copy message"
        title="Copy message"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </ActionBarPrimitive.Copy>
    </ActionBarPrimitive.Root>
  );
}

// ──────────────────────────────────────────────────────────
// Timestamp — shown below user messages
// ──────────────────────────────────────────────────────────

function MessageTimestamp() {
  const createdAt = useMessage((s) => s.createdAt);
  if (!createdAt) return null;
  const now = Date.now();
  const diffMs = now - createdAt.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  let label: string;
  if (diffMs < 60_000) {
    label = "just now";
  } else if (diffMin < 60) {
    label = `${diffMin}m ago`;
  } else {
    label = createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return (
    <span className="mt-1 text-xs text-mission-control-text-dim opacity-60 select-none">
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Assistant message bubble
// ──────────────────────────────────────────────────────────

export function AssistantMessageBubble() {
  return (
    <MessagePrimitive.Root className="flex gap-3 mt-6 items-start group">
      {/* Agent avatar */}
      <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 flex-shrink-0 mt-0.5" aria-hidden />

      <div className="flex-1 min-w-0 flex flex-col items-start max-w-[80%]">
        <div className="relative rounded-xl rounded-tl-sm bg-mission-control-surface/80 border border-mission-control-border text-mission-control-text px-4 py-3 text-sm break-words shadow-sm w-full">
          <MessagePrimitive.Content
            components={{
              Text: AssistantTextPart,
            }}
          />
          <StreamingIndicator />
          <AssistantCopyButton />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

// ──────────────────────────────────────────────────────────
// User message bubble
// ──────────────────────────────────────────────────────────

export function UserMessageBubble() {
  return (
    <MessagePrimitive.Root className="flex gap-3 mt-6 items-start justify-end">
      <div className="flex-1 min-w-0 flex flex-col items-end max-w-[80%]">
        <div className="rounded-xl rounded-tr-sm bg-mission-control-accent/10 border border-mission-control-accent/20 text-mission-control-text px-4 py-3 text-sm break-words shadow-sm">
          <MessagePrimitive.Content />
        </div>
        <MessageTimestamp />
      </div>
    </MessagePrimitive.Root>
  );
}

// ──────────────────────────────────────────────────────────
// Composer — wraps ComposerPrimitive.Root with our styling.
// The parent ChatPanel keeps its own input/send state via
// the runtime's onNew callback, so we use the managed input.
// ──────────────────────────────────────────────────────────

export function MissionControlComposer({
  placeholder,
  disabled,
  loading,
}: {
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <ComposerPrimitive.Root className="flex-1 flex items-end gap-2">
      <div className="flex-1 relative">
        <ComposerPrimitive.Input
          className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-4 py-3 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors text-sm leading-relaxed"
          placeholder={placeholder ?? "Message... (Enter to send, Shift+Enter for newline)"}
          submitMode="enter"
          disabled={disabled}
          rows={1}
          autoFocus
        />
      </div>
      <ComposerPrimitive.Send
        disabled={disabled || loading}
        className="p-3 bg-mission-control-accent text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex-shrink-0"
        aria-label="Send message"
        title="Send message (Enter)"
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Send size={20} />
        )}
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}

// ──────────────────────────────────────────────────────────
// Thread — viewport + messages list + empty state
// ──────────────────────────────────────────────────────────

export function MissionControlThread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4">
        <ThreadPrimitive.Empty>
          <div className="flex flex-col items-center justify-center h-full gap-3 text-mission-control-text-dim">
            <MessageSquare size={32} className="opacity-40" />
            <p className="text-sm">Start a conversation</p>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessageBubble,
            AssistantMessage: AssistantMessageBubble,
          }}
        />
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
