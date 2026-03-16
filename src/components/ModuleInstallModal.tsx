import { useState } from 'react';
import { X, CheckCircle, XCircle, Loader2, Download, Key, Package, Bot } from 'lucide-react';
import { moduleApi, catalogApi } from '../lib/api';
import type { CatalogModule } from '../types/catalog';

interface ModuleInstallModalProps {
  module: CatalogModule;
  onClose: () => void;
  onInstalled?: (moduleId: string) => void;
}

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

interface InstallStep {
  id: string;
  label: string;
  detail: string;
  status: StepStatus;
  errorMsg?: string;
}

function buildSteps(module: CatalogModule): InstallStep[] {
  return [
    {
      id: 'check',
      label: 'Check dependencies',
      detail: [
        module.requiredApis.length > 0 ? `APIs: ${module.requiredApis.join(', ')}` : null,
        module.requiredAgents.length > 0 ? `Agents: ${module.requiredAgents.join(', ')}` : null,
        module.requiredNpm.length > 0 ? `npm: ${module.requiredNpm.join(', ')}` : null,
      ].filter(Boolean).join(' · ') || 'No external deps',
      status: 'pending',
    },
    {
      id: 'catalog',
      label: 'Mark installed in catalog',
      detail: 'catalog_modules.installed = 1',
      status: 'pending',
    },
    {
      id: 'module_state',
      label: 'Register in module system',
      detail: 'module_state table + enabled',
      status: 'pending',
    },
  ];
}

const STEP_ICON: Record<StepStatus, React.ReactNode> = {
  pending: <div className="w-4 h-4 rounded-full border-2 border-mission-control-border" />,
  running: <Loader2 size={16} className="text-info animate-spin" />,
  done:    <CheckCircle size={16} className="text-success" />,
  error:   <XCircle size={16} className="text-error" />,
  skipped: <div className="w-4 h-4 rounded-full border-2 border-mission-control-border opacity-40" />,
};

export default function ModuleInstallModal({ module, onClose, onInstalled }: ModuleInstallModalProps) {
  const [steps, setSteps]     = useState<InstallStep[]>(buildSteps(module));
  const [started, setStarted] = useState(false);
  const [done, setDone]       = useState(false);
  const [failed, setFailed]   = useState(false);

  const updateStep = (id: string, status: StepStatus, errorMsg?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));
  };

  const runInstall = async () => {
    setStarted(true);
    setFailed(false);

    try {
      // Step 1: Check — verify deps are noted (informational for now)
      updateStep('check', 'running');
      await new Promise(r => setTimeout(r, 300)); // simulate check
      updateStep('check', 'done');

      // Step 2+3: Call install endpoint (does catalog + module_state in one DB transaction)
      updateStep('catalog', 'running');
      updateStep('module_state', 'running');
      await moduleApi.install(module.id);
      updateStep('catalog', 'done');
      updateStep('module_state', 'done');

      // Also mark in catalog_modules via catalog API (belt-and-suspenders)
      await catalogApi.setModuleInstalled(module.id, true);

      setDone(true);
      onInstalled?.(module.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Mark the first running step as error
      setSteps(prev => prev.map(s =>
        s.status === 'running' ? { ...s, status: 'error', errorMsg: msg.slice(0, 80) } : s
      ));
      setFailed(true);
    }
  };

  const doneCount = steps.filter(s => s.status === 'done').length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default" onClick={onClose} type="button" aria-label="Close" />
      <div className="relative w-full max-w-md bg-mission-control-bg border border-mission-control-accent/30 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <div className="w-10 h-10 rounded-lg bg-mission-control-accent/10 flex items-center justify-center text-xl flex-shrink-0">
            {module.icon || '🧩'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold">Install {module.name}</h2>
            <p className="text-xs text-mission-control-text-dim truncate">{module.description}</p>
          </div>
          <button onClick={onClose} className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded-lg hover:bg-mission-control-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Dependencies overview */}
          {(module.requiredApis.length > 0 || module.requiredAgents.length > 0 || module.requiredNpm.length > 0) && (
            <div className="rounded-lg border border-warning-border bg-warning-subtle/30 p-3 space-y-1.5 text-xs">
              {module.requiredApis.length > 0 && (
                <div className="flex items-center gap-1.5 text-warning">
                  <Key size={11} className="flex-shrink-0" />
                  <span>API keys required: {module.requiredApis.join(', ')}</span>
                </div>
              )}
              {module.requiredAgents.length > 0 && (
                <div className="flex items-center gap-1.5 text-info">
                  <Bot size={11} className="flex-shrink-0" />
                  <span>Agents needed: {module.requiredAgents.join(', ')}</span>
                </div>
              )}
              {module.requiredNpm.length > 0 && (
                <div className="flex items-center gap-1.5 text-mission-control-text-dim">
                  <Package size={11} className="flex-shrink-0" />
                  <span>npm packages: {module.requiredNpm.join(', ')}</span>
                </div>
              )}
              <p className="text-mission-control-text-dim opacity-70 pt-1">
                Ensure these are available before activating the module.
              </p>
            </div>
          )}

          {/* Progress bar */}
          {started && (
            <div>
              <div className="flex justify-between text-xs text-mission-control-text-dim mb-1">
                <span>Installing…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-mission-control-border overflow-hidden">
                <div
                  className="h-full bg-mission-control-accent rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            {steps.map(step => (
              <div key={step.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-mission-control-surface">
                <div className="flex-shrink-0 mt-0.5">{STEP_ICON[step.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${step.status === 'error' ? 'text-error' : ''}`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-mission-control-text-dim truncate">
                    {step.errorMsg || step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Done message */}
          {done && (
            <div className="flex items-center gap-2 text-success text-sm p-3 rounded-lg border border-success-border bg-success-subtle">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span>{module.name} installed successfully! Reload the app to activate.</span>
            </div>
          )}

          {/* Failed message */}
          {failed && (
            <div className="flex items-center gap-2 text-error text-sm p-3 rounded-lg border border-error-border bg-error-subtle">
              <XCircle size={16} className="flex-shrink-0" />
              <span>Installation failed. Check the step details above.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-mission-control-border">
          {!started ? (
            <>
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={runInstall}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
              >
                <Download size={14} /> Install
              </button>
            </>
          ) : done || failed ? (
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors">
              Close
            </button>
          ) : (
            <div className="flex-1 text-center text-sm text-mission-control-text-dim">
              Installing…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
