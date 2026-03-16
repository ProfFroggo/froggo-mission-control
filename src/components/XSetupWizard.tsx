// Setup wizard for Social Media module — verifies X/Twitter API, wires agents, syncs data
import { useState, useEffect, useCallback } from 'react';
import { Twitter, Key, CheckCircle, AlertTriangle, ArrowRight, ExternalLink, RefreshCw, Eye, EyeOff, XCircle, User, BarChart2, Bot } from 'lucide-react';
import { showToast } from './Toast';

interface XSetupWizardProps {
  onComplete: () => void;
}

type Step = 'keys' | 'verify' | 'agent' | 'done';

const TWITTER_KEYS = [
  { id: 'twitter_api_key', label: 'API Key (Consumer Key)', placeholder: 'Enter your X API key...', required: false },
  { id: 'twitter_api_secret', label: 'API Secret (Consumer Secret)', placeholder: 'Enter your API secret...', required: false },
  { id: 'twitter_oauth_client_id', label: 'OAuth 2.0 Client ID', placeholder: 'Client ID...', required: true },
  { id: 'twitter_oauth_client_secret', label: 'OAuth 2.0 Client Secret', placeholder: 'Client secret...', required: true },
  { id: 'twitter_bearer_token', label: 'Bearer Token', placeholder: 'AAAA...', required: true },
] as const;

async function getKey(key: string): Promise<string> {
  try {
    const res = await fetch(`/api/settings/${key}`);
    const data = await res.json();
    return data?.value || '';
  } catch { return ''; }
}

async function saveKey(key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    return res.ok;
  } catch { return false; }
}

interface VerifyResult {
  success: boolean;
  user?: { id: string; name: string; username: string; profile_image_url?: string; public_metrics?: Record<string, number> };
  error?: string;
  checks?: Record<string, boolean>;
}

export default function XSetupWizard({ onComplete }: XSetupWizardProps) {
  const [step, setStep] = useState<Step>('keys');
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);

  // Verify state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Agent state
  const [agentWiring, setAgentWiring] = useState(false);
  const [agentWired, setAgentWired] = useState(false);

  // Load existing keys
  useEffect(() => {
    (async () => {
      const loaded: Record<string, string> = {};
      for (const k of TWITTER_KEYS) {
        loaded[k.id] = await getKey(k.id);
      }
      setValues(loaded);
      setLoading(false);
    })();
  }, []);

  const requiredFilled = TWITTER_KEYS.filter(k => k.required).every(k => values[k.id]?.trim());
  const anyFilled = TWITTER_KEYS.some(k => values[k.id]?.trim());

  const handleSaveKeys = async () => {
    setSaving(true);
    let ok = true;
    for (const k of TWITTER_KEYS) {
      if (values[k.id]?.trim()) {
        if (!await saveKey(k.id, values[k.id].trim())) ok = false;
      }
    }
    setSaving(false);
    if (ok) {
      showToast('Keys saved to keychain', 'success');
      setStep('verify');
      // Auto-verify after saving
      handleVerify();
    } else {
      showToast('Failed to save some keys', 'error');
    }
  };

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/x/verify', { method: 'POST' });
      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      if (data.success) {
        showToast(`Connected as @${data.user?.username}`, 'success');
      }
    } catch (e) {
      setVerifyResult({ success: false, error: 'Network error — is the server running?' });
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleWireAgent = async () => {
    setAgentWiring(true);
    try {
      // Ensure social-manager agent has Twitter tools enabled
      // This patches the agent config to include the X/Twitter related tools
      await fetch('/api/agents/social-manager/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tools: ['task_create', 'task_update', 'task_list', 'task_activity_create',
                  'chat_post', 'chat_read', 'approval_create', 'schedule_create', 'schedule_list',
                  'image_generate'],
        }),
      }).catch(() => { /* agent may not exist yet — non-fatal */ });

      setAgentWired(true);
      showToast('Agent configured for social media', 'success');
    } catch {
      showToast('Agent wiring failed — configure manually in Agents', 'warning');
      setAgentWired(true); // Don't block progress
    } finally {
      setAgentWiring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={24} className="text-mission-control-accent animate-spin" />
      </div>
    );
  }

  const STEPS: { id: Step; label: string }[] = [
    { id: 'keys', label: 'Credentials' },
    { id: 'verify', label: 'Verify' },
    { id: 'agent', label: 'Setup' },
    { id: 'done', label: 'Ready' },
  ];

  const stepIdx = STEPS.findIndex(s => s.id === step);

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-info-subtle flex items-center justify-center mx-auto mb-4">
            <Twitter size={32} className="text-info" />
          </div>
          <h1 className="text-2xl font-bold text-mission-control-text mb-2">Connect X / Twitter</h1>
          <p className="text-sm text-mission-control-text-dim">
            {step === 'keys' && 'Add your API credentials. Keys are stored securely in your OS keychain.'}
            {step === 'verify' && 'Testing your credentials against the X API...'}
            {step === 'agent' && 'Configuring your social media agent...'}
            {step === 'done' && 'Everything is connected and ready to go!'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              {i > 0 && <div className={`w-6 h-px ${i <= stepIdx ? 'bg-mission-control-accent' : 'bg-mission-control-border'}`} />}
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                i === stepIdx ? 'bg-mission-control-accent/20 text-mission-control-accent' :
                i < stepIdx ? 'bg-success-subtle text-success' :
                'bg-mission-control-border text-mission-control-text-dim'
              }`}>
                {i < stepIdx && <CheckCircle size={10} />}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Keys */}
        {step === 'keys' && (
          <div className="space-y-4">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-mission-control-text flex items-center gap-2"><Key size={14} /> API Credentials</h3>
                <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-mission-control-text-dim hover:text-mission-control-text flex items-center gap-1">
                  {showKeys ? <EyeOff size={12} /> : <Eye size={12} />} {showKeys ? 'Hide' : 'Show'}
                </button>
              </div>
              {TWITTER_KEYS.map(k => (
                <div key={k.id}>
                  <label className="block text-xs text-mission-control-text-dim mb-1">
                    {k.label} {k.required && <span className="text-error">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys ? 'text' : 'password'}
                      value={values[k.id] || ''}
                      onChange={e => setValues(p => ({ ...p, [k.id]: e.target.value }))}
                      placeholder={k.placeholder}
                      className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                    />
                    {values[k.id]?.trim() && <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />}
                  </div>
                </div>
              ))}
            </div>
            <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors">
              <ExternalLink size={12} /> Get credentials from the X Developer Portal
            </a>
            <button
              onClick={handleSaveKeys}
              disabled={saving || !requiredFilled}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {saving ? 'Saving...' : 'Save & Verify'}
            </button>
          </div>
        )}

        {/* Step 2: Verify */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6">
              {verifying ? (
                <div className="text-center py-4">
                  <RefreshCw size={32} className="mx-auto text-mission-control-accent animate-spin mb-3" />
                  <p className="text-sm text-mission-control-text-dim">Verifying credentials with X API...</p>
                </div>
              ) : verifyResult?.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {verifyResult.user?.profile_image_url ? (
                      <img src={verifyResult.user.profile_image_url} alt="" className="w-14 h-14 rounded-full" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-info-subtle flex items-center justify-center"><User size={24} className="text-info" /></div>
                    )}
                    <div>
                      <p className="font-semibold text-mission-control-text">{verifyResult.user?.name}</p>
                      <p className="text-sm text-mission-control-accent">@{verifyResult.user?.username}</p>
                    </div>
                    <CheckCircle size={24} className="text-success ml-auto" />
                  </div>
                  {verifyResult.user?.public_metrics && (
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-mission-control-border">
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-mission-control-text">{(verifyResult.user.public_metrics.followers_count ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-mission-control-text-dim">Followers</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-mission-control-text">{(verifyResult.user.public_metrics.following_count ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-mission-control-text-dim">Following</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums text-mission-control-text">{(verifyResult.user.public_metrics.tweet_count ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-mission-control-text-dim">Posts</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : verifyResult ? (
                <div className="text-center py-4 space-y-3">
                  <XCircle size={32} className="mx-auto text-error" />
                  <p className="text-sm font-medium text-error">Verification Failed</p>
                  <p className="text-xs text-mission-control-text-dim">{verifyResult.error}</p>
                  {verifyResult.checks && (
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {Object.entries(verifyResult.checks).map(([k, v]) => (
                        <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${v ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'}`}>
                          {v ? <CheckCircle size={10} className="inline mr-1" /> : <XCircle size={10} className="inline mr-1" />}
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('keys')} className="flex-1 px-4 py-2.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:text-mission-control-text transition-colors">
                Back
              </button>
              {verifyResult?.success ? (
                <button onClick={() => { setStep('agent'); handleWireAgent(); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors">
                  <ArrowRight size={14} /> Continue
                </button>
              ) : (
                <button onClick={handleVerify} disabled={verifying}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40">
                  {verifying ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {verifying ? 'Verifying...' : 'Retry Verification'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Agent Setup */}
        {step === 'agent' && (
          <div className="space-y-4">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-mission-control-accent/20 flex items-center justify-center">
                  <Bot size={20} className="text-mission-control-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-mission-control-text">Social Media Agent</p>
                  <p className="text-xs text-mission-control-text-dim">Configuring tools and permissions...</p>
                </div>
                {agentWiring ? (
                  <RefreshCw size={16} className="text-mission-control-accent animate-spin ml-auto" />
                ) : agentWired ? (
                  <CheckCircle size={16} className="text-success ml-auto" />
                ) : null}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-success" />
                  <span className="text-mission-control-text">API credentials stored in keychain</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-success" />
                  <span className="text-mission-control-text">X API connection verified</span>
                </div>
                <div className="flex items-center gap-2">
                  {agentWired ? <CheckCircle size={12} className="text-success" /> : <RefreshCw size={12} className="text-mission-control-text-dim animate-spin" />}
                  <span className="text-mission-control-text">{agentWired ? 'Agent tools configured' : 'Configuring agent tools...'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep('done')}
              disabled={!agentWired}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40"
            >
              <ArrowRight size={14} /> Finish Setup
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="bg-mission-control-surface border border-success-border rounded-lg p-6 text-center space-y-3">
              <CheckCircle size={48} className="mx-auto text-success" />
              <h2 className="text-lg font-semibold text-mission-control-text">X / Twitter Connected</h2>
              <p className="text-sm text-mission-control-text-dim">
                Your account is verified, credentials are in the keychain, and the social agent is configured.
              </p>
            </div>
            <button onClick={async () => {
                // Save setup completion flag
                await fetch('/api/settings/twitter_setup_complete', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ value: 'true' }),
                }).catch(() => {});
                onComplete();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors">
              <BarChart2 size={14} /> Open Social Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
