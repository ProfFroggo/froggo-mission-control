"use client";

import { useExternalStoreRuntime } from "@assistant-ui/react";
import type { ThreadMessageLike, AppendMessage } from "@assistant-ui/react";

export type InternalMessage = {
  id?: string;
  role: string;
  content:
    | string
    | { type: string; text?: string; [key: string]: unknown }[];
  timestamp?: number;
  streaming?: boolean;
};

/**
 * Convert our internal StructuredChatMessage format to assistant-ui's ThreadMessageLike.
 * Maps only text content — structured blocks are collapsed to plain text.
 */
export function convertToThreadMessage(
  msg: InternalMessage,
  _idx: number
): ThreadMessageLike {
  let textContent = "";

  if (typeof msg.content === "string") {
    textContent = msg.content;
  } else if (Array.isArray(msg.content)) {
    textContent = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b.text as string) ?? "")
      .join("");
  }

  const role = msg.role as "user" | "assistant" | "system";

  const base = {
    id: msg.id,
    role,
    content: [{ type: "text" as const, text: textContent }],
    createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  };

  if (role === "assistant") {
    return {
      ...base,
      status: msg.streaming
        ? { type: "running" as const }
        : { type: "complete" as const, reason: "stop" as const },
    };
  }

  return base;
}

/**
 * Build an ExternalStoreRuntime bridging our ChatPanel messages array + sendMessage
 * into the assistant-ui runtime contract.
 *
 * @param messages  - ChatPanel messages state cast to InternalMessage[]
 * @param isRunning - true while streaming (maps to `loading` in ChatPanel)
 * @param onSend    - async function that sends the text (sendMessage in ChatPanel)
 */
export function useMissionControlRuntime(
  messages: InternalMessage[],
  isRunning: boolean,
  onSend: (text: string) => Promise<void>
) {
  return useExternalStoreRuntime<InternalMessage>({
    messages,
    convertMessage: convertToThreadMessage,
    isRunning,
    onNew: async (message: AppendMessage) => {
      const text = message.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (text) {
        await onSend(text);
      }
    },
  });
}
