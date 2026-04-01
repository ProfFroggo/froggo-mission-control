import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Loader2, Mail, Calendar, HardDrive, Users, CheckCircle, AlertTriangle, Globe, Cloud, Monitor, Apple } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';
import { AccountProvider, DataType, AddAccountRequest } from '../types/accounts';
import { useUserSettings } from '../store/userSettings';
import { accountsApi } from '../lib/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'provider' | 'email' | 'dataTypes' | 'auth' | 'connecting' | 'success';

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  google: Globe,
  icloud: Cloud,
  microsoft: Monitor,
  apple: Apple,
};

const PROVIDER_INFO: Record<string, { name: string; color: string; description: string; supportedTypes: DataType[]; authMethods: readonly string[]; comingSoon?: boolean }> = {
  google: {
    name: 'Google',
    color: 'var(--mission-control-info)',
    description: 'Gmail, Calendar, Drive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  icloud: {
    name: 'iCloud',
    color: 'var(--mission-control-info)',
    description: 'Mail, Calendar, Contacts',
    supportedTypes: ['email', 'calendar', 'contacts'] as DataType[],
    authMethods: ['app-password'] as const,
    comingSoon: true,
  },
  microsoft: {
    name: 'Microsoft',
    color: 'var(--mission-control-info)',
    description: 'Outlook, Calendar, OneDrive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts', 'tasks'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  apple: {
    name: 'Apple',
    color: 'var(--mission-control-text)',
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

      const result = await accountsApi.add(request as unknown as Record<string, unknown>);

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
    <Flex align="center" justify="center" p="4" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-mission-control-surface rounded-2xl shadow-2xl border border-mission-control-border max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-mission-control-text">Add Connected Account</h2>
            <p className="text-xs text-mission-control-text-dim mt-0.5">
              {step === 'provider' && 'Choose your provider'}
              {step === 'email' && 'Enter your email address'}
              {step === 'dataTypes' && 'Select services to connect'}
              {step === 'auth' && 'Authenticate your account'}
              {step === 'connecting' && 'Connecting...'}
              {step === 'success' && 'Account connected!'}
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={step === 'connecting'}
            aria-label="Close wizard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <Flex align="center" gap="2">
            {(['provider', 'email', 'dataTypes', 'auth'] as const).map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    step === s || ['connecting', 'success'].includes(step) || idx < ['provider', 'email', 'dataTypes', 'auth'].indexOf(step)
                      ? 'bg-mission-control-accent'
                      : 'bg-mission-control-border'
                  }`}
                />
              </div>
            ))}
          </Flex>
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
                    type="button"
                    onClick={() => {
                      if (info.comingSoon) return;
                      setProvider(p);
                      setAuthMethod(info.authMethods[0] as 'oauth' | 'app-password');
                    }}
                    disabled={info.comingSoon}
                    className={`w-full flex items-center gap-2 px-3 py-4 rounded-lg border text-left transition-colors ${
                      provider === p ? 'bg-mission-control-accent/10 border-mission-control-accent/40' : 'border-mission-control-border hover:border-mission-control-accent/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Flex align="center" gap="4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${info.color}20` }}
                      >
                        {(() => { const PIco = PROVIDER_ICONS[p] ?? Globe; return <PIco size={28} style={{ color: info.color }} />; })()}
                      </div>
                      <div className="flex-1">
                        <Flex align="center" gap="2" className="font-semibold text-lg mb-1">
                          {info.name}
                          {info.comingSoon && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                              Coming Soon
                            </span>
                          )}
                        </Flex>
                        <div className="text-sm text-mission-control-text-dim">{info.description}</div>
                      </div>
                      {provider === p && (
                        <Check size={24} className="text-mission-control-accent" />
                      )}
                    </Flex>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Email Input */}
          {step === 'email' && currentProviderInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4 flex items-center justify-center">{(() => { const PIco = PROVIDER_ICONS[provider!] ?? Globe; return <PIco size={48} style={{ color: currentProviderInfo.color }} />; })()}</div>
                <h3 className="text-lg font-semibold mb-2">{currentProviderInfo.name} Account</h3>
                <p className="text-sm text-mission-control-text-dim">
                  Enter the email address for your {currentProviderInfo.name} account
                </p>
              </div>

              <div>
                <label htmlFor="email-input" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Email Address</label>
                <TextField.Root
                  id="email-input"
                  type="email"
                  aria-label="Email address input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`your.email@${provider === 'google' ? 'gmail.com' : provider === 'microsoft' ? 'outlook.com' : 'example.com'}`}
                  size="3"
                  className="w-full"
                />
              </div>

              {/* Known Accounts Quick Select */}
              <div>
                <span className="block text-sm font-medium mb-2 text-mission-control-text-dim">
                  Or select a known account:
                </span>
                <div className="space-y-2">
                  {provider === 'google' && useUserSettings.getState().emailAccounts.map(a => a.email).map(acc => (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => setEmail(acc)}
                      className="inline-flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
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
                <p className="text-sm text-mission-control-text-dim">
                  Choose which services Mission Control should have access to
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
                      type="button"
                      onClick={() => toggleDataType(type)}
                      className={`w-full flex items-center gap-2 px-3 py-4 rounded-lg border text-left transition-colors ${
                        isSelected ? 'bg-mission-control-accent/10 border-mission-control-accent/40' : 'border-mission-control-border hover:border-mission-control-accent/30'
                      }`}
                    >
                      <Flex align="center" gap="3">
                        <Icon size={24} className={isSelected ? 'text-mission-control-accent' : 'text-mission-control-text-dim'} />
                        <div className="flex-1">
                          <div className="font-medium mb-1">{info.label}</div>
                          <div className="text-sm text-mission-control-text-dim">{info.description}</div>
                        </div>
                        {isSelected && (
                          <Check size={20} className="text-mission-control-accent" />
                        )}
                      </Flex>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                <Flex align="start" gap="2" className="text-sm">
                  <AlertTriangle size={16} className="text-info mt-0.5 flex-shrink-0" />
                  <div className="text-info">
                    You can always add or remove services later from account settings
                  </div>
                </Flex>
              </div>
            </div>
          )}

          {/* Step 4: Authentication */}
          {step === 'auth' && currentProviderInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Authenticate</h3>
                <p className="text-sm text-mission-control-text-dim">
                  {authMethod === 'oauth' 
                    ? `We'll open your browser to securely authenticate with ${currentProviderInfo.name}`
                    : `Enter an app-specific password for ${email}`}
                </p>
              </div>

              {authMethod === 'oauth' ? (
                <div className="space-y-4">
                  <div className="bg-mission-control-bg border border-mission-control-border rounded-xl p-4 text-center">
                    <div className="text-4xl mb-4">🔐</div>
                    <h4 className="font-medium mb-2">OAuth Authentication</h4>
                    <p className="text-sm text-mission-control-text-dim mb-4">
                      Click &quot;Connect&quot; below to open your browser and sign in to {currentProviderInfo.name}.
                      Your credentials never pass through Mission Control.
                    </p>
                    <ul className="text-sm text-mission-control-text-dim text-left space-y-2">
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
                        <span>Grant permissions to Mission Control</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>4.</span>
                        <span>You&apos;ll be redirected back automatically</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                    <Flex align="start" gap="2" className="text-sm">
                      <AlertTriangle size={16} className="text-info mt-0.5 flex-shrink-0" />
                      <div className="text-info">
                        <strong>Permissions requested:</strong>
                        <ul className="mt-2 space-y-1">
                          {selectedDataTypes.map(type => (
                            <li key={type}>• {DATA_TYPE_INFO[type].description}</li>
                          ))}
                        </ul>
                      </div>
                    </Flex>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                    <Flex align="start" gap="2">
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
                    </Flex>
                  </div>

                  <div>
                    <label htmlFor="app-password" className="text-xs font-medium text-mission-control-text-dim mb-1 block">App-Specific Password</label>
                    <TextField.Root
                      id="app-password"
                      type="password"
                      aria-label="App-specific password input"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                      size="3"
                      className="w-full"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => window.open(
                      provider === 'icloud' ? 'https://appleid.apple.com/account/manage' : '#',
                      '_blank'
                    )}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
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
              <Loader2 size={48} className="text-mission-control-accent animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connecting to {currentProviderInfo?.name}...</h3>
              <p className="text-sm text-mission-control-text-dim">
                {authMethod === 'oauth' 
                  ? 'Complete authentication in the browser window'
                  : 'Verifying credentials...'}
              </p>
            </div>
          )}

          {/* Step 6: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check size={32} className="text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Account Connected!</h3>
              <p className="text-sm text-mission-control-text-dim text-center">
                {email} has been successfully connected to Mission Control
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && step !== 'connecting' && step !== 'success' && (
            <div className="mt-6 p-4 bg-error/10 border border-error/30 rounded-lg">
              <Flex align="start" gap="2">
                <AlertTriangle size={16} className="text-error mt-0.5" />
                <div className="text-sm text-error">{error}</div>
              </Flex>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== 'connecting' && step !== 'success' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-mission-control-border flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="2"
              onClick={handleBack}
              disabled={step === 'provider'}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <Button
              onClick={handleNext}
              variant="solid"
              size="2"
            >
              {step === 'auth' ? 'Connect' : 'Next'}
              {step !== 'auth' && <ArrowRight size={16} />}
            </Button>
          </div>
        )}
      </div>
    </Flex>
  );
}
