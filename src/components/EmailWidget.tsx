import { useState, useEffect } from 'react';
import { Mail, RefreshCw, AlertCircle, Inbox, Star, Tag } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { useUserSettings } from '../store/userSettings';
import WidgetLoading from './WidgetLoading';

interface EmailAccount {
  email: string;
  label: string;
  unread: number;
  action: number; // @action labeled
  starred: number;
}

export default function EmailWidget() {
  const { emailAccounts } = useUserSettings();
  const ACCOUNTS = emailAccounts.map(a => ({ email: a.email, label: a.label, color: a.color || 'text-mission-control-text-dim' }));
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchEmail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch counts for each account via REST API
      const results = await Promise.all(
        ACCOUNTS.map(async (acc) => {
          try {
            const res = await fetch(`/api/email/counts?account=${encodeURIComponent(acc.email)}`).then(r => r.ok ? r.json() : null).catch(() => null);
            return {
              ...acc,
              unread: res?.unread || 0,
              action: res?.action || 0,
              starred: res?.starred || 0,
            };
          } catch {
            return { ...acc, unread: 0, action: 0, starred: 0 };
          }
        })
      );
      
      setAccounts(results);
      setLastFetch(Date.now());
    } catch (e: unknown) {
      // 'Failed to fetch email:', e;
      setError('Could not load email');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount + refresh every 15 minutes
  useEffect(() => {
    fetchEmail();
    
    const interval = setInterval(fetchEmail, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalUnread = accounts.reduce((sum, a) => sum + a.unread, 0);
  const totalAction = accounts.reduce((sum, a) => sum + a.action, 0);

  const quickCheck = (account: string) => {
    gateway.sendChat(`Check my ${account} inbox and tell me what's important`);
  };

  return (
    <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border overflow-hidden">
      <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-success" />
          <h2 className="font-semibold">Email</h2>
          {totalUnread > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full flex-shrink-0 whitespace-nowrap">
              {totalUnread} unread
            </span>
          )}
          {totalAction > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-error-subtle text-error rounded-full flex-shrink-0 whitespace-nowrap">
              {totalAction} action
            </span>
          )}
        </div>
        <button
          onClick={fetchEmail}
          disabled={loading}
          className="p-2 hover:bg-mission-control-border rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="divide-y divide-mission-control-border">
        {loading && accounts.length === 0 ? (
          <WidgetLoading 
            variant="spinner" 
            title="Checking inboxes..." 
            icon={Mail}
            compact 
          />
        ) : error ? (
          <div className="p-6 text-center text-mission-control-text-dim">
            <AlertCircle size={24} className="mx-auto mb-2 text-error" />
            <p className="text-sm">{error}</p>
            <button onClick={fetchEmail} className="mt-2 text-xs text-mission-control-accent hover:underline">
              Try again
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-6 text-center text-mission-control-text-dim">
            <Inbox size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click refresh to check email</p>
            <button onClick={fetchEmail} className="mt-2 text-xs text-mission-control-accent hover:underline">
              Fetch now
            </button>
          </div>
        ) : (
          accounts.map((account) => (
            <button
              key={account.email}
              onClick={() => quickCheck(account.label)}
              onKeyDown={(e) => { if (e.key === 'Enter') quickCheck(account.label); }}
              className="w-full p-3 hover:bg-mission-control-bg/50 transition-colors cursor-pointer group text-left"
              aria-label={`Quick check ${account.label} account`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${ACCOUNTS.find(a => a.email === account.email)?.color}`}>
                    {account.label === 'Bitso' ? '💼' : account.label === 'Carbium' ? '🔷' : '📧'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{account.label}</div>
                    <div className="text-xs text-mission-control-text-dim truncate">{account.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.action > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-error-subtle text-error rounded-full">
                      <Tag size={10} />
                      {account.action}
                    </span>
                  )}
                  {account.starred > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-warning-subtle text-warning rounded-full">
                      <Star size={10} />
                      {account.starred}
                    </span>
                  )}
                  {account.unread > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                      {account.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {lastFetch > 0 && (
        <div className="px-4 py-2 border-t border-mission-control-border text-xs text-mission-control-text-dim">
          Updated {new Date(lastFetch).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
