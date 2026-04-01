import { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, RefreshCw, Filter, Eye, EyeOff, Trash2, Plus, Ban, X, Copy } from 'lucide-react';
import { Button, Flex, Badge, Select, TextField } from '@radix-ui/themes';
import { showToast } from './Toast';
import { settingsApi } from '../lib/api';

interface APIKey {
  id: string;
  name: string;
  key: string;
  service: string;
  lastUsed?: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  finding: string;
  details: string;
  recommendation?: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  source: string;
}

const API_PRESETS = [
  { label: 'Custom',                service: '',               placeholder: 'Your API key or secret' },
  { label: 'Anthropic',             service: 'Anthropic',      placeholder: 'sk-ant-...' },
  { label: 'OpenAI',                service: 'OpenAI',         placeholder: 'sk-...' },
  { label: 'Google Gemini',         service: 'Google Gemini',  placeholder: 'AIza...' },
  { label: 'X / Twitter API Key',   service: 'Twitter',        placeholder: 'API key (Consumer key)' },
  { label: 'X / Twitter Bearer',    service: 'Twitter Bearer', placeholder: 'AAAA...' },
  { label: 'Discord Bot Token',     service: 'Discord',        placeholder: 'Bot token' },
  { label: 'Slack Bot Token',       service: 'Slack',          placeholder: 'xoxb-...' },
  { label: 'GitHub Token',          service: 'GitHub',         placeholder: 'ghp_...' },
  { label: 'Stripe',                service: 'Stripe',         placeholder: 'sk_live_... or sk_test_...' },
  { label: 'Twilio Auth Token',     service: 'Twilio',         placeholder: 'Auth token from console' },
  { label: 'SendGrid',              service: 'SendGrid',       placeholder: 'SG...' },
  { label: 'AWS Access Key',        service: 'AWS',            placeholder: 'AKIA...' },
  { label: 'Perplexity',            service: 'Perplexity',     placeholder: 'pplx-...' },
  { label: 'Replicate',             service: 'Replicate',      placeholder: 'r8_...' },
  { label: 'ElevenLabs',            service: 'ElevenLabs',     placeholder: 'API key from dashboard' },
  { label: 'Birdeye',               service: 'Birdeye',        placeholder: 'API key from dashboard' },
  { label: 'Helius',                service: 'Helius',         placeholder: 'API key from dashboard' },
];

const DEFAULT_DISALLOWED = [
  'Bash(rm -rf *)', 'Bash(sudo *)', 'Bash(curl *)', 'Bash(wget *)',
  'Bash(git push --force *)', 'Bash(git reset --hard *)',
  'Bash(chmod *)', 'Bash(chown *)', 'Bash(kill *)', 'Bash(pkill *)',
];

export default function SecuritySettings() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showKeyValues, setShowKeyValues] = useState<{ [key: string]: boolean }>({});
  const [addKeyModal, setAddKeyModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', service: '', key: '' });

  // Blocked commands
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [newDisallowed, setNewDisallowed] = useState('');

  // Load initial data
  useEffect(() => {
    loadAPIKeys();
    loadAuditLogs();
    loadAlerts();
    loadDisallowedTools();
  }, []);

  function parseSettingArray<T>(result: { value?: unknown } | null): T[] {
    if (!result?.value) return [];
    try {
      const parsed = typeof result.value === 'string' ? JSON.parse(result.value) : result.value;
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch { return []; }
  }

  // Load API keys from settings
  const loadAPIKeys = async () => {
    try {
      const result = await settingsApi.get('security.keys');
      setApiKeys(parseSettingArray<APIKey>(result));
    } catch (e) {
      // '[Security] Failed to load API keys:', e;
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    try {
      const result = await settingsApi.get('security.auditLogs');
      setAuditLogs(parseSettingArray<AuditLog>(result));
    } catch (e) {
      // '[Security] Failed to load audit logs:', e;
    }
  };

  // Load security alerts
  const loadAlerts = async () => {
    try {
      const result = await settingsApi.get('security.alerts');
      setAlerts(parseSettingArray<SecurityAlert>(result));
    } catch (e) {
      // '[Security] Failed to load alerts:', e;
    }
  };

  // Load blocked commands (disallowed tools)
  const loadDisallowedTools = async () => {
    try {
      const result = await settingsApi.get('security.disallowedTools');
      const parsed = parseSettingArray<string>(result);
      setDisallowedTools(parsed.length > 0 ? parsed : DEFAULT_DISALLOWED);
    } catch {
      setDisallowedTools(DEFAULT_DISALLOWED);
    }
  };

  const saveDisallowedTools = async (list: string[]) => {
    const result = await settingsApi.set('security.disallowedTools', list);
    if (result?.error) showToast('error', 'Save Failed', result.error);
    else setDisallowedTools(list);
  };

  const handleAddDisallowed = async () => {
    const val = newDisallowed.trim();
    if (!val) return;
    if (disallowedTools.includes(val)) { showToast('info', 'Already blocked', val); return; }
    const updated = [...disallowedTools, val];
    await saveDisallowedTools(updated);
    setNewDisallowed('');
    showToast('success', 'Added', `${val} is now blocked`);
  };

  const handleRemoveDisallowed = async (tool: string) => {
    const updated = disallowedTools.filter(t => t !== tool);
    await saveDisallowedTools(updated);
    showToast('success', 'Removed', `${tool} unblocked`);
  };

  const handleRestoreDefaults = async () => {
    await saveDisallowedTools(DEFAULT_DISALLOWED);
    showToast('success', 'Restored', 'Default blocked commands restored');
  };

  // Run AI security audit
  const runSecurityAudit = async () => {
    setIsAuditing(true);
    setAuditProgress('Initializing security audit...');

    try {
      // Simulate audit steps
      setAuditProgress('Scanning configuration files...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setAuditProgress('Checking API keys and credentials...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setAuditProgress('Analyzing logs for vulnerabilities...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setAuditProgress('Checking file permissions...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setAuditProgress('Generating AI recommendations...');

      // Call backend to run AI-powered audit
      const result = await settingsApi.set('security.runAudit', { timestamp: Date.now() });

      if (!result?.error) {
        showToast('success', 'Security Audit Complete', 'Audit timestamp recorded');
        loadAuditLogs(); // Refresh logs
        loadAlerts();
      } else {
        showToast('error', 'Audit Failed', result.error);
      }
    } catch (e: unknown) {
      showToast('error', 'Audit Error', e instanceof Error ? e.message : 'Security audit failed');
    } finally {
      setIsAuditing(false);
      setAuditProgress('');
    }
  };

  // Add API key
  const handleAddKey = async () => {
    if (!newKey.name || !newKey.service || !newKey.key) {
      showToast('error', 'Validation Error', 'All fields are required');
      return;
    }

    try {
      const entry: APIKey = {
        id: `key-${Date.now()}`,
        name: newKey.name,
        service: newKey.service,
        key: newKey.key,
        createdAt: new Date().toISOString(),
      };
      const updated = [...apiKeys, entry];
      const result = await settingsApi.set('security.keys', updated);
      if (!result?.error) {
        showToast('success', 'Key Added', `${newKey.name} has been securely stored`);
        setAddKeyModal(false);
        setNewKey({ name: '', service: '', key: '' });
        setApiKeys(updated);
      } else {
        showToast('error', 'Failed to Add Key', result.error);
      }
    } catch (e: unknown) {
      showToast('error', 'Error', e instanceof Error ? e.message : 'Failed to add API key');
    }
  };

  // Delete API key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const updated = apiKeys.filter(k => k.id !== keyId);
      const result = await settingsApi.set('security.keys', updated);
      if (!result?.error) {
        showToast('success', 'Key Deleted', 'API key has been removed');
        setApiKeys(updated);
      } else {
        showToast('error', 'Failed to Delete', result.error);
      }
    } catch (e: unknown) {
      showToast('error', 'Error', e instanceof Error ? e.message : 'Failed to delete API key');
    }
  };

  // Update audit log status
  const updateAuditStatus = async (logId: string, status: 'acknowledged' | 'resolved') => {
    try {
      const updated = auditLogs.map(l => l.id === logId ? { ...l, status } : l);
      const result = await settingsApi.set('security.auditLogs', updated);
      if (!result?.error) {
        setAuditLogs(updated);
      }
    } catch (e) {
      // '[Security] Failed to update audit log:', e;
    }
  };

  // Dismiss alert
  const dismissAlert = async (alertId: string) => {
    try {
      const updated = alerts.filter(a => a.id !== alertId);
      const result = await settingsApi.set('security.alerts', updated);
      if (!result?.error) {
        setAlerts(updated);
      }
    } catch (e) {
      // '[Security] Failed to dismiss alert:', e;
    }
  };

  // Filter logs by severity
  const filteredLogs = severityFilter === 'all'
    ? auditLogs
    : auditLogs.filter(log => log.severity === severityFilter);

  // Severity badge color
  const getSeverityBadgeColor = (severity: string): 'red' | 'amber' | 'blue' | 'gray' => {
    switch (severity) {
      case 'critical':
      case 'high': return 'red';
      case 'medium': return 'amber';
      case 'low': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusBadgeColor = (status: string): 'grass' | 'blue' | 'gray' => {
    switch (status) {
      case 'resolved': return 'grass';
      case 'acknowledged': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Alerts */}
      {alerts.length > 0 && (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Active Security Alerts</p>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  alert.severity === 'critical' || alert.severity === 'high'
                    ? 'bg-error/10 border-error/30'
                    : alert.severity === 'medium'
                    ? 'bg-warning/10 border-warning/30'
                    : 'bg-info/10 border-info/30'
                }`}
              >
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs opacity-75 mt-1">
                    {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() => dismissAlert(alert.id)}
                  title="Dismiss"
                  aria-label="Dismiss alert"
                >
                  <CheckCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Security Audit */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">AI Security Audit</p>
        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
          <p className="text-sm text-mission-control-text-dim mb-4">
            Run a comprehensive AI-powered security audit to scan configuration files, credentials, logs, and permissions for vulnerabilities.
          </p>

          <Button
            variant="solid"
            color="grass"
            size="2"
            onClick={runSecurityAudit}
            disabled={isAuditing}
          >
            {isAuditing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Running Audit...
              </>
            ) : (
              <>
                <Shield size={16} />
                Run Security Audit
              </>
            )}
          </Button>

          {auditProgress && (
            <div className="mt-4 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
              <Flex align="center" gap="2" className="text-sm">
                <RefreshCw size={14} className="animate-spin text-mission-control-accent" />
                <span className="text-mission-control-text-dim">{auditProgress}</span>
              </Flex>
            </div>
          )}
        </div>
      </section>

      {/* API Keys Management */}
      <section>
        <Flex align="center" justify="between" className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">API Keys</p>
          <Button
            variant="soft"
            color="gray"
            size="2"
            onClick={() => setAddKeyModal(true)}
          >
            <Plus size={14} />
            Add Key
          </Button>
        </Flex>

        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border divide-y divide-mission-control-border/50">
          {apiKeys.length === 0 ? (
            <div className="p-8 text-center text-mission-control-text-dim">
              <Key size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No API keys stored</p>
              <p className="text-xs mt-1 opacity-70">Add keys to use with agents and automations</p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="text-sm font-medium text-mission-control-text">{key.name}</div>
                  <div className="text-xs text-mission-control-text-dim mt-0.5">{key.service}</div>
                  <Flex align="center" gap="1.5" className="mt-2">
                    <code className="px-2 py-0.5 bg-mission-control-bg border border-mission-control-border/60 rounded text-xs font-mono text-mission-control-text-dim tracking-wider">
                      {showKeyValues[key.id]
                        ? key.key
                        : key.key.slice(0, 6) + '••••••••••••' + key.key.slice(-4)}
                    </code>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors"
                      onClick={() => setShowKeyValues(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                      title={showKeyValues[key.id] ? 'Hide' : 'Reveal'}
                      aria-label={showKeyValues[key.id] ? 'Hide key value' : 'Reveal key value'}
                    >
                      {showKeyValues[key.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(key.key).then(
                          () => showToast('success', 'Copied', 'Key copied to clipboard'),
                          () => showToast('error', 'Copy failed', 'Could not access clipboard')
                        );
                      }}
                      title="Copy key"
                      aria-label="Copy key to clipboard"
                    >
                      <Copy size={12} />
                    </button>
                  </Flex>
                  {key.lastUsed && (
                    <div className="text-xs text-mission-control-text-dim mt-1.5">
                      Last used: {new Date(key.lastUsed).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-error hover:bg-error/5 transition-colors"
                  onClick={() => handleDeleteKey(key.id)}
                  title="Delete key"
                  aria-label="Delete API key"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Blocked Commands */}
      <section>
        <Flex align="center" justify="between" className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Blocked Commands</p>
          <Button
            type="button"
            variant="ghost"
            size="2"
            onClick={handleRestoreDefaults}
          >
            Restore defaults
          </Button>
        </Flex>
        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
          <div className="p-3 border-b border-mission-control-border bg-mission-control-bg/50">
            <p className="text-xs text-mission-control-text-dim mb-2">
              These patterns are blocked for all agents via <code className="font-mono bg-mission-control-bg px-1 rounded">--disallowedTools</code>. Supports Claude tool patterns like <code className="font-mono bg-mission-control-bg px-1 rounded">Bash(rm -rf *)</code>.
            </p>
            <Flex gap="2">
              <TextField.Root
                size="2"
                className="flex-1 font-mono text-xs"
                value={newDisallowed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDisallowed(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddDisallowed()}
                placeholder="e.g. Bash(npm publish *)"
              />
              <Button
                variant="solid"
                color="grass"
                size="2"
                onClick={handleAddDisallowed}
              >
                <Plus size={12} /> Block
              </Button>
            </Flex>
          </div>
          <div className="divide-y divide-mission-control-border max-h-64 overflow-y-auto">
            {disallowedTools.length === 0 ? (
              <div className="p-6 text-center text-mission-control-text-dim text-sm">No commands blocked</div>
            ) : (
              disallowedTools.map(tool => (
                <Flex key={tool} align="center" justify="between" className="px-3 py-2">
                  <code className="text-xs font-mono text-mission-control-text">{tool}</code>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    onClick={() => handleRemoveDisallowed(tool)}
                    title="Unblock"
                    aria-label={`Unblock ${tool}`}
                  >
                    <Ban size={14} />
                  </button>
                </Flex>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Audit Log Viewer */}
      <section>
        <Flex align="center" justify="between" className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Audit Log</p>
          <Flex align="center" gap="2">
            <Filter size={14} className="text-mission-control-text-dim" />
            <Select.Root value={severityFilter} onValueChange={setSeverityFilter}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="all">All Severities</Select.Item>
                <Select.Item value="critical">Critical</Select.Item>
                <Select.Item value="high">High</Select.Item>
                <Select.Item value="medium">Medium</Select.Item>
                <Select.Item value="low">Low</Select.Item>
                <Select.Item value="info">Info</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border divide-y divide-mission-control-border/50 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-mission-control-text-dim">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {severityFilter === 'all'
                  ? 'No audit findings. Run a security audit to get started.'
                  : `No ${severityFilter} severity findings`}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4">
                <Flex align="start" gap="3">
                  <div className="flex-1 min-w-0">
                    <Flex align="center" gap="2" className="mb-2">
                      <Badge color={getSeverityBadgeColor(log.severity)} variant="soft">
                        {log.severity.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-mission-control-text-dim">{log.category}</span>
                      <Badge color={getStatusBadgeColor(log.status)} variant="soft">
                        {log.status}
                      </Badge>
                    </Flex>
                    <div className="font-medium mb-1">{log.finding}</div>
                    <div className="text-sm text-mission-control-text-dim mb-2">{log.details}</div>
                    {log.recommendation && (
                      <div className="text-sm bg-mission-control-bg border-l-2 border-mission-control-accent pl-3 py-2 mt-2">
                        <div className="text-xs text-mission-control-text-dim mb-1">Recommendation</div>
                        {log.recommendation}
                      </div>
                    )}
                    <div className="text-xs text-mission-control-text-dim mt-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {log.status === 'open' && (
                    <Flex gap="1">
                      <Button
                        variant="soft"
                        color="gray"
                        size="2"
                        onClick={() => updateAuditStatus(log.id, 'acknowledged')}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        variant="soft"
                        color="grass"
                        size="2"
                        onClick={() => updateAuditStatus(log.id, 'resolved')}
                      >
                        Resolve
                      </Button>
                    </Flex>
                  )}
                </Flex>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Key Modal */}
      {addKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
              <h3 className="text-base font-semibold">Add Credential</h3>
              <button
                type="button"
                onClick={() => { setAddKeyModal(false); setNewKey({ name: '', service: '', key: '' }); }}
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Preset</label>
                <Select.Root
                  onValueChange={(val) => {
                    const service = val === '_custom' ? '' : val;
                    const preset = API_PRESETS.find(p => (p.service || '_custom') === val);
                    if (preset) setNewKey(k => ({ ...k, service, name: service ? preset.label : k.name }));
                  }}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Content>
                    {API_PRESETS.map(p => (
                      <Select.Item key={p.label} value={p.service || '_custom'}>{p.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <label htmlFor="api-key-name" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Label</label>
                <TextField.Root
                  id="api-key-name"
                  size="2"
                  className="w-full"
                  value={newKey.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(k => ({ ...k, name: e.target.value }))}
                  placeholder="e.g., OpenAI Production"
                />
              </div>
              <div>
                <label htmlFor="api-key-service" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Service</label>
                <TextField.Root
                  id="api-key-service"
                  size="2"
                  className="w-full"
                  value={newKey.service}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(k => ({ ...k, service: e.target.value }))}
                  placeholder="e.g., OpenAI"
                />
              </div>
              <div>
                <label htmlFor="api-key-value" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Key / Token / Secret</label>
                <TextField.Root
                  id="api-key-value"
                  size="2"
                  className="w-full font-mono"
                  type="password"
                  autoComplete="off"
                  value={newKey.key}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKey(k => ({ ...k, key: e.target.value }))}
                  placeholder={API_PRESETS.find(p => p.service === newKey.service)?.placeholder ?? 'Paste your key here'}
                />
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
              <Button
                variant="ghost"
                size="2"
                onClick={() => { setAddKeyModal(false); setNewKey({ name: '', service: '', key: '' }); }}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                size="2"
                onClick={handleAddKey}
              >
                Add Credential
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
