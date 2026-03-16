// LEGACY: SmartFolderRuleEditor uses file-level suppression for intentional patterns.
// Rule editor component - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, Zap, Info, ChevronDown, Save, TestTube } from 'lucide-react';
import { showToast } from './Toast';
import {
  RuleConditionType,
  RuleCondition,
  FolderRule,
  validateRule,
  describeRule,
  RULE_TEMPLATES,
  evaluateRule,
  ConversationData
} from '../lib/folderRules';

interface SmartFolderRuleEditorProps {
  folderId: number;
  folderName: string;
  onClose?: () => void;
  onSave?: () => void;
}

const CONDITION_TYPES: { value: RuleConditionType; label: string; description: string; valueType: 'text' | 'number' | 'boolean' }[] = [
  { value: 'sender_matches', label: 'Sender matches', description: 'Match sender identifier (supports wildcards)', valueType: 'text' },
  { value: 'sender_name_contains', label: 'Sender name contains', description: 'Sender display name contains text', valueType: 'text' },
  { value: 'content_contains', label: 'Content contains', description: 'Message contains keywords (comma-separated)', valueType: 'text' },
  { value: 'platform_is', label: 'Platform is', description: 'Message platform (whatsapp, telegram, discord, etc)', valueType: 'text' },
  { value: 'priority_above', label: 'Priority above', description: 'Priority score greater than', valueType: 'number' },
  { value: 'priority_below', label: 'Priority below', description: 'Priority score less than', valueType: 'number' },
  { value: 'has_attachment', label: 'Has attachment', description: 'Message includes files', valueType: 'boolean' },
  { value: 'is_urgent', label: 'Is urgent', description: 'Message marked as urgent', valueType: 'boolean' },
  { value: 'reply_needed', label: 'Reply needed', description: 'Message requires response', valueType: 'boolean' },
  { value: 'time_range', label: 'Time range', description: 'Received during time range (HH:MM-HH:MM)', valueType: 'text' },
  { value: 'domain_matches', label: 'Domain matches', description: 'Email domain (supports wildcards)', valueType: 'text' },
];

export default function SmartFolderRuleEditor({ folderId, folderName, onClose, onSave }: SmartFolderRuleEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [rule, setRule] = useState<Partial<FolderRule>>({
    id: `rule-${Date.now()}`,
    folderId,
    name: `${folderName} Auto-Assignment`,
    enabled: true,
    operator: 'AND',
    conditions: [],
    priority: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  const [testData, setTestData] = useState<Partial<ConversationData>>({
    sender: 'test@example.com',
    senderName: 'Test User',
    platform: 'whatsapp',
    content: 'This is a test message',
    priorityScore: 50,
    isUrgent: false,
    hasAttachment: false,
  });
  
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadRule();
  }, [folderId]);

  const loadRule = async () => {
    setLoading(true);
    try {
      const result = await fetch(`/api/library?action=folder-rules&folderId=${folderId}`).then(r => r.ok ? r.json() : { success: false });
      if (result.success && result.rule) {
        setRule(result.rule as unknown as Partial<FolderRule>);
      }
    } catch (error) {
      // '[RuleEditor] Load error:', error;
      showToast('error', 'Failed to load rule');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    const validation = validateRule(rule);
    if (!validation.valid) {
      showToast('error', validation.errors[0]);
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder-rules-save', folderId, rule }),
      }).then(r => r.ok ? r.json() : { success: false });
      if (result.success) {
        showToast('success', 'Rule saved successfully');
        onSave?.();
      } else {
        showToast('error', result.error || 'Failed to save rule');
      }
    } catch (error) {
      // '[RuleEditor] Save error:', error;
      showToast('error', 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete smart folder rule? This will make the folder manual-only.')) {
      return;
    }

    try {
      const result = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder-rules-delete', folderId }),
      }).then(r => r.ok ? r.json() : { success: false });
      if (result.success) {
        showToast('success', 'Rule deleted');
        onClose?.();
      } else {
        showToast('error', result.error || 'Failed to delete rule');
      }
    } catch (error) {
      // '[RuleEditor] Delete error:', error;
      showToast('error', 'Failed to delete rule');
    }
  };

  const addCondition = () => {
    setRule({
      ...rule,
      conditions: [
        ...(rule.conditions || []),
        { type: 'sender_matches', value: '', negate: false },
      ],
    });
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const conditions = [...(rule.conditions || [])];
    conditions[index] = { ...conditions[index], ...updates };
    setRule({ ...rule, conditions });
  };

  const removeCondition = (index: number) => {
    const conditions = [...(rule.conditions || [])];
    conditions.splice(index, 1);
    setRule({ ...rule, conditions });
  };

  const applyTemplate = (template: Partial<FolderRule>) => {
    setRule({
      ...rule,
      ...template,
      id: rule.id,
      folderId: rule.folderId,
      createdAt: rule.createdAt,
      updatedAt: new Date().toISOString(),
    });
    setShowTemplates(false);
  };

  const testRule = () => {
    if (!rule.conditions || rule.conditions.length === 0) {
      showToast('error', 'Add conditions to test');
      return;
    }

    setTesting(true);
    try {
      const result = evaluateRule(rule as FolderRule, testData as ConversationData);
      setTestResult(result);
      showToast(result ? 'success' : 'info', result ? 'Rule matches!' : 'Rule does not match');
    } catch (error) {
      // '[RuleEditor] Test error:', error;
      showToast('error', 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const getConditionConfig = (type: RuleConditionType) => {
    return CONDITION_TYPES.find(c => c.value === type) || CONDITION_TYPES[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-mission-control-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-mission-control-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-lg">
            <Zap size={20} className="text-mission-control-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Smart Folder Rules</h2>
            <p className="text-sm text-mission-control-text-dim">{folderName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={testRule}
            disabled={testing || !rule.conditions || rule.conditions.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-info-subtle text-info hover:bg-info-subtle rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            <TestTube size={14} />
            Test Rule
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-accent hover:bg-mission-control-accent-hover text-white rounded-lg transition-colors text-sm"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Rule Info */}
        <div className="card p-4">
          <div className="flex items-start gap-3 mb-4">
            <Info size={16} className="text-mission-control-accent mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">How Smart Folders Work</h3>
              <p className="text-sm text-mission-control-text-dim">
                Define conditions to automatically assign conversations to this folder. 
                Conversations matching your rules will be added automatically.
              </p>
            </div>
          </div>

          {/* Rule Description */}
          {rule.conditions && rule.conditions.length > 0 && (
            <div className="p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
              <div className="text-xs font-medium text-mission-control-text-dim mb-1">Current Rule:</div>
              <div className="text-sm text-mission-control-accent">{describeRule(rule as FolderRule)}</div>
            </div>
          )}
        </div>

        {/* Rule Configuration */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Rule Configuration</h3>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg text-sm transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              Templates
            </button>
          </div>

          {/* Templates Dropdown */}
          {showTemplates && (
            <div className="p-3 bg-mission-control-bg rounded-lg border border-mission-control-border space-y-2">
              <div className="text-xs font-medium text-mission-control-text-dim mb-2">Quick Templates:</div>
              {RULE_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="w-full text-left p-2 hover:bg-mission-control-surface rounded transition-colors"
                >
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="text-xs text-mission-control-text-dim mt-1">
                    {template.conditions?.map(c => `${c.type}: ${c.value}`).join(' ' + (template.operator || 'AND') + ' ')}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rule-name" className="block text-sm font-medium mb-2">Rule Name</label>
              <input
                id="rule-name"
                type="text"
                value={rule.name || ''}
                onChange={(e) => setRule({ ...rule, name: e.target.value })}
                className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                placeholder="e.g., High Priority Messages"
              />
            </div>
            <div>
              <label htmlFor="rule-priority" className="block text-sm font-medium mb-2">Priority</label>
              <input
                id="rule-priority"
                type="number"
                value={rule.priority || 50}
                onChange={(e) => setRule({ ...rule, priority: parseInt(e.target.value) })}
                min={0}
                max={100}
                className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
              />
              <p className="text-xs text-mission-control-text-dim mt-1">Higher priority rules run first (0-100)</p>
            </div>
          </div>

          {/* Operator */}
          <div>
            <span className="block text-sm font-medium mb-2">Match Conditions</span>
            <div className="flex gap-3">
              <button
                onClick={() => setRule({ ...rule, operator: 'AND' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rule.operator === 'AND'
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'
                }`}
              >
                AND (All conditions)
              </button>
              <button
                onClick={() => setRule({ ...rule, operator: 'OR' })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  rule.operator === 'OR'
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'
                }`}
              >
                OR (Any condition)
              </button>
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-3 bg-mission-control-bg rounded-lg">
            <div>
              <div className="text-sm font-medium">Rule Enabled</div>
              <div className="text-xs text-mission-control-text-dim">Activate auto-assignment for this folder</div>
            </div>
            <button
              onClick={() => setRule({ ...rule, enabled: !rule.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                rule.enabled ? 'bg-mission-control-accent' : 'bg-mission-control-border'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-mission-control-text rounded-full transition-transform ${
                  rule.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Conditions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Conditions</h3>
            <button
              onClick={addCondition}
              className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-accent hover:bg-mission-control-accent-hover text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              Add Condition
            </button>
          </div>

          {rule.conditions && rule.conditions.length > 0 ? (
            <div className="space-y-3">
              {rule.conditions.map((condition, idx) => {
                const config = getConditionConfig(condition.type);
                return (
                  <div key={idx} className="p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
                    <div className="flex items-start gap-3">
                      {/* Condition Type */}
                      <div className="flex-1">
                        <select
                          value={condition.type}
                          onChange={(e) => updateCondition(idx, { type: e.target.value as RuleConditionType })}
                          className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-mission-control-accent"
                        >
                          {CONDITION_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        {/* Condition Value */}
                        {config.valueType === 'text' && (
                          <input
                            type="text"
                            value={String(condition.value || '')}
                            onChange={(e) => updateCondition(idx, { value: e.target.value })}
                            placeholder={config.description}
                            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                          />
                        )}
                        {config.valueType === 'number' && (
                          <input
                            type="number"
                            value={Number(condition.value || 0)}
                            onChange={(e) => updateCondition(idx, { value: parseFloat(e.target.value) })}
                            placeholder={config.description}
                            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                          />
                        )}
                        {config.valueType === 'boolean' && (
                          <div className="flex items-center gap-2 text-sm text-mission-control-text-dim">
                            <Check size={16} className="text-mission-control-accent" />
                            {config.description}
                          </div>
                        )}

                        {/* Negate Toggle */}
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={condition.negate || false}
                            onChange={(e) => updateCondition(idx, { negate: e.target.checked })}
                            className="w-4 h-4 rounded border-mission-control-border text-mission-control-accent focus:ring-mission-control-accent"
                          />
                          <span className="text-xs text-mission-control-text-dim">NOT (negate condition)</span>
                        </label>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeCondition(idx)}
                        className="p-2 hover:bg-error-subtle text-error rounded-lg transition-colors"
                        title="Remove condition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-mission-control-text-dim py-8">
              <p>No conditions yet</p>
              <p className="text-sm mt-1">Add conditions to define when conversations match this folder</p>
            </div>
          )}
        </div>

        {/* Test Section */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Test Rule</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={testData.sender || ''}
                onChange={(e) => setTestData({ ...testData, sender: e.target.value })}
                placeholder="Sender (email/phone)"
                className="bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={testData.senderName || ''}
                onChange={(e) => setTestData({ ...testData, senderName: e.target.value })}
                placeholder="Sender name"
                className="bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={testData.platform || ''}
                onChange={(e) => setTestData({ ...testData, platform: e.target.value })}
                placeholder="Platform (whatsapp, telegram, etc)"
                className="bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={testData.priorityScore || 50}
                onChange={(e) => setTestData({ ...testData, priorityScore: parseInt(e.target.value) })}
                placeholder="Priority score"
                className="bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={testData.content || ''}
              onChange={(e) => setTestData({ ...testData, content: e.target.value })}
              placeholder="Message content..."
              rows={3}
              className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm resize-none"
            />

            {/* Test Result */}
            {testResult !== null && (
              <div
                className={`p-3 rounded-lg border ${
                  testResult
                    ? 'bg-success-subtle border-success-border text-success'
                    : 'bg-warning-subtle border-warning-border text-warning'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {testResult ? <Check size={16} /> : <X size={16} />}
                  {testResult ? 'This conversation would match this rule' : 'This conversation would NOT match this rule'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        {rule.id && (
          <div className="card p-4 border-error-border">
            <h3 className="font-semibold text-error mb-2">Danger Zone</h3>
            <p className="text-sm text-mission-control-text-dim mb-3">
              Deleting this rule will make the folder manual-only. Existing assignments will remain.
            </p>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 bg-error-subtle hover:bg-error-subtle text-error rounded-lg text-sm transition-colors"
            >
              <Trash2 size={14} />
              Delete Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
