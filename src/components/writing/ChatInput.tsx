import { useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Flex, TextArea } from '@radix-ui/themes';
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
    <div className="bg-mission-control-surface border-t border-mission-control-border p-3 space-y-2 dark">
      <AgentPicker selected={selectedAgent} onSelect={setSelectedAgent} disabled={disabled} />
      <Flex align="end" gap="2">
        <TextArea
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
          style={{ flex: 1, resize: 'none' }}
        />
        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled || !input.trim()}
          title="Send message"
          aria-label="Send message"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </button>
      </Flex>
    </div>
  );
}
