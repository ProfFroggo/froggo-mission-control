import { useExternalStoreRuntime, ExternalStoreRuntime } from '@assistant-ui/react';
import { useState, useCallback, useRef } from 'react';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type UseMissionControlRuntimeOptions = {
  agentId: string;
  sessionKey: string;
  model?: string;
};

export function useMissionControlRuntime({ agentId, sessionKey, model = 'claude-sonnet-4-6' }: UseMissionControlRuntimeOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const onNew = useCallback(async (msg: { content: Array<{ type: string; text: string }> }) => {
    const text = msg.content.find(c => c.type === 'text')?.text ?? '';
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsRunning(true);

    let accumulated = '';
    const assistantId = crypto.randomUUID();

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model, sessionKey }),
      });
      if (!res.body) throw new Error('No body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') break;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === 'text_delta') {
              accumulated += ev.text;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return [...prev.slice(0, -1), { ...last, content: accumulated }];
                }
                return [...prev, { id: assistantId, role: 'assistant', content: accumulated, timestamp: new Date() }];
              });
            }
          } catch {}
        }
      }
    } finally {
      setIsRunning(false);
    }
  }, [agentId, sessionKey, model]);

  const runtime = useExternalStoreRuntime({
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: [{ type: 'text' as const, text: m.content }],
    })),
    isRunning,
    onNew,
  });

  return { runtime, messages, setMessages };
}
