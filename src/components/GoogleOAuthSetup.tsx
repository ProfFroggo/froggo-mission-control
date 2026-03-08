// GoogleOAuthSetup — shown in CommsInbox when Google is not authenticated.
// Handles the OAuth flow: click → redirect to Google → code lands at localhost:3000 → exchanged for tokens.

import { useState, useEffect, useCallback } from 'react';
import { Mail, AlertCircle, Loader, Copy } from 'lucide-react';
import { showToast } from './Toast';

interface AuthStatus {
  authenticated: boolean;
  hasCredentials?: boolean;
  needsSetup?: boolean;
  email?: string | null;
  error?: string;
}

interface Props {
  onAuthenticated: (email: string) => void;
}

export default function GoogleOAuthSetup({ onAuthenticated }: Props) {
  const [status, setStatus] = useState<'checking' | 'needs-setup' | 'ready' | 'error'>('checking');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const checkForCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return false;

    window.history.replaceState({}, document.title, window.location.pathname);
    setConnecting(true);

    try {
      const res = await fetch('/api/google/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        onAuthenticated(data.email ?? 'Connected');
        return true;
      } else {
        setError(data.error ?? 'Authentication failed');
        setStatus('ready');
      }
    } catch {
      setError('Failed to complete authentication');
      setStatus('ready');
    }
    setConnecting(false);
    return false;
  }, [onAuthenticated]);

  useEffect(() => {
    checkForCallback().then(handled => {
      if (handled) return;

      fetch('/api/google/auth/status')
        .then(r => r.json())
        .then((data: AuthStatus) => {
          setAuthStatus(data);
          if (data.needsSetup || !data.hasCredentials) {
            setStatus('needs-setup');
          } else {
            setStatus('ready');
          }
        })
        .catch(() => setStatus('ready'));
    });
  }, [checkForCallback]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/google/auth/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to get auth URL');
        setConnecting(false);
      }
    } catch {
      setError('Failed to start authentication');
      setConnecting(false);
    }
  };

  const copyPath = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('success', 'Copied', text));
  };

  if (status === 'checking' || connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-mission-control-text-dim">
        <Loader size={32} className="animate-spin text-mission-control-accent" />
        <span className="text-sm">{connecting ? 'Connecting to Google...' : 'Checking...'}</span>
      </div>
    );
  }

  if (status === 'needs-setup') {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="p-6 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Google OAuth Credentials Missing</h3>
              <p className="text-xs text-mission-control-text-dim">Install gogcli to enable Gmail and Calendar access.</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
              <p className="font-medium text-xs uppercase tracking-wider text-mission-control-text-dim">Setup Steps</p>

              <div className="space-y-2">
                <Step n={1} text="Install gogcli via Homebrew:" />
              </div>

              <div className="flex items-center gap-2 bg-mission-control-bg rounded px-3 py-2 text-xs font-mono">
                <span className="flex-1 text-mission-control-accent truncate">brew install gogcli</span>
                <button
                  onClick={() => copyPath('brew install gogcli')}
                  className="flex-shrink-0 text-mission-control-text-dim hover:text-mission-control-text"
                  title="Copy command"
                >
                  <Copy size={12} />
                </button>
              </div>

              <div className="space-y-2">
                <Step n={2} text="Authenticate gogcli with your Google account:" />
              </div>

              <div className="flex items-center gap-2 bg-mission-control-bg rounded px-3 py-2 text-xs font-mono">
                <span className="flex-1 text-mission-control-accent truncate">gog login</span>
                <button
                  onClick={() => copyPath('gog login')}
                  className="flex-shrink-0 text-mission-control-text-dim hover:text-mission-control-text"
                  title="Copy command"
                >
                  <Copy size={12} />
                </button>
              </div>

              <Step n={3} text='Reload the inbox — a "Connect Google Account" button will appear' />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-3 py-2 border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
              >
                Reload after setup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 max-w-sm mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-accent/10 flex items-center justify-center">
        <Mail size={32} className="text-mission-control-accent" />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1">Connect Gmail</h3>
        <p className="text-sm text-mission-control-text-dim leading-relaxed">
          Connect your Google account to read and send Gmail, and sync your Calendar into the Schedule view.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 w-full">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {authStatus?.error && (
        <div className="flex items-center gap-2 text-yellow-400 text-xs bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 w-full">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{authStatus.error}</span>
        </div>
      )}

      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors w-full justify-center"
      >
        <Mail size={16} />
        Connect Google Account
      </button>

      <p className="text-xs text-mission-control-text-dim/60">
        Grants read/send access to Gmail and read/write to Google Calendar. Revoke in Settings at any time.
      </p>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="w-5 h-5 rounded-full bg-mission-control-accent/20 text-mission-control-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <span className="text-xs text-mission-control-text/80 leading-relaxed">{text}</span>
    </div>
  );
}
