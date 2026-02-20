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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentLabel}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completedCount}/{totalSections} sections · {overallProgress}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
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
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : s.id === currentSection
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
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
            <Bot size={48} className="text-blue-400 dark:text-blue-500 mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Module Builder</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
              I'll walk you through a series of questions to design your module spec. Ready?
            </p>
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Play size={16} /> Start Interview
            </button>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Bot size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white dark:bg-blue-600'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <User size={16} className="text-gray-600 dark:text-gray-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isStarted && (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isFinished ? 'Interview complete! Review your spec →' : 'Type your answer...'}
              disabled={isFinished}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isFinished}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
