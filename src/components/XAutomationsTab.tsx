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
  TrendingUp,
  FileText,
  Bot,
  History,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button, IconButton, Badge, Heading, Text, Spinner, TextField, TextArea, Select, Box, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: 'mention' | 'keyword' | 'time' | 'follower' | 'dm' | 'engagement';
  trigger_config: Record<string, any>;
  conditions: Record<string, any> | null;
  actions: { type: string; config: Record<string, any> }[];
  ai_engine?: 'gemini' | 'claude';
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
  {
    type: 'engagement',
    label: 'High engagement',
    icon: TrendingUp,
    description: 'Trigger when a mention exceeds a like/retweet threshold',
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
  { type: 'add_to_list', label: 'Add to list', icon: List, description: 'Add user to a Twitter list' },
  { type: 'process_mentions', label: 'Process mentions', icon: Zap, description: 'Fetch mentions + generate AI reply suggestions' },
  { type: 'report', label: 'Generate report', icon: FileText, description: 'Run competitor analysis or weekly summary' },
  { type: 'post_content', label: 'Post content', icon: Edit, description: 'Create a draft post in the pipeline' },
  { type: 'custom_prompt', label: 'Custom AI action', icon: Bot, description: 'Run a custom prompt with the social manager agent' },
];

// ─── API persistence ──────────────────────────────────────────────────────────

const API_BASE = '/api/x/automations';

export default function XAutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [executionLog, setExecutionLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  // Builder state
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderTriggerType, setBuilderTriggerType] = useState<string>('');
  const [builderTriggerConfig, setBuilderTriggerConfig] = useState<Record<string, any>>({});
  const [builderActions, setBuilderActions] = useState<{ type: string; config: Record<string, any> }[]>([]);
  const [builderAiEngine, setBuilderAiEngine] = useState<'gemini' | 'claude'>('gemini');
  const [builderMaxHourly, setBuilderMaxHourly] = useState(10);
  const [builderMaxDaily, setBuilderMaxDaily] = useState(50);
  const [showLog, setShowLog] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [logDisplayLimit, setLogDisplayLimit] = useState(20);
  const [expandedLogEntry, setExpandedLogEntry] = useState<string | null>(null);

  useEffect(() => {
    loadAutomations();
    // Listen for AI-created automations from agent chat
    const handler = () => {
      showToast('success', 'Automation created via AI');
      loadAutomations();
    };
    window.addEventListener('x-automation-created', handler);
    return () => window.removeEventListener('x-automation-created', handler);
  }, []);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations || []);
        setExecutionLog(data.recentLogs || []);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  };

  const toggleAutomation = async (id: string, currentState: boolean) => {
    // Optimistic update
    const updated = automations.map(a =>
      a.id === id ? { ...a, enabled: !currentState } : a,
    );
    setAutomations(updated);
    fetch(API_BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: !currentState }),
    }).catch(() => loadAutomations());
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    setAutomations(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(API_BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      showToast('success', 'Deleted', 'Automation removed');
    } catch {
      showToast('error', 'Error', 'Failed to delete');
      loadAutomations();
    }
  };

  const testAutomation = async (_id: string) => {
    try {
      const res = await fetch('/api/x/automations/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      showToast('success', 'Engine Run', `Checked ${data.checked}, fired ${data.fired}, skipped ${data.skipped}`);
      loadAutomations();
    } catch {
      showToast('error', 'Error', 'Failed to run automation engine');
    }
  };

  const openBuilder = (automation?: Automation) => {
    if (automation) {
      setEditingAutomation(automation);
      setBuilderName(automation.name);
      setBuilderDescription(automation.description);
      setBuilderTriggerType(automation.trigger_type);
      setBuilderTriggerConfig(automation.trigger_config);
      setBuilderActions(automation.actions);
      setBuilderAiEngine(automation.ai_engine || 'gemini');
      setBuilderMaxHourly(automation.max_executions_per_hour);
      setBuilderMaxDaily(automation.max_executions_per_day);
    } else {
      setEditingAutomation(null);
      setBuilderName('');
      setBuilderDescription('');
      setBuilderTriggerType('');
      setBuilderTriggerConfig({});
      setBuilderActions([]);
      setBuilderAiEngine('gemini');
      setBuilderMaxHourly(10);
      setBuilderMaxDaily(50);
    }
    setShowBuilder(true);
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setEditingAutomation(null);
  };

  const saveAutomation = async () => {
    if (!builderName || !builderTriggerType || builderActions.length === 0) {
      showToast('warning', 'Missing Fields', 'Please fill in all required fields');
      return;
    }

    const payload = {
      name: builderName,
      description: builderDescription,
      trigger_type: builderTriggerType,
      trigger_config: builderTriggerConfig,
      actions: builderActions,
      ai_engine: builderAiEngine,
      max_per_hour: builderMaxHourly,
      max_per_day: builderMaxDaily,
    };

    try {
      if (editingAutomation) {
        // Update existing
        const res = await fetch(API_BASE, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAutomation.id, ...payload }),
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        // Create new
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Create failed');
      }
      closeBuilder();
      loadAutomations();
      showToast('success', 'Saved', editingAutomation ? 'Automation updated' : 'Automation created');
    } catch {
      showToast('error', 'Error', 'Failed to save automation');
    }
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
      case 'report':
        return { report_type: 'competitor-analysis' };
      case 'post_content':
        return { template: '' };
      case 'custom_prompt':
        return { prompt: '' };
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
        <Spinner size="3" />
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Builder Header */}
          <Flex align="center" justify="between">
            <Heading size="5" weight="medium" className="flex items-center gap-2">
              <Zap size={20} className="text-mission-control-accent" />
              {editingAutomation ? 'Edit Automation' : 'New Automation'}
            </Heading>
            <Button onClick={closeBuilder} variant="ghost" color="gray" size="2">
              Cancel
            </Button>
          </Flex>

          {/* Basic Info */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <div>
              <label htmlFor="automation-name" className="block text-sm font-medium mb-2">
                Automation Name
              </label>
              <TextField.Root
                id="automation-name"
                value={builderName}
                onChange={e => setBuilderName(e.target.value)}
                placeholder="e.g., Auto-thank followers"
                size="2"
              />
            </div>
            <div>
              <label htmlFor="automation-description" className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <TextArea
                id="automation-description"
                value={builderDescription}
                onChange={e => setBuilderDescription(e.target.value)}
                placeholder="What does this automation do?"
                rows={2}
                variant="soft"
                resize="vertical"
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
                  <Button
                    key={option.type}
                    onClick={() => {
                      setBuilderTriggerType(option.type);
                      setBuilderTriggerConfig({});
                    }}
                    size="2"
                    variant={isSelected ? 'soft' : 'ghost'}
                   
                    className="flex items-start gap-3 p-4 w-full text-left h-auto"
                    style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}
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
                  </Button>
                );
              })}
            </div>

            {/* Trigger Config */}
            {builderTriggerType === 'keyword' && (
              <div className="mt-4">
                <label htmlFor="trigger-keywords" className="block text-sm font-medium mb-2">
                  Keywords (comma-separated)
                </label>
                <TextField.Root
                  id="trigger-keywords"
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
                  size="2"
                />
              </div>
            )}

            {builderTriggerType === 'time' && (
              <div className="mt-4">
                <label htmlFor="trigger-interval" className="block text-sm font-medium mb-2">
                  Interval
                </label>
                <Select.Root
                  value={builderTriggerConfig.interval || '1h'}
                  onValueChange={val =>
                    setBuilderTriggerConfig({
                      ...builderTriggerConfig,
                      interval: val,
                    })
                  }
                  size="2"
                >
                  <Select.Trigger id="trigger-interval" className="w-full" />
                  <Select.Content>
                    <Select.Item value="15m">Every 15 minutes</Select.Item>
                    <Select.Item value="30m">Every 30 minutes</Select.Item>
                    <Select.Item value="1h">Every hour</Select.Item>
                    <Select.Item value="6h">Every 6 hours</Select.Item>
                    <Select.Item value="12h">Every 12 hours</Select.Item>
                    <Select.Item value="1d">Every day</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
            )}

            {builderTriggerType === 'engagement' && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="trigger-min-likes" className="block text-sm font-medium mb-2">
                    Min likes
                  </label>
                  <TextField.Root
                    id="trigger-min-likes"
                    type="number"
                    value={builderTriggerConfig.min_likes ?? 50}
                    onChange={e =>
                      setBuilderTriggerConfig({
                        ...builderTriggerConfig,
                        min_likes: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    size="2"
                  />
                </div>
                <div>
                  <label htmlFor="trigger-min-retweets" className="block text-sm font-medium mb-2">
                    Min retweets
                  </label>
                  <TextField.Root
                    id="trigger-min-retweets"
                    type="number"
                    value={builderTriggerConfig.min_retweets ?? 10}
                    onChange={e =>
                      setBuilderTriggerConfig({
                        ...builderTriggerConfig,
                        min_retweets: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                    size="2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* AI Engine */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-mission-control-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                2
              </span>
              AI Engine
            </h3>
            <p className="text-sm text-mission-control-text-dim">
              Select the AI model used for reply generation and content actions.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={() => setBuilderAiEngine('gemini')}
                size="2"
                variant={builderAiEngine === 'gemini' ? 'soft' : 'ghost'}
               
                className="flex items-start gap-3 p-4 w-full h-auto"
                style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}
              >
                <Bot
                  size={20}
                  className={builderAiEngine === 'gemini' ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}
                />
                <div>
                  <div className="font-medium text-sm">Gemini Flash Lite</div>
                  <div className="text-xs text-mission-control-text-dim">Fast, cheap — ideal for background automation</div>
                </div>
              </Button>
              <Button
                onClick={() => setBuilderAiEngine('claude')}
                size="2"
                variant={builderAiEngine === 'claude' ? 'soft' : 'ghost'}
               
                className="flex items-start gap-3 p-4 w-full h-auto"
                style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}
              >
                <Sparkles
                  size={20}
                  className={builderAiEngine === 'claude' ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}
                />
                <div>
                  <div className="font-medium text-sm">Claude Haiku</div>
                  <div className="text-xs text-mission-control-text-dim">Interactive, nuanced — ideal for replies requiring context</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-mission-control-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">
                3
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
                      <Flex align="center" justify="between">
                        <Flex align="center" gap="2" className="font-medium">
                          <Icon size={16} />
                          {ACTION_OPTIONS.find(o => o.type === action.type)?.label}
                        </Flex>
                        <IconButton
                          onClick={() => removeAction(index)}
                          size="2"
                          variant="ghost"
                          color="red"

                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Flex>

                      {(action.type === 'reply' || action.type === 'dm') && (
                        <TextArea
                          id={`action-template-${index}`}
                          value={action.config.template || ''}
                          onChange={e =>
                            updateAction(index, { ...action.config, template: e.target.value })
                          }
                          placeholder="Message template..."
                          rows={2}
                          variant="soft"
                          resize="vertical"
                        />
                      )}

                      {action.type === 'add_to_list' && (
                        <TextField.Root
                          id={`action-list-id-${index}`}
                          value={action.config.list_id || ''}
                          onChange={e =>
                            updateAction(index, { ...action.config, list_id: e.target.value })
                          }
                          placeholder="List ID"
                          size="2"
                        />
                      )}

                      {action.type === 'report' && (
                        <div>
                          <label htmlFor={`action-report-type-${index}`} className="block text-xs font-medium mb-1 text-mission-control-text-dim">
                            Report type
                          </label>
                          <Select.Root
                            value={action.config.report_type || 'competitor-analysis'}
                            onValueChange={val =>
                              updateAction(index, { ...action.config, report_type: val })
                            }
                            size="2"
                          >
                            <Select.Trigger id={`action-report-type-${index}`} className="w-full" />
                            <Select.Content>
                              <Select.Item value="competitor-analysis">Competitor analysis</Select.Item>
                              <Select.Item value="weekly-summary">Weekly summary</Select.Item>
                            </Select.Content>
                          </Select.Root>
                        </div>
                      )}

                      {action.type === 'post_content' && (
                        <div>
                          <label htmlFor={`action-post-template-${index}`} className="block text-xs font-medium mb-1 text-mission-control-text-dim">
                            Content template
                          </label>
                          <TextArea
                            id={`action-post-template-${index}`}
                            value={action.config.template || ''}
                            onChange={e =>
                              updateAction(index, { ...action.config, template: e.target.value })
                            }
                            placeholder="Draft post content..."
                            rows={3}
                            variant="soft"
                            resize="vertical"
                          />
                        </div>
                      )}

                      {action.type === 'custom_prompt' && (
                        <div>
                          <label htmlFor={`action-prompt-${index}`} className="block text-xs font-medium mb-1 text-mission-control-text-dim">
                            Custom prompt
                          </label>
                          <TextArea
                            id={`action-prompt-${index}`}
                            value={action.config.prompt || ''}
                            onChange={e =>
                              updateAction(index, { ...action.config, prompt: e.target.value })
                            }
                            placeholder="Describe what the AI should do with the trigger data..."
                            rows={3}
                            variant="soft"
                            resize="vertical"
                          />
                        </div>
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
                  <Button
                    key={option.type}
                    onClick={() => addAction(option.type)}
                    size="2"
                    variant="ghost"
                   
                    className="flex items-center gap-2 w-full"
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icon size={16} />
                    {option.label}
                  </Button>
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
                <TextField.Root
                  id="max-per-hour"
                  type="number"
                  value={builderMaxHourly}
                  onChange={e => setBuilderMaxHourly(parseInt(e.target.value) || 10)}
                  min="1"
                  max="100"
                  size="2"
                />
              </div>
              <div>
                <label htmlFor="max-per-day" className="block text-sm font-medium mb-2">
                  Max per day
                </label>
                <TextField.Root
                  id="max-per-day"
                  type="number"
                  value={builderMaxDaily}
                  onChange={e => setBuilderMaxDaily(parseInt(e.target.value) || 50)}
                  min="1"
                  max="1000"
                  size="2"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Flex gap="3">
            <Button
              onClick={closeBuilder}
              size="2"
              variant="ghost"

              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={saveAutomation}
              size="2"
              variant="soft"

              className="flex-1"
            >
              {editingAutomation ? 'Update Automation' : 'Create Automation'}
            </Button>
          </Flex>
        </div>
      </div>
    );
  }

  return (
    <Box className="h-full overflow-y-auto">
      <div className="w-full p-6 space-y-6">
        {/* Header */}
        <Flex align="center" justify="between">
          <div>
            <h2 className="text-xl font-semibold text-mission-control-text flex items-center gap-2">
              <Zap size={20} className="text-mission-control-accent" />
              X Automations
            </h2>
            <p className="text-mission-control-text-dim mt-1">
              IFTTT-style automation for your X account
            </p>
          </div>
          <Flex align="center" gap="2">
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('x-agent-chat-inject', {
                  detail: { message: 'I want to create a new automation for my X/Twitter account. Help me define the trigger, conditions, and actions. When ready, output the automation as a ```automation JSON block.' }
                }));
              }}
              size="2"
              variant="ghost"
             
            >
              <Sparkles size={16} />
              Create with AI
            </Button>
            <Button
              onClick={() => openBuilder()}
              size="2"
              variant="soft"
             
            >
              <Plus size={16} />
              Manual
            </Button>
          </Flex>
        </Flex>

        {/* Automations List */}
        {automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-mission-control-surface rounded-lg border border-mission-control-border">
            <Zap size={32} className="text-mission-control-text-dim opacity-50" />
            <p className="text-sm font-medium text-mission-control-text">No automations yet</p>
            <p className="text-xs text-mission-control-text-dim max-w-xs">Build IFTTT-style rules to automate your X account responses and actions.</p>
            <Button
              onClick={() => openBuilder()}
              size="2"
              variant="soft"
             
            >
              Create your first automation
            </Button>
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
                  <Flex align="start" justify="between" className="mb-4">
                    <div className="flex-1">
                      <Flex align="center" gap="3" className="mb-2">
                        <h3 className="text-lg font-semibold">{automation.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            automation.enabled
                              ? 'bg-success-subtle text-success'
                              : 'bg-mission-control-border text-mission-control-text-dim'
                          }`}
                        >
                          {automation.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </Flex>
                      {automation.description && (
                        <p className="text-mission-control-text-dim text-sm">
                          {automation.description}
                        </p>
                      )}
                    </div>

                    <Flex align="center" gap="2">
                      <IconButton
                        onClick={() => toggleAutomation(automation.id, automation.enabled)}
                        size="2"
                        variant={automation.enabled ? 'soft' : 'ghost'}
                        color={automation.enabled ? 'green' : 'gray'}
                       
                        title={automation.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => testAutomation(automation.id)}
                        size="2"
                        variant="ghost"
                       
                        title="Test automation"
                      >
                        <Play size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => openBuilder(automation)}
                        size="2"
                        variant="ghost"
                       
                        title="Edit"
                      >
                        <Edit size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => deleteAutomation(automation.id)}
                        size="2"
                        variant="ghost"
                        color="red"
                       
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Flex>
                  </Flex>

                  <Flex align="center" gap="3" className="text-sm">
                    <Flex align="center" gap="2" className="px-3 py-1.5 bg-mission-control-bg rounded-lg">
                      <TriggerIcon size={14} />
                      <span>
                        {TRIGGER_OPTIONS.find(o => o.type === automation.trigger_type)?.label}
                      </span>
                    </Flex>
                    <span className="text-mission-control-text-dim">&rarr;</span>
                    <Flex align="center" gap="2">
                      {automation.actions.map((action: { type: string; config: Record<string, any> }, index: number) => {
                        const ActionIcon = getActionIcon(action.type);
                        return (
                          <Flex
                            key={`${automation.id}-${action.type}-${index}`}
                            align="center"
                            gap="1"
                            className="px-3 py-1.5 bg-mission-control-bg rounded-lg"
                          >
                            <ActionIcon size={14} />
                            <span>
                              {ACTION_OPTIONS.find(o => o.type === action.type)?.label}
                            </span>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </Flex>

                  {automation.total_executions > 0 && (
                    <Flex align="center" justify="between" className="mt-4 pt-4 border-t border-mission-control-border text-sm text-mission-control-text-dim tabular-nums">
                      <span>Executed {automation.total_executions} times</span>
                      {automation.last_executed_at && (
                        <span>
                          Last run: {new Date(automation.last_executed_at).toLocaleString()}
                        </span>
                      )}
                    </Flex>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Execution Log */}
        <div className="mt-6 bg-mission-control-surface rounded-lg border border-mission-control-border">
          <Button
            onClick={() => setShowLog(!showLog)}
            size="2"
            variant="ghost"
           
            className="flex items-center gap-2 w-full text-left px-4 py-3"
            style={{ justifyContent: 'flex-start' }}
          >
            {showLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <History size={14} className="text-mission-control-accent" />
            <span>Execution Log</span>
            <span className="text-mission-control-text-dim ml-1">({executionLog.length})</span>
          </Button>

          {showLog && (
            <div className="px-4 pb-4">
              {/* Filter */}
              <div className="mb-3">
                <TextField.Root
                  value={logFilter}
                  onChange={e => {
                    setLogFilter(e.target.value);
                    setLogDisplayLimit(20);
                  }}
                  placeholder="Filter by automation name..."
                  size="1"
                />
              </div>

              {executionLog.length === 0 ? (
                <p className="text-xs text-mission-control-text-dim py-4 text-center">
                  No executions yet. Automations run every 5 minutes when enabled.
                </p>
              ) : (() => {
                const filteredLog = logFilter
                  ? executionLog.filter((entry: any) => {
                      const automation = automations.find(a => a.id === entry.automation_id);
                      const name = automation?.name || entry.automation_id || '';
                      return name.toLowerCase().includes(logFilter.toLowerCase());
                    })
                  : executionLog;
                const visibleLog = filteredLog.slice(0, logDisplayLimit);

                return (
                  <>
                    <div className="space-y-1.5">
                      {visibleLog.map((entry: any) => {
                        const automation = automations.find(a => a.id === entry.automation_id);
                        const automationName = automation?.name || entry.automation_id || 'Unknown';
                        const isExpanded = expandedLogEntry === entry.id;
                        const actionsTaken: any[] = entry.actions_taken || [];

                        return (
                          <div key={entry.id} className="rounded-lg border border-mission-control-border bg-mission-control-bg overflow-hidden">
                            <Button
                              onClick={() => setExpandedLogEntry(isExpanded ? null : entry.id)}
                              size="1"
                              variant="ghost"
                             
                              className="flex items-center gap-3 w-full text-left px-3 py-2"
                              style={{ justifyContent: 'flex-start' }}
                            >
                              {isExpanded ? <ChevronDown size={12} className="flex-shrink-0" /> : <ChevronRight size={12} className="flex-shrink-0" />}
                              <span className="text-mission-control-text-dim w-28 flex-shrink-0 tabular-nums">
                                {new Date(entry.executed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-mission-control-text font-medium flex-1 truncate">{automationName}</span>
                              <span className="text-mission-control-text-dim flex-shrink-0 mx-2">{entry.trigger_type}</span>
                              <span className="text-mission-control-text-dim flex-shrink-0 truncate max-w-[120px]">
                                {actionsTaken.map((a: any) => a.type).join(', ') || 'no actions'}
                              </span>
                              <span className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                entry.status === 'executed' ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'
                              }`}>
                                {entry.status}
                              </span>
                            </Button>

                            {isExpanded && (
                              <div className="px-3 pb-3 pt-1 border-t border-mission-control-border space-y-2">
                                <div className="text-xs text-mission-control-text-dim">
                                  <span className="font-medium text-mission-control-text">Automation ID:</span> {entry.automation_id}
                                </div>
                                {actionsTaken.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-mission-control-text mb-1">Actions taken:</div>
                                    <div className="space-y-1">
                                      {actionsTaken.map((a: any, i: number) => (
                                        <div key={i} className="text-xs text-mission-control-text-dim bg-mission-control-surface rounded px-2 py-1">
                                          <span className="font-medium">{a.type}</span>
                                          {a.status && <span className="ml-2 opacity-70">{a.status}</span>}
                                          {a.approval_id && <span className="ml-2 opacity-50">approval: {a.approval_id}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {entry.error && (
                                  <div className="text-xs text-error bg-error-subtle rounded px-2 py-1">
                                    {entry.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {filteredLog.length > logDisplayLimit && (
                      <Button
                        onClick={() => setLogDisplayLimit(prev => prev + 20)}
                        size="1"
                        variant="ghost"
                       
                        className="mt-3 w-full"
                      >
                        Load more ({filteredLog.length - logDisplayLimit} remaining)
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </Box>
  );
}
