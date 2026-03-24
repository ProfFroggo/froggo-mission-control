"use client";

import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from "@assistant-ui/react";
import { Send, Loader2 } from "lucide-react";
import MarkdownMessage from "../MarkdownMessage";

// ──────────────────────────────────────────────────────────
// Text renderer — wraps MarkdownMessage for assistant content
// ──────────────────────────────────────────────────────────

function AssistantTextPart({ text }: { text: string }) {
  return <MarkdownMessage content={text} />;
}

// ──────────────────────────────────────────────────────────
// Assistant message bubble
// ──────────────────────────────────────────────────────────

export function AssistantMessageBubble() {
  return (
    <MessagePrimitive.Root className="flex gap-3 mt-6 items-start">
      <div className="flex-1 min-w-0 flex flex-col items-start max-w-[80%]">
        <div className="rounded-xl rounded-tl-sm bg-mission-control-surface/80 border border-mission-control-border text-mission-control-text px-4 py-3 text-sm break-words shadow-sm w-full">
          <MessagePrimitive.Content
            components={{
              Text: AssistantTextPart,
            }}
          />
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
    <ComposerPrimitive.Root className="flex items-end gap-2">
      <ComposerPrimitive.Input
        className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-4 py-3 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors text-sm"
        placeholder={placeholder ?? "Message..."}
        submitMode="enter"
        disabled={disabled}
        rows={1}
        autoFocus
      />
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
// Thread — viewport + messages list
// ──────────────────────────────────────────────────────────

export function MissionControlThread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4">
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
