// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, Plus, Trash2, Pin, PinOff, Mic, MicOff } from 'lucide-react';
import { Button, Flex, Box, Text, Spinner } from '@radix-ui/themes';
import PanelHeader from './PanelHeader';
import MicSelector from './MicSelector';
import { authHeaders } from '../lib/api';
import { GeminiStt } from '../lib/globalStt';

interface Note {
  id: string;
  content: string;
  color: string;
  pinned: number;
  createdAt: number;
  updatedAt: number;
}

const NOTE_COLORS: { value: string; label: string; bg: string }[] = [
  { value: 'default', label: 'Default', bg: 'bg-mission-control-surface' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500/10' },
  { value: 'green', label: 'Green', bg: 'bg-green-500/10' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-500/10' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-500/10' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500/10' },
];

function colorBg(color: string): string {
  return NOTE_COLORS.find(c => c.value === color)?.bg ?? 'bg-mission-control-surface';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [micDeviceId, setMicDeviceId] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sttRef = useRef<GeminiStt | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes?limit=200', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const addNote = useCallback(async (content: string) => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes(prev => [note, ...prev]);
        setInput('');
      }
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE', headers: authHeaders() });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  }, []);

  const togglePin = useCallback(async (id: string, currentlyPinned: number) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !currentlyPinned }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNotes(prev => {
          const filtered = prev.filter(n => n.id !== id);
          if (updated.pinned) return [updated, ...filtered];
          const firstUnpinned = filtered.findIndex(n => !n.pinned);
          if (firstUnpinned === -1) return [...filtered, updated];
          filtered.splice(firstUnpinned, 0, updated);
          return filtered;
        });
      }
    } catch { /* ignore */ }
  }, []);

  const toggleSTT = useCallback(() => {
    if (listening && sttRef.current) {
      sttRef.current.stop();
      setListening(false);
      return;
    }

    const stt = new GeminiStt({
      deviceId: micDeviceId || undefined,
      continuous: true,
      chunkDurationMs: 8000,
      onTranscript: (text) => { setInput(prev => prev ? `${prev} ${text}` : text); },
      onError: () => { setListening(false); },
      onEnd: () => { setListening(false); },
    });
    sttRef.current = stt;
    stt.start();
    setListening(true);
    inputRef.current?.focus();
  }, [listening, micDeviceId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addNote(input);
    }
  };

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        icon={StickyNote}
        title="Notes"
        subtitle={`${notes.length} note${notes.length !== 1 ? 's' : ''}`}
        badge={pinnedNotes.length > 0 ? `${pinnedNotes.length} pinned` : undefined}
      />

      {/* Quick add bar */}
      <div className="px-6 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <Flex gap="2" align="end">
          <Box className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a note and press Enter..."
              rows={2}
              className="form-textarea w-full resize-none"
            />
          </Box>
          <Flex direction="column" gap="1">
            <button
              type="button"
              onClick={toggleSTT}
              title={listening ? 'Stop listening' : 'Voice input'}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                listening
                  ? 'bg-destructive/10 text-destructive animate-pulse'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'
              }`}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <MicSelector value={micDeviceId} onChange={setMicDeviceId} compact />
            <Button
              size="2"
              variant="solid"
              color="violet"
              onClick={() => addNote(input)}
              disabled={saving || !input.trim()}
            >
              {saving ? <Spinner size="1" /> : <Plus size={14} />}
            </Button>
          </Flex>
        </Flex>
      </div>

      {/* Notes grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <Flex justify="center" py="8"><Spinner size="3" /></Flex>
        ) : notes.length === 0 ? (
          <Flex direction="column" align="center" justify="center" py="8" gap="2">
            <StickyNote size={40} className="text-mission-control-text-dim/30" />
            <Text size="2" className="text-mission-control-text-dim">No notes yet. Add one above.</Text>
          </Flex>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...pinnedNotes, ...unpinnedNotes].map(note => (
              <div
                key={note.id}
                className={`${colorBg(note.color)} border border-mission-control-border rounded-lg p-3 flex flex-col gap-2 group relative`}
              >
                {note.pinned ? (
                  <Pin size={12} className="absolute top-2 right-2 text-mission-control-accent" />
                ) : null}
                <Text size="2" className="text-mission-control-text whitespace-pre-wrap break-words flex-1">
                  {note.content}
                </Text>
                <Flex align="center" justify="between" className="mt-auto">
                  <Text size="1" className="text-mission-control-text-dim">{timeAgo(note.createdAt)}</Text>
                  <Flex gap="1" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => togglePin(note.id, note.pinned)}
                      title={note.pinned ? 'Unpin' : 'Pin'}
                      aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                    >
                      {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      title="Delete"
                      aria-label="Delete note"
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-mission-control-text-dim hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </Flex>
                </Flex>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
