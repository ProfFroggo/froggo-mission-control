import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, LogOut, Wifi, WifiOff, MessageSquare, Gamepad2, MessageCircle, Briefcase, Mail, Globe, Radio, Send as SendPlane } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

interface ChannelAccount {
  accountId: string;
  name?: string;
  connected?: boolean;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number;
  lastError?: string;
  lastStartAt?: number;
  lastStopAt?: number;
  lastInboundAt?: number;
  lastOutboundAt?: number;
  dmPolicy?: string;
  mode?: string;
  tokenSource?: string;
  botTokenSource?: string;
}

interface ChannelInfo {
  id: string;
  label: string;
  accounts: ChannelAccount[];
  defaultAccountId?: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  discord: <Gamepad2 size={20} />,
  telegram: <SendPlane size={20} />,
  whatsapp: <MessageCircle size={20} />,
  slack: <Briefcase size={20} />,
  email: <Mail size={20} />,
  web: <Globe size={20} />,
};

export default function ChannelsTab() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gateway.getChannelsStatus();
      if (result) {
        const order = result.channelOrder || Object.keys(result.channelAccounts || {});
        const labels = result.channelLabels || {};
        const accounts = result.channelAccounts || {};
        const defaults = result.channelDefaultAccountId || {};

        const parsed: ChannelInfo[] = order.map(id => ({
          id,
          label: labels[id] || id.charAt(0).toUpperCase() + id.slice(1),
          accounts: accounts[id] || [],
          defaultAccountId: defaults[id],
        }));
        setChannels(parsed);
      }
    } catch (e) {
      // 'Failed to load channels:', e;
      showToast('error', 'Failed to load channels', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const handleLogout = async (channelId: string, accountId?: string) => {
    showConfirm({
      title: 'Logout',
      message: `Are you sure you want to logout ${accountId || channelId}?`,
      confirmLabel: 'Logout',
      type: 'warning',
    }, async () => {
      try {
        await gateway.channelLogout(channelId, accountId);
        showToast('success', 'Logged out');
        loadChannels();
      } catch (e) {
        showToast('error', 'Logout failed', String(e));
      }
    });
  };

  const formatTimeAgo = (ms?: number) => {
    if (!ms) return '—';
    const diff = Date.now() - ms;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-mission-control-text-dim">
          {channels.length} channel{channels.length !== 1 ? 's' : ''} •{' '}
          {channels.reduce((n, c) => n + c.accounts.filter(a => a.connected).length, 0)} connected accounts
        </div>
        <button onClick={loadChannels} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border rounded-lg text-sm hover:bg-mission-control-border/80">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && channels.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-mission-control-text-dim">
          <RefreshCw size={24} className="animate-spin mr-3" /> Loading channels...
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 text-mission-control-text-dim">
          <MessageSquare size={48} className="mx-auto opacity-20 mb-4" />
          <p>No channels configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map(channel => {
            const isExpanded = expandedChannel === channel.id;
            const connectedCount = channel.accounts.filter(a => a.connected).length;
            const totalCount = channel.accounts.length;
            const hasError = channel.accounts.some(a => a.lastError);

            return (
              <div key={channel.id} className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-mission-control-bg/50 transition-colors"
                  onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedChannel(isExpanded ? null : channel.id); } }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${channel.label} channel - ${isExpanded ? 'collapse' : 'expand'}`}
                >
                  <span className="text-2xl">{CHANNEL_ICONS[channel.id] || <Radio size={20} />}</span>
                  <div className="flex-1">
                    <div className="font-medium">{channel.label}</div>
                    <div className="text-xs text-mission-control-text-dim">
                      {connectedCount}/{totalCount} account{totalCount !== 1 ? 's' : ''} connected
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasError && <span className="w-2 h-2 rounded-full bg-error" title="Has errors" />}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      connectedCount > 0 ? 'bg-success-subtle text-success' : 'bg-mission-control-bg0/20 text-mission-control-text-dim'
                    }`}>
                      {connectedCount > 0 ? 'Online' : 'Offline'}
                    </span>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-mission-control-border">
                    {channel.accounts.length === 0 ? (
                      <div className="p-4 text-sm text-mission-control-text-dim">No accounts configured</div>
                    ) : channel.accounts.map((account, i) => (
                      <div key={i} className="p-4 border-b border-mission-control-border last:border-b-0 hover:bg-mission-control-border/40">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded ${account.connected ? 'bg-success-subtle' : 'bg-mission-control-bg0/20'}`}>
                            {account.connected ? <Wifi size={14} className="text-success" /> : <WifiOff size={14} className="text-mission-control-text-dim" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{account.name || account.accountId}</div>
                            <div className="text-xs text-mission-control-text-dim flex flex-wrap gap-x-3 gap-y-0.5">
                              {account.enabled !== undefined && (
                                <span className={account.enabled ? 'text-success' : 'text-mission-control-text-dim'}>
                                  {account.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              )}
                              {account.dmPolicy && <span>DM: {account.dmPolicy}</span>}
                              {account.mode && <span>Mode: {account.mode}</span>}
                              {account.lastInboundAt && <span>Last in: {formatTimeAgo(account.lastInboundAt)}</span>}
                              {account.lastOutboundAt && <span>Last out: {formatTimeAgo(account.lastOutboundAt)}</span>}
                              {account.reconnectAttempts !== undefined && account.reconnectAttempts > 0 && (
                                <span className="text-warning">Reconnects: {account.reconnectAttempts}</span>
                              )}
                            </div>
                            {account.lastError && (
                              <div className="text-xs text-error mt-1">{account.lastError}</div>
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleLogout(channel.id, account.accountId); }}
                            className="p-2 hover:bg-error-subtle text-mission-control-text-dim hover:text-error rounded-lg transition-colors"
                            title="Logout"
                          >
                            <LogOut size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />
    </div>
  );
}
