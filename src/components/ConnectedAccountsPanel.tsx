import { useState, useEffect, lazy, Suspense } from 'react';
import { 
  Mail, Calendar, HardDrive, Users, Plus, RefreshCw, 
  CheckCircle, XCircle, AlertTriangle, Trash2, X, ChevronRight,
  Key, Clock, Shield, Database, Link as LinkIcon, HelpCircle
} from 'lucide-react';
import { showToast } from './Toast';
import { useConfirmDialog } from './ConfirmDialog';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConnectedAccounts');

// Lazy load ChannelsTab to avoid import-time errors breaking the whole panel
const ChannelsTab = lazy(() => import('./ChannelsTab').catch((err) => {
  logger.error('Failed to load ChannelsTab:', err);
  return {
    default: () => <div className="text-center py-8 text-clawd-text-dim">Failed to load Channels tab</div>
  };
}));

interface ConnectedAccount {
  id: string;
  // Support both old (provider) and new (accountType) field names
  accountType?: 'google' | 'icloud' | 'microsoft' | 'outlook';
  provider?: string;
  email: string;
  displayName?: string;
  // Support both old (status) and new (authStatus) field names
  authStatus?: 'connected' | 'expired' | 'error' | 'revoked';
  status?: string;
  grantedScopes?: string[];
  scopes?: Array<{ type: string; permission: string; description: string }>;
  dataTypes?: Array<'email' | 'calendar' | 'drive' | 'contacts' | 'tasks'>;
  lastSyncTime?: number;
  lastChecked?: number;
  lastSyncStatus?: 'success' | 'error' | 'partial';
  profilePictureUrl?: string;
  skillName?: string;
  createdAt: number;
  updatedAt: number;
}

interface AccountPermission {
  id: number;
  accountId: string;
  permissionType: string;
  permissionScope: string;
  grantedAt: number;
  lastUsedAt?: number;
}

interface AccountTypeInfo {
  type: string;
  name: string;
  icon: string;
  supportedDataTypes: string[];
  requiresSkill: boolean;
  skillName?: string;
  available: boolean;
}

// Data type icon mapping
const DATA_TYPE_ICONS: Record<string, any> = {
  email: Mail,
  calendar: Calendar,
  drive: HardDrive,
  contacts: Users,
  tasks: CheckCircle,
};

// Data type color mapping
const DATA_TYPE_COLORS: Record<string, string> = {
  email: 'bg-info-subtle text-info border-info-border',
  calendar: 'bg-success-subtle text-success border-success-border',
  drive: 'bg-review-subtle text-review border-review-border',
  contacts: 'bg-warning-subtle text-warning border-warning-border',
  tasks: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

// Account type icon mapping
const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  google: '📧',
  icloud: '🍎',
  microsoft: '📨',
  outlook: '📨',
};

// Normalize account data to handle both old and new service formats
function normalizeAccount(account: any): ConnectedAccount {
  return {
    ...account,
    accountType: account.accountType || account.provider || 'google',
    authStatus: account.authStatus || account.status || 'error',
    dataTypes: Array.isArray(account.dataTypes) ? account.dataTypes : [],
    grantedScopes: account.grantedScopes || (Array.isArray(account.scopes) ? account.scopes.map((s: any) => s?.description || s?.type || '') : []),
    lastSyncTime: account.lastSyncTime || account.lastChecked,
    createdAt: account.createdAt || Date.now(),
    updatedAt: account.updatedAt || Date.now(),
  };
}

// Safe icon lookup - returns a fallback if icon not found
function getDataTypeIcon(type: string) {
  return DATA_TYPE_ICONS[type] || HelpCircle;
}

export default function ConnectedAccountsPanel() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [availableTypes, setAvailableTypes] = useState<AccountTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<ConnectedAccount | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccountPermissions, setSelectedAccountPermissions] = useState<AccountPermission[]>([]);
  const [addingAccount, setAddingAccount] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [importingGoogle, setImportingGoogle] = useState(false);
  const [panelTab, setPanelTab] = useState<'accounts' | 'channels'>('accounts');
  const { showConfirm } = useConfirmDialog();

  useEffect(() => {
    loadAccounts();
    loadAvailableTypes();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      if (!window.clawdbot?.accounts?.list) {
        // APIs not available (web mode) - show empty state instead of error
        setAccounts([]);
        return;
      }
      const result = await window.clawdbot.accounts.list();
      if (result?.success) {
        const normalized = (result.accounts || []).map(normalizeAccount);
        setAccounts(normalized);
      } else if (result?.error) {
        showToast('error', 'Failed to load accounts', result.error);
      }
    } catch (err: unknown) {
      // '[ConnectedAccounts] Failed to load accounts:', err;
      showToast('error', 'Failed to load accounts', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTypes = async () => {
    try {
      const result = await window.clawdbot?.accounts?.getAvailableTypes();
      if (result?.success) {
        setAvailableTypes((result.types || []) as AccountTypeInfo[]);
      }
    } catch (err: unknown) {
      // 'Failed to load available types:', err;
    }
  };

  const handleAccountClick = async (account: ConnectedAccount) => {
    setSelectedAccount(account);
    
    // Load permissions
    try {
      const result = await window.clawdbot?.accounts?.getPermissions(account.id);
      if (result?.success) {
        setSelectedAccountPermissions((result.permissions || []) as AccountPermission[]);
      }
    } catch (err: unknown) {
      // 'Failed to load permissions:', err;
    }
    
    setShowDetailModal(true);
  };

  const handleRefresh = async (accountId: string) => {
    try {
      const result = await window.clawdbot?.accounts?.refresh(accountId);
      if (result?.success) {
        showToast('success', 'Account refreshed', 'Connection verified successfully');
        loadAccounts();
      } else {
        showToast('error', 'Refresh failed', result?.error || 'Unknown error');
      }
    } catch (err: unknown) {
      showToast('error', 'Refresh failed', err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    showConfirm({
      title: 'Remove Account',
      message: `Remove account ${account.email}?\n\nThis will revoke access and delete stored credentials.`,
      confirmLabel: 'Remove',
      type: 'danger',
    }, async () => {
      try {
        const result = await window.clawdbot?.accounts?.remove(accountId);
        if (result?.success) {
          showToast('success', 'Account removed', `${account.email} has been removed`);
          loadAccounts();
          if (selectedAccount?.id === accountId) {
            setShowDetailModal(false);
          }
        } else {
          showToast('error', 'Failed to remove', result?.error || 'Unknown error');
        }
      } catch (err: unknown) {
        showToast('error', 'Failed to remove', err instanceof Error ? err.message : String(err));
      }
    });
  };

  const handleImportGoogle = async () => {
    setImportingGoogle(true);
    try {
      const result = await window.clawdbot?.accounts?.importGoogle();
      if (result?.success) {
        showToast('success', 'Import complete', `Imported ${result.imported} Google account(s)`);
        if (result.errors && result.errors.length > 0) {
          showToast('warning', 'Import partial', `${result.errors.length} account(s) had errors`);
        }
        loadAccounts();
      } else {
        showToast('error', 'Import failed', result?.error || 'Unknown error');
      }
    } catch (err: unknown) {
      showToast('error', 'Import failed', err instanceof Error ? err.message : String(err));
    } finally {
      setImportingGoogle(false);
    }
  };

  const handleAddAccount = async () => {
    if (!selectedType) {
      showToast('warning', 'Select account type', 'Please select an account type to add');
      return;
    }

    setAddingAccount(true);
    try {
      const result = await window.clawdbot?.accounts?.add(selectedType, {
        conversational: true
      });
      
      if (result?.success) {
        showToast('success', 'Account added', 'Account authenticated successfully');
        loadAccounts();
        setShowAddModal(false);
        setSelectedType('');
      } else {
        showToast('error', 'Authentication failed', result?.error || 'Could not authenticate account');
      }
    } catch (err: unknown) {
      showToast('error', 'Authentication failed', err instanceof Error ? err.message : String(err));
    } finally {
      setAddingAccount(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <LinkIcon size={24} /> Connected Accounts
          </h1>
          <p className="text-clawd-text-dim">
            Manage your Google, iCloud, Microsoft, and other connected accounts
          </p>
          <div className="flex gap-2 mt-4">
            {(['accounts', 'channels'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  panelTab === tab
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {tab === 'accounts' ? '🔗 Accounts' : '📡 Channels'}
              </button>
            ))}
          </div>
        </div>

        {panelTab === 'channels' && (
          <Suspense fallback={<div className="text-center py-8 text-clawd-text-dim"><RefreshCw size={24} className="mx-auto animate-spin mb-2" />Loading channels...</div>}>
            <ChannelsTab />
          </Suspense>
        )}

        {panelTab === 'accounts' && <>

        {/* Smart Selection Rules */}
        <div className="mb-6 p-4 bg-info-subtle border border-info-border rounded-xl">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <h3 className="font-semibold text-info mb-1">Smart Account Selection</h3>
              <p className="text-sm text-info">
                <strong>No default accounts!</strong> Froggo intelligently chooses which account to use based on context.
                Every account is equal - selection is context-aware and intelligent.
              </p>
            </div>
          </div>
          
          <details className="mt-3">
            <summary className="text-sm font-medium text-info cursor-pointer hover:text-info">
              📋 View Selection Rules (7 Priority Levels)
            </summary>
            <div className="mt-3 space-y-2">
              {[
                { priority: 1, rule: 'Exact Address Match', description: 'Email received at your address → Reply from that same address', example: 'Highest priority - ensures replies come from the right address' },
                { priority: 2, rule: 'Reply-To Header', description: 'Uses reply-to address from original message', example: 'Respects email threading and conversation flow' },
                { priority: 3, rule: 'Conversation Continuity', description: 'Continues thread with same account used previously', example: 'Keeps multi-message conversations consistent' },
                { priority: 4, rule: 'Calendar Source', description: 'Invite on iCloud calendar → Uses iCloud account', example: 'Matches calendar events to their source' },
                { priority: 5, rule: 'Domain Match', description: '@company.com email → user@company.com', example: 'Uses company email for company communications' },
                { priority: 6, rule: 'Capability Match', description: 'Uses accounts with required data type (email, calendar, etc)', example: 'Ensures account can handle the action' },
                { priority: 7, rule: 'Context-Free', description: 'No context available - suggests adding more info', example: 'Last resort - indicates missing context' },
              ].map((rule) => (
                <div key={rule.priority} className="flex gap-3 p-2 bg-clawd-bg rounded">
                  <div className="text-info font-bold text-sm w-6">{rule.priority}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{rule.rule}</div>
                    <div className="text-xs text-clawd-text-dim">{rule.description}</div>
                    <div className="text-xs text-info mt-1">Example: {rule.example}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            <Plus size={16} />
            Add Account
          </button>
          
          <button
            onClick={handleImportGoogle}
            disabled={importingGoogle}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors disabled:opacity-50"
          >
            {importingGoogle ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
            Import Google Accounts
          </button>

          <button
            onClick={loadAccounts}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Accounts List */}
        {loading ? (
          <div className="text-center py-12 text-clawd-text-dim">
            <RefreshCw size={32} className="mx-auto mb-3 animate-spin" />
            <p>Loading accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 bg-clawd-surface rounded-xl border border-clawd-border">
            <LinkIcon size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-50" />
            <h3 className="text-lg font-medium mb-2">No accounts connected</h3>
            <p className="text-clawd-text-dim mb-4">
              Add your first account to get started
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
            >
              <Plus size={16} />
              Add Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-clawd-surface rounded-xl border border-clawd-border p-4 hover:border-clawd-accent transition-colors cursor-pointer group"
                onClick={() => handleAccountClick(account)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAccountClick(account); } }}
                role="button"
                tabIndex={0}
                aria-label={`${account.email} account - ${account.authStatus === 'connected' ? 'connected' : account.authStatus === 'expired' ? 'expired' : 'error'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Account Icon */}
                    <div className="text-3xl">
                      {ACCOUNT_TYPE_ICONS[account.accountType || ''] || '📧'}
                    </div>

                    {/* Account Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{account.email}</h3>
                        {account.authStatus === 'connected' ? (
                          <CheckCircle size={16} className="text-success" />
                        ) : account.authStatus === 'expired' ? (
                          <AlertTriangle size={16} className="text-warning" />
                        ) : (
                          <XCircle size={16} className="text-error" />
                        )}
                      </div>

                      {/* Data Types */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(account.dataTypes || []).map((type) => {
                          const Icon = getDataTypeIcon(type);
                          return (
                            <span
                              key={type}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${DATA_TYPE_COLORS[type] || 'bg-clawd-bg0/20 text-clawd-text-dim border-clawd-border/30'}`}
                            >
                              <Icon size={14} />
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </span>
                          );
                        })}
                      </div>

                      {/* Meta Info */}
                      <div className="text-xs text-clawd-text-dim">
                        <span>Last sync: {formatRelativeTime(account.lastSyncTime)}</span>
                        {account.skillName && (
                          <span className="ml-3">
                            Skill: <code className="text-clawd-accent">{account.skillName}</code>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefresh(account.id);
                        }}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Refresh connection"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(account.id);
                        }}
                        className="p-2 hover:bg-error-subtle text-error rounded-lg transition-colors"
                        title="Remove account"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={20} className="text-clawd-text-dim" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}
      </div>

      {panelTab === 'accounts' && <>
      {/* Account Detail Modal */}
      {showDetailModal && selectedAccount && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowDetailModal(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close account detail modal"
        >
          <div 
            className="bg-clawd-surface rounded-xl border border-clawd-border p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="text-4xl">
                  {ACCOUNT_TYPE_ICONS[selectedAccount.accountType || ''] || '📧'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selectedAccount.email}</h2>
                  <p className="text-sm text-clawd-text-dim">
                    {(selectedAccount.accountType || 'Unknown').charAt(0).toUpperCase() + (selectedAccount.accountType || 'unknown').slice(1)} Account
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Connection Status */}
            <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} />
                <h3 className="font-medium">Connection Status</h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedAccount.authStatus === 'connected' ? (
                  <>
                    <CheckCircle size={16} className="text-success" />
                    <span className="text-success">Connected</span>
                  </>
                ) : selectedAccount.authStatus === 'expired' ? (
                  <>
                    <AlertTriangle size={16} className="text-warning" />
                    <span className="text-warning">Token Expired</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-error" />
                    <span className="text-error">Connection Error</span>
                  </>
                )}
              </div>
            </div>

            {/* Data Types Accessed */}
            <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Database size={16} />
                <h3 className="font-medium">Data Types Accessed</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedAccount.dataTypes || []).map((type) => {
                  const Icon = getDataTypeIcon(type);
                  return (
                    <div
                      key={type}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${DATA_TYPE_COLORS[type] || 'bg-clawd-bg0/20 text-clawd-text-dim border-clawd-border/30'}`}
                    >
                      <Icon size={16} />
                      <span className="capitalize">{type}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permissions Granted */}
            {selectedAccount.grantedScopes && selectedAccount.grantedScopes.length > 0 && (
              <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={16} />
                  <h3 className="font-medium">Permissions Granted</h3>
                </div>
                <div className="space-y-1">
                  {selectedAccount.grantedScopes.map((scope, idx) => (
                    <div key={idx} className="text-sm text-clawd-text-dim flex items-center gap-2">
                      <CheckCircle size={14} className="text-success" />
                      <code className="text-xs">{scope}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Permissions */}
            {selectedAccountPermissions.length > 0 && (
              <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={16} />
                  <h3 className="font-medium">Detailed Permissions</h3>
                </div>
                <div className="space-y-2">
                  {selectedAccountPermissions.map((perm) => (
                    <div key={perm.id} className="text-sm">
                      <div className="font-medium">{perm.permissionType}</div>
                      <div className="text-xs text-clawd-text-dim">
                        <code>{perm.permissionScope}</code>
                      </div>
                      {perm.lastUsedAt && (
                        <div className="text-xs text-clawd-text-dim">
                          Last used: {formatRelativeTime(perm.lastUsedAt)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Information */}
            <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} />
                <h3 className="font-medium">Sync Information</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-clawd-text-dim">Last Sync:</span>
                  <span>{formatDate(selectedAccount.lastSyncTime)}</span>
                </div>
                {selectedAccount.lastSyncStatus && (
                  <div className="flex justify-between">
                    <span className="text-clawd-text-dim">Status:</span>
                    <span className={
                      selectedAccount.lastSyncStatus === 'success' ? 'text-success' :
                      selectedAccount.lastSyncStatus === 'partial' ? 'text-warning' :
                      'text-error'
                    }>
                      {selectedAccount.lastSyncStatus.charAt(0).toUpperCase() + selectedAccount.lastSyncStatus.slice(1)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-clawd-text-dim">Account Created:</span>
                  <span>{formatDate(selectedAccount.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleRefresh(selectedAccount.id);
                  setShowDetailModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
              >
                <RefreshCw size={16} />
                Refresh Connection
              </button>
              <button
                onClick={() => {
                  handleRemove(selectedAccount.id);
                  setShowDetailModal(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-error-subtle text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors"
              >
                <Trash2 size={16} />
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !addingAccount && setShowAddModal(false)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === 'Escape') && !addingAccount) { e.preventDefault(); setShowAddModal(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close add account modal"
        >
          <div 
            className="bg-clawd-surface rounded-xl border border-clawd-border p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add Connected Account</h2>
              <button
                onClick={() => !addingAccount && setShowAddModal(false)}
                disabled={addingAccount}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Account Type Selection */}
            <div className="mb-6">
              <h3 className="font-medium mb-3">Select Account Type</h3>
              <div className="space-y-2">
                {availableTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => setSelectedType(type.type)}
                    disabled={!type.available}
                    className={`w-full p-4 rounded-lg border transition-colors text-left ${
                      selectedType === type.type
                        ? 'border-clawd-accent bg-clawd-accent/10'
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    } ${!type.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{type.name}</div>
                        <div className="text-sm text-clawd-text-dim">
                          {type.supportedDataTypes.join(', ')}
                        </div>
                        {!type.available && type.requiresSkill && (
                          <div className="text-xs text-error mt-1">
                            Requires &apos;{type.skillName}&apos; skill (not installed)
                          </div>
                        )}
                      </div>
                      {selectedType === type.type && (
                        <CheckCircle size={20} className="text-clawd-accent" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Setup Instructions */}
            {selectedType && (
              <div className="mb-6 p-4 bg-clawd-bg rounded-lg">
                <h3 className="font-medium mb-2">Setup Instructions</h3>
                <div className="text-sm text-clawd-text-dim space-y-2">
                  <p>1. Click &quot;Continue&quot; to start the authentication process</p>
                  <p>2. A browser window will open for OAuth authentication</p>
                  <p>3. Sign in and grant the requested permissions</p>
                  <p>4. Your account will be automatically configured</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={addingAccount}
                className="flex-1 px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-lg hover:bg-clawd-border/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!selectedType || addingAccount}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
              >
                {addingAccount ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>}
    </div>
  );
}
