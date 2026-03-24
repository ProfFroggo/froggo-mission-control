"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  useMessage,
} from "@assistant-ui/react";
import { Box, Flex, Text, IconButton } from "@radix-ui/themes";
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
} from "lucide-react";
import { useState } from "react";
import MarkdownMessage from "../MarkdownMessage";

// ─────────────────────────────────────────────────────────────────
// CSS keyframes injected once
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
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    .aui-message-enter { animation: aui-fade-in 0.2s ease both; }
    .aui-action-bar { opacity: 0; transition: opacity 0.15s; }
    .aui-message-root:hover .aui-action-bar,
    .aui-message-root:focus-within .aui-action-bar { opacity: 1; }
    .aui-scroll-btn { opacity: 0; transition: opacity 0.2s; }
    .aui-scroll-btn.visible { opacity: 1; }
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
// Streaming cursors: thinking dots + inline cursor
// ─────────────────────────────────────────────────────────────────

function ThinkingDots() {
  ensureCSS();
  return (
    <span
      style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}
      aria-label="Agent is thinking"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent-9)",
            display: "inline-block",
            animation: `aui-thinking-dot 1.2s ease-in-out infinite`,
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

function StreamingCursor() {
  ensureCSS();
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 2,
        height: "0.85em",
        marginLeft: 1,
        background: "var(--accent-9)",
        verticalAlign: "text-bottom",
        borderRadius: 1,
        animation: "aui-cursor-blink 0.8s step-end infinite",
      }}
    />
  );
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
// Action bars
// ─────────────────────────────────────────────────────────────────

type SmallIconBtnProps = {
  onClick?: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
  asChild?: boolean;
};

function SmallBtn({ onClick, title, active, children, asChild }: SmallIconBtnProps) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "var(--radius-2)",
    border: "1px solid transparent",
    background: "transparent",
    color: active ? "var(--accent-9)" : "var(--gray-9)",
    cursor: "pointer",
    transition: "all 0.12s",
    flexShrink: 0,
  };
  if (asChild) return <>{children}</>;
  return (
    <button type="button" onClick={onClick} title={title} style={style} aria-label={title}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--gray-a3)";
        (e.currentTarget as HTMLElement).style.color = "var(--gray-12)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--gray-5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = active ? "var(--accent-9)" : "var(--gray-9)";
        (e.currentTarget as HTMLElement).style.borderColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function AssistantActionBar() {
  const [copied, setCopied] = useState(false);

  return (
    <Flex
      gap="1"
      align="center"
      mt="1"
      className="aui-action-bar"
      style={{ minHeight: 32 }}
    >
      {/* Copy */}
      <ActionBarPrimitive.Copy
        copiedDuration={1500}
        onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-2)",
          border: "1px solid transparent",
          background: "transparent",
          color: copied ? "var(--green-10)" : "var(--gray-9)",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        title="Copy message"
        aria-label="Copy message"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </ActionBarPrimitive.Copy>

      {/* Thumbs up */}
      <ActionBarPrimitive.FeedbackPositive
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-2)",
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--gray-9)",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        title="Good response"
        aria-label="Good response"
      >
        <ThumbsUp size={13} />
      </ActionBarPrimitive.FeedbackPositive>

      {/* Thumbs down */}
      <ActionBarPrimitive.FeedbackNegative
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-2)",
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--gray-9)",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        title="Bad response"
        aria-label="Bad response"
      >
        <ThumbsDown size={13} />
      </ActionBarPrimitive.FeedbackNegative>

      {/* Regenerate — only last assistant message */}
      <ActionBarPrimitive.Reload
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-2)",
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--gray-9)",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        title="Regenerate response"
        aria-label="Regenerate response"
      >
        <RefreshCw size={13} />
      </ActionBarPrimitive.Reload>

      {/* Branch picker — shows count when > 1 branch */}
      <BranchPickerPrimitive.Root
        hideWhenSingleBranch
        style={{ display: "contents" }}
      >
        <Flex
          align="center"
          gap="1"
          style={{
            borderLeft: "1px solid var(--gray-4)",
            paddingLeft: 6,
            marginLeft: 2,
          }}
        >
          <BranchPickerPrimitive.Previous
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "var(--radius-1)",
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--gray-9)",
              cursor: "pointer",
            }}
            aria-label="Previous branch"
          >
            <ChevronLeft size={12} />
          </BranchPickerPrimitive.Previous>
          <Text size="1" style={{ color: "var(--gray-9)", minWidth: 24, textAlign: "center" }}>
            <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
          </Text>
          <BranchPickerPrimitive.Next
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "var(--radius-1)",
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--gray-9)",
              cursor: "pointer",
            }}
            aria-label="Next branch"
          >
            <ChevronRight size={12} />
          </BranchPickerPrimitive.Next>
        </Flex>
      </BranchPickerPrimitive.Root>
    </Flex>
  );
}

function UserActionBar() {
  return (
    <Flex
      gap="1"
      align="center"
      mt="1"
      justify="end"
      className="aui-action-bar"
      style={{ minHeight: 28 }}
    >
      <ActionBarPrimitive.Edit
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "var(--radius-2)",
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--gray-9)",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        title="Edit message"
        aria-label="Edit message"
      >
        <Edit3 size={13} />
      </ActionBarPrimitive.Edit>
    </Flex>
  );
}

// ─────────────────────────────────────────────────────────────────
// Message bubbles
// ─────────────────────────────────────────────────────────────────

export function AssistantMessageBubble() {
  ensureCSS();
  return (
    <MessagePrimitive.Root className="aui-message-root aui-message-enter">
      <Box py="3" px="1" style={{ maxWidth: "100%" }}>
        {/* Content */}
        <Box
          style={{
            fontSize: "var(--font-size-2)",
            lineHeight: "1.65",
            color: "var(--gray-12)",
            wordBreak: "break-word",
          }}
        >
          <MessagePrimitive.Content
            components={{ Text: MarkdownText }}
          />
          <AssistantStreamState />
        </Box>
        {/* Action bar — hidden until hover */}
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="never"
          style={{ display: "contents" }}
        >
          <AssistantActionBar />
        </ActionBarPrimitive.Root>
      </Box>
    </MessagePrimitive.Root>
  );
}

export function UserMessageBubble() {
  ensureCSS();
  return (
    <MessagePrimitive.Root className="aui-message-root aui-message-enter">
      <Flex justify="end" py="2" px="1">
        <Flex direction="column" align="end" style={{ maxWidth: "75%" }}>
          {/* Bubble */}
          <Box
            style={{
              background: "var(--accent-4)",
              border: "1px solid var(--accent-6)",
              borderRadius: "16px 16px 4px 16px",
              padding: "10px 16px",
              fontSize: "var(--font-size-2)",
              lineHeight: "1.6",
              color: "var(--gray-12)",
              wordBreak: "break-word",
              boxShadow: "0 1px 3px var(--black-a2)",
            }}
          >
            <MessagePrimitive.Content />
          </Box>
          {/* Action bar */}
          <ActionBarPrimitive.Root
            autohide="not-last"
            style={{ display: "contents" }}
          >
            <UserActionBar />
          </ActionBarPrimitive.Root>
        </Flex>
      </Flex>
    </MessagePrimitive.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
// Scroll-to-bottom button
// ─────────────────────────────────────────────────────────────────

function ScrollToBottomButton() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <button
        type="button"
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px 6px 10px",
          borderRadius: "var(--radius-5)",
          background: "var(--color-panel-solid)",
          border: "1px solid var(--gray-5)",
          color: "var(--gray-11)",
          fontSize: "var(--font-size-1)",
          cursor: "pointer",
          boxShadow: "0 2px 8px var(--black-a4)",
          transition: "all 0.15s",
          zIndex: 10,
        }}
        aria-label="Scroll to latest"
      >
        <ChevronDown size={14} />
        <span>Latest</span>
      </button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

// ─────────────────────────────────────────────────────────────────
// Composer — growing textarea + actions + send
// ─────────────────────────────────────────────────────────────────

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
    <ComposerPrimitive.Root
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--color-surface)",
        border: "1px solid var(--gray-5)",
        borderRadius: "var(--radius-4)",
        padding: "10px 12px 10px 16px",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 1px 4px var(--black-a2)",
      }}
      className="focus-within:border-[var(--accent-8)] focus-within:shadow-[0_0_0_2px_var(--accent-a4)]"
    >
      {/* Textarea */}
      <ComposerPrimitive.Input
        style={{
          display: "block",
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          color: "var(--gray-12)",
          fontSize: "var(--font-size-2)",
          lineHeight: "1.55",
          fontFamily: "inherit",
        }}
        className="min-h-[22px] max-h-[160px] overflow-auto placeholder:text-[var(--gray-9)]"
        placeholder={placeholder ?? "Message… (Enter to send, Shift+Enter for newline)"}
        submitMode="enter"
        disabled={disabled}
        rows={1}
        autoFocus
      />

      {/* Bottom row: right-aligned send */}
      <Flex justify="end" align="center">
        <ComposerPrimitive.Send disabled={disabled || loading} asChild>
          <IconButton
            size="2"
           
            disabled={disabled || loading}
            aria-label="Send message"
            title="Send (Enter)"
          >
            {loading ? (
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Send size={16} />
            )}
          </IconButton>
        </ComposerPrimitive.Send>
      </Flex>
    </ComposerPrimitive.Root>
  );
}

// ─────────────────────────────────────────────────────────────────
// Thread — root with auto-scroll viewport
// ─────────────────────────────────────────────────────────────────

export function MissionControlThread() {
  ensureCSS();
  return (
    <ThreadPrimitive.Root
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <ThreadPrimitive.Viewport
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 20px",
          scrollBehavior: "smooth",
        }}
      >
        {/* Empty state */}
        <ThreadPrimitive.Empty>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ height: "100%", minHeight: 280, color: "var(--gray-9)" }}
          >
            <Box
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--accent-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare size={22} style={{ color: "var(--accent-9)" }} />
            </Box>
            <Text size="2" color="gray" weight="medium">
              Start a conversation
            </Text>
            <Text size="1" color="gray" style={{ opacity: 0.65 }}>
              Send a message to your agent
            </Text>
          </Flex>
        </ThreadPrimitive.Empty>

        {/* Messages */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessageBubble,
            AssistantMessage: AssistantMessageBubble,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* Scroll-to-bottom floating button */}
      <ScrollToBottomButton />
    </ThreadPrimitive.Root>
  );
}
