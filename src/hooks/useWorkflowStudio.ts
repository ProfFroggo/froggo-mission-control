// src/hooks/useWorkflowStudio.ts
// React hook wrapping WorkflowStudioClient with connection status,
// workflow list caching, and execution helpers.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WorkflowStudioClient,
  WorkflowStudioError,
  type ExecutionResult,
  type WorkflowSummary,
} from '@/lib/workflow-studio-client';

const HEALTH_POLL_MS = 15_000;

interface UseWorkflowStudioOptions {
  healthPollInterval?: number;
  autoFetchWorkflows?: boolean;
}

interface UseWorkflowStudioReturn {
  isConnected: boolean;
  workflows: WorkflowSummary[];
  loading: boolean;
  error: string | null;
  lastExecution: ExecutionResult | null;
  executeWorkflow: (id: string, inputs?: Record<string, unknown>) => Promise<ExecutionResult | null>;
  refreshWorkflows: () => Promise<void>;
  checkHealth: () => Promise<boolean>;
}

export function useWorkflowStudio(
  options: UseWorkflowStudioOptions = {},
): UseWorkflowStudioReturn {
  const {
    healthPollInterval = HEALTH_POLL_MS,
    autoFetchWorkflows = true,
  } = options;

  const clientRef = useRef(new WorkflowStudioClient());
  const [isConnected, setIsConnected] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<ExecutionResult | null>(null);
  const hasFetched = useRef(false);

  // Health check — uses listWorkflows as a lightweight ping
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      await clientRef.current.listWorkflows(1, 0);
      setIsConnected(true);
      setError(null);
      return true;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  // Poll health
  useEffect(() => {
    if (healthPollInterval <= 0) return;
    checkHealth();
    const id = setInterval(checkHealth, healthPollInterval);
    return () => clearInterval(id);
  }, [checkHealth, healthPollInterval]);

  // Fetch workflow list
  const refreshWorkflows = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const list = await clientRef.current.listWorkflows();
      setWorkflows(list);
      setError(null);
    } catch (err) {
      const msg = err instanceof WorkflowStudioError ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on connect
  useEffect(() => {
    if (isConnected && autoFetchWorkflows && !hasFetched.current) {
      hasFetched.current = true;
      refreshWorkflows();
    }
    if (!isConnected) {
      hasFetched.current = false;
    }
  }, [isConnected, autoFetchWorkflows, refreshWorkflows]);

  // Execute
  const executeWorkflow = useCallback(
    async (id: string, inputs?: Record<string, unknown>): Promise<ExecutionResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await clientRef.current.executeWorkflow(id, inputs);
        const execResult: ExecutionResult = {
          id: result.id,
          workflow_id: result.workflowId,
          trigger: 'manual',
          status: result.status,
          started_at: new Date().toISOString(),
          completed_at: null,
          duration_ms: 0,
        };
        setLastExecution(execResult);
        return execResult;
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
