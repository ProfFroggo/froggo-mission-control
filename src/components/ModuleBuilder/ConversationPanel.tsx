import { useState, useRef, useEffect } from 'react';
import MarkdownMessage from '../MarkdownMessage';
import { Send, Bot, User, Play, CheckCircle } from 'lucide-react';
import { Button, IconButton, TextField, Flex } from '@radix-ui/themes';
import type { ConversationMessage, SectionProgress, SectionId } from './types';
import { SECTION_ORDER, SECTION_LABELS } from './types';

interface Props {
  messages: ConversationMessage[];
  sectionProgress: SectionProgress[];
  currentSection: SectionId;
  overallProgress: number;
  isStarted: boolean;
  isFinished: boolean;
  isStreaming: boolean;
  streamingContent?: string;
  onSend: (content: string) => void;
  onStart: () => void;
  onJumpToSection: (sectionId: SectionId) => void;
}

export default function ConversationPanel({
  messages,
  sectionProgress,
  currentSection,
  overallProgress,
  isStarted,
  isFinished,
  isStreaming,
  streamingContent,
  onSend,
  onStart,
  onJumpToSection,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isFinished || !isStarted) return;
    setInput('');
    onSend(text);
  };

  const currentLabel = SECTION_LABELS[currentSection] || currentSection;
  const completedCount = sectionProgress.filter(s => s.complete).length;
  const totalSections = SECTION_ORDER.length;

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg border-r border-mission-control-border">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-mission-control-border">
        <Flex align="center" justify="between" className="mb-2">
          <span className="text-sm font-medium text-mission-control-text">
            {currentLabel}
          </span>
          <span className="text-xs text-mission-control-text-dim">
            {completedCount}/{totalSections} sections · {overallProgress}%
          </span>
        </Flex>
        <div className="w-full h-2 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className="h-full bg-mission-control-accent rounded-full transition-colors duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        {/* Section pills */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {sectionProgress.map(s => (
            <button
              key={s.id}
              onClick={() => onJumpToSection(s.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                s.complete
                  ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]'
                  : s.id === currentSection
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
              }`}
            >
              {s.complete && <CheckCircle size={10} />}{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!isStarted && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={48} className="text-mission-control-accent mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-mission-control-text mb-2">Module Builder</h3>
            <p className="text-sm text-mission-control-text-dim mb-6 max-w-xs">
              I'll walk you through a series of questions to design your module spec. Ready?
            </p>
            <Button size="3" variant="solid" onClick={onStart}>
              <Play size={16} /> Start Interview
            </Button>
          </div>
        )}

        {messages.map(msg => (
          <Flex key={msg.id} gap="3" justify={msg.role === 'user' ? 'end' : 'start'}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-accent/20 flex items-center justify-center">
                <Bot size={16} className="text-mission-control-accent" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface text-mission-control-text'
              }`}
            >
              {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-border flex items-center justify-center">
                <User size={16} className="text-mission-control-text-dim" />
              </div>
            )}
          </Flex>
        ))}
        {isStreaming && (
          <Flex gap="3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-accent/20 flex items-center justify-center">
              <Bot size={16} className="text-mission-control-accent animate-pulse" />
            </div>
            <div className="max-w-[80%] rounded-lg px-4 py-2.5 text-sm bg-mission-control-surface text-mission-control-text">
              {streamingContent ? (
                <MarkdownMessage content={streamingContent} streaming={true} />
              ) : (
                <span className="inline-flex gap-1 text-mission-control-text-dim">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              )}
            </div>
          </Flex>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isStarted && (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-mission-control-border">
          <Flex gap="2">
            <TextField.Root
              size="2"
              className="flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isFinished ? 'Interview complete! Review your spec →' : isStreaming ? 'Thinking...' : 'Type your answer...'}
              disabled={isFinished || isStreaming}
            />
            <IconButton
              type="submit"
              size="2"
              variant="solid"
             
              disabled={!input.trim() || isFinished || isStreaming}
            >
              <Send size={16} />
            </IconButton>
          </Flex>
        </form>
      )}
    </Flex>
  );
}
