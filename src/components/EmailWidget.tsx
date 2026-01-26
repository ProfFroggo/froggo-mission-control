import { useState, useEffect } from 'react';
import { Mail, RefreshCw, AlertCircle, Inbox, Star, Tag } from 'lucide-react';
import { gateway } from '../lib/gateway';

interface EmailAccount {
  email: string;
  label: string;
  unread: number;
  action: number; // @action labeled
  starred: number;
}

const ACCOUNTS = [
  { email: 'kevin.macarthur@bitso.com', label: 'Bitso', color: 'text-blue-400' },
  { email: 'kevin@carbium.io', label: 'Carbium', color: 'text-green-400' },
  { email: 'kmacarthur.gpt@gmail.com', label: 'Personal', color: 'text-purple-400' },
];

export default function EmailWidget() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchEmail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Ask Froggo to check email counts
      const result = await gateway.sendChat(
        '[SYSTEM] Check unread email counts for all 3 accounts using gog CLI. ' +
        'For each account, count: total unread, @action labeled, starred. ' +
        'Return JSON array: [{email, unread, action, starred}]. Only JSON, no other text.'
      );
      
      if (result?.content) {
        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const merged = ACCOUNTS.map(acc => ({
            ...acc,
            unread: parsed.find((p: any) => p.email === acc.email)?.unread || 0,
            action: parsed.find((p: any) => p.email === acc.email)?.action || 0,
            starred: parsed.find((p: any) => p.email === acc.email)?.starred || 0,
          }));
          setAccounts(merged);
          setLastFetch(Date.now());
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch email:', e);
      setError('Could not load email');
    } finally {
      setLoading(false);
    }
  };

  const totalUnread = accounts.reduce((sum, a) => sum + a.unread, 0);
  const totalAction = accounts.reduce((sum, a) => sum + a.action, 0);

  const quickCheck = (account: string) => {
    gateway.sendChat(`Check my ${account} inbox and tell me what's important`);
  };

  return (
    <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden">
      <div className="p-4 border-b border-clawd-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-green-400" />
          <h2 className="font-semibold">Email</h2>
          {totalUnread > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-clawd-accent/20 text-clawd-accent rounded-full">
              {totalUnread} unread
            </span>
          )}
          {totalAction > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full">
              {totalAction} action
            </span>
          )}
        </div>
        <button
          onClick={fetchEmail}
          disabled={loading}
          className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="divide-y divide-clawd-border">
        {loading && accounts.length === 0 ? (
          <div className="p-6 text-center text-clawd-text-dim">
            <Mail size={24} className="mx-auto mb-2 opacity-50 animate-pulse" />
            <p className="text-sm">Checking inboxes...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-clawd-text-dim">
            <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
            <p className="text-sm">{error}</p>
            <button onClick={fetchEmail} className="mt-2 text-xs text-clawd-accent hover:underline">
              Try again
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-6 text-center text-clawd-text-dim">
            <Inbox size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click refresh to check email</p>
            <button onClick={fetchEmail} className="mt-2 text-xs text-clawd-accent hover:underline">
              Fetch now
            </button>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.email}
              onClick={() => quickCheck(account.label)}
              className="p-3 hover:bg-clawd-bg/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${ACCOUNTS.find(a => a.email === account.email)?.color}`}>
                    {account.label === 'Bitso' ? '💼' : account.label === 'Carbium' ? '🔷' : '📧'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{account.label}</div>
                    <div className="text-xs text-clawd-text-dim truncate">{account.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.action > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                      <Tag size={10} />
                      {account.action}
                    </span>
                  )}
                  {account.starred > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                      <Star size={10} />
                      {account.starred}
                    </span>
                  )}
                  {account.unread > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-clawd-accent/20 text-clawd-accent rounded-full">
                      {account.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {lastFetch > 0 && (
        <div className="px-4 py-2 border-t border-clawd-border text-xs text-clawd-text-dim">
          Updated {new Date(lastFetch).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
