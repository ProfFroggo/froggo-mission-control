// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/hooks/useWorkflowStudio.ts
// React hook that wraps WorkflowStudioClient with connection status polling,
// workflow list caching, and execution helpers.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WorkflowStudioClient,
  WorkflowStudioError,
  type ExecutionResult,
  type WorkflowSummary,
} from '@/lib/workflow-studio-client';

/** Health-check polling interval (ms). */
const HEALTH_POLL_MS = 15_000;

interface UseWorkflowStudioOptions {
  /** How often to poll the health endpoint (ms). Set to 0 to disable. */
  healthPollInterval?: number;
  /** Automatically fetch the workflow list when connected. */
  autoFetchWorkflows?: boolean;
  /** Optional workspace filter for listWorkflows. */
  workspaceId?: string;
}

interface UseWorkflowStudioReturn {
  /** Whether Workflow Studio is reachable. */
  isConnected: boolean;
  /** Cached list of workflows (empty until first successful fetch). */
  workflows: WorkflowSummary[];
  /** True while any async operation is in-flight. */
  loading: boolean;
  /** Last error from any operation, cleared on next success. */
  error: string | null;
  /** Most recent execution result. */
  lastExecution: ExecutionResult | null;
  /** Trigger a workflow execution by ID. */
  executeWorkflow: (id: string, inputs?: Record<string, unknown>) => Promise<ExecutionResult | null>;
  /** Re-fetch the workflow list. */
  refreshWorkflows: () => Promise<void>;
  /** Manually trigger a health check. */
  checkHealth: () => Promise<boolean>;
}

export function useWorkflowStudio(
  options: UseWorkflowStudioOptions = {},
): UseWorkflowStudioReturn {
  const {
    healthPollInterval = HEALTH_POLL_MS,
    autoFetchWorkflows = true,
    workspaceId,
  } = options;

  const clientRef = useRef(new WorkflowStudioClient());
  const [isConnected, setIsConnected] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<ExecutionResult | null>(null);

  // Track whether we've already fetched workflows after first connect
  const hasFetched = useRef(false);

  // ── Health check ──────────────────────────────────────────────────────────

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      await clientRef.current.healthCheck();
      setIsConnected(true);
      setError(null);
      return true;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  // Poll health on an interval
  useEffect(() => {
    if (healthPollInterval <= 0) return;

    // Immediate first check
    checkHealth();

    const id = setInterval(checkHealth, healthPollInterval);
    return () => clearInterval(id);
  }, [checkHealth, healthPollInterval]);

  // ── Workflow list ─────────────────────────────────────────────────────────

  const refreshWorkflows = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await clientRef.current.listWorkflows(workspaceId);
      setWorkflows(list);
      setError(null);
    } catch (err) {
      const msg = err instanceof WorkflowStudioError ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Auto-fetch workflows once connected
  useEffect(() => {
    if (isConnected && autoFetchWorkflows && !hasFetched.current) {
      hasFetched.current = true;
      refreshWorkflows();
    }
    // Reset hasFetched when we lose connection so it re-fetches on reconnect
    if (!isConnected) {
      hasFetched.current = false;
    }
  }, [isConnected, autoFetchWorkflows, refreshWorkflows]);

  // ── Execute ───────────────────────────────────────────────────────────────

  const executeWorkflow = useCallback(
    async (
      id: string,
      inputs?: Record<string, unknown>,
    ): Promise<ExecutionResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await clientRef.current.executeWorkflow(id, inputs);
        setLastExecution(result);
        return result;
      } catch (err) {
        const msg = err instanceof WorkflowStudioError ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    isConnected,
    workflows,
    loading,
    error,
    lastExecution,
    executeWorkflow,
    refreshWorkflows,
    checkHealth,
  };
}
