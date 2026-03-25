import { useState, useEffect, useCallback } from 'react';
import { Rocket, Plus, Trash2, Calendar, Clock, ChevronDown, ChevronUp, GripVertical, Send, MessageSquare, Sparkles } from 'lucide-react';
import { Button, IconButton, Badge, Spinner, TextField, TextArea, Select, Flex } from '@radix-ui/themes';
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

function countChars(text: string): number {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  let count = text.length;
  for (const url of urls) count = count - url.length + 23;
  return count;
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
      const res = await fetch('/api/x/campaigns');
      if (!res.ok) throw new Error(`Campaigns API error: ${res.status}`);
      const data = await res.json();
      const raw = data.campaigns || [];
      setCampaigns(raw.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        title: c.title as string || '',
        subject: c.subject as string || '',
        stages: hydrateStages(Array.isArray(c.stages) ? c.stages : []),
        status: (c.status as Campaign['status']) || 'draft',
        created_at: c.created_at as number || Date.now(),
        start_date: c.start_date as string | undefined,
      })));
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
      const res = await fetch('/api/x/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCampaign.id,
          title: editingCampaign.title,
          subject: editingCampaign.subject,
          status: editingCampaign.status,
          start_date: editingCampaign.start_date || null,
          stages: editingCampaign.stages,
          proposed_by: 'user',
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      showToast('success', 'Campaign saved');
      setEditingCampaign(null);
      loadCampaigns();
    } catch (error: unknown) {
      showToast('error', `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const scheduleCampaign = async () => {
    if (!editingCampaign || !editingCampaign.start_date) {
      showToast('error', 'Set a start date first');
      return;
    }
    try {
      // Save campaign with scheduled status
      const campaignRes = await fetch('/api/x/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCampaign.id,
          title: editingCampaign.title,
          subject: editingCampaign.subject,
          status: 'scheduled',
          start_date: editingCampaign.start_date,
          stages: editingCampaign.stages,
          proposed_by: 'user',
        }),
      });
      if (!campaignRes.ok) throw new Error(`Campaign save failed: ${campaignRes.status}`);

      // Create individual x_posts for each stage (with auto-approval)
      const startDate = new Date(editingCampaign.start_date);
      let scheduled = 0;
      for (const stage of editingCampaign.stages) {
        const stageDate = new Date(startDate);
        stageDate.setDate(stageDate.getDate() + stage.dayOffset);
        const [hours, minutes] = stage.time.split(':').map(Number);
        stageDate.setHours(hours, minutes, 0, 0);
        const timestamp = stageDate.getTime();

        if (timestamp > Date.now()) {
          await fetch('/api/x/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: stage.type || 'tweet',
              content: stage.content,
              status: 'scheduled',
              scheduled_for: timestamp,
              campaign_id: editingCampaign.id,
              proposed_by: 'user',
              metadata: { stageId: stage.id, dayOffset: stage.dayOffset },
            }),
          });
          scheduled++;
        }
      }

      showToast('success', `Campaign scheduled! ${scheduled}/${editingCampaign.stages.length} stages queued`);
      setEditingCampaign(null);
      loadCampaigns();
    } catch (error: unknown) {
      showToast('error', `Schedule failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/x/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      showToast('success', 'Campaign deleted');
      loadCampaigns();
    } catch (error: unknown) {
      showToast('error', `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <Spinner size="3" />
      </div>
    );
  }

  // Campaign editor (both manual and AI-proposed)
  if (editingCampaign) {
    const sortedStages = [...editingCampaign.stages].sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time));

    return (
      <div className="flex flex-col h-full bg-mission-control-bg">
        <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
          <Flex align="center" gap="2">
            <Rocket className="w-5 h-5 text-info" />
            <h3 className="text-lg font-semibold text-mission-control-text">
              {editingCampaign.status === 'draft' && !campaigns.find(c => c.id === editingCampaign.id) ? 'New Campaign' : 'Edit Campaign'}
            </h3>
          </Flex>
          <Flex align="center" gap="2">
            <Button onClick={() => setEditingCampaign(null)} variant="ghost" color="gray" size="2">Cancel</Button>
            <Button onClick={saveCampaign} variant="solid" color="blue" size="2">Save Draft</Button>
          </Flex>
        </Flex>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="campaign-title" className="block text-sm font-medium text-mission-control-text mb-2">Campaign Title</label>
              <TextField.Root
                id="campaign-title"
                value={editingCampaign.title}
                onChange={e => setEditingCampaign({ ...editingCampaign, title: e.target.value })}
                placeholder="e.g., AI Agents Launch Week"
                size="2"
              />
            </div>
            <div>
              <label htmlFor="campaign-subject" className="block text-sm font-medium text-mission-control-text mb-2">Subject / Theme</label>
              <TextArea
                id="campaign-subject"
                value={editingCampaign.subject}
                onChange={e => setEditingCampaign({ ...editingCampaign, subject: e.target.value })}
                placeholder="What is this campaign about? Describe the narrative arc, key messages, and goals..."
                rows={3}
                size="2"
              />
            </div>
            <Flex gap="4">
              <div className="flex-1">
                <label htmlFor="campaign-start-date" className="block text-sm font-medium text-mission-control-text mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <TextField.Root
                  id="campaign-start-date"
                  type="date"
                  value={editingCampaign.start_date || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, start_date: e.target.value })}
                  size="2"
                />
              </div>
              <div className="flex-1">
                <span className="block text-sm font-medium text-mission-control-text mb-2">Total Stages</span>
                <div className="px-4 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-mission-control-text">
                  {editingCampaign.stages.length} tweets over {Math.max(...editingCampaign.stages.map(s => s.dayOffset), 0) + 1} days
                </div>
              </div>
            </Flex>
          </div>

          <div>
            <Flex align="center" justify="between" className="mb-3">
              <h4 className="text-sm font-semibold text-mission-control-text">Campaign Timeline</h4>
              <Button
                onClick={addStage}
                variant="ghost"
                size="2"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </Button>
            </Flex>

            <div className="space-y-3">
              {sortedStages.map((stage, idx) => {
                const isExpanded = expandedStages.has(stage.id);
                return (
                  <div key={stage.id} className="bg-mission-control-bg-alt border border-mission-control-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-mission-control-surface transition-colors text-left"
                      type="button"
                    >
                      <GripVertical className="w-4 h-4 text-mission-control-text-dim flex-shrink-0" />
                      <span className="w-8 h-8 flex items-center justify-center bg-info/20 text-info text-sm font-bold rounded-full flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Flex align="center" gap="2">
                          <span className="text-sm font-medium text-mission-control-text">Day {stage.dayOffset + 1}</span>
                          <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                            <Clock className="w-3 h-3" />{stage.time}
                          </span>
                          <Badge color="blue" variant="soft" radius="full">{stage.type}</Badge>
                        </Flex>
                        {!isExpanded && stage.content && (
                          <p className="text-xs text-mission-control-text-dim truncate mt-1">{stage.content.slice(0, 80)}...</p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-mission-control-text-dim" /> : <ChevronDown className="w-4 h-4 text-mission-control-text-dim" />}
                    </button>

                    {isExpanded && (
                      <div className="p-4 pt-0 space-y-3 border-t border-mission-control-border">
                        <Flex gap="3" className="pt-3">
                          <div className="w-24">
                            <label htmlFor={`stage-day-${stage.id}`} className="block text-xs text-mission-control-text-dim mb-1">Day</label>
                            <TextField.Root
                              id={`stage-day-${stage.id}`}
                              type="number"
                              min={0}
                              value={stage.dayOffset}
                              onChange={e => updateStage(stage.id, { dayOffset: Math.max(0, parseInt(e.target.value) || 0) })}
                              size="2"
                            />
                          </div>
                          <div className="w-28">
                            <label htmlFor={`stage-time-${stage.id}`} className="block text-xs text-mission-control-text-dim mb-1">Time</label>
                            <TextField.Root
                              id={`stage-time-${stage.id}`}
                              type="time"
                              value={stage.time}
                              onChange={e => updateStage(stage.id, { time: e.target.value })}
                              size="2"
                            />
                          </div>
                          <div className="flex-1">
                            <label htmlFor={`stage-type-${stage.id}`} className="block text-xs text-mission-control-text-dim mb-1">Type</label>
                            <Select.Root
                              value={stage.type}
                              onValueChange={val => updateStage(stage.id, { type: val as CampaignStage['type'] })}
                              size="2"
                            >
                              <Select.Trigger className="w-full" />
                              <Select.Content>
                                {STAGE_TYPES.map(t => (
                                  <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Root>
                          </div>
                        </Flex>

                        <div>
                          <label htmlFor={`stage-content-${stage.id}`} className="block text-xs text-mission-control-text-dim mb-1">Tweet Content</label>
                          <TextArea
                            id={`stage-content-${stage.id}`}
                            value={stage.content}
                            onChange={e => updateStage(stage.id, { content: e.target.value })}
                            placeholder="Write the tweet content for this stage..."
                            rows={3}
                            size="2"
                          />
                          <div className={`text-xs mt-1 ${countChars(stage.content) > 280 ? 'text-error' : 'text-mission-control-text-dim'}`}>
                            <span className="tabular-nums">{countChars(stage.content)}/280</span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`stage-notes-${stage.id}`} className="block text-xs text-mission-control-text-dim mb-1">Notes (internal)</label>
                          <TextField.Root
                            id={`stage-notes-${stage.id}`}
                            value={stage.notes}
                            onChange={e => updateStage(stage.id, { notes: e.target.value })}
                            placeholder="e.g., Hook tweet, builds curiosity..."
                            size="2"
                          />
                        </div>

                        {editingCampaign.stages.length > 1 && (
                          <Button
                            onClick={() => removeStage(stage.id)}
                            variant="ghost"
                            color="red"
                            size="1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove stage
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Flex gap="3" className="p-4 border-t border-mission-control-border">
          <Button onClick={saveCampaign} variant="soft" color="gray" size="3" className="flex-1">Save Draft</Button>
          <Button onClick={scheduleCampaign} disabled={!editingCampaign.start_date} variant="solid" color="grass" size="3" className="flex-1">
            <Send className="w-4 h-4" />
            Schedule Campaign
          </Button>
        </Flex>
      </div>
    );
  }

  // Campaign list + AI proposal banner
  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <Rocket className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-mission-control-text">Campaigns</h3>
        </Flex>
        <Button onClick={createNewCampaign} variant="solid" color="blue" size="2">
          <Plus className="w-4 h-4" />
          Manual
        </Button>
      </Flex>

      {/* AI Proposal Banner */}
      {aiProposal && (
        <div className="mx-4 mt-4 p-4 bg-mission-control-accent/10 border-2 border-mission-control-accent/40 rounded-lg animate-in fade-in">
          <Flex align="start" gap="3">
            <Sparkles className="w-5 h-5 text-mission-control-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-mission-control-text mb-1">Agent Proposed a Campaign</h4>
              <p className="text-sm font-medium text-mission-control-text">{aiProposal.title}</p>
              {aiProposal.subject && (
                <p className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">{aiProposal.subject}</p>
              )}
              <p className="text-xs text-mission-control-text-dim mt-1">
                {aiProposal.stages.length} stages over {Math.max(...aiProposal.stages.map(s => s.dayOffset), 0) + 1} days
              </p>
              <Flex gap="2" className="mt-3">
                <Button onClick={acceptProposal} variant="solid" color="grass" size="2">
                  <Sparkles className="w-4 h-4" />
                  Review &amp; Edit
                </Button>
                <Button
                  onClick={dismissProposal}
                  variant="ghost"
                  color="gray"
                  size="2"
                >
                  Dismiss
                </Button>
              </Flex>
            </div>
          </Flex>
        </div>
      )}

      {/* Conversational hint when empty */}
      {campaigns.length === 0 && !aiProposal ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mission-control-text-dim max-w-sm">
            <Rocket className="w-12 h-12 mx-auto mb-3 text-mission-control-text-dim" />
            <p className="font-medium text-mission-control-text">No campaigns yet</p>
            <p className="text-sm mt-2">Build campaigns two ways:</p>
            <div className="mt-4 space-y-3">
              <Button
                onClick={createNewCampaign}
                variant="ghost"
                size="3"
                className="w-full flex items-center gap-3 justify-start"
              >
                <Plus className="w-5 h-5" />
                <div className="text-left">
                  <span className="font-medium block">Manual</span>
                  <span className="text-xs opacity-70">Build stages yourself</span>
                </div>
              </Button>
              <div className="w-full px-4 py-3 text-sm bg-mission-control-accent/10 text-mission-control-text rounded-lg border border-mission-control-accent/30 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-mission-control-accent" />
                <div className="text-left">
                  <span className="font-medium block">AI-Assisted</span>
                  <span className="text-xs text-mission-control-text-dim">Chat with the agent on the left to generate a campaign</span>
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
              draft: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mission-control-border text-mission-control-text-dim text-xs font-medium',
              ready: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-subtle text-warning text-xs font-medium',
              scheduled: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-info-subtle text-info text-xs font-medium',
              active: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-subtle text-success text-xs font-medium',
              completed: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mission-control-border text-mission-control-text-dim text-xs font-medium',
            };
            return (
              <div
                key={campaign.id}
                role="button"
                tabIndex={0}
                className="bg-mission-control-bg-alt border border-mission-control-border rounded-lg p-4 hover:border-info/50 transition-colors cursor-pointer"
                onClick={() => { setEditingCampaign(campaign); setExpandedStages(new Set()); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setEditingCampaign(campaign); setExpandedStages(new Set()); } }}
              >
                <Flex align="start" justify="between" className="mb-2">
                  <h4 className="text-sm font-bold text-mission-control-text">{campaign.title || 'Untitled Campaign'}</h4>
                  <span className={statusColors[campaign.status] || statusColors.draft}>
                    {campaign.status}
                  </span>
                </Flex>
                {campaign.subject && (
                  <p className="text-xs text-mission-control-text-dim mb-2 line-clamp-2">{campaign.subject}</p>
                )}
                <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim tabular-nums">
                  <span>{stageCount} stage{stageCount !== 1 ? 's' : ''}</span>
                  <span>{daySpan} day{daySpan !== 1 ? 's' : ''}</span>
                  <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                  <IconButton
                    onClick={e => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                    aria-label="Delete campaign"
                    variant="ghost"
                    color="red"
                    size="1"
                    className="ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconButton>
                </Flex>
              </div>
            );
          })}
        </div>
      ) : null}
    </Flex>
  );
}
