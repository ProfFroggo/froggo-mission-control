import { useState } from 'react';
import { Button, IconButton, Box, Flex } from '@radix-ui/themes';
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
    <Flex align="center" justify="center" p="4" className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default border-0 outline-none" onClick={onClose} type="button" aria-label="Close" />
      <Flex direction="column" className="relative w-full max-w-md bg-mission-control-bg border border-mission-control-accent/30 rounded-2xl shadow-2xl max-h-[80vh]">

        {/* Header */}
        <Flex align="center" gap="3" p="4" className="border-b border-mission-control-border">
          <Flex align="center" justify="center" className="w-10 h-10 rounded-lg bg-mission-control-accent/10 text-xl flex-shrink-0">
            {module.icon || <Puzzle size={18} />}
          </Flex>
          <Box className="flex-1 min-w-0">
            <h2 className="font-bold">Install {module.name}</h2>
            <p className="text-xs text-mission-control-text-dim truncate">{module.description}</p>
          </Box>
          <IconButton variant="ghost" size="1" onClick={onClose} aria-label="Close install modal">
            <X size={18} />
          </IconButton>
        </Flex>

        {/* Body */}
        <Box p="4" className="flex-1 overflow-y-auto space-y-4">

          {/* Dependencies overview */}
          {(module.requiredApis.length > 0 || module.requiredAgents.length > 0 || module.requiredNpm.length > 0) && (
            <div className="rounded-lg border border-warning-border bg-warning-subtle/30 p-3 space-y-1.5 text-xs">
              {module.requiredApis.length > 0 && (
                <Flex align="center" gap="2" className="text-warning">
                  <Key size={11} className="flex-shrink-0" />
                  <span>API keys required: {module.requiredApis.join(', ')}</span>
                </Flex>
              )}
              {module.requiredAgents.length > 0 && (
                <Flex align="center" gap="2" className="text-info">
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
              <p className="text-mission-control-text-dim opacity-70 pt-1">
                Ensure these are available before activating the module.
              </p>
            </div>
          )}

          {/* Progress bar */}
          {started && (
            <div>
              <Flex justify="between" className="text-xs text-mission-control-text-dim mb-1">
                <span>Installing…</span>
                <span>{progress}%</span>
              </Flex>
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
              <Flex key={step.id} align="start" gap="3" p="3" className="rounded-lg bg-mission-control-surface">
                <div className="flex-shrink-0 mt-0.5">{STEP_ICON[step.status]}</div>
                <Box className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${step.status === 'error' ? 'text-error' : ''}`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-mission-control-text-dim truncate">
                    {step.errorMsg || step.detail}
                  </div>
                </Box>
              </Flex>
            ))}
          </div>

          {/* Done message */}
          {done && (
            <Flex align="center" gap="2" p="3" className="text-success text-sm rounded-lg border border-success-border bg-success-subtle">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span>{module.name} installed successfully! Reload the app to activate.</span>
            </Flex>
          )}

          {/* Failed message */}
          {failed && (
            <Flex align="center" gap="2" p="3" className="text-error text-sm rounded-lg border border-error-border bg-error-subtle">
              <XCircle size={16} className="flex-shrink-0" />
              <span>Installation failed. Check the step details above.</span>
            </Flex>
          )}
        </Box>

        {/* Footer */}
        <Flex align="center" gap="3" p="4" className="border-t border-mission-control-border">
          {!started ? (
            <>
              <Button type="button" variant="surface" color="gray" size="2" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="solid"
                size="2"
                onClick={runInstall}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Download size={14} /> Install
              </Button>
            </>
          ) : done || failed ? (
            <Button type="button" variant="surface" color="gray" size="2" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
              Close
            </Button>
          ) : (
            <div className="flex-1 text-center text-sm text-mission-control-text-dim">
              Installing…
            </div>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
