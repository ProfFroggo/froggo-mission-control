import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, TrendingUp, Clock, CheckCircle, AlertCircle, Target } from 'lucide-react';

interface TrainingEntry {
  id: string;
  agent_id: string;
  trainer_id: string;
  training_type: string;
  focus_area: string;
  outcome: string | null;
  skill_before: number | null;
  skill_after: number | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: number;
}

export default function TrainingLogModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'db-exec',
          sql: 'SELECT * FROM agent_training_log ORDER BY created_at DESC LIMIT 50',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((data?.result || []) as TrainingEntry[]);
      }
    } catch (e) {
      // 'Failed to load training log:', e;
    } finally {
      setLoading(false);
    }
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const outcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case 'passed': return <CheckCircle size={14} className="text-success" />;
      case 'needs-work': return <AlertCircle size={14} className="text-amber-400" />;
      case 'failed': return <AlertCircle size={14} className="text-error" />;
      default: return <Clock size={14} className="text-clawd-text-dim" />;
    }
  };

  const filteredEntries = filter === 'all' ? entries : entries.filter(e => e.agent_id === filter);
  const agents = [...new Set(entries.map(e => e.agent_id))];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        aria-label="Close training log"
      />
      <div className={`relative w-full max-w-2xl bg-clawd-bg border border-clawd-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <BookOpen size={20} className="text-teal-400" />
          <h2 className="font-bold text-clawd-text flex-1">Training Log</h2>
          {agents.length > 0 && (
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="text-xs bg-clawd-surface border border-clawd-border rounded-lg px-2 py-1 text-clawd-text"
            >
              <option value="all">All Agents</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <button onClick={handleClose} className="p-1 text-clawd-text-dim hover:text-clawd-text rounded-lg hover:bg-clawd-surface">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-clawd-text-dim py-8">Loading...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen size={32} className="mx-auto text-clawd-text-dim mb-3 opacity-40" />
              <p className="text-clawd-text-dim text-sm">No training sessions yet.</p>
              <p className="text-clawd-text-dim text-xs mt-1">Training runs automatically during quiet periods.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="rounded-lg border border-clawd-border p-3 hover:border-clawd-border/80 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {outcomeIcon(entry.outcome)}
                    <span className="font-medium text-sm text-clawd-text capitalize">{entry.agent_id}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-clawd-surface text-clawd-text-dim">{entry.training_type}</span>
                    <span className="flex-1" />
                    <span className="text-[10px] text-clawd-text-dim">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-clawd-text-dim">{entry.focus_area}</p>
                  {entry.skill_before != null && entry.skill_after != null && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Target size={12} className="text-clawd-text-dim" />
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-clawd-text-dim">{entry.skill_before}</span>
                        <TrendingUp size={10} className={entry.skill_after > entry.skill_before ? 'text-success' : 'text-clawd-text-dim'} />
                        <span className={entry.skill_after > entry.skill_before ? 'text-success font-medium' : 'text-clawd-text-dim'}>{entry.skill_after}</span>
                      </div>
                    </div>
                  )}
                  {entry.notes && <p className="text-xs text-clawd-text-dim mt-1 italic">{entry.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
