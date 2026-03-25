import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, Loader2, Mail, Calendar, HardDrive, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button, IconButton, TextField, Flex } from '@radix-ui/themes';
import { AccountProvider, DataType, AddAccountRequest } from '../types/accounts';
import { useUserSettings } from '../store/userSettings';
import { accountsApi } from '../lib/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'provider' | 'email' | 'dataTypes' | 'auth' | 'connecting' | 'success';

const PROVIDER_INFO: Record<string, { name: string; logo: string; color: string; description: string; supportedTypes: DataType[]; authMethods: readonly string[]; comingSoon?: boolean }> = {
  google: {
    name: 'Google',
    logo: '🔵',
    color: 'var(--mission-control-info)',
    description: 'Gmail, Calendar, Drive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  icloud: {
    name: 'iCloud',
    logo: '☁️',
    color: 'var(--mission-control-info)',
    description: 'Mail, Calendar, Contacts',
    supportedTypes: ['email', 'calendar', 'contacts'] as DataType[],
    authMethods: ['app-password'] as const,
    comingSoon: true,
  },
  microsoft: {
    name: 'Microsoft',
    logo: '🔷',
    color: 'var(--mission-control-info)',
    description: 'Outlook, Calendar, OneDrive, Contacts',
    supportedTypes: ['email', 'calendar', 'drive', 'contacts', 'tasks'] as DataType[],
    authMethods: ['oauth'] as const,
  },
  apple: {
    name: 'Apple',
    logo: '',
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
    <Flex align="center" justify="center" p="4" className="fixed inset-0 bg-black/50 z-50">
      <div className="bg-mission-control-surface rounded-xl border border-mission-control-border max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
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
          <IconButton
            onClick={onClose}
            disabled={step === 'connecting'}
            size="2"
            variant="ghost"
            color="gray"
           
            aria-label="Close wizard"
          >
            <X size={20} />
          </IconButton>
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
                  <Button
                    key={p}
                    onClick={() => {
                      if (info.comingSoon) return;
                      setProvider(p);
                      setAuthMethod(info.authMethods[0] as 'oauth' | 'app-password');
                    }}
                    disabled={info.comingSoon}
                    variant={provider === p ? 'soft' : 'ghost'}
                    color={provider === p ? 'violet' : 'gray'}
                    size="2"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '1rem', height: 'auto' }}
                  >
                    <Flex align="center" gap="4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                        style={{ backgroundColor: `${info.color}20` }}
                      >
                        {info.logo}
                      </div>
                      <div className="flex-1">
                        <Flex align="center" gap="2" className="font-semibold text-lg mb-1">
                          {info.name}
                          {info.comingSoon && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-warning-subtle text-warning">
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
                  </Button>
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
                <p className="text-sm text-mission-control-text-dim">
                  Enter the email address for your {currentProviderInfo.name} account
                </p>
              </div>

              <div>
                <label htmlFor="email-input" className="block text-sm font-medium mb-2">Email Address</label>
                <TextField.Root
                  id="email-input"
                  type="email"
                  aria-label="Email address input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`your.email@${provider === 'google' ? 'gmail.com' : provider === 'microsoft' ? 'outlook.com' : 'example.com'}`}
                  size="3"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Known Accounts Quick Select */}
              <div>
                <span className="block text-sm font-medium mb-2 text-mission-control-text-dim">
                  Or select a known account:
                </span>
                <div className="space-y-2">
                  {provider === 'google' && useUserSettings.getState().emailAccounts.map(a => a.email).map(acc => (
                    <Button
                      key={acc}
                      onClick={() => setEmail(acc)}
                      variant="ghost"
                      color="gray"
                      size="2"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      {acc}
                    </Button>
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
                    <Button
                      key={type}
                      onClick={() => toggleDataType(type)}
                      variant={isSelected ? 'soft' : 'ghost'}
                      color={isSelected ? 'violet' : 'gray'}
                      size="2"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '1rem', height: 'auto' }}
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
                    </Button>
                  );
                })}
              </div>

              <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
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
                  <div className="p-6 bg-mission-control-bg rounded-lg border border-mission-control-border text-center">
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

                  <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
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
                  <div className="p-4 bg-warning-subtle border border-warning-border rounded-lg">
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
                    <label htmlFor="app-password" className="block text-sm font-medium mb-2">App-Specific Password</label>
                    <TextField.Root
                      id="app-password"
                      type="password"
                      aria-label="App-specific password input"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                      size="3"
                      style={{ width: '100%', fontFamily: 'monospace' }}
                    />
                  </div>

                  <Button
                    onClick={() => window.open(
                      provider === 'icloud' ? 'https://appleid.apple.com/account/manage' : '#',
                      '_blank'
                    )}
                    variant="ghost"
                    color="violet"
                    size="2"
                  >
                    How to generate an app-specific password →
                  </Button>
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
              <div className="w-16 h-16 rounded-full bg-success-subtle flex items-center justify-center mb-4">
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
            <div className="mt-6 p-4 bg-error-subtle border border-error-border rounded-lg">
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
              onClick={handleBack}
              disabled={step === 'provider'}
              variant="ghost"
              color="gray"
              size="2"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <Button
              onClick={handleNext}
              variant="solid"
              color="violet"
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
