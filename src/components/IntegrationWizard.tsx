/**
 * IntegrationWizard — Stepped credential wizard modal for module configuration.
 *
 * Flow:
 *   Intro (step 0) → Credential steps (steps 1..N) → Review + Test (step N+1)
 *
 * Features:
 * - Resumes from last saved step on reopen (via module:integration:get)
 * - Persists step progress to DB on each Next (via module:integration:upsert)
 * - Stores credentials via module:cred:store
 * - Tests connection via module:health:test
 * - Shows LLM-generated fix suggestion on failure (via ai:generateReply)
 * - Marks integration complete via module:integration:complete
 */

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Plug } from 'lucide-react';
import BaseModal, { BaseModalBody, BaseModalFooter } from './BaseModal';
import { LoadingButton, Spinner } from './LoadingStates';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CredentialSpec {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  type: 'api_key' | 'oauth_token' | 'password' | 'url' | 'custom';
}

interface HealthCheckConfig {
  type: 'url' | 'api_call';
  credentialId?: string;
  url?: string;
  method?: string;
  successStatus?: number;
}

interface TestResult {
  success: boolean;
  error?: string;
  diagnosis?: string;
}

interface IntegrationWizardProps {
  isOpen: boolean;
  moduleId: string;
  moduleName: string;
  credentials: CredentialSpec[];
  healthCheck?: HealthCheckConfig | null;
  onComplete: () => void;
  onCancel: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSecretType(type: CredentialSpec['type']): boolean {
  return type === 'api_key' || type === 'oauth_token' || type === 'password';
}

function maskValue(value: string): string {
  if (!value) return '••••••••';
  if (value.length <= 4) return '••••••••';
  return value.slice(0, 2) + '•'.repeat(Math.min(8, value.length - 2)) + value.slice(-2);
}

// Step indices:
//   0          = intro
//   1..N       = credential steps (credentials[step - 1])
//   N+1        = review + test
function credentialIndexForStep(step: number): number {
  return step - 1;
}

// ─── Progress Dots ───────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i <= current ? 'bg-clawd-accent' : 'bg-clawd-border'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Step: Intro ─────────────────────────────────────────────────────────────

function IntroStep({
  moduleName,
  credentials,
}: {
  moduleName: string;
  credentials: CredentialSpec[];
}) {
  const typeBadge = (type: CredentialSpec['type']) => {
    const labels: Record<CredentialSpec['type'], string> = {
      api_key: 'API Key',
      oauth_token: 'OAuth Token',
      password: 'Password',
      url: 'URL',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-clawd-accent/10 flex items-center justify-center flex-shrink-0">
          <Plug size={20} className="text-clawd-accent" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-clawd-text">
            Set up {moduleName}
          </h3>
          <p className="text-sm text-clawd-text-dim mt-0.5">
            {credentials.length === 0
              ? 'No credentials required. Click Next to activate.'
              : `We'll collect ${credentials.length} credential${credentials.length !== 1 ? 's' : ''} and verify the connection.`}
          </p>
        </div>
      </div>

      {credentials.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-clawd-text-dim uppercase tracking-wider">
            Required credentials
          </p>
          <ul className="space-y-2">
            {credentials.map((cred) => (
              <li
                key={cred.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-clawd-surface border border-clawd-border"
              >
                <span className="text-sm text-clawd-text">{cred.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-clawd-border text-clawd-text-dim">
                  {typeBadge(cred.type)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Step: Credential Input ───────────────────────────────────────────────────

function CredentialStep({
  credential,
  value,
  onChange,
}: {
  credential: CredentialSpec;
  value: string;
  onChange: (val: string) => void;
}) {
  const inputType = isSecretType(credential.type) ? 'password' : 'text';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-clawd-text">{credential.label}</h3>
        {credential.description && (
          <p className="text-sm text-clawd-text-dim mt-1">{credential.description}</p>
        )}
        {credential.required && (
          <p className="text-xs text-clawd-accent mt-1">Required</p>
        )}
      </div>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          inputType === 'password'
            ? '••••••••••••'
            : credential.type === 'url'
            ? 'https://...'
            : 'Enter value...'
        }
        autoComplete="off"
        autoFocus
        className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2.5 text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent text-sm"
      />
    </div>
  );
}

// ─── Step: Review + Test ─────────────────────────────────────────────────────

function ReviewStep({
  credentials,
  values,
  testing,
  testResult,
  onTest,
  onReenter,
  onFinish,
}: {
  credentials: CredentialSpec[];
  values: Record<string, string>;
  testing: boolean;
  testResult: TestResult | null;
  onTest: () => void;
  onReenter: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-clawd-text">Review &amp; Test</h3>
        <p className="text-sm text-clawd-text-dim mt-0.5">
          Verify your credentials look correct, then test the connection.
        </p>
      </div>

      {/* Credential summary */}
      {credentials.length > 0 && (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-clawd-surface border border-clawd-border"
            >
              <span className="text-sm text-clawd-text">{cred.label}</span>
              <span className="text-xs font-mono text-clawd-text-dim">
                {values[cred.id] ? maskValue(values[cred.id]) : <em className="text-clawd-text-dim not-italic">not set</em>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Test Connection button */}
      <div className="space-y-3">
        <LoadingButton
          loading={testing}
          onClick={onTest}
          variant="secondary"
          className="w-full"
        >
          Test Connection
        </LoadingButton>

        {/* Status area */}
        {testing && (
          <div className="flex items-center gap-2 text-clawd-text-dim text-sm">
            <Spinner size={14} />
            <span>Testing connection...</span>
          </div>
        )}

        {!testing && testResult && (
          <div className="space-y-2">
            {testResult.success ? (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} />
                <span>Connection successful!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{testResult.error || 'Connection failed'}</span>
                </div>
                {testResult.diagnosis && (
                  <div className="px-3 py-2.5 rounded-lg bg-clawd-surface border border-clawd-border text-sm text-clawd-text-dim">
                    <p className="text-xs font-medium text-clawd-text-dim uppercase tracking-wider mb-1">
                      Suggested fix
                    </p>
                    {testResult.diagnosis}
                  </div>
                )}
                <button
                  onClick={onReenter}
                  className="text-xs text-clawd-accent hover:underline"
                  type="button"
                >
                  Re-enter credentials
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Finish button — visible after successful test */}
      {testResult?.success && (
        <LoadingButton onClick={onFinish} variant="primary" className="w-full">
          Finish Setup
        </LoadingButton>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntegrationWizard({
  isOpen,
  moduleId,
  moduleName,
  credentials,
  healthCheck,
  onComplete,
  onCancel,
}: IntegrationWizardProps) {
  const totalSteps = credentials.length + 2; // intro + N creds + review
  const reviewStep = credentials.length + 1;

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);

  // On mount: load persisted wizard state from DB
  useEffect(() => {
    if (!isOpen || resumeLoaded) return;

    (async () => {
      try {
        const result = await (window as any).clawdbot.modules.invoke(
          'module:integration:get',
          moduleId,
        );
        if (result?.integration?.wizard_step > 0) {
          setCurrentStep(result.integration.wizard_step);
        }
      } catch {
        // Ignore — start from step 0
      } finally {
        setResumeLoaded(true);
      }
    })();
  }, [isOpen, moduleId, resumeLoaded]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setValues({});
      setTesting(false);
      setTestResult(null);
      setResumeLoaded(false);
    }
  }, [isOpen]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (currentStep === 0) {
      // Intro → first credential (or review if no creds)
      setCurrentStep(credentials.length > 0 ? 1 : reviewStep);
      return;
    }

    const credIndex = credentialIndexForStep(currentStep);
    const credential = credentials[credIndex];
    const value = values[credential.id] || '';

    try {
      // Store the credential
      await (window as any).clawdbot.modules.invoke(
        'module:cred:store',
        moduleId,
        credential.id,
        value,
      );
      // Save wizard progress (masked placeholder — not real secret)
      await (window as any).clawdbot.modules.invoke(
        'module:integration:upsert',
        moduleId,
        currentStep + 1,
        { [credential.id]: '********' },
      );
    } catch {
      // Non-fatal — wizard still advances even if persistence fails
    }

    setCurrentStep(currentStep + 1);
    setTestResult(null);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setTestResult(null);
    }
  };

  const handleReenter = () => {
    setCurrentStep(1);
    setTestResult(null);
  };

  // ── Test Connection ─────────────────────────────────────────────────────────

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = (await (window as any).clawdbot.modules.invoke(
        'module:health:test',
        moduleId,
        healthCheck ?? null,
        values,
      )) as { success: boolean; error?: string; rawError?: string; synthetic?: boolean };

      if (result.success) {
        setTestResult({ success: true });
      } else {
        let diagnosis: string | undefined;

        // Attempt LLM diagnosis — non-critical, best-effort
        try {
          const diagResult = (await (window as any).clawdbot.modules.invoke(
            'ai:generateReply',
            {
              threadMessages: [
                {
                  role: 'user',
                  content: `Module "${moduleName}" connection test failed. Error: ${
                    result.rawError || result.error
                  }. In 1-2 sentences, what went wrong and how should the user fix it?`,
                },
              ],
            },
          )) as { success: boolean; reply?: string };

          if (diagResult?.success && diagResult.reply) {
            diagnosis = diagResult.reply;
          }
        } catch {
          // LLM unavailable — show raw error only
        }

        setTestResult({
          success: false,
          error: result.error || 'Connection failed',
          diagnosis,
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  // ── Complete ────────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    try {
      await (window as any).clawdbot.modules.invoke('module:integration:complete', moduleId);
    } catch {
      // Non-fatal — complete the wizard regardless
    }
    onComplete();
  };

  // ── Step titles ─────────────────────────────────────────────────────────────

  const stepTitle = () => {
    if (currentStep === 0) return `Configure ${moduleName}`;
    if (currentStep === reviewStep) return 'Review & Test';
    const cred = credentials[credentialIndexForStep(currentStep)];
    return cred ? `Step ${currentStep} of ${credentials.length}: ${cred.label}` : 'Configure';
  };

  const canGoNext = () => {
    if (currentStep === 0) return true;
    if (currentStep === reviewStep) return false; // review has its own finish button
    const cred = credentials[credentialIndexForStep(currentStep)];
    if (!cred) return false;
    if (cred.required) return !!values[cred.id]?.trim();
    return true;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      size="lg"
      showCloseButton={false}
      preventBackdropClose
      ariaLabel={`Integration wizard for ${moduleName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-clawd-border">
        <div>
          <h2 className="text-lg font-semibold text-clawd-text">{stepTitle()}</h2>
          <div className="mt-2">
            <ProgressDots total={totalSteps} current={currentStep} />
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-clawd-border rounded-lg transition-colors text-clawd-text-dim hover:text-clawd-text"
          type="button"
          aria-label="Cancel setup"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <BaseModalBody maxHeight="60vh">
        {currentStep === 0 && (
          <IntroStep moduleName={moduleName} credentials={credentials} />
        )}

        {currentStep >= 1 && currentStep < reviewStep && (() => {
          const cred = credentials[credentialIndexForStep(currentStep)];
          if (!cred) return null;
          return (
            <CredentialStep
              credential={cred}
              value={values[cred.id] || ''}
              onChange={(val) => setValues((prev) => ({ ...prev, [cred.id]: val }))}
            />
          );
        })()}

        {currentStep === reviewStep && (
          <ReviewStep
            credentials={credentials}
            values={values}
            testing={testing}
            testResult={testResult}
            onTest={handleTest}
            onReenter={handleReenter}
            onFinish={handleFinish}
          />
        )}
      </BaseModalBody>

      {/* Footer — navigation buttons (not shown on review step which has inline buttons) */}
      {currentStep !== reviewStep && (
        <BaseModalFooter align="right">
          {currentStep === 0 ? (
            <LoadingButton onClick={onCancel} variant="ghost">
              Cancel
            </LoadingButton>
          ) : (
            <LoadingButton onClick={handleBack} variant="ghost" icon={<ArrowLeft size={14} />}>
              Back
            </LoadingButton>
          )}

          <LoadingButton
            onClick={handleNext}
            variant="primary"
            disabled={!canGoNext()}
            icon={<ArrowRight size={14} />}
          >
            {currentStep === 0 && credentials.length === 0 ? 'Activate' : 'Next'}
          </LoadingButton>
        </BaseModalFooter>
      )}

      {/* Footer for review step — only Cancel/Back visible (Finish inside body) */}
      {currentStep === reviewStep && (
        <BaseModalFooter align="right">
          <LoadingButton onClick={handleBack} variant="ghost" icon={<ArrowLeft size={14} />}>
            Back
          </LoadingButton>
        </BaseModalFooter>
      )}
    </BaseModal>
  );
}
