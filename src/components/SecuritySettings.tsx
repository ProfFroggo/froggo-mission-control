import { useState, useEffect } from 'react';
import { Shield, Key, Lock, AlertTriangle, CheckCircle, XCircle, Play, RefreshCw, Filter, Eye, EyeOff, Trash2, Plus, Ban } from 'lucide-react';
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
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-error-subtle text-error border-error-border';
      case 'high': return 'bg-warning-subtle text-warning border-warning-border';
      case 'medium': return 'bg-warning-subtle text-warning border-warning-border';
      case 'low': return 'bg-info-subtle text-info border-info-border';
      case 'info': return 'bg-mission-control-bg0/20 text-mission-control-text-dim border-mission-control-border/30';
      default: return 'bg-mission-control-bg0/20 text-mission-control-text-dim border-mission-control-border/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Alerts */}
      {alerts.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            Active Security Alerts
          </h2>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border flex items-start gap-3 ${getSeverityColor(alert.severity)}`}
              >
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs opacity-75 mt-1">
                    {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="p-1 hover:bg-mission-control-text/10 rounded transition-colors"
                  title="Dismiss"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Security Audit */}
      <section>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Shield size={16} />
          AI Security Audit
        </h2>
        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
          <p className="text-sm text-mission-control-text-dim mb-4">
            Run a comprehensive AI-powered security audit to scan configuration files, credentials, logs, and permissions for vulnerabilities.
          </p>
          
          <button
            onClick={runSecurityAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuditing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Running Audit...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Security Audit
              </>
            )}
          </button>

          {auditProgress && (
            <div className="mt-4 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw size={14} className="animate-spin text-mission-control-accent" />
                <span className="text-mission-control-text-dim">{auditProgress}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* API Keys Management */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Key size={16} />
            API Keys
          </h2>
          <button
            onClick={() => setAddKeyModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
          >
            <Plus size={14} />
            Add Key
          </button>
        </div>
        
        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border divide-y divide-mission-control-border">
          {apiKeys.length === 0 ? (
            <div className="p-8 text-center text-mission-control-text-dim">
              <Key size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No API keys stored</p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{key.name}</div>
                    <div className="text-xs text-mission-control-text-dim mt-1">{key.service}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-2 py-1 bg-mission-control-bg rounded text-xs font-mono">
                        {showKeyValues[key.id] ? key.key : '••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowKeyValues(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                        className="p-1 hover:bg-mission-control-border rounded transition-colors"
                        title={showKeyValues[key.id] ? 'Hide' : 'Show'}
                      >
                        {showKeyValues[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {key.lastUsed && (
                      <div className="text-xs text-mission-control-text-dim mt-2">
                        Last used: {new Date(key.lastUsed).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-2 hover:bg-error-subtle text-error rounded-lg transition-colors"
                    title="Delete key"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Blocked Commands */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Ban size={16} />
            Blocked Commands
          </h2>
          <button
            onClick={handleRestoreDefaults}
            className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            Restore defaults
          </button>
        </div>
        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
          <div className="p-3 border-b border-mission-control-border bg-mission-control-bg0/30">
            <p className="text-xs text-mission-control-text-dim mb-2">
              These patterns are blocked for all agents via <code className="font-mono bg-mission-control-bg px-1 rounded">--disallowedTools</code>. Supports Claude tool patterns like <code className="font-mono bg-mission-control-bg px-1 rounded">Bash(rm -rf *)</code>.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDisallowed}
                onChange={e => setNewDisallowed(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDisallowed()}
                placeholder="e.g. Bash(npm publish *)"
                className="flex-1 text-xs bg-mission-control-bg border border-mission-control-border rounded px-3 py-1.5 focus:outline-none focus:border-mission-control-accent font-mono"
              />
              <button
                onClick={handleAddDisallowed}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded hover:bg-mission-control-accent-dim transition-colors"
              >
                <Plus size={12} /> Block
              </button>
            </div>
          </div>
          <div className="divide-y divide-mission-control-border max-h-64 overflow-y-auto">
            {disallowedTools.length === 0 ? (
              <div className="p-6 text-center text-mission-control-text-dim text-sm">No commands blocked</div>
            ) : (
              disallowedTools.map(tool => (
                <div key={tool} className="flex items-center justify-between px-3 py-2">
                  <code className="text-xs font-mono text-mission-control-text">{tool}</code>
                  <button
                    onClick={() => handleRemoveDisallowed(tool)}
                    className="p-1 hover:bg-error/10 text-mission-control-text-dim hover:text-error rounded transition-colors"
                    title="Unblock"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Audit Log Viewer */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Lock size={16} />
            Audit Log
          </h2>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-mission-control-text-dim" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-sm bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-mission-control-accent"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>

        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border divide-y divide-mission-control-border max-h-96 overflow-y-auto">
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
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${getSeverityColor(log.severity)}`}>
                        {log.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-mission-control-text-dim">{log.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.status === 'resolved' 
                          ? 'bg-success-subtle text-success' 
                          : log.status === 'acknowledged'
                          ? 'bg-info-subtle text-info'
                          : 'bg-mission-control-bg0/20 text-mission-control-text-dim'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="font-medium mb-1">{log.finding}</div>
                    <div className="text-sm text-mission-control-text-dim mb-2">{log.details}</div>
                    {log.recommendation && (
                      <div className="text-sm bg-mission-control-bg border-l-2 border-mission-control-accent pl-3 py-2 mt-2">
                        <div className="text-xs text-mission-control-text-dim mb-1">💡 Recommendation</div>
                        {log.recommendation}
                      </div>
                    )}
                    <div className="text-xs text-mission-control-text-dim mt-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {log.status === 'open' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateAuditStatus(log.id, 'acknowledged')}
                        className="px-2 py-1 text-xs bg-info-subtle text-info rounded hover:bg-info-subtle transition-colors"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => updateAuditStatus(log.id, 'resolved')}
                        className="px-2 py-1 text-xs bg-success-subtle text-success rounded hover:bg-success-subtle transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Key Modal */}
      {addKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Plus size={16} />
              Add Credential
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-mission-control-text-dim mb-1">Preset</label>
                <select
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                  onChange={e => {
                    const preset = API_PRESETS.find(p => p.service === e.target.value);
                    if (preset) setNewKey(k => ({ ...k, service: preset.service, name: preset.service ? preset.label : k.name }));
                  }}
                >
                  {API_PRESETS.map(p => (
                    <option key={p.label} value={p.service}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="api-key-name" className="block text-sm text-mission-control-text-dim mb-1">Label</label>
                <input
                  id="api-key-name"
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey(k => ({ ...k, name: e.target.value }))}
                  placeholder="e.g., OpenAI Production"
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                />
              </div>
              <div>
                <label htmlFor="api-key-service" className="block text-sm text-mission-control-text-dim mb-1">Service</label>
                <input
                  id="api-key-service"
                  type="text"
                  value={newKey.service}
                  onChange={(e) => setNewKey(k => ({ ...k, service: e.target.value }))}
                  placeholder="e.g., OpenAI"
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                />
              </div>
              <div>
                <label htmlFor="api-key-value" className="block text-sm text-mission-control-text-dim mb-1">Key / Token / Secret</label>
                <input
                  id="api-key-value"
                  type="password"
                  autoComplete="off"
                  value={newKey.key}
                  onChange={(e) => setNewKey(k => ({ ...k, key: e.target.value }))}
                  placeholder={API_PRESETS.find(p => p.service === newKey.service)?.placeholder ?? 'Paste your key here'}
                  className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddKey}
                className="flex-1 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors text-sm"
              >
                Add Credential
              </button>
              <button
                onClick={() => { setAddKeyModal(false); setNewKey({ name: '', service: '', key: '' }); }}
                className="px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
