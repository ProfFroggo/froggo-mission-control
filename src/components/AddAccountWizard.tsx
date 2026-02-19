import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Loader2, Mail, Calendar, HardDrive, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { AccountProvider, DataType, AddAccountRequest } from '../types/accounts';
import { useUserSettings } from '../store/userSettings';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'provider' | 'email' | 'dataTypes' | 'auth' | 'connecting' | 'success';

const PROVIDER_INFO: Record<string, { name: string; logo: string; color: string; description: string; supportedTypes: DataType[]; authMethods: readonly string[]; comingSoon?: boolean }> = {
  google: {
    name: 'Google',
    logo: '🔵',
    color: '#4285f4',
    description: 'Gmail, Calendar, Drive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  icloud: {
    name: 'iCloud',
    logo: '☁️',
    color: '#007aff',
    description: 'Mail, Calendar, Contacts',
    supportedTypes: ['email', 'calendar', 'contacts'] as DataType[],
    authMethods: ['app-password'] as const,
    comingSoon: true,
  },
  microsoft: {
    name: 'Microsoft',
    logo: '🔷',
    color: '#00a4ef',
    description: 'Outlook, Calendar, OneDrive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts', 'tasks'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  apple: {
    name: 'Apple',
    logo: '',
    color: '#000000',
    description: 'iCloud Mail, Calendar, Contacts',
    supportedTypes: ['email', 'calendar', 'contacts'] as DataType[],
    authMethods: ['app-password'] as const,
  },
};

const DATA_TYPE_INFO = {
  email: {
    icon: Mail,
    label: 'Email',
    description: 'Read and send emails, manage inbox',
  },
  calendar: {
    icon: Calendar,
    label: 'Calendar',
    description: 'View and create events, set reminders',
  },
  drive: {
    icon: HardDrive,
    label: 'Drive/Storage',
    description: 'Access files and documents',
  },
  contacts: {
    icon: Users,
    label: 'Contacts',
    description: 'Access contact information',
  },
  tasks: {
    icon: CheckCircle,
    label: 'Tasks',
    description: 'Sync tasks and to-dos',
  },
};

export default function AddAccountWizard({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<AccountProvider | null>(null);
  const [email, setEmail] = useState('');
  const [selectedDataTypes, setSelectedDataTypes] = useState<DataType[]>([]);
  const [authMethod, setAuthMethod] = useState<'oauth' | 'app-password' | null>(null);
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentProviderInfo = provider ? PROVIDER_INFO[provider] : null;

  const handleNext = () => {
    setError(null);

    if (step === 'provider') {
      if (!provider) {
        setError('Please select a provider');
        return;
      }
      setStep('email');
    } else if (step === 'email') {
      if (!email || !email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }
      setStep('dataTypes');
    } else if (step === 'dataTypes') {
      if (selectedDataTypes.length === 0) {
        setError('Please select at least one data type');
        return;
      }
      setStep('auth');
    } else if (step === 'auth') {
      if (!authMethod) {
        setError('Please select an authentication method');
        return;
      }
      if (authMethod === 'app-password' && !appPassword) {
        setError('Please enter your app password');
        return;
      }
      handleConnect();
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 'email') setStep('provider');
    else if (step === 'dataTypes') setStep('email');
    else if (step === 'auth') setStep('dataTypes');
  };

  const handleConnect = async () => {
    if (!provider || !email || !authMethod) return;

    setStep('connecting');
    setError(null);

    try {
      const request: AddAccountRequest = {
        provider,
        email,
        dataTypes: selectedDataTypes,
        authType: authMethod,
        appPassword: authMethod === 'app-password' ? appPassword : undefined,
      };

      const result = await window.clawdbot?.accounts?.add(request as unknown as string);

      if (result?.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(result?.error || 'Failed to connect account');
        setStep('auth');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect account');
      setStep('auth');
    }
  };

  const toggleDataType = (type: DataType) => {
    if (selectedDataTypes.includes(type)) {
      setSelectedDataTypes(selectedDataTypes.filter(t => t !== type));
    } else {
      setSelectedDataTypes([...selectedDataTypes, type]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-clawd-border">
          <div>
            <h2 className="text-xl font-semibold">Add Connected Account</h2>
            <p className="text-sm text-clawd-text-dim mt-1">
              {step === 'provider' && 'Choose your provider'}
              {step === 'email' && 'Enter your email address'}
              {step === 'dataTypes' && 'Select services to connect'}
              {step === 'auth' && 'Authenticate your account'}
              {step === 'connecting' && 'Connecting...'}
              {step === 'success' && 'Account connected!'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'connecting'}
            className="p-2 hover:bg-clawd-bg rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close wizard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {(['provider', 'email', 'dataTypes', 'auth'] as const).map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    step === s || ['connecting', 'success'].includes(step) || idx < ['provider', 'email', 'dataTypes', 'auth'].indexOf(step)
                      ? 'bg-clawd-accent'
                      : 'bg-clawd-border'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-4">
              {(Object.keys(PROVIDER_INFO) as AccountProvider[]).map((p) => {
                const info = PROVIDER_INFO[p];
                return (
                  <button
                    key={p}
                    onClick={() => {
                      if (info.comingSoon) return;
                      setProvider(p);
                      setAuthMethod(info.authMethods[0] as 'oauth' | 'app-password');
                    }}
                    disabled={info.comingSoon}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      info.comingSoon
                        ? 'border-clawd-border opacity-50 cursor-not-allowed'
                        : provider === p
                          ? 'border-clawd-accent bg-clawd-accent/10'
                          : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                        style={{ backgroundColor: `${info.color}20` }}
                      >
                        {info.logo}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-1 flex items-center gap-2">
                          {info.name}
                          {info.comingSoon && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-clawd-warning/20 text-clawd-warning">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-clawd-text-dim">{info.description}</div>
                      </div>
                      {provider === p && (
                        <Check size={24} className="text-clawd-accent" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Email Input */}
          {step === 'email' && currentProviderInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-5xl mb-4">{currentProviderInfo.logo}</div>
                <h3 className="text-lg font-semibold mb-2">{currentProviderInfo.name} Account</h3>
                <p className="text-sm text-clawd-text-dim">
                  Enter the email address for your {currentProviderInfo.name} account
                </p>
              </div>

              <div>
                <label htmlFor="email-input" className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  id="email-input"
                  type="email"
                  aria-label="Email address input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`your.email@${provider === 'google' ? 'gmail.com' : provider === 'microsoft' ? 'outlook.com' : 'example.com'}`}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-3 focus:outline-none focus:border-clawd-accent"
                />
              </div>

              {/* Known Accounts Quick Select */}
              <div>
                <span className="block text-sm font-medium mb-2 text-clawd-text-dim">
                  Or select a known account:
                </span>
                <div className="space-y-2">
                  {provider === 'google' && useUserSettings.getState().emailAccounts.map(a => a.email).map(acc => (
                    <button
                      key={acc}
                      onClick={() => setEmail(acc)}
                      className="w-full p-3 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent/50 transition-colors text-left"
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Data Types Selection */}
          {step === 'dataTypes' && currentProviderInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Select Services</h3>
                <p className="text-sm text-clawd-text-dim">
                  Choose which services Froggo should have access to
                </p>
              </div>

              <div className="space-y-3">
                {currentProviderInfo.supportedTypes.map((type) => {
                  const info = DATA_TYPE_INFO[type];
                  const Icon = info.icon;
                  const isSelected = selectedDataTypes.includes(type);

                  return (
                    <button
                      key={type}
                      onClick={() => toggleDataType(type)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-clawd-accent bg-clawd-accent/10'
                          : 'border-clawd-border hover:border-clawd-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={24} className={isSelected ? 'text-clawd-accent' : 'text-clawd-text-dim'} />
                        <div className="flex-1">
                          <div className="font-medium mb-1">{info.label}</div>
                          <div className="text-sm text-clawd-text-dim">{info.description}</div>
                        </div>
                        {isSelected && (
                          <Check size={20} className="text-clawd-accent" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={16} className="text-info mt-0.5 flex-shrink-0" />
                  <div className="text-info">
                    You can always add or remove services later from account settings
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Authentication */}
          {step === 'auth' && currentProviderInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Authenticate</h3>
                <p className="text-sm text-clawd-text-dim">
                  {authMethod === 'oauth' 
                    ? `We'll open your browser to securely authenticate with ${currentProviderInfo.name}`
                    : `Enter an app-specific password for ${email}`}
                </p>
              </div>

              {authMethod === 'oauth' ? (
                <div className="space-y-4">
                  <div className="p-6 bg-clawd-bg rounded-xl border border-clawd-border text-center">
                    <div className="text-4xl mb-4">🔐</div>
                    <h4 className="font-medium mb-2">OAuth Authentication</h4>
                    <p className="text-sm text-clawd-text-dim mb-4">
                      Click &quot;Connect&quot; below to open your browser and sign in to {currentProviderInfo.name}.
                      Your credentials never pass through Froggo.
                    </p>
                    <ul className="text-sm text-clawd-text-dim text-left space-y-2">
                      <li className="flex items-start gap-2">
                        <span>1.</span>
                        <span>Browser window will open</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>2.</span>
                        <span>Sign in to your {currentProviderInfo.name} account</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>3.</span>
                        <span>Grant permissions to Froggo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>4.</span>
                        <span>You&apos;ll be redirected back automatically</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle size={16} className="text-info mt-0.5 flex-shrink-0" />
                      <div className="text-info">
                        <strong>Permissions requested:</strong>
                        <ul className="mt-2 space-y-1">
                          {selectedDataTypes.map(type => (
                            <li key={type}>• {DATA_TYPE_INFO[type].description}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-warning-subtle border border-warning-border rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-warning mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-warning">
                        <strong>App-Specific Password Required</strong>
                        <p className="mt-2">
                          {provider === 'icloud' && 
                            'Generate an app-specific password at appleid.apple.com → Sign-In and Security → App-Specific Passwords'}
                          {provider === 'apple' && 
                            'Create an app-specific password in your Apple ID settings'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="app-password" className="block text-sm font-medium mb-2">App-Specific Password</label>
                    <input
                      id="app-password"
                      type="password"
                      aria-label="App-specific password input"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-3 focus:outline-none focus:border-clawd-accent font-mono"
                    />
                  </div>

                  <button
                    onClick={() => window.open(
                      provider === 'icloud' ? 'https://appleid.apple.com/account/manage' : '#',
                      '_blank'
                    )}
                    className="text-sm text-clawd-accent hover:underline"
                  >
                    How to generate an app-specific password →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Connecting */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="text-clawd-accent animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connecting to {currentProviderInfo?.name}...</h3>
              <p className="text-sm text-clawd-text-dim">
                {authMethod === 'oauth' 
                  ? 'Complete authentication in the browser window'
                  : 'Verifying credentials...'}
              </p>
            </div>
          )}

          {/* Step 6: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
                <Check size={32} className="text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Account Connected!</h3>
              <p className="text-sm text-clawd-text-dim text-center">
                {email} has been successfully connected to Froggo
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && step !== 'connecting' && step !== 'success' && (
            <div className="mt-6 p-4 bg-error-subtle border border-error-border rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-error mt-0.5" />
                <div className="text-sm text-error">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== 'connecting' && step !== 'success' && (
          <div className="flex items-center justify-between p-6 border-t border-clawd-border">
            <button
              onClick={handleBack}
              disabled={step === 'provider'}
              className="px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg hover:bg-clawd-surface transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors flex items-center gap-2"
            >
              {step === 'auth' ? 'Connect' : 'Next'}
              {step !== 'auth' && <ArrowRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
