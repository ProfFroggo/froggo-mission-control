import { useState, useEffect } from 'react';
import { Shield, Key, Lock, AlertTriangle, CheckCircle, XCircle, Play, RefreshCw, Filter, Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { showToast } from './Toast';

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

  // Load initial data
  useEffect(() => {
    loadAPIKeys();
    loadAuditLogs();
    loadAlerts();
  }, []);

  // Load API keys from secure storage
  const loadAPIKeys = async () => {
    try {
      const result = await (window as any).clawdbot?.security?.listKeys();
      if (result?.success) {
        setApiKeys(result.keys);
      }
    } catch (e) {
      console.error('[Security] Failed to load API keys:', e);
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    try {
      const result = await (window as any).clawdbot?.security?.listAuditLogs();
      if (result?.success) {
        setAuditLogs(result.logs);
      }
    } catch (e) {
      console.error('[Security] Failed to load audit logs:', e);
    }
  };

  // Load security alerts
  const loadAlerts = async () => {
    try {
      const result = await (window as any).clawdbot?.security?.listAlerts();
      if (result?.success) {
        setAlerts(result.alerts);
      }
    } catch (e) {
      console.error('[Security] Failed to load alerts:', e);
    }
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
      const result = await (window as any).clawdbot?.security?.runAudit();
      
      if (result?.success) {
        showToast('success', 'Security Audit Complete', `Found ${result.findings.length} items`);
        loadAuditLogs(); // Refresh logs
        if (result.alerts && result.alerts.length > 0) {
          loadAlerts(); // Refresh alerts
        }
      } else {
        showToast('error', 'Audit Failed', result?.error || 'Could not complete security audit');
      }
    } catch (e: any) {
      showToast('error', 'Audit Error', e.message || 'Security audit failed');
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
      const result = await (window as any).clawdbot?.security?.addKey(newKey);
      if (result?.success) {
        showToast('success', 'Key Added', `${newKey.name} has been securely stored`);
        setAddKeyModal(false);
        setNewKey({ name: '', service: '', key: '' });
        loadAPIKeys();
      } else {
        showToast('error', 'Failed to Add Key', result?.error || 'Could not store API key');
      }
    } catch (e: any) {
      showToast('error', 'Error', e.message || 'Failed to add API key');
    }
  };

  // Delete API key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const result = await (window as any).clawdbot?.security?.deleteKey(keyId);
      if (result?.success) {
        showToast('success', 'Key Deleted', 'API key has been removed');
        loadAPIKeys();
      } else {
        showToast('error', 'Failed to Delete', result?.error || 'Could not delete API key');
      }
    } catch (e: any) {
      showToast('error', 'Error', e.message || 'Failed to delete API key');
    }
  };

  // Update audit log status
  const updateAuditStatus = async (logId: string, status: 'acknowledged' | 'resolved') => {
    try {
      const result = await (window as any).clawdbot?.security?.updateAuditLog(logId, { status });
      if (result?.success) {
        loadAuditLogs();
      }
    } catch (e) {
      console.error('[Security] Failed to update audit log:', e);
    }
  };

  // Dismiss alert
  const dismissAlert = async (alertId: string) => {
    try {
      const result = await (window as any).clawdbot?.security?.dismissAlert(alertId);
      if (result?.success) {
        loadAlerts();
      }
    } catch (e) {
      console.error('[Security] Failed to dismiss alert:', e);
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
      case 'high': return 'bg-orange-500/20 text-warning border-orange-500/30';
      case 'medium': return 'bg-warning-subtle text-warning border-warning-border';
      case 'low': return 'bg-info-subtle text-info border-info-border';
      case 'info': return 'bg-clawd-bg0/20 text-clawd-text-dim border-clawd-border/30';
      default: return 'bg-clawd-bg0/20 text-clawd-text-dim border-clawd-border/30';
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
                  className="p-1 hover:bg-white/10 rounded transition-colors"
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
        <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
          <p className="text-sm text-clawd-text-dim mb-4">
            Run a comprehensive AI-powered security audit to scan configuration files, credentials, logs, and permissions for vulnerabilities.
          </p>
          
          <button
            onClick={runSecurityAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="mt-4 p-3 bg-clawd-bg rounded-lg border border-clawd-border">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw size={14} className="animate-spin text-clawd-accent" />
                <span className="text-clawd-text-dim">{auditProgress}</span>
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
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            <Plus size={14} />
            Add Key
          </button>
        </div>
        
        <div className="bg-clawd-surface rounded-xl border border-clawd-border divide-y divide-clawd-border">
          {apiKeys.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">
              <Key size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No API keys stored</p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{key.name}</div>
                    <div className="text-xs text-clawd-text-dim mt-1">{key.service}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-2 py-1 bg-clawd-bg rounded text-xs font-mono">
                        {showKeyValues[key.id] ? key.key : '••••••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowKeyValues(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                        className="p-1 hover:bg-clawd-border rounded transition-colors"
                        title={showKeyValues[key.id] ? 'Hide' : 'Show'}
                      >
                        {showKeyValues[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {key.lastUsed && (
                      <div className="text-xs text-clawd-text-dim mt-2">
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

      {/* Audit Log Viewer */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Lock size={16} />
            Audit Log
          </h2>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-clawd-text-dim" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-sm bg-clawd-surface border border-clawd-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-clawd-accent"
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

        <div className="bg-clawd-surface rounded-xl border border-clawd-border divide-y divide-clawd-border max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">
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
                      <span className="text-xs text-clawd-text-dim">{log.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.status === 'resolved' 
                          ? 'bg-success-subtle text-success' 
                          : log.status === 'acknowledged'
                          ? 'bg-info-subtle text-info'
                          : 'bg-clawd-bg0/20 text-clawd-text-dim'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="font-medium mb-1">{log.finding}</div>
                    <div className="text-sm text-clawd-text-dim mb-2">{log.details}</div>
                    {log.recommendation && (
                      <div className="text-sm bg-clawd-bg border-l-2 border-clawd-accent pl-3 py-2 mt-2">
                        <div className="text-xs text-clawd-text-dim mb-1">💡 Recommendation</div>
                        {log.recommendation}
                      </div>
                    )}
                    <div className="text-xs text-clawd-text-dim mt-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {log.status === 'open' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateAuditStatus(log.id, 'acknowledged')}
                        className="px-2 py-1 text-xs bg-info-subtle text-info rounded hover:bg-blue-500/30 transition-colors"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => updateAuditStatus(log.id, 'resolved')}
                        className="px-2 py-1 text-xs bg-success-subtle text-success rounded hover:bg-green-500/30 transition-colors"
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
          <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Plus size={16} />
              Add API Key
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Key Name</label>
                <input
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey(k => ({ ...k, name: e.target.value }))}
                  placeholder="e.g., OpenAI Production"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Service</label>
                <input
                  type="text"
                  value={newKey.service}
                  onChange={(e) => setNewKey(k => ({ ...k, service: e.target.value }))}
                  placeholder="e.g., OpenAI"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">API Key</label>
                <input
                  type="password"
                  value={newKey.key}
                  onChange={(e) => setNewKey(k => ({ ...k, key: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddKey}
                className="flex-1 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
              >
                Add Key
              </button>
              <button
                onClick={() => {
                  setAddKeyModal(false);
                  setNewKey({ name: '', service: '', key: '' });
                }}
                className="px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-lg hover:bg-clawd-border/80 transition-colors"
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
