// GoogleOAuthSetup — shown in CommsInbox when Google is not authenticated.
// Handles the OAuth/PKCE flow: click → redirect to Google → code lands at localhost → exchanged for tokens.

import { useState, useEffect, useCallback } from 'react';
import { Mail, AlertCircle, Loader } from 'lucide-react';

interface Props {
  onAuthenticated: (email: string) => void;
}

export default function GoogleOAuthSetup({ onAuthenticated }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }
    } catch {
      setError('Failed to complete authentication');
    }
    setConnecting(false);
    return false;
  }, [onAuthenticated]);

  useEffect(() => {
    checkForCallback();
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

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-mission-control-text-dim">
        <Loader size={32} className="animate-spin text-mission-control-accent" />
        <span className="text-sm">Connecting to Google...</span>
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
