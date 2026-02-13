import { useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { useChatPaneStore } from '../../store/chatPaneStore';
import AgentPicker from './AgentPicker';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { input, setInput, selectedAgent, setSelectedAgent } = useChatPaneStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 22; // ~text-sm line height
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSend(input.trim());
      }
    }
  };

  const handleSendClick = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
    }
  };

  return (
    <div className="bg-clawd-surface border-t border-clawd-border p-3 space-y-2">
      <AgentPicker selected={selectedAgent} onSelect={setSelectedAgent} disabled={disabled} />
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agent..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-clawd-bg border border-clawd-border rounded px-3 py-2 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent resize-none disabled:opacity-50"
        />
        <button
          onClick={handleSendClick}
          disabled={disabled || !input.trim()}
          className="p-2 rounded bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
