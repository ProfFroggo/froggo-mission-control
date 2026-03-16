import { useState, useEffect } from 'react';
import {
  Plus,
  Power,
  Trash2,
  Edit,
  Play,
  Zap,
  Clock,
  Hash,
  UserPlus,
  MessageSquare,
  Heart,
  Repeat,
  Send,
  List,
} from 'lucide-react';
import { showToast } from './Toast';

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: 'mention' | 'keyword' | 'time' | 'follower' | 'dm';
  trigger_config: Record<string, any>;
  conditions: Record<string, any> | null;
  actions: { type: string; config: Record<string, any> }[];
  max_executions_per_hour: number;
  max_executions_per_day: number;
  total_executions: number;
  last_executed_at: number | null;
}

interface TriggerOption {
  type: string;
  label: string;
  icon: any;
  description: string;
}

interface ActionOption {
  type: string;
  label: string;
  icon: any;
  description: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    type: 'mention',
    label: 'When mentioned',
    icon: MessageSquare,
    description: 'Trigger when @Prof_Frogo is mentioned',
  },
  {
    type: 'keyword',
    label: 'Keyword detected',
    icon: Hash,
    description: 'Trigger when specific keywords are found',
  },
  {
    type: 'time',
    label: 'Scheduled time',
    icon: Clock,
    description: 'Trigger at specific times or intervals',
  },
  {
    type: 'follower',
    label: 'Follower action',
    icon: UserPlus,
    description: 'Trigger when someone follows or unfollows',
  },
  {
    type: 'dm',
    label: 'Direct message',
    icon: Send,
    description: 'Trigger when receiving a DM',
  },
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    type: 'reply',
    label: 'Reply to tweet',
    icon: MessageSquare,
    description: 'Send an automated reply',
  },
  { type: 'like', label: 'Like tweet', icon: Heart, description: 'Automatically like the tweet' },
  { type: 'retweet', label: 'Retweet', icon: Repeat, description: 'Automatically retweet' },
  { type: 'dm', label: 'Send DM', icon: Send, description: 'Send a direct message' },
  {
    type: 'add_to_list',
    label: 'Add to list',
    icon: List,
    description: 'Add user to a Twitter list',
  },
];

// ─── localStorage persistence ─────────────────────────────────────────────────

const LS_AUTOMATIONS_KEY = 'x-automations';

function loadAutomationsFromLS(): Automation[] {
  try {
    const raw = localStorage.getItem(LS_AUTOMATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAutomationsToLS(automations: Automation[]): void {
  try {
    localStorage.setItem(LS_AUTOMATIONS_KEY, JSON.stringify(automations));
  } catch {}
}

export default function XAutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  // Builder state
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderTriggerType, setBuilderTriggerType] = useState<string>('');
  const [builderTriggerConfig, setBuilderTriggerConfig] = useState<Record<string, any>>({});
  const [builderActions, setBuilderActions] = useState<{ type: string; config: Record<string, any> }[]>([]);
  const [builderMaxHourly, setBuilderMaxHourly] = useState(10);
  const [builderMaxDaily, setBuilderMaxDaily] = useState(50);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = () => {
    setLoading(true);
    try {
      const stored = loadAutomationsFromLS();
      setAutomations(stored);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = (id: string, currentState: boolean) => {
    const updated = automations.map(a =>
      a.id === id ? { ...a, enabled: !currentState } : a,
    );
    setAutomations(updated);
    saveAutomationsToLS(updated);
  };

  const deleteAutomation = (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    const updated = automations.filter(a => a.id !== id);
    setAutomations(updated);
    saveAutomationsToLS(updated);
    showToast('success', 'Deleted', 'Automation removed');
  };

  const testAutomation = (_id: string) => {
    showToast(
      'info',
      'Not Available',
      'Automation testing requires the server-side engine.',
    );
  };

  const openBuilder = (automation?: Automation) => {
    if (automation) {
      setEditingAutomation(automation);
      setBuilderName(automation.name);
      setBuilderDescription(automation.description);
      setBuilderTriggerType(automation.trigger_type);
      setBuilderTriggerConfig(automation.trigger_config);
      setBuilderActions(automation.actions);
      setBuilderMaxHourly(automation.max_executions_per_hour);
      setBuilderMaxDaily(automation.max_executions_per_day);
    } else {
      setEditingAutomation(null);
      setBuilderName('');
      setBuilderDescription('');
      setBuilderTriggerType('');
      setBuilderTriggerConfig({});
      setBuilderActions([]);
      setBuilderMaxHourly(10);
      setBuilderMaxDaily(50);
    }
    setShowBuilder(true);
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setEditingAutomation(null);
  };

  const saveAutomation = () => {
    if (!builderName || !builderTriggerType || builderActions.length === 0) {
      showToast('warning', 'Missing Fields', 'Please fill in all required fields');
      return;
    }

    const automationData: Automation = {
      id: editingAutomation?.id || `auto-${Date.now()}`,
      name: builderName,
      description: builderDescription,
      enabled: editingAutomation?.enabled ?? false,
      trigger_type: builderTriggerType as Automation['trigger_type'],
      trigger_config: builderTriggerConfig,
      conditions: null,
      actions: builderActions,
      max_executions_per_hour: builderMaxHourly,
      max_executions_per_day: builderMaxDaily,
      total_executions: editingAutomation?.total_executions ?? 0,
      last_executed_at: editingAutomation?.last_executed_at ?? null,
    };

    let updated: Automation[];
    if (editingAutomation) {
      updated = automations.map(a => (a.id === automationData.id ? automationData : a));
    } else {
      updated = [...automations, automationData];
    }

    setAutomations(updated);
    saveAutomationsToLS(updated);
    closeBuilder();
    showToast(
      'success',
      'Automation Saved',
      editingAutomation ? 'Changes saved successfully' : 'New automation created',
    );
  };

  const addAction = (actionType: string) => {
    const newAction = {
      type: actionType,
      config: getDefaultActionConfig(actionType),
    };
    setBuilderActions([...builderActions, newAction]);
  };

  const updateAction = (index: number, config: Record<string, any>) => {
    const updated = [...builderActions];
    updated[index] = { ...updated[index], config };
    setBuilderActions(updated);
  };

  const removeAction = (index: number) => {
    setBuilderActions(builderActions.filter((_, i) => i !== index));
  };

  const getDefaultActionConfig = (actionType: string): Record<string, any> => {
    switch (actionType) {
      case 'reply':
        return { template: '' };
      case 'dm':
        return { template: '' };
      case 'add_to_list':
        return { list_id: '' };
      default:
        return {};
    }
  };

  const getTriggerIcon = (type: string) => {
    const option = TRIGGER_OPTIONS.find(o => o.type === type);
    return option?.icon || Zap;
  };

  const getActionIcon = (type: string) => {
    const option = ACTION_OPTIONS.find(o => o.type === type);
    return option?.icon || Zap;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mission-control-accent"></div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Builder Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-mission-control-text flex items-center gap-2">
              <Zap size={20} className="text-mission-control-accent" />
              {editingAutomation ? 'Edit Automation' : 'New Automation'}
            </h2>
            <button
              onClick={closeBuilder}
              className="text-mission-control-text-dim hover:text-mission-control-text"
            >
              Cancel
            </button>
          </div>

          {/* Basic Info */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <div>
              <label htmlFor="automation-name" className="block text-sm font-medium mb-2">
                Automation Name
              </label>
              <input
                id="automation-name"
                type="text"
                value={builderName}
                onChange={e => setBuilderName(e.target.value)}
                placeholder="e.g., Auto-thank followers"
                className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent"
              />
            </div>
            <div>
              <label htmlFor="automation-description" className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <textarea
                id="automation-description"
                value={builderDescription}
                onChange={e => setBuilderDescription(e.target.value)}
                placeholder="What does this automation do?"
                rows={2}
                className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent resize-none"
              />
            </div>
          </div>

          {/* Trigger Selection */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-mission-control-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                1
              </span>
              When this happens (Trigger)
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {TRIGGER_OPTIONS.map(option => {
                const Icon = option.icon;
                const isSelected = builderTriggerType === option.type;

                return (
                  <button
                    key={option.type}
                    onClick={() => {
                      setBuilderTriggerType(option.type);
                      setBuilderTriggerConfig({});
                    }}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-mission-control-accent bg-mission-control-accent/10'
                        : 'border-mission-control-border hover:border-mission-control-accent/50'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        isSelected ? 'text-mission-control-accent' : 'text-mission-control-text-dim'
                      }
                    />
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-mission-control-text-dim">
                        {option.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trigger Config */}
            {builderTriggerType === 'keyword' && (
              <div className="mt-4">
                <label htmlFor="trigger-keywords" className="block text-sm font-medium mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  id="trigger-keywords"
                  type="text"
                  value={builderTriggerConfig.keywords?.join(', ') || ''}
                  onChange={e =>
                    setBuilderTriggerConfig({
                      ...builderTriggerConfig,
                      keywords: e.target.value
                        .split(',')
                        .map((k: string) => k.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g., crypto, blockchain, web3"
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent"
                />
              </div>
            )}

            {builderTriggerType === 'time' && (
              <div className="mt-4">
                <label htmlFor="trigger-interval" className="block text-sm font-medium mb-2">
                  Interval
                </label>
                <select
                  id="trigger-interval"
                  value={builderTriggerConfig.interval || '1h'}
                  onChange={e =>
                    setBuilderTriggerConfig({
                      ...builderTriggerConfig,
                      interval: e.target.value,
                    })
                  }
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent"
                >
                  <option value="15m">Every 15 minutes</option>
                  <option value="30m">Every 30 minutes</option>
                  <option value="1h">Every hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="12h">Every 12 hours</option>
                  <option value="1d">Every day</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-mission-control-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                2
              </span>
              Do this (Actions)
            </h3>

            {builderActions.length === 0 ? (
              <div className="text-center py-8 text-mission-control-text-dim">
                <p>No actions added yet</p>
                <p className="text-sm mt-1">Click an action below to add it</p>
              </div>
            ) : (
              <div className="space-y-3">
                {builderActions.map((action, index) => {
                  const Icon = getActionIcon(action.type);

                  return (
                    <div
                      key={`action-${index}`}
                      className="bg-mission-control-bg rounded-lg border border-mission-control-border p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon size={16} />
                          {ACTION_OPTIONS.find(o => o.type === action.type)?.label}
                        </div>
                        <button
                          onClick={() => removeAction(index)}
                          className="text-error hover:text-error"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {(action.type === 'reply' || action.type === 'dm') && (
                        <textarea
                          id={`action-template-${index}`}
                          value={action.config.template || ''}
                          onChange={e =>
                            updateAction(index, { ...action.config, template: e.target.value })
                          }
                          placeholder="Message template..."
                          rows={2}
                          className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent resize-none text-sm"
                        />
                      )}

                      {action.type === 'add_to_list' && (
                        <input
                          id={`action-list-id-${index}`}
                          type="text"
                          value={action.config.list_id || ''}
                          onChange={e =>
                            updateAction(index, { ...action.config, list_id: e.target.value })
                          }
                          placeholder="List ID"
                          className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-mission-control-border">
              {ACTION_OPTIONS.map(option => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.type}
                    onClick={() => addAction(option.type)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-mission-control-border hover:border-mission-control-accent hover:bg-mission-control-accent/10 transition-all text-sm"
                  >
                    <Icon size={16} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <h3 className="font-semibold">Rate Limits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="max-per-hour" className="block text-sm font-medium mb-2">
                  Max per hour
                </label>
                <input
                  id="max-per-hour"
                  type="number"
                  value={builderMaxHourly}
                  onChange={e => setBuilderMaxHourly(parseInt(e.target.value) || 10)}
                  min="1"
                  max="100"
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent"
                />
              </div>
              <div>
                <label htmlFor="max-per-day" className="block text-sm font-medium mb-2">
                  Max per day
                </label>
                <input
                  id="max-per-day"
                  type="number"
                  value={builderMaxDaily}
                  onChange={e => setBuilderMaxDaily(parseInt(e.target.value) || 50)}
                  min="1"
                  max="1000"
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-3 outline-none focus:border-mission-control-accent"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={closeBuilder}
              className="flex-1 px-4 py-3 bg-mission-control-border rounded-lg hover:bg-mission-control-border/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAutomation}
              className="flex-1 px-4 py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors font-medium"
            >
              {editingAutomation ? 'Update Automation' : 'Create Automation'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-mission-control-text flex items-center gap-2">
              <Zap size={20} className="text-mission-control-accent" />
              X Automations
            </h2>
            <p className="text-mission-control-text-dim mt-1">
              IFTTT-style automation for your X account
            </p>
          </div>
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors"
          >
            <Plus size={20} />
            New Automation
          </button>
        </div>

        {/* Automations List */}
        {automations.length === 0 ? (
          <div className="text-center py-16 bg-mission-control-surface rounded-lg border border-mission-control-border">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-mission-control-text-dim mb-4">No automations yet</p>
            <button
              onClick={() => openBuilder()}
              className="px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors"
            >
              Create your first automation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {automations.map(automation => {
              const TriggerIcon = getTriggerIcon(automation.trigger_type);

              return (
                <div
                  key={automation.id}
                  className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 hover:border-mission-control-accent/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{automation.name}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            automation.enabled
                              ? 'bg-success-subtle text-success'
                              : 'bg-mission-control-surface text-mission-control-text-dim'
                          }`}
                        >
                          {automation.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      {automation.description && (
                        <p className="text-mission-control-text-dim text-sm">
                          {automation.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAutomation(automation.id, automation.enabled)}
                        className={`p-2 rounded-lg transition-colors ${
                          automation.enabled
                            ? 'bg-success-subtle text-success hover:bg-success-subtle'
                            : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-border'
                        }`}
                        title={automation.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => testAutomation(automation.id)}
                        className="p-2 rounded-lg hover:bg-mission-control-border transition-colors"
                        title="Test automation"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => openBuilder(automation)}
                        className="p-2 rounded-lg hover:bg-mission-control-border transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteAutomation(automation.id)}
                        className="p-2 rounded-lg hover:bg-mission-control-border text-error transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-bg rounded-lg">
                      <TriggerIcon size={14} />
                      <span>
                        {TRIGGER_OPTIONS.find(o => o.type === automation.trigger_type)?.label}
                      </span>
                    </div>
                    <span className="text-mission-control-text-dim">&rarr;</span>
                    <div className="flex items-center gap-2">
                      {automation.actions.map((action: { type: string; config: Record<string, any> }, index: number) => {
                        const ActionIcon = getActionIcon(action.type);
                        return (
                          <div
                            key={`${automation.id}-${action.type}-${index}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-mission-control-bg rounded-lg"
                          >
                            <ActionIcon size={14} />
                            <span>
                              {ACTION_OPTIONS.find(o => o.type === action.type)?.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {automation.total_executions > 0 && (
                    <div className="mt-4 pt-4 border-t border-mission-control-border flex items-center justify-between text-sm text-mission-control-text-dim">
                      <span>Executed {automation.total_executions} times</span>
                      {automation.last_executed_at && (
                        <span>
                          Last run: {new Date(automation.last_executed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
