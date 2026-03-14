// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { History, X, Clock, RotateCcw } from 'lucide-react';

interface KBVersion {
  id: number;
  articleId: string;
  editedBy: string;
  editedAt: number;
  versionNote: string | null;
  content: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

function computeDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const maxA = Math.min(aLines.length, 200);
  const maxB = Math.min(bLines.length, 200);

  const dp: number[][] = Array.from({ length: maxA + 1 }, () => new Array(maxB + 1).fill(0));
  for (let i = maxA - 1; i >= 0; i--) {
    for (let j = maxB - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < maxA || j < maxB) {
    if (i < maxA && j < maxB && aLines[i] === bLines[j]) {
      result.push({ type: 'unchanged', text: aLines[i] });
      i++; j++;
    } else if (j < maxB && (i >= maxA || dp[i][j + 1] >= dp[i + 1][j])) {
      result.push({ type: 'added', text: bLines[j] });
      j++;
    } else {
      result.push({ type: 'removed', text: aLines[i] });
      i++;
    }
  }
  return result;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Props {
  articleId: string;
  currentContent: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export default function ArticleRevisionHistory({ articleId, currentContent, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KBVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/knowledge/${articleId}/versions`)
      .then(r => r.json())
      .then(d => { if (d.success) setVersions(d.versions); })
      .finally(() => setLoading(false));
  }, [articleId]);

  const currentWords = countWords(currentContent);

  const handleRestore = async () => {
    if (!selected) return;
    if (!confirm(`Restore version from ${new Date(selected.editedAt).toLocaleString()}?`)) return;
    setRestoring(true);
    try {
      await fetch(`/api/knowledge/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: selected.content, versionNote: 'Restored from version history' }),
      });
      onRestore(selected.content);
      onClose();
    } finally {
      setRestoring(false);
    }
  };

  const diffLines = selected ? computeDiff(selected.content, currentContent) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl mx-4 rounded-xl bg-mission-control-surface border border-mission-control-border shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border shrink-0">
          <History size={16} className="text-mission-control-text-dim" />
          <span className="font-semibold text-mission-control-text flex-1 text-sm">Revision History</span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-60 shrink-0 border-r border-mission-control-border flex flex-col">
            <div className="px-3 py-2 border-b border-mission-control-border">
              <p className="text-xs text-mission-control-text-dim">
                {versions.length} saved version{versions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="mx-2 my-1 h-12 rounded bg-mission-control-border animate-pulse" />
                ))
              ) : versions.length === 0 ? (
                <div className="p-4 text-center">
                  <Clock size={20} className="mx-auto mb-2 text-mission-control-text-dim" />
                  <p className="text-xs text-mission-control-text-dim">No saved versions yet.</p>
                  <p className="text-xs text-mission-control-text-dim mt-1">Versions are saved each time content is edited.</p>
                </div>
              ) : (
                <div className="space-y-px px-2">
                  {versions.map((v, idx) => {
                    const wordCount = countWords(v.content);
                    const diff = wordCount - currentWords;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelected(selected?.id === v.id ? null : v)}
                        className={`w-full text-left px-3 py-2.5 rounded transition-colors ${
                          selected?.id === v.id
                            ? 'bg-blue-600/20 border border-blue-500/40'
                            : 'hover:bg-mission-control-border border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-mission-control-text">v{versions.length - idx}</span>
                          <span className={`text-xs font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-mission-control-text-dim'}`}>
                            {diff > 0 ? `+${diff}` : diff === 0 ? '±0' : String(diff)}w
                          </span>
                        </div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">
                          {new Date(v.editedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {' '}
                          {new Date(v.editedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-mission-control-text-dim capitalize truncate opacity-70">
                          {v.editedBy}{v.versionNote ? ` · ${v.versionNote}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selected === null ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <History size={24} className="mx-auto mb-2 text-mission-control-text-dim" />
                  <p className="text-sm text-mission-control-text-dim">Select a version to preview and compare</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-mission-control-border shrink-0">
                  <div>
                    <span className="text-xs font-medium text-mission-control-text">
                      {new Date(selected.editedAt).toLocaleString()}
                    </span>
                    <span className="ml-2 text-xs text-mission-control-text-dim capitalize">{selected.editedBy}</span>
                    {selected.versionNote && (
                      <span className="ml-2 text-xs text-mission-control-text-dim opacity-70">· {selected.versionNote}</span>
                    )}
                  </div>
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs"
                  >
                    <RotateCcw size={11} />
                    {restoring ? 'Restoring...' : 'Restore this version'}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex gap-3 mb-3 text-xs text-mission-control-text-dim">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40 inline-block" />
                      Added in current
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 inline-block" />
                      Removed in current
                    </span>
                  </div>
                  <div className="font-mono text-xs rounded border border-mission-control-border overflow-hidden">
                    {(diffLines ?? []).map((line, i) => (
                      <div
                        key={i}
                        className={`px-3 py-0.5 leading-5 whitespace-pre-wrap break-all ${
                          line.type === 'added'
                            ? 'bg-green-500/10 text-green-300'
                            : line.type === 'removed'
                            ? 'bg-red-500/10 text-red-300 line-through opacity-70'
                            : 'text-mission-control-text-dim'
                        }`}
                      >
                        <span className="mr-2 opacity-40 select-none">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        {line.text || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
