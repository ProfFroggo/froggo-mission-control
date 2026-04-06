import { useState, useEffect } from 'react';
import { Button, IconButton, TextField, Select, TextArea, Flex } from '@radix-ui/themes';
import {
  Plus, Settings, Play, Pause, Trash2, Edit,
  AlertCircle, CheckCircle, Clock, Zap,
  MessageCircle, Hash, Calendar as CalendarIcon, Users, Mail
} from 'lucide-react';
import { showToast } from './Toast';
import { settingsApi } from '../lib/api';

// Automation types
export interface XAutomationTrigger {
  type: 'mention' | 'keyword' | 'time' | 'follower' | 'dm';
  config: {
    keywords?: string[];
    interval?: string; // e.g., "1h", "24h"
    users?: string[];
    action?: 'follow' | 'unfollow';
  };
}

export interface XAutomationCondition {
  field: string;
  operator: '>' | '<' | '=' | '!=' | 'contains' | 'not_contains';
  value: string | number;
}

export interface XAutomationAction {
  id?: string;
  type: 'reply' | 'like' | 'retweet' | 'dm' | 'add_to_list';
  config: {
    template?: string;
    listId?: string;
  };
}

export interface XAutomation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: string; // JSON
  conditions?: string; // JSON
  actions: string; // JSON
  max_executions_per_hour: number;
  max_executions_per_day: number;
  total_executions: number;
  last_executed_at?: number;
  created_at: number;
  updated_at: number;
}

export interface XAutomationExecution {
  id: string;
  automation_id: string;
  trigger_data: string; // JSON
  actions_executed: string; // JSON
  status: 'success' | 'partial' | 'failed';
  error_message?: string;
  executed_at: number;
}

const TRIGGER_ICONS = {
  mention: MessageCircle,
  keyword: Hash,
  time: CalendarIcon,
  follower: Users,
  dm: Mail,
};

export default function XAutomationsPanel() {
  const [automations, setAutomations] = useState<XAutomation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<XAutomation | null>(null);
  
  useEffect(() => {
    loadAutomations();
  }, []);
  
  const loadAutomations = async () => {
    setLoading(true);
    try {
      const result = await settingsApi.get('xAutomations') as any;
      if (result?.success && result.automations) {
        setAutomations(result.automations);
      }
    } catch (e) {
      // 'Failed to load automations:', e;
    } finally {
      setLoading(false);
    }
  };
  
  const toggleAutomation = async (id: string, enabled: boolean) => {
    try {
      await settingsApi.set('xAutomationToggle', { id, enabled });
      {
        loadAutomations();
      }
    } catch (e) {
      // 'Failed to toggle automation:', e;
    }
  };
  
  const deleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    
    try {
      await settingsApi.set('xAutomationDelete', { id });
      {
        loadAutomations();
      }
    } catch (e) {
      // 'Failed to delete automation:', e;
    }
  };
  
  const parseJSON = (json: string) => {
    try {
      return JSON.parse(json);
    } catch (err) {
      console.warn('[XAutomationsPanel] Non-critical:', err);
      return {};
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" justify="between" className="mb-3">
          <Flex align="center" gap="3">
            <div className="p-2 bg-review-subtle rounded-lg">
              <Zap size={24} className="text-review" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">X Automations</h1>
              <p className="text-sm text-mission-control-text-dim">
                {automations.length} automation{automations.length !== 1 ? 's' : ''} • 
                {automations.filter(a => a.enabled).length} active
              </p>
            </div>
          </Flex>
          <Button
            onClick={() => {
              setEditingAutomation(null);
              setShowBuilder(true);
            }}
            size="2"
            variant="solid"
          >
            <Plus size={16} />
            New Automation
          </Button>
        </Flex>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-mission-control-text-dim">
            <Settings size={48} className="mx-auto mb-4 opacity-30 animate-spin" />
            <p>Loading automations...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="text-center py-12 text-mission-control-text-dim">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p className="mb-2">No automations yet</p>
            <p className="text-sm mb-4">
              Create IFTTT-style automations to automatically engage with your audience
            </p>
            <Button
              onClick={() => setShowBuilder(true)}
              size="2"
              variant="solid"
            >
              Create Your First Automation
            </Button>
          </div>
        ) : (
          <div className="w-full flex gap-4 overflow-x-auto pb-4">
            {automations.map((automation) => {
              const trigger = parseJSON(automation.trigger_config);
              const actions = parseJSON(automation.actions);
              const TriggerIcon = TRIGGER_ICONS[automation.trigger_type as keyof typeof TRIGGER_ICONS];
              
              return (
                <div
                  key={automation.id}
                  className="flex-shrink-0 w-96 bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/30 transition-colors"
                >
                  {/* Header: name + status + actions */}
                  <Flex align="start" justify="between" className="mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-mission-control-text truncate">
                          {automation.name}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          automation.enabled
                            ? 'bg-success/10 text-success'
                            : 'bg-mission-control-border/50 text-mission-control-text-dim'
                        }`}>
                          {automation.enabled ? 'Active' : 'Paused'}
                        </span>
                        {TriggerIcon && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-info/10 text-info">
                            <TriggerIcon size={10} />
                            {automation.trigger_type}
                          </span>
                        )}
                      </div>
                      {automation.description && (
                        <p className="text-xs text-mission-control-text-dim line-clamp-2">
                          {automation.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <Flex align="center" gap="1" className="ml-2 flex-shrink-0">
                      <IconButton
                        onClick={() => toggleAutomation(automation.id, !automation.enabled)}
                        size="1"
                        variant="ghost"
                        color={automation.enabled ? 'orange' : 'green'}
                        title={automation.enabled ? 'Pause' : 'Activate'}
                      >
                        {automation.enabled ? <Pause size={14} /> : <Play size={14} />}
                      </IconButton>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAutomation(automation);
                          setShowBuilder(true);
                        }}
                        title="Edit"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAutomation(automation.id)}
                        title="Delete"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-danger hover:bg-mission-control-border/40 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Flex>
                  </Flex>

                  {/* Automation Flow */}
                  <div className="flex items-center gap-2 text-xs mb-3 px-3 py-2 bg-mission-control-bg rounded-lg flex-wrap">
                    <span className="text-mission-control-text-dim font-medium">IF</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-info/10 text-info">
                      {automation.trigger_type}
                    </span>
                    {trigger.keywords && (
                      <span className="text-mission-control-text-dim truncate max-w-[120px]">
                        {'"' + trigger.keywords.join(', ') + '"'}
                      </span>
                    )}
                    <span className="text-mission-control-text-dim">→</span>
                    <span className="text-mission-control-text-dim font-medium">THEN</span>
                    <div className="flex gap-1 flex-wrap">
                      {Array.isArray(actions) && actions.map((action: XAutomationAction, i: number) => (
                        <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                          {action.type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-mission-control-text-dim tabular-nums">
                      <CheckCircle size={11} />
                      {automation.total_executions} runs
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-mission-control-text-dim tabular-nums">
                      <Clock size={11} />
                      {automation.max_executions_per_hour}/hr
                    </span>
                    {automation.last_executed_at && (
                      <span className="text-[10px] text-mission-control-text-dim tabular-nums">
                        Last: {new Date(automation.last_executed_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Automation Builder Modal */}
      {showBuilder && (
        <AutomationBuilder
          automation={editingAutomation}
          onClose={() => {
            setShowBuilder(false);
            setEditingAutomation(null);
          }}
          onSave={() => {
            setShowBuilder(false);
            setEditingAutomation(null);
            loadAutomations();
          }}
        />
      )}
    </div>
  );
}

// Automation Builder Component
interface AutomationBuilderProps {
  automation: XAutomation | null;
  onClose: () => void;
  onSave: () => void;
}

function AutomationBuilder({ automation, onClose, onSave }: AutomationBuilderProps) {
  const [name, setName] = useState(automation?.name || '');
  const [description, setDescription] = useState(automation?.description || '');
  const [triggerType, setTriggerType] = useState<'mention' | 'keyword' | 'time' | 'follower' | 'dm'>(
    (automation?.trigger_type as any) || 'mention'
  );
  const [triggerConfig, setTriggerConfig] = useState(() => {
    try {
      return automation?.trigger_config ? JSON.parse(automation.trigger_config) : {};
    } catch (err) {
      console.warn('[XAutomationsPanel] Non-critical:', err);
      return {};
    }
  });
  const [actions, setActions] = useState<XAutomationAction[]>(() => {
    try {
      return automation?.actions ? JSON.parse(automation.actions) : [];
    } catch (err) {
      console.warn('[XAutomationsPanel] Non-critical:', err);
      return [];
    }
  });
  const [maxPerHour, setMaxPerHour] = useState(automation?.max_executions_per_hour || 10);
  const [maxPerDay, setMaxPerDay] = useState(automation?.max_executions_per_day || 50);
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter a name for this automation', 'warning');
      return;
    }
    
    if (actions.length === 0) {
      showToast('Please add at least one action', 'warning');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        id: automation?.id,
        name,
        description,
        trigger_type: triggerType,
        trigger_config: JSON.stringify(triggerConfig),
        actions: JSON.stringify(actions),
        max_executions_per_hour: maxPerHour,
        max_executions_per_day: maxPerDay,
      };
      
      const result = await settingsApi.set('xAutomation', { ...(automation ? { id: automation.id } : {}), ...payload }) as any;
      if (result) {
        onSave();
      } else {
        showToast(`Failed to save: ${result?.error || 'Unknown error'}`, 'error');
      }
    } catch (e: unknown) {
      showToast(`Failed to save: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Flex align="center" justify="center" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border">
          <h2 className="text-xl font-semibold mb-2">
            {automation ? 'Edit Automation' : 'Create Automation'}
          </h2>
          <p className="text-sm text-mission-control-text-dim">
            Build an IFTTT-style automation to automate X engagement
          </p>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label htmlFor="automation-name" className="block text-sm font-medium mb-2">Name</label>
            <TextField.Root
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-thank new followers"
              size="2"
            />
          </div>

          <div>
            <label htmlFor="automation-description" className="block text-sm font-medium mb-2">Description (optional)</label>
            <TextArea
              id="automation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this automation do?"
              rows={2}
              resize="none"
              size="2"
            />
          </div>
          
          {/* Trigger Section */}
          <div className="border-t border-mission-control-border pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-info/10 text-info rounded-lg text-sm">IF</span>
              Trigger
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="automation-trigger" className="block text-sm font-medium mb-2">When this happens...</label>
                <Select.Root value={triggerType} onValueChange={(v) => setTriggerType(v as any)}>
                  <Select.Trigger id="automation-trigger" className="w-full" />
                  <Select.Content>
                    <Select.Item value="mention">Someone mentions me</Select.Item>
                    <Select.Item value="keyword">Tweet contains keywords</Select.Item>
                    <Select.Item value="time">At a specific time/interval</Select.Item>
                    <Select.Item value="follower">Someone follows/unfollows me</Select.Item>
                    <Select.Item value="dm">I receive a DM</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>

              {/* Trigger-specific config */}
              {triggerType === 'keyword' && (
                <div>
                  <label htmlFor="automation-keywords" className="block text-sm font-medium mb-2">Keywords (comma-separated)</label>
                  <TextField.Root
                    id="automation-keywords"
                    value={triggerConfig.keywords?.join(', ') || ''}
                    onChange={(e) => setTriggerConfig({
                      ...triggerConfig,
                      keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean)
                    })}
                    placeholder="bitcoin, crypto, web3"
                    size="2"
                  />
                </div>
              )}

              {triggerType === 'time' && (
                <div>
                  <label htmlFor="automation-interval" className="block text-sm font-medium mb-2">Interval</label>
                  <Select.Root value={triggerConfig.interval || '1h'} onValueChange={(v) => setTriggerConfig({ ...triggerConfig, interval: v })}>
                    <Select.Trigger id="automation-interval" className="w-full" />
                    <Select.Content>
                      <Select.Item value="15m">Every 15 minutes</Select.Item>
                      <Select.Item value="30m">Every 30 minutes</Select.Item>
                      <Select.Item value="1h">Every hour</Select.Item>
                      <Select.Item value="6h">Every 6 hours</Select.Item>
                      <Select.Item value="12h">Every 12 hours</Select.Item>
                      <Select.Item value="24h">Every 24 hours</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              )}

              {triggerType === 'follower' && (
                <div>
                  <label htmlFor="automation-follower-action" className="block text-sm font-medium mb-2">Action</label>
                  <Select.Root value={triggerConfig.action || 'follow'} onValueChange={(v) => setTriggerConfig({ ...triggerConfig, action: v })}>
                    <Select.Trigger id="automation-follower-action" className="w-full" />
                    <Select.Content>
                      <Select.Item value="follow">New follower</Select.Item>
                      <Select.Item value="unfollow">Lost follower</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="border-t border-mission-control-border pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-success/10 text-success rounded-lg text-sm">THEN</span>
              Actions
            </h3>
            
            <div className="space-y-3 mb-4">
              {actions.map((action, index) => (
                <div key={action.id || `action-${index}`} className="bg-mission-control-bg border border-mission-control-border rounded-xl p-4">
                  <Flex align="start" gap="3">
                    <div className="flex-1 space-y-3">
                      <Select.Root
                        value={action.type}
                        onValueChange={(v) => {
                          const newActions = [...actions];
                          newActions[index] = { ...action, type: v as any };
                          setActions(newActions);
                        }}
                      >
                        <Select.Trigger className="w-full" />
                        <Select.Content>
                          <Select.Item value="reply">Reply to tweet</Select.Item>
                          <Select.Item value="like">Like tweet</Select.Item>
                          <Select.Item value="retweet">Retweet</Select.Item>
                          <Select.Item value="dm">Send DM</Select.Item>
                          <Select.Item value="add_to_list">Add user to list</Select.Item>
                        </Select.Content>
                      </Select.Root>

                      {(action.type === 'reply' || action.type === 'dm') && (
                        <TextArea
                          value={action.config.template || ''}
                          onChange={(e) => {
                            const newActions = [...actions];
                            newActions[index] = {
                              ...action,
                              config: { ...action.config, template: e.target.value }
                            };
                            setActions(newActions);
                          }}
                          placeholder="Message template... Use {{username}}, {{tweet}}, etc."
                          rows={3}
                          resize="none"
                          size="2"
                        />
                      )}

                      {action.type === 'add_to_list' && (
                        <TextField.Root
                          value={action.config.listId || ''}
                          onChange={(e) => {
                            const newActions = [...actions];
                            newActions[index] = {
                              ...action,
                              config: { ...action.config, listId: e.target.value }
                            };
                            setActions(newActions);
                          }}
                          placeholder="List ID or name"
                          size="2"
                        />
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setActions(actions.filter((_, i) => i !== index))}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Flex>
                </div>
              ))}
            </div>
            
            <Button
              onClick={() => setActions([...actions, { type: 'reply', config: {} }])}
              size="2"
              variant="soft"
            >
              <Plus size={14} />
              Add Action
            </Button>
          </div>
          
          {/* Rate Limits */}
          <div className="border-t border-mission-control-border pt-6">
            <h3 className="text-lg font-semibold mb-4">Rate Limits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="automation-max-per-hour" className="block text-sm font-medium mb-2">Max per hour</label>
                <TextField.Root
                  id="automation-max-per-hour"
                  type="number"
                  value={String(maxPerHour)}
                  onChange={(e) => setMaxPerHour(parseInt(e.target.value) || 0)}
                  min="1"
                  max="100"
                  size="2"
                />
              </div>

              <div>
                <label htmlFor="automation-max-per-day" className="block text-sm font-medium mb-2">Max per day</label>
                <TextField.Root
                  id="automation-max-per-day"
                  type="number"
                  value={String(maxPerDay)}
                  onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 0)}
                  min="1"
                  max="1000"
                  size="2"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <Flex align="center" justify="between" className="p-6 border-t border-mission-control-border">
          <p className="text-sm text-mission-control-text-dim">
            <AlertCircle size={14} className="inline mr-1" />
            Automations run in the background. Be mindful of X&apos;s rate limits.
          </p>

          <Flex gap="3">
            <Button
              onClick={onClose}
              size="2"
              variant="soft"
              color="gray"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || actions.length === 0}
              size="2"
              variant="solid"
            >
              {saving ? 'Saving...' : automation ? 'Update' : 'Create'}
            </Button>
          </Flex>
        </Flex>
      </div>
    </Flex>
  );
}
