import { useState, useEffect } from 'react';
import { 
  Plus, Settings, Play, Pause, Trash2, Edit, 
  AlertCircle, CheckCircle, Clock, Zap, 
  MessageCircle, Hash, Calendar as CalendarIcon, Users, Mail
} from 'lucide-react';

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
      const result = await (window as any).clawdbot?.xAutomations?.list();
      if (result?.success && result.automations) {
        setAutomations(result.automations);
      }
    } catch (e) {
      console.error('Failed to load automations:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleAutomation = async (id: string, enabled: boolean) => {
    try {
      const result = await (window as any).clawdbot?.xAutomations?.toggle(id, enabled);
      if (result?.success) {
        loadAutomations();
      }
    } catch (e) {
      console.error('Failed to toggle automation:', e);
    }
  };
  
  const deleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    
    try {
      const result = await (window as any).clawdbot?.xAutomations?.delete(id);
      if (result?.success) {
        loadAutomations();
      }
    } catch (e) {
      console.error('Failed to delete automation:', e);
    }
  };
  
  const parseJSON = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <Zap size={24} className="text-review" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">X Automations</h1>
              <p className="text-sm text-clawd-text-dim">
                {automations.length} automation{automations.length !== 1 ? 's' : ''} • 
                {automations.filter(a => a.enabled).length} active
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingAutomation(null);
              setShowBuilder(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/80 transition-colors"
          >
            <Plus size={16} />
            New Automation
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-clawd-text-dim">
            <Settings size={48} className="mx-auto mb-4 opacity-30 animate-spin" />
            <p>Loading automations...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="text-center py-12 text-clawd-text-dim">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p className="mb-2">No automations yet</p>
            <p className="text-sm mb-4">
              Create IFTTT-style automations to automatically engage with your audience
            </p>
            <button
              onClick={() => setShowBuilder(true)}
              className="px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/80 transition-colors"
            >
              Create Your First Automation
            </button>
          </div>
        ) : (
          <div className="max-w-8xl mx-auto space-y-4">
            {automations.map((automation) => {
              const trigger = parseJSON(automation.trigger_config);
              const actions = parseJSON(automation.actions);
              const TriggerIcon = TRIGGER_ICONS[automation.trigger_type as keyof typeof TRIGGER_ICONS];
              
              return (
                <div
                  key={automation.id}
                  className={`bg-clawd-surface rounded-xl border-2 transition-all ${
                    automation.enabled 
                      ? 'border-success-border hover:border-green-500/50' 
                      : 'border-clawd-border hover:border-clawd-border/80'
                  }`}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${automation.enabled ? 'bg-green-500/20' : 'bg-clawd-border'}`}>
                          {TriggerIcon && <TriggerIcon size={20} className={automation.enabled ? 'text-success' : 'text-clawd-text-dim'} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{automation.name}</h3>
                            {automation.enabled && (
                              <span className="px-2 py-0.5 text-xs bg-success-subtle text-success rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          {automation.description && (
                            <p className="text-sm text-clawd-text-dim">{automation.description}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleAutomation(automation.id, !automation.enabled)}
                          className={`p-2 rounded-lg transition-colors ${
                            automation.enabled 
                              ? 'bg-warning-subtle text-warning hover:bg-yellow-500/30' 
                              : 'bg-success-subtle text-success hover:bg-green-500/30'
                          }`}
                          title={automation.enabled ? 'Pause' : 'Activate'}
                        >
                          {automation.enabled ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAutomation(automation);
                            setShowBuilder(true);
                          }}
                          className="p-2 rounded-lg bg-clawd-border hover:bg-clawd-border/80 transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteAutomation(automation.id)}
                          className="p-2 rounded-lg bg-error-subtle text-error hover:bg-red-500/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Automation Flow */}
                    <div className="flex items-center gap-3 text-sm mb-3 p-3 bg-clawd-bg rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-clawd-text-dim">IF</span>
                        <span className="px-2 py-1 bg-info-subtle text-info rounded">
                          {automation.trigger_type}
                        </span>
                        {trigger.keywords && (
                          <span className="text-clawd-text-dim">
                            &quot;{trigger.keywords.join(&quot;, &quot;)}&quot;
                          </span>
                        )}
                      </div>
                      <span className="text-clawd-text-dim">→</span>
                      <div className="flex items-center gap-2">
                        <span className="text-clawd-text-dim">THEN</span>
                        <div className="flex gap-1">
                          {Array.isArray(actions) && actions.map((action: XAutomationAction, i: number) => (
                            <span key={i} className="px-2 py-1 bg-success-subtle text-success rounded">
                              {action.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6 text-xs text-clawd-text-dim">
                      <div className="flex items-center gap-1">
                        <CheckCircle size={14} />
                        {automation.total_executions} executions
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {automation.max_executions_per_hour}/hr limit
                      </div>
                      {automation.last_executed_at && (
                        <div className="flex items-center gap-1">
                          Last: {new Date(automation.last_executed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
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
    } catch {
      return {};
    }
  });
  const [actions, setActions] = useState<XAutomationAction[]>(() => {
    try {
      return automation?.actions ? JSON.parse(automation.actions) : [];
    } catch {
      return [];
    }
  });
  const [maxPerHour, setMaxPerHour] = useState(automation?.max_executions_per_hour || 10);
  const [maxPerDay, setMaxPerDay] = useState(automation?.max_executions_per_day || 50);
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name for this automation');
      return;
    }
    
    if (actions.length === 0) {
      alert('Please add at least one action');
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
      
      const result = automation
        ? await (window as any).clawdbot?.xAutomations?.update(automation.id, payload)
        : await (window as any).clawdbot?.xAutomations?.create(payload);
      
      if (result?.success) {
        onSave();
      } else {
        alert(`Failed to save: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="bg-clawd-surface border border-clawd-border rounded-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-clawd-border">
          <h2 className="text-xl font-semibold mb-2">
            {automation ? 'Edit Automation' : 'Create Automation'}
          </h2>
          <p className="text-sm text-clawd-text-dim">
            Build an IFTTT-style automation to automate X engagement
          </p>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-thank new followers"
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this automation do?"
              rows={2}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent resize-none"
            />
          </div>
          
          {/* Trigger Section */}
          <div className="border-t border-clawd-border pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-info-subtle text-info rounded-lg text-sm">IF</span>
              Trigger
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">When this happens...</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                >
                  <option value="mention">Someone mentions me</option>
                  <option value="keyword">Tweet contains keywords</option>
                  <option value="time">At a specific time/interval</option>
                  <option value="follower">Someone follows/unfollows me</option>
                  <option value="dm">I receive a DM</option>
                </select>
              </div>
              
              {/* Trigger-specific config */}
              {triggerType === 'keyword' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Keywords (comma-separated)</label>
                  <input
                    type="text"
                    value={triggerConfig.keywords?.join(', ') || ''}
                    onChange={(e) => setTriggerConfig({ 
                      ...triggerConfig, 
                      keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean)
                    })}
                    placeholder="bitcoin, crypto, web3"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                  />
                </div>
              )}
              
              {triggerType === 'time' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Interval</label>
                  <select
                    value={triggerConfig.interval || '1h'}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, interval: e.target.value })}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                  >
                    <option value="15m">Every 15 minutes</option>
                    <option value="30m">Every 30 minutes</option>
                    <option value="1h">Every hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="12h">Every 12 hours</option>
                    <option value="24h">Every 24 hours</option>
                  </select>
                </div>
              )}
              
              {triggerType === 'follower' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Action</label>
                  <select
                    value={triggerConfig.action || 'follow'}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, action: e.target.value })}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                  >
                    <option value="follow">New follower</option>
                    <option value="unfollow">Lost follower</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="border-t border-clawd-border pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-success-subtle text-success rounded-lg text-sm">THEN</span>
              Actions
            </h3>
            
            <div className="space-y-3 mb-4">
              {actions.map((action, index) => (
                <div key={index} className="bg-clawd-bg border border-clawd-border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <select
                        value={action.type}
                        onChange={(e) => {
                          const newActions = [...actions];
                          newActions[index] = { ...action, type: e.target.value as any };
                          setActions(newActions);
                        }}
                        className="w-full bg-clawd-surface border border-clawd-border rounded-lg p-2 text-sm"
                      >
                        <option value="reply">Reply to tweet</option>
                        <option value="like">Like tweet</option>
                        <option value="retweet">Retweet</option>
                        <option value="dm">Send DM</option>
                        <option value="add_to_list">Add user to list</option>
                      </select>
                      
                      {(action.type === 'reply' || action.type === 'dm') && (
                        <textarea
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
                          className="w-full bg-clawd-surface border border-clawd-border rounded-lg p-2 text-sm resize-none"
                        />
                      )}
                      
                      {action.type === 'add_to_list' && (
                        <input
                          type="text"
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
                          className="w-full bg-clawd-surface border border-clawd-border rounded-lg p-2 text-sm"
                        />
                      )}
                    </div>
                    
                    <button
                      onClick={() => setActions(actions.filter((_, i) => i !== index))}
                      className="p-2 text-error hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setActions([...actions, { type: 'reply', config: {} }])}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors text-sm"
            >
              <Plus size={14} />
              Add Action
            </button>
          </div>
          
          {/* Rate Limits */}
          <div className="border-t border-clawd-border pt-6">
            <h3 className="text-lg font-semibold mb-4">Rate Limits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Max per hour</label>
                <input
                  type="number"
                  value={maxPerHour}
                  onChange={(e) => setMaxPerHour(parseInt(e.target.value) || 0)}
                  min="1"
                  max="100"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Max per day</label>
                <input
                  type="number"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 0)}
                  min="1"
                  max="1000"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-clawd-border flex items-center justify-between">
          <p className="text-sm text-clawd-text-dim">
            <AlertCircle size={14} className="inline mr-1" />
            Automations run in the background. Be mindful of X&apos;s rate limits.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || actions.length === 0}
              className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : automation ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
