import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Play } from 'lucide-react';
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
  onSend,
  onStart,
  onJumpToSection,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="flex flex-col h-full bg-mission-control-bg border-r border-mission-control-border">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-mission-control-text">
            {currentLabel}
          </span>
          <span className="text-xs text-mission-control-text-dim">
            {completedCount}/{totalSections} sections · {overallProgress}%
          </span>
        </div>
        <div className="w-full h-2 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className="h-full bg-mission-control-accent rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        {/* Section pills */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {sectionProgress.map(s => (
            <button
              key={s.id}
              onClick={() => onJumpToSection(s.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                s.complete
                  ? 'bg-success-subtle text-success'
                  : s.id === currentSection
                    ? 'bg-mission-control-accent/20 text-mission-control-accent'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {s.complete ? '✓ ' : ''}{s.label}
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
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-mission-control-accent hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity"
            >
              <Play size={16} /> Start Interview
            </button>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-accent/20 flex items-center justify-center">
                <Bot size={16} className="text-mission-control-accent" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface text-mission-control-text'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-border flex items-center justify-center">
                <User size={16} className="text-mission-control-text-dim" />
              </div>
            )}
          </div>
        ))}
        {isStreaming && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mission-control-accent/20 flex items-center justify-center">
              <Bot size={16} className="text-mission-control-accent animate-pulse" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm bg-mission-control-surface">
              <span className="inline-flex gap-1 text-mission-control-text-dim">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isStarted && (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-mission-control-border">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isFinished ? 'Interview complete! Review your spec →' : isStreaming ? 'Thinking...' : 'Type your answer...'}
              disabled={isFinished || isStreaming}
              className="flex-1 px-4 py-2 rounded-lg border border-mission-control-border bg-mission-control-surface text-mission-control-text text-sm focus:outline-none focus:ring-2 focus:ring-mission-control-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isFinished || isStreaming}
              className="px-3 py-2 bg-mission-control-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-opacity"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
