import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle, AlertTriangle, Shield, Key, Clock, ExternalLink, Mail, Calendar, HardDrive, Users, ListTodo, BarChart2, Lock, type LucideIcon } from 'lucide-react';
import { Button, IconButton, Flex } from '@radix-ui/themes';
import { ConnectedAccount, DataType } from '../types/accounts';

interface Props {
  account: ConnectedAccount;
  onClose: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}

const DATA_TYPE_ICONS: Record<string, LucideIcon> = {
  email: Mail,
  calendar: Calendar,
  drive: HardDrive,
  contacts: Users,
  tasks: ListTodo,
};

const PERMISSION_LABELS = {
  'read': 'Read only',
  'write': 'Write only',
  'read-write': 'Read & Write',
};

const PROVIDER_DOCS = {
  google: 'https://support.google.com/accounts/answer/3466521',
  icloud: 'https://support.apple.com/en-us/HT204053',
  microsoft: 'https://support.microsoft.com/account-billing',
  apple: 'https://support.apple.com/guide/icloud',
};

export default function AccountDetailModal({ account, onClose, onRefresh, onRemove }: Props) {
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'security'>('overview');
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- handleClose is stable modal handler

  const getStatusColor = () => {
    switch (account.status) {
      case 'connected':
        return 'text-success';
      case 'error':
        return 'text-error';
      case 'needs-reauth':
        return 'text-warning';
      default:
        return 'text-mission-control-text-dim';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Allow click or Enter/Escape key
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  // Handle inner click with keyboard support
  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    // Allow click or Enter key to propagate to backdrop
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <Flex
      align="center"
      justify="center"
      p="4"
      className={`fixed inset-0 modal-backdrop backdrop-blur-md z-50 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <div
        className={`glass-modal rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-mission-control-text">{account.email}</h2>
            <Flex align="center" gap="2" className="mt-0.5">
              <span className="text-sm text-mission-control-text-dim capitalize">{account.provider}</span>
              <span className="text-mission-control-text-dim">•</span>
              <span className={`text-sm ${getStatusColor()}`}>
                {account.status === 'connected' ? 'Connected' :
                 account.status === 'error' ? 'Error' :
                 account.status === 'needs-reauth' ? 'Needs Reauth' : 'Checking'}
              </span>
            </Flex>
          </div>
          <IconButton
            onClick={handleClose}
            aria-label="Close modal"
            variant="ghost"
            color="gray"
            size="2"
           
          >
            <X size={16} />
          </IconButton>
        </div>

        {/* Tabs */}
        <Flex gap="1" className="px-6 border-b border-mission-control-border">
          {(['overview', 'permissions', 'security'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-mission-control-accent text-mission-control-accent'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {tab === 'overview' && <BarChart2 size={14} />}
              {tab === 'permissions' && <Lock size={14} />}
              {tab === 'security' && <Shield size={14} />}
              {tab}
            </button>
          ))}
        </Flex>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Rate Limits */}
              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Rate Limits & Usage</h3>
                <div className="space-y-2 text-sm">
                  {account.dataTypes.includes('email' as any) && (
                    <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                      <span className="text-mission-control-text-dim">Email Sending</span>
                      <span className="font-medium">
                        {account.metadata?.emailQuota || '500'} / day
                        <span className="text-xs text-mission-control-text-dim ml-2">
                          ({account.metadata?.emailUsed || 0} used)
                        </span>
                      </span>
                    </Flex>
                  )}
                  {account.dataTypes.includes('calendar' as any) && (
                    <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                      <span className="text-mission-control-text-dim">Calendar Events</span>
                      <span className="font-medium">
                        {account.metadata?.calendarQuota || '10,000'} / day
                        <span className="text-xs text-mission-control-text-dim ml-2">
                          ({account.metadata?.calendarUsed || 0} used)
                        </span>
                      </span>
                    </Flex>
                  )}
                  {account.dataTypes.includes('drive' as any) && (
                    <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                      <span className="text-mission-control-text-dim">Drive Storage</span>
                      <span className="font-medium">
                        {account.metadata?.driveUsed || '2.5'} GB / {account.metadata?.driveQuota || '15'} GB
                      </span>
                    </Flex>
                  )}
                  {(!account.dataTypes.includes('email' as any) && 
                    !account.dataTypes.includes('calendar' as any) && 
                    !account.dataTypes.includes('drive' as any)) && (
                    <div className="text-center py-4 text-mission-control-text-dim text-sm">
                      No rate limits applicable for this account
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 bg-mission-control-bg rounded-lg text-xs text-mission-control-text-dim">
                  Rate limits are provider-specific and reset daily. Mission Control tracks usage to avoid hitting limits.
                </div>
              </section>

              {/* Data Types */}
              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Connected Services</h3>
                <div className="grid grid-cols-2 gap-3">
                  {account.dataTypes.map((type) => {
                    const DtIcon = DATA_TYPE_ICONS[type] ?? ListTodo;
                    return (
                    <div
                      key={type}
                      className="flex items-center gap-3 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border"
                    >
                      <DtIcon size={20} className="text-mission-control-text-dim flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium capitalize">{type}</div>
                        <div className="text-xs text-mission-control-text-dim">
                          {account.metadata?.[`${type}sCount`] ? 
                            `${account.metadata[`${type}sCount`]} items` : 
                            'Active'}
                        </div>
                      </div>
                      <CheckCircle size={16} className="text-success" />
                    </div>
                    );
                  })}
                </div>
              </section>

              {/* Connection Status */}
              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Connection Details</h3>
                <div className="space-y-2 text-sm">
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <span className="text-mission-control-text-dim">Status</span>
                    <span className={`font-medium flex items-center gap-1.5 ${getStatusColor()}`}>
                      {account.status === 'connected' ? <><CheckCircle size={14} /> Connected</> :
                       account.status === 'error' ? <><X size={14} /> Error</> :
                       account.status === 'needs-reauth' ? <><AlertTriangle size={14} /> Needs Reauth</> : <><RefreshCw size={14} /> Checking</>}
                    </span>
                  </Flex>
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <span className="text-mission-control-text-dim">Auth Type</span>
                    <span className="font-medium capitalize">{account.authType}</span>
                  </Flex>
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <span className="text-mission-control-text-dim">Last Checked</span>
                    <span className="font-medium">
                      {account.lastChecked ? formatDate(account.lastChecked) : 'Never'}
                    </span>
                  </Flex>
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <span className="text-mission-control-text-dim">Added</span>
                    <span className="font-medium">{formatDate(account.createdAt)}</span>
                  </Flex>
                </div>
              </section>

              {/* Error Message */}
              {account.status === 'error' && account.errorMessage && (
                <div className="p-4 bg-error-subtle border border-error-border rounded-lg">
                  <Flex align="start" gap="2">
                    <AlertTriangle size={16} className="text-error mt-0.5" />
                    <div>
                      <div className="font-medium text-error mb-1">Connection Error</div>
                      <div className="text-sm text-error">{account.errorMessage}</div>
                    </div>
                  </Flex>
                </div>
              )}

              {/* Metadata */}
              {account.metadata && Object.keys(account.metadata).length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Additional Info</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(account.metadata).map(([key, value]) => (
                      <Flex key={key} align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                        <span className="text-mission-control-text-dim capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-medium">{String(value)}</span>
                      </Flex>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                <Flex align="start" gap="2">
                  <Shield size={16} className="text-info mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-info mb-1">Permissions Explained</div>
                    <div className="text-sm text-info">
                      These permissions allow Mission Control to access your data securely.
                      You can revoke access at any time.
                    </div>
                  </div>
                </Flex>
              </div>

              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Granted Permissions</h3>
                <div className="space-y-3">
                  {account.scopes.map((scope, idx) => {
                    const ScopeIcon = DATA_TYPE_ICONS[scope.type] ?? ListTodo;
                    return (
                    <div
                      key={idx}
                      className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border"
                    >
                      <Flex align="start" gap="3">
                        <ScopeIcon size={20} className="text-mission-control-text-dim flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <Flex align="center" gap="2" className="mb-1">
                            <span className="font-medium capitalize">{scope.type}</span>
                            <span className="text-xs px-2 py-0.5 bg-mission-control-surface rounded">
                              {PERMISSION_LABELS[scope.permission]}
                            </span>
                          </Flex>
                          <p className="text-sm text-mission-control-text-dim">{scope.description}</p>
                        </div>
                        <CheckCircle size={16} className="text-success mt-0.5" />
                      </Flex>
                    </div>
                    );
                  })}
                </div>
              </section>

              {/* Why We Need These */}
              <section className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border">
                <h4 className="font-medium mb-2">Why does Mission Control need these permissions?</h4>
                <ul className="space-y-2 text-sm text-mission-control-text-dim">
                  {account.dataTypes.includes('email' as DataType) && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span><strong>Email:</strong> Read and send messages, manage inbox</span>
                    </li>
                  )}
                  {account.dataTypes.includes('calendar' as DataType) && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span><strong>Calendar:</strong> View and create events, set reminders</span>
                    </li>
                  )}
                  {account.dataTypes.includes('drive' as DataType) && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span><strong>Drive:</strong> Access files, create documents, sync data</span>
                    </li>
                  )}
                  {account.dataTypes.includes('contacts' as DataType) && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span><strong>Contacts:</strong> Read contact information for quick access</span>
                    </li>
                  )}
                  {account.dataTypes.includes('tasks' as DataType) && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span><strong>Tasks:</strong> Sync tasks, create reminders, track progress</span>
                    </li>
                  )}
                </ul>
              </section>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Security Status</h3>
                <div className="space-y-2 text-sm">
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-mission-control-text-dim" />
                      <span className="text-mission-control-text-dim">Token Storage</span>
                    </div>
                    <span className="font-medium text-success flex items-center gap-1">
                      <CheckCircle size={14} /> Encrypted
                    </span>
                  </Flex>
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-mission-control-text-dim" />
                      <span className="text-mission-control-text-dim">OAuth Protocol</span>
                    </div>
                    <span className="font-medium text-success flex items-center gap-1">
                      <CheckCircle size={14} /> Secure
                    </span>
                  </Flex>
                  <Flex align="center" justify="between" className="p-3 bg-mission-control-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-mission-control-text-dim" />
                      <span className="text-mission-control-text-dim">Token Refresh</span>
                    </div>
                    <span className="font-medium text-success flex items-center gap-1">
                      <CheckCircle size={14} /> Automatic
                    </span>
                  </Flex>
                </div>
              </section>

              <section className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border">
                <h4 className="font-medium mb-2">How Mission Control keeps your data safe</h4>
                <ul className="space-y-2 text-sm text-mission-control-text-dim">
                  <li className="flex items-start gap-2">
                    <Lock size={14} className="mt-0.5 flex-shrink-0" />
                    <span>OAuth tokens are encrypted using system keychain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Tokens auto-refresh and never stored in plain text</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield size={14} className="mt-0.5 flex-shrink-0" />
                    <span>All API calls use secure HTTPS connections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>No data is ever shared with third parties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Removing account immediately revokes all access</span>
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-medium text-mission-control-text-dim mb-3">Provider Security</h3>
                <div className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border">
                  <p className="text-sm text-mission-control-text-dim mb-3">
                    Review and manage app permissions directly in your {account.provider} account:
                  </p>
                  <a
                    href={PROVIDER_DOCS[account.provider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-mission-control-accent hover:underline"
                  >
                    Open {account.provider} Security Settings
                    <ExternalLink size={14} />
                  </a>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="p-4 bg-error-subtle border border-error-border rounded-lg">
                <h4 className="font-medium text-error mb-2">Danger Zone</h4>
                <p className="text-sm text-error mb-3">
                  Removing this account will revoke Mission Control&apos;s access and delete all stored credentials.
                  This action cannot be undone.
                </p>
                <Button
                  onClick={onRemove}
                  variant="solid"
                  color="red"
                  size="2"
                >
                  Remove Account
                </Button>
              </section>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button
            onClick={onRefresh}
            variant="ghost"
            color="gray"
            size="2"
          >
            <RefreshCw size={16} />
            Test Connection
          </Button>
          <Button
            onClick={handleClose}
            variant="solid"
            size="2"
          >
            Done
          </Button>
        </div>
      </div>
    </Flex>
  );
}
