/**
 * AgentInstallModal — Two-phase agent install flow.
 *
 * Flow:
 *   preview → installing → success (or credentials → success)
 *
 * Features:
 * - SOUL.md preview before install confirmation
 * - Install progress while provisioning workspace
 * - Gateway restart advisory after successful install
 * - IntegrationWizard handoff if agent declares credentials
 */

import { useState, useEffect } from 'react';
import { Bot, CheckCircle, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button, Spinner, Flex } from '@radix-ui/themes';
import BaseModal, { BaseModalBody, BaseModalFooter } from './BaseModal';
import IntegrationWizard from './IntegrationWizard';
import { marketplaceApi } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentCredential {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  type: 'api_key' | 'oauth_token' | 'password' | 'url' | 'custom';
}

interface AgentMeta {
  agentId: string;
  soulPreview: string;
  credentials?: AgentCredential[];
  templateFiles?: Record<string, string>;
}

interface AgentInstallEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  sha256: string;
  agent: AgentMeta;
}

interface AgentInstallModalProps {
  isOpen: boolean;
  entry: AgentInstallEntry;
  onInstalled: () => void;
  onCancel: () => void;
}

type Phase = 'preview' | 'installing' | 'success' | 'error' | 'credentials';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentInstallModal({
  isOpen,
  entry,
  onInstalled,
  onCancel,
}: AgentInstallModalProps) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('preview');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // ── Install handler ────────────────────────────────────────────────────────

  const handleInstall = async () => {
    setPhase('installing');
    try {
      const result = await marketplaceApi.installAgent(entry.id);

      if (result?.success) {
        if (result.needsCredentials && entry.agent.credentials?.length) {
          setPhase('credentials');
        } else {
          setPhase('success');
        }
      } else {
        setErrorMsg(result?.error ?? `Failed to install ${entry.name}.`);
        setPhase('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? `Error installing ${entry.name}.`);
      setPhase('error');
    }
  };

  // ── Credential wizard phase: render only IntegrationWizard ────────────────

  if (phase === 'credentials') {
    return (
      <IntegrationWizard
        isOpen={true}
        moduleId={entry.id}
        moduleName={entry.name}
        credentials={entry.agent.credentials ?? []}
        healthCheck={null}
        onComplete={() => setPhase('success')}
        onCancel={() => setPhase('success')}
      />
    );
  }

  // ── Preview phase ──────────────────────────────────────────────────────────

  if (phase === 'preview') {
    return (
      <BaseModal
        isOpen={isOpen}
        onClose={onCancel}
        size="lg"
        showCloseButton={false}
        ariaLabel={`Install agent: ${entry.name}`}
      >
        {/* Header */}
        <Flex align="center" gap="3" className="px-6 pt-6 pb-4 border-b border-mission-control-border">
          <div className="w-10 h-10 rounded-xl bg-mission-control-border/30 border border-mission-control-border flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-mission-control-text-dim" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-mission-control-text">Install Agent: {entry.name}</h2>
            <span className="text-xs text-mission-control-text-dim/70">v{entry.version}</span>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
            <X size={16} />
          </button>
        </Flex>

        {/* Body */}
        <BaseModalBody maxHeight="60vh">
          <div className="space-y-4">
            {/* Workspace path info */}
            <p className="text-sm text-mission-control-text-dim">
              This will create{' '}
              <code className="text-[--accent-11] bg-[--accent-3] px-1.5 py-0.5 rounded text-xs font-mono">
                ~/mission-control/agents/{entry.agent.agentId}/
              </code>
            </p>

            {/* SOUL.md preview box */}
            <div className="rounded-lg border border-mission-control-border bg-mission-control-bg overflow-hidden">
              <div className="px-3 py-2 text-xs text-mission-control-text-dim border-b border-mission-control-border bg-mission-control-surface">
                SOUL.md Preview
              </div>
              <pre className="p-3 text-xs text-mission-control-text-dim overflow-y-auto max-h-48 whitespace-pre-wrap font-mono leading-relaxed">
                {entry.agent.soulPreview}
              </pre>
            </div>

            {/* Credentials warning */}
            {(entry.agent.credentials?.length ?? 0) > 0 && (
              <p className="text-sm text-[var(--color-warning)]">
                Requires {entry.agent.credentials!.length} API key
                {entry.agent.credentials!.length !== 1 ? 's' : ''} — you&apos;ll be prompted after install.
              </p>
            )}
          </div>
        </BaseModalBody>

        {/* Footer */}
        <BaseModalFooter align="right">
          <Button type="button" onClick={onCancel} variant="soft" color="gray" size="2">
            Cancel
          </Button>
          <Button type="button" onClick={handleInstall} variant="solid" color="grass" size="2">
            <Bot size={14} />
            Install Agent
          </Button>
        </BaseModalFooter>
      </BaseModal>
    );
  }

  // ── Installing phase ───────────────────────────────────────────────────────

  if (phase === 'installing') {
    return (
      <BaseModal
        isOpen={isOpen}
        onClose={() => {}}
        size="md"
        showCloseButton={false}
        preventBackdropClose
        preventEscClose
        ariaLabel={`Installing ${entry.name}...`}
      >
        <BaseModalBody>
          <div className="flex flex-col items-center gap-4 py-4">
            <Spinner size="3" />
            <div className="text-center">
              <p className="text-base font-semibold text-mission-control-text">Installing {entry.name}...</p>
              <p className="text-sm text-mission-control-text-dim mt-1">Provisioning agent workspace…</p>
            </div>
          </div>
        </BaseModalBody>
      </BaseModal>
    );
  }

  // ── Success phase ──────────────────────────────────────────────────────────

  if (phase === 'success') {
    return (
      <BaseModal
        isOpen={isOpen}
        onClose={onInstalled}
        size="md"
        showCloseButton={false}
        ariaLabel="Agent installed"
      >
        {/* Header */}
        <Flex align="center" gap="3" className="px-6 pt-6 pb-4 border-b border-mission-control-border">
          <CheckCircle size={20} className="text-[var(--color-success)] flex-shrink-0" />
          <h2 className="text-base font-semibold text-mission-control-text">Agent Installed</h2>
        </Flex>

        {/* Body */}
        <BaseModalBody>
          <div className="space-y-4">
            {/* Success message */}
            <p className="text-sm text-mission-control-text">
              <span className="font-medium text-[var(--color-success)]">{entry.name}</span> installed successfully.
            </p>

            {/* Workspace path */}
            <div className="px-3 py-2.5 rounded-lg bg-mission-control-surface border border-mission-control-border text-sm text-mission-control-text-dim">
              Workspace created at{' '}
              <code className="text-mission-control-text font-mono text-xs">~/mission-control/agents/{entry.agent.agentId}/</code>
            </div>

            {/* Gateway restart advisory */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[var(--color-warning)] text-sm">
              <RefreshCw size={15} className="flex-shrink-0 mt-0.5" />
              <span>Reload the page for the new agent to appear in the agent list.</span>
            </div>
          </div>
        </BaseModalBody>

        {/* Footer */}
        <BaseModalFooter align="right">
          <Button type="button" onClick={onInstalled} variant="solid" color="grass" size="2">
            Done
          </Button>
        </BaseModalFooter>
      </BaseModal>
    );
  }

  // ── Error phase ────────────────────────────────────────────────────────────

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      size="md"
      showCloseButton={false}
      ariaLabel="Installation failed"
    >
      {/* Header */}
      <Flex align="center" gap="3" className="px-6 pt-6 pb-4 border-b border-mission-control-border">
        <AlertTriangle size={20} className="text-[var(--color-error)] flex-shrink-0" />
        <h2 className="text-base font-semibold text-mission-control-text">Installation Failed</h2>
      </Flex>

      {/* Body */}
      <BaseModalBody>
        <p className="text-sm text-[var(--color-error)]">
          {errorMsg ?? 'An unexpected error occurred during installation.'}
        </p>
      </BaseModalBody>

      {/* Footer */}
      <BaseModalFooter align="right">
        <Button type="button" onClick={onCancel} variant="soft" color="gray" size="2">
          Close
        </Button>
      </BaseModalFooter>
    </BaseModal>
  );
}
