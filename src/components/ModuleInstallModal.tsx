import { useState } from 'react';
import { Button, Box, Flex } from '@radix-ui/themes';
import { X, CheckCircle, XCircle, Loader2, Download, Key, Package, Bot, Puzzle } from 'lucide-react';
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

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'running') return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-info)]/15 border border-[var(--color-info)]/30 flex items-center justify-center flex-shrink-0">
      <Loader2 size={13} className="text-[var(--color-info)] animate-spin" />
    </div>
  );
  if (status === 'done') return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 flex items-center justify-center flex-shrink-0">
      <CheckCircle size={13} className="text-[var(--color-success)]" />
    </div>
  );
  if (status === 'error') return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 flex items-center justify-center flex-shrink-0">
      <XCircle size={13} className="text-[var(--color-error)]" />
    </div>
  );
  if (status === 'skipped') return (
    <div className="w-7 h-7 rounded-full border-2 border-mission-control-border/40 opacity-40 flex-shrink-0" />
  );
  return (
    <div className="w-7 h-7 rounded-full border-2 border-mission-control-border flex-shrink-0" />
  );
}

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
    <Flex align="center" justify="center" p="4" className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default border-0 outline-none" onClick={onClose} type="button" aria-label="Close" />
      <Flex direction="column" className="relative w-full max-w-md bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl max-h-[80vh]">

        {/* Progress bar at top */}
        <div className="h-1 bg-mission-control-border rounded-t-2xl overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-mission-control-accent rounded-full transition-[width] duration-500"
            style={{ width: `${started ? progress : 0}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-mission-control-border/20 flex items-center justify-center flex-shrink-0">
              <Puzzle size={18} className="text-mission-control-accent" />
            </div>
            <Box className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-mission-control-text">Install {module.name}</h2>
              <p className="text-xs text-mission-control-text-dim/70 truncate">{module.description}</p>
            </Box>
          </div>
          <button onClick={onClose} aria-label="Close install modal" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Dependencies overview */}
          {(module.requiredApis.length > 0 || module.requiredAgents.length > 0 || module.requiredNpm.length > 0) && (
            <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3 space-y-1.5 text-xs">
              {module.requiredApis.length > 0 && (
                <Flex align="center" gap="2" className="text-[var(--color-warning)]">
                  <Key size={11} className="flex-shrink-0" />
                  <span>API keys required: {module.requiredApis.join(', ')}</span>
                </Flex>
              )}
              {module.requiredAgents.length > 0 && (
                <Flex align="center" gap="2" className="text-[var(--color-info)]">
                  <Bot size={11} className="flex-shrink-0" />
                  <span>Agents needed: {module.requiredAgents.join(', ')}</span>
                </Flex>
              )}
              {module.requiredNpm.length > 0 && (
                <Flex align="center" gap="2" className="text-mission-control-text-dim">
                  <Package size={11} className="flex-shrink-0" />
                  <span>npm packages: {module.requiredNpm.join(', ')}</span>
                </Flex>
              )}
              <p className="text-mission-control-text-dim/70 pt-1">
                Ensure these are available before activating the module.
              </p>
            </div>
          )}

          {/* Progress status */}
          {started && (
            <Flex justify="between" className="text-xs text-mission-control-text-dim">
              <span>{done ? 'Installation complete' : failed ? 'Installation failed' : 'Installing…'}</span>
              <span>{progress}%</span>
            </Flex>
          )}

          {/* Steps */}
          <div className="space-y-2">
            {steps.map(step => (
              <Flex key={step.id} align="start" gap="3" p="3" className="rounded-xl bg-mission-control-bg border border-mission-control-border">
                <StepDot status={step.status} />
                <Box className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${step.status === 'error' ? 'text-[var(--color-error)]' : 'text-mission-control-text'}`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-mission-control-text-dim/70 truncate mt-0.5">
                    {step.errorMsg || step.detail}
                  </div>
                </Box>
              </Flex>
            ))}
          </div>

          {/* Done message */}
          {done && (
            <Flex align="center" gap="2" p="3" className="text-[var(--color-success)] text-sm rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span>{module.name} installed successfully! Reload the app to activate.</span>
            </Flex>
          )}

          {/* Failed message */}
          {failed && (
            <Flex align="center" gap="2" p="3" className="text-[var(--color-error)] text-sm rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10">
              <XCircle size={16} className="flex-shrink-0" />
              <span>Installation failed. Check the step details above.</span>
            </Flex>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          {!started ? (
            <>
              <Button type="button" variant="ghost" size="2" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="solid"
                size="2"
                onClick={runInstall}
              >
                <Download size={14} /> Install
              </Button>
            </>
          ) : done || failed ? (
            <Button type="button" variant="ghost" size="2" onClick={onClose}>
              Close
            </Button>
          ) : (
            <span className="text-sm text-mission-control-text-dim">
              Installing…
            </span>
          )}
        </div>
      </Flex>
    </Flex>
  );
}
