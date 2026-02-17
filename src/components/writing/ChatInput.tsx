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
    <div className="bg-clawd-surface border-t border-clawd-border p-3 space-y-2 dark">
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
          className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-4 py-3 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent resize-none transition-colors disabled:opacity-50 dark"
        />
        <button
          onClick={handleSendClick}
          disabled={disabled || !input.trim()}
          className="p-3 bg-clawd-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
          title="Send message"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
