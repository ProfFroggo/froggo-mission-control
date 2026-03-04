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
import { Bot, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import BaseModal, { BaseModalBody, BaseModalFooter } from './BaseModal';
import IntegrationWizard from './IntegrationWizard';
import { Spinner } from './LoadingStates';
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
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-clawd-border">
          <div className="w-9 h-9 rounded-lg bg-clawd-accent/10 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-clawd-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-clawd-text">Install Agent: {entry.name}</h2>
            <span className="text-xs text-clawd-text-dim">v{entry.version}</span>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors text-clawd-text-dim hover:text-clawd-text flex-shrink-0"
            type="button"
            aria-label="Cancel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <BaseModalBody maxHeight="60vh">
          <div className="space-y-4">
            {/* Workspace path info */}
            <p className="text-sm text-clawd-text-dim">
              This will create{' '}
              <code className="text-clawd-accent bg-clawd-accent/10 px-1.5 py-0.5 rounded text-xs font-mono">
                ~/agent-{entry.agent.agentId}/
              </code>
            </p>

            {/* SOUL.md preview box */}
            <div className="rounded-lg border border-clawd-border bg-clawd-bg overflow-hidden">
              <div className="px-3 py-2 text-xs text-clawd-text-dim border-b border-clawd-border bg-clawd-surface">
                SOUL.md Preview
              </div>
              <pre className="p-3 text-xs text-clawd-text-dim overflow-y-auto max-h-48 whitespace-pre-wrap font-mono leading-relaxed">
                {entry.agent.soulPreview}
              </pre>
            </div>

            {/* Credentials warning */}
            {(entry.agent.credentials?.length ?? 0) > 0 && (
              <p className="text-sm text-amber-400">
                Requires {entry.agent.credentials!.length} API key
                {entry.agent.credentials!.length !== 1 ? 's' : ''} — you'll be prompted after install.
              </p>
            )}
          </div>
        </BaseModalBody>

        {/* Footer */}
        <BaseModalFooter align="right">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            <Bot size={14} />
            Install Agent
          </button>
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
            <Spinner size={28} />
            <div className="text-center">
              <p className="text-base font-semibold text-clawd-text">Installing {entry.name}...</p>
              <p className="text-sm text-clawd-text-dim mt-1">Provisioning agent workspace…</p>
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
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-clawd-border">
          <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-clawd-text">Agent Installed</h2>
        </div>

        {/* Body */}
        <BaseModalBody>
          <div className="space-y-4">
            {/* Success message */}
            <p className="text-sm text-clawd-text">
              <span className="font-medium text-green-400">{entry.name}</span> installed successfully.
            </p>

            {/* Workspace path */}
            <div className="px-3 py-2.5 rounded-lg bg-clawd-surface border border-clawd-border text-sm text-clawd-text-dim">
              Workspace created at{' '}
              <code className="text-clawd-text font-mono text-xs">~/agent-{entry.agent.agentId}/</code>
            </div>

            {/* Gateway restart advisory */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <RefreshCw size={15} className="flex-shrink-0 mt-0.5" />
              <span>Restart the OpenClaw gateway for the new agent to appear in session lists.</span>
            </div>
          </div>
        </BaseModalBody>

        {/* Footer */}
        <BaseModalFooter align="right">
          <button
            type="button"
            onClick={onInstalled}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-clawd-accent hover:opacity-90 text-white rounded-lg transition-colors"
          >
            Done
          </button>
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
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-clawd-border">
        <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
        <h2 className="text-lg font-semibold text-clawd-text">Installation Failed</h2>
      </div>

      {/* Body */}
      <BaseModalBody>
        <p className="text-sm text-red-400">
          {errorMsg ?? 'An unexpected error occurred during installation.'}
        </p>
      </BaseModalBody>

      {/* Footer */}
      <BaseModalFooter align="right">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border rounded-lg transition-colors"
        >
          Close
        </button>
      </BaseModalFooter>
    </BaseModal>
  );
}
