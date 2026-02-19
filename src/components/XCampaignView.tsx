import { useState, useEffect, useCallback } from 'react';
import { Rocket, Plus, Trash2, Calendar, Clock, ChevronDown, ChevronUp, GripVertical, Send, MessageSquare, Sparkles } from 'lucide-react';
import { showToast } from './Toast';

interface CampaignStage {
  id: string;
  dayOffset: number;
  time: string;
  content: string;
  type: 'tweet' | 'thread' | 'reply';
  notes: string;
}

interface Campaign {
  id: string;
  title: string;
  subject: string;
  stages: CampaignStage[];
  status: 'draft' | 'ready' | 'scheduled' | 'active' | 'completed';
  created_at: number;
  start_date?: string;
}

const STAGE_TYPES = [
  { value: 'tweet', label: 'Single Tweet' },
  { value: 'thread', label: 'Thread' },
  { value: 'reply', label: 'Reply/Follow-up' },
] as const;

function newStage(dayOffset: number): CampaignStage {
  return {
    id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dayOffset,
    time: '10:00',
    content: '',
    type: 'tweet',
    notes: '',
  };
}

function hydrateStages(raw: any[]): CampaignStage[] {
  return raw.map((s, i) => ({
    id: s.id || `stage-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    dayOffset: typeof s.dayOffset === 'number' ? s.dayOffset : i,
    time: s.time || '10:00',
    content: s.content || '',
    type: (['tweet', 'thread', 'reply'] as const).includes(s.type) ? s.type : 'tweet',
    notes: s.notes || '',
  }));
}

export default function XCampaignView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [aiProposal, setAiProposal] = useState<Campaign | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot?.xCampaign?.list?.();
      if (result?.success) {
        setCampaigns((result.campaigns || []) as Campaign[]);
      } else {
        setCampaigns([]);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Listen for AI-generated campaign proposals from agent chat
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;
      const campaign: Campaign = {
        id: `campaign-${Date.now()}`,
        title: data.title || 'AI-Generated Campaign',
        subject: data.subject || '',
        stages: hydrateStages(data.stages || []),
        status: 'draft',
        created_at: Date.now(),
      };
      setAiProposal(campaign);
      showToast('success', 'Agent proposed a campaign — review it below');
    };
    window.addEventListener('x-campaign-proposal', handler);
    return () => window.removeEventListener('x-campaign-proposal', handler);
  }, []);

  const createNewCampaign = () => {
    const campaign: Campaign = {
      id: `campaign-${Date.now()}`,
      title: '',
      subject: '',
      stages: [newStage(0), newStage(1), newStage(3)],
      status: 'draft',
      created_at: Date.now(),
    };
    setEditingCampaign(campaign);
    setAiProposal(null);
    setExpandedStages(new Set(campaign.stages.map(s => s.id)));
  };

  const acceptProposal = () => {
    if (!aiProposal) return;
    setEditingCampaign(aiProposal);
    setExpandedStages(new Set(aiProposal.stages.map(s => s.id)));
    setAiProposal(null);
  };

  const dismissProposal = () => {
    setAiProposal(null);
  };

  const addStage = () => {
    if (!editingCampaign) return;
    const maxDay = Math.max(...editingCampaign.stages.map(s => s.dayOffset), 0);
    const stage = newStage(maxDay + 1);
    setEditingCampaign({
      ...editingCampaign,
      stages: [...editingCampaign.stages, stage],
    });
    setExpandedStages(prev => new Set([...prev, stage.id]));
  };

  const removeStage = (stageId: string) => {
    if (!editingCampaign || editingCampaign.stages.length <= 1) return;
    setEditingCampaign({
      ...editingCampaign,
      stages: editingCampaign.stages.filter(s => s.id !== stageId),
    });
  };

  const updateStage = (stageId: string, updates: Partial<CampaignStage>) => {
    if (!editingCampaign) return;
    setEditingCampaign({
      ...editingCampaign,
      stages: editingCampaign.stages.map(s =>
        s.id === stageId ? { ...s, ...updates } : s
      ),
    });
  };

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const saveCampaign = async () => {
    if (!editingCampaign) return;
    if (!editingCampaign.title.trim()) {
      showToast('error', 'Campaign title is required');
      return;
    }
    if (!editingCampaign.subject.trim()) {
      showToast('error', 'Campaign subject is required');
      return;
    }
    const emptyStages = editingCampaign.stages.filter(s => !s.content.trim());
    if (emptyStages.length > 0) {
      showToast('error', `${emptyStages.length} stage(s) have no content`);
      return;
    }

    try {
      const result = await (window as any).clawdbot?.xCampaign?.save?.(editingCampaign);
      if (result?.success) {
        showToast('success', 'Campaign saved');
        setEditingCampaign(null);
        loadCampaigns();
      } else {
        showToast('error', result?.error || 'Failed to save campaign');
      }
    } catch (error: any) {
      showToast('error', `Save failed: ${error.message}`);
    }
  };

  const scheduleCampaign = async () => {
    if (!editingCampaign || !editingCampaign.start_date) {
      showToast('error', 'Set a start date first');
      return;
    }
    try {
      const toSave = { ...editingCampaign, status: 'scheduled' as const };
      const result = await (window as any).clawdbot?.xCampaign?.save?.(toSave);
      if (!result?.success) {
        showToast('error', result?.error || 'Failed to save');
        return;
      }

      const startDate = new Date(editingCampaign.start_date);
      let scheduled = 0;
      for (const stage of editingCampaign.stages) {
        const stageDate = new Date(startDate);
        stageDate.setDate(stageDate.getDate() + stage.dayOffset);
        const [hours, minutes] = stage.time.split(':').map(Number);
        stageDate.setHours(hours, minutes, 0, 0);
        const timestamp = stageDate.getTime();

        if (timestamp > Date.now()) {
          const schedResult = await window.clawdbot?.xScheduled?.schedule?.(stage.content, timestamp);
          if (schedResult?.success) scheduled++;
        }
      }

      showToast('success', `Campaign scheduled! ${scheduled}/${editingCampaign.stages.length} stages queued`);
      setEditingCampaign(null);
      loadCampaigns();
    } catch (error: any) {
      showToast('error', `Schedule failed: ${error.message}`);
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const result = await (window as any).clawdbot?.xCampaign?.delete?.(id);
      if (result?.success) {
        showToast('success', 'Campaign deleted');
        loadCampaigns();
      }
    } catch {
      showToast('error', 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-clawd-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Campaign editor (both manual and AI-proposed)
  if (editingCampaign) {
    const sortedStages = [...editingCampaign.stages].sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time));

    return (
      <div className="flex flex-col h-full bg-clawd-bg">
        <div className="flex items-center justify-between p-4 border-b border-clawd-border">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-info" />
            <h3 className="text-lg font-semibold text-clawd-text">
              {editingCampaign.status === 'draft' && !campaigns.find(c => c.id === editingCampaign.id) ? 'New Campaign' : 'Edit Campaign'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingCampaign(null)}
              className="px-3 py-2 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveCampaign}
              className="px-4 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
            >
              Save Draft
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="campaign-title" className="block text-sm font-medium text-clawd-text mb-2">Campaign Title</label>
              <input
                id="campaign-title"
                type="text"
                value={editingCampaign.title}
                onChange={e => setEditingCampaign({ ...editingCampaign, title: e.target.value })}
                placeholder="e.g., AI Agents Launch Week"
                className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
              />
            </div>
            <div>
              <label htmlFor="campaign-subject" className="block text-sm font-medium text-clawd-text mb-2">Subject / Theme</label>
              <textarea
                id="campaign-subject"
                value={editingCampaign.subject}
                onChange={e => setEditingCampaign({ ...editingCampaign, subject: e.target.value })}
                placeholder="What is this campaign about? Describe the narrative arc, key messages, and goals..."
                rows={3}
                className="w-full bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info resize-none"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="campaign-start-date" className="block text-sm font-medium text-clawd-text mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  id="campaign-start-date"
                  type="date"
                  value={editingCampaign.start_date || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, start_date: e.target.value })}
                  className="w-full bg-clawd-bg-alt text-clawd-text border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
                />
              </div>
              <div className="flex-1">
                <span className="block text-sm font-medium text-clawd-text mb-2">Total Stages</span>
                <div className="px-4 py-2 bg-clawd-bg-alt border border-clawd-border rounded-lg text-clawd-text">
                  {editingCampaign.stages.length} tweets over {Math.max(...editingCampaign.stages.map(s => s.dayOffset), 0) + 1} days
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-clawd-text">Campaign Timeline</h4>
              <button
                onClick={addStage}
                className="flex items-center gap-1 text-sm text-info hover:text-info/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
            </div>

            <div className="space-y-3">
              {sortedStages.map((stage, idx) => {
                const isExpanded = expandedStages.has(stage.id);
                return (
                  <div key={stage.id} className="bg-clawd-bg-alt border border-clawd-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-clawd-surface transition-colors text-left"
                    >
                      <GripVertical className="w-4 h-4 text-clawd-text-dim flex-shrink-0" />
                      <span className="w-8 h-8 flex items-center justify-center bg-info/20 text-info text-sm font-bold rounded-full flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-clawd-text">Day {stage.dayOffset + 1}</span>
                          <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                            <Clock className="w-3 h-3" />{stage.time}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-info-subtle text-info rounded-full">{stage.type}</span>
                        </div>
                        {!isExpanded && stage.content && (
                          <p className="text-xs text-clawd-text-dim truncate mt-1">{stage.content.slice(0, 80)}...</p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-clawd-text-dim" /> : <ChevronDown className="w-4 h-4 text-clawd-text-dim" />}
                    </button>

                    {isExpanded && (
                      <div className="p-4 pt-0 space-y-3 border-t border-clawd-border">
                        <div className="flex gap-3 pt-3">
                          <div className="w-24">
                            <label htmlFor={`stage-day-${stage.id}`} className="block text-xs text-clawd-text-dim mb-1">Day</label>
                            <input
                              id={`stage-day-${stage.id}`}
                              type="number"
                              min={0}
                              value={stage.dayOffset}
                              onChange={e => updateStage(stage.id, { dayOffset: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full bg-clawd-surface text-clawd-text border border-clawd-border rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="w-28">
                            <label htmlFor={`stage-time-${stage.id}`} className="block text-xs text-clawd-text-dim mb-1">Time</label>
                            <input
                              id={`stage-time-${stage.id}`}
                              type="time"
                              value={stage.time}
                              onChange={e => updateStage(stage.id, { time: e.target.value })}
                              className="w-full bg-clawd-surface text-clawd-text border border-clawd-border rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label htmlFor={`stage-type-${stage.id}`} className="block text-xs text-clawd-text-dim mb-1">Type</label>
                            <select
                              id={`stage-type-${stage.id}`}
                              value={stage.type}
                              onChange={e => updateStage(stage.id, { type: e.target.value as CampaignStage['type'] })}
                              className="w-full bg-clawd-surface text-clawd-text border border-clawd-border rounded px-2 py-1 text-sm"
                            >
                              {STAGE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`stage-content-${stage.id}`} className="block text-xs text-clawd-text-dim mb-1">Tweet Content</label>
                          <textarea
                            id={`stage-content-${stage.id}`}
                            value={stage.content}
                            onChange={e => updateStage(stage.id, { content: e.target.value })}
                            placeholder="Write the tweet content for this stage..."
                            rows={3}
                            className="w-full bg-clawd-surface text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-info"
                          />
                          <div className={`text-xs mt-1 ${stage.content.length > 280 ? 'text-error' : 'text-clawd-text-dim'}`}>
                            {stage.content.length}/280
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`stage-notes-${stage.id}`} className="block text-xs text-clawd-text-dim mb-1">Notes (internal)</label>
                          <input
                            id={`stage-notes-${stage.id}`}
                            type="text"
                            value={stage.notes}
                            onChange={e => updateStage(stage.id, { notes: e.target.value })}
                            placeholder="e.g., Hook tweet, builds curiosity..."
                            className="w-full bg-clawd-surface text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded px-3 py-1.5 text-sm"
                          />
                        </div>

                        {editingCampaign.stages.length > 1 && (
                          <button
                            onClick={() => removeStage(stage.id)}
                            className="flex items-center gap-1 text-xs text-error hover:text-error/80 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove stage
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-clawd-border flex gap-3">
          <button
            onClick={saveCampaign}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-clawd-bg-alt hover:bg-clawd-surface text-clawd-text font-medium rounded-lg border border-clawd-border transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={scheduleCampaign}
            disabled={!editingCampaign.start_date}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-info hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed text-clawd-text font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            Schedule Campaign
          </button>
        </div>
      </div>
    );
  }

  // Campaign list + AI proposal banner
  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-clawd-text">Campaigns</h3>
        </div>
        <button
          onClick={createNewCampaign}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Manual
        </button>
      </div>

      {/* AI Proposal Banner */}
      {aiProposal && (
        <div className="mx-4 mt-4 p-4 bg-clawd-accent/10 border-2 border-clawd-accent/40 rounded-xl animate-in fade-in">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-clawd-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-clawd-text mb-1">Agent Proposed a Campaign</h4>
              <p className="text-sm font-medium text-clawd-text">{aiProposal.title}</p>
              {aiProposal.subject && (
                <p className="text-xs text-clawd-text-dim mt-1 line-clamp-2">{aiProposal.subject}</p>
              )}
              <p className="text-xs text-clawd-text-dim mt-1">
                {aiProposal.stages.length} stages over {Math.max(...aiProposal.stages.map(s => s.dayOffset), 0) + 1} days
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={acceptProposal}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-clawd-accent hover:bg-clawd-accent/80 text-white font-medium rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Review & Edit
                </button>
                <button
                  onClick={dismissProposal}
                  className="px-4 py-2 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversational hint when empty */}
      {campaigns.length === 0 && !aiProposal ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-clawd-text-dim max-w-sm">
            <Rocket className="w-12 h-12 mx-auto mb-3 text-clawd-text-dim" />
            <p className="font-medium text-clawd-text">No campaigns yet</p>
            <p className="text-sm mt-2">Build campaigns two ways:</p>
            <div className="mt-4 space-y-3">
              <button
                onClick={createNewCampaign}
                className="w-full px-4 py-3 text-sm bg-clawd-bg-alt hover:bg-clawd-surface text-clawd-text rounded-lg border border-clawd-border transition-colors flex items-center gap-3"
              >
                <Plus className="w-5 h-5 text-info" />
                <div className="text-left">
                  <span className="font-medium block">Manual</span>
                  <span className="text-xs text-clawd-text-dim">Build stages yourself</span>
                </div>
              </button>
              <div className="w-full px-4 py-3 text-sm bg-clawd-accent/10 text-clawd-text rounded-lg border border-clawd-accent/30 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-clawd-accent" />
                <div className="text-left">
                  <span className="font-medium block">AI-Assisted</span>
                  <span className="text-xs text-clawd-text-dim">Chat with the agent on the left to generate a campaign</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : campaigns.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {campaigns.map(campaign => {
            const stageCount = campaign.stages?.length || 0;
            const daySpan = campaign.stages ? Math.max(...campaign.stages.map((s: any) => s.dayOffset || 0), 0) + 1 : 0;
            const statusColors: Record<string, string> = {
              draft: 'bg-clawd-bg-alt text-clawd-text-dim',
              ready: 'bg-warning-subtle text-warning',
              scheduled: 'bg-info-subtle text-info',
              active: 'bg-success-subtle text-success',
              completed: 'bg-clawd-bg-alt text-clawd-text-dim',
            };
            return (
              <div
                key={campaign.id}
                role="button"
                tabIndex={0}
                className="bg-clawd-bg-alt border border-clawd-border rounded-lg p-4 hover:border-info/50 transition-colors cursor-pointer"
                onClick={() => { setEditingCampaign(campaign); setExpandedStages(new Set()); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setEditingCampaign(campaign); setExpandedStages(new Set()); } }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-clawd-text">{campaign.title || 'Untitled Campaign'}</h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[campaign.status] || statusColors.draft}`}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.subject && (
                  <p className="text-xs text-clawd-text-dim mb-2 line-clamp-2">{campaign.subject}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
                  <span>{stageCount} stage{stageCount !== 1 ? 's' : ''}</span>
                  <span>{daySpan} day{daySpan !== 1 ? 's' : ''}</span>
                  <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                    className="ml-auto text-error hover:text-error/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
