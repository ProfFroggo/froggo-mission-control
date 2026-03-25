// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef } from 'react';
import { SmilePlus, ThumbsUp, Check, X, Lightbulb, Flame, Eye } from 'lucide-react';

export interface ReactionSummary {
  reaction: string;
  count: number;
  users: string[];
  label?: string;
}

interface MessageReactionsProps {
  messageId: string;
  isUser: boolean;
}

const QUICK_REACTIONS: { emoji: string; icon: React.ReactNode; label: string }[] = [
  { emoji: 'thumbs-up', icon: <ThumbsUp size={14} />, label: 'Thumbs up' },
  { emoji: 'check', icon: <Check size={14} />, label: 'Done' },
  { emoji: 'x', icon: <X size={14} />, label: 'No' },
  { emoji: 'lightbulb', icon: <Lightbulb size={14} />, label: 'Idea' },
  { emoji: 'flame', icon: <Flame size={14} />, label: 'Hot' },
  { emoji: 'eye', icon: <Eye size={14} />, label: 'Looking' },
];

export default function MessageReactions({ messageId, isUser }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<ReactionSummary[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load reactions on mount
  useEffect(() => {
    fetchReactions();
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close picker on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPicker]);

  const fetchReactions = async () => {
    try {
      const res = await fetch(`/api/chat/reactions?messageId=${encodeURIComponent(messageId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setReactions(data.reactions ?? []);
    } catch { /* non-critical */ }
  };

  const toggleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, reaction: emoji, userId: 'user' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setReactions(data.reactions ?? []);
    } catch { /* non-critical */ } finally {
      setLoading(false);
      setShowPicker(false);
    }
  };

  const myReactions = new Set(
    reactions.filter(r => r.users.includes('user')).map(r => r.reaction)
  );

  return (
    <div className={`flex items-center gap-1 flex-wrap mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Existing reaction pills */}
      {reactions.map(r => (
        <button
          key={r.reaction}
          type="button"
          onClick={() => toggleReaction(r.reaction)}
          title={`${r.label ?? r.reaction}: ${r.count}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            myReactions.has(r.reaction)
              ? 'bg-mission-control-accent/20 border-mission-control-accent/60 text-mission-control-accent'
              : 'bg-mission-control-bg border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent/40'
          }`}
        >
          <span>{r.reaction}</span>
          <span>{r.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setShowPicker(v => !v)}
          title="Add reaction"
          aria-label="Add reaction"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors opacity-0 group-hover:opacity-100"
        >
          <SmilePlus size={13} />
        </button>

        {showPicker && (
          <div
            className={`absolute z-30 bottom-full mb-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-xl p-2 flex gap-1 ${
              isUser ? 'right-0' : 'left-0'
            }`}
          >
            {QUICK_REACTIONS.map(({ emoji, icon, label }) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                title={label}
                aria-label={label}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                  myReactions.has(emoji)
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
