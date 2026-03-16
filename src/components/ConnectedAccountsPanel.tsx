import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Mail, Calendar, HardDrive, MessageSquare } from 'lucide-react';
import { showToast } from './Toast';

interface GoogleAuthStatus {
  authenticated: boolean;
  hasCredentials: boolean;
  email?: string | null;
  error?: string;
}

const GOOGLE_SERVICES = [
  { icon: Mail, label: 'Gmail', description: 'Read, send, and manage email' },
  { icon: Calendar, label: 'Calendar', description: 'View and create events' },
  { icon: HardDrive, label: 'Drive', description: 'Access and search files' },
  { icon: MessageSquare, label: 'Chat', description: 'Send messages to spaces' },
];

export default function ConnectedAccountsPanel() {
  const [status, setStatus] = useState<GoogleAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google/auth?action=status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleConnect = async () => {
    try {
      window.location.href = '/api/google/auth';
    } catch {
      showToast('error', 'Failed to connect', 'Could not reach auth endpoint');
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch('/api/google/auth/revoke', { method: 'POST' });
      if (res.ok) {
        showToast('success', 'Disconnected', 'Google Workspace access revoked');
        await loadStatus();
      } else {
        showToast('error', 'Failed to revoke', 'Could not revoke access');
      }
    } catch {
      showToast('error', 'Failed to revoke', 'Could not reach revoke endpoint');
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-mission-control-text-dim">
        <RefreshCw size={20} className="animate-spin mr-2" /> Checking Google Workspace…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Google icon */}
            <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" aria-label="Google">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div>
              <div className="font-semibold">Google Workspace</div>
              {status?.authenticated && status.email ? (
                <div className="text-sm text-mission-control-text-dim">{status.email}</div>
              ) : (
                <div className="text-sm text-mission-control-text-dim">Sign in to connect Gmail, Calendar & more</div>
              )}
            </div>
          </div>

          {/* Status badge */}
          {status?.authenticated ? (
            <span className="flex items-center gap-1.5 text-sm text-success px-3 py-1 bg-success-subtle border border-success-border rounded-full">
              <CheckCircle size={14} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-error px-3 py-1 bg-error-subtle border border-error-border rounded-full">
              <XCircle size={14} /> Not connected
            </span>
          )}
        </div>

        {/* Error / setup message */}
        {status?.error && (
          <div className="mt-4 p-3 bg-warning-subtle border border-warning-border rounded-lg text-sm text-warning">
            {status.error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          {status?.authenticated ? (
            <>
              <button
                onClick={loadStatus}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm hover:border-mission-control-accent transition-colors"
              >
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-2 px-4 py-2 bg-error-subtle border border-error-border text-error rounded-lg text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {revoking ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
                Disconnect
              </button>
            </>
          ) : status?.hasCredentials ? (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm hover:bg-mission-control-accent-dim transition-colors"
            >
              Connect Google Workspace
            </button>
          ) : null}
        </div>
      </div>

      {/* Services */}
      <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-5">
        <h3 className="font-medium mb-3 text-sm text-mission-control-text-dim uppercase tracking-wide">Services enabled</h3>
        <div className="grid grid-cols-2 gap-3">
          {GOOGLE_SERVICES.map(({ icon: Icon, label, description }) => (
            <div key={label} className={`flex items-start gap-3 p-3 rounded-lg border ${status?.authenticated ? 'border-success-border bg-success-subtle' : 'border-mission-control-border bg-mission-control-bg opacity-50'}`}>
              <Icon size={18} className={status?.authenticated ? 'text-success mt-0.5' : 'text-mission-control-text-dim mt-0.5'} />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-mission-control-text-dim">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* No setup needed — click Connect above to authenticate */}
    </div>
  );
}
