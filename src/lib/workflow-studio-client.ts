// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/workflow-studio-client.ts
// Client for communicating with Workflow Studio via Mission Control's proxy route.
// All requests go through /api/workflow-studio/proxy to avoid CORS issues.

/** Default timeout for individual requests (ms). */
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  color?: string;
  workspaceId?: string;
  folderId?: string | null;
  isDeployed?: boolean;
  runCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  /** Workflow state / node graph — shape depends on WS version. */
  state?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExecutionResult {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
}

export class WorkflowStudioError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'WorkflowStudioError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class WorkflowStudioClient {
  private readonly proxyBase: string;
  private readonly timeoutMs: number;

  /**
   * @param proxyBase  Base URL of the MC proxy endpoint (relative or absolute).
   *                   Defaults to `/api/workflow-studio/proxy` (same-origin).
   * @param timeoutMs  Per-request timeout in milliseconds.
   */
  constructor(proxyBase = '/api/workflow-studio/proxy', timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.proxyBase = proxyBase.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  // ── Core fetch helper ────────────────────────────────────────────────────

  /**
   * Send a request through the MC proxy to Workflow Studio.
   *
   * @param wsPath   The WS API path, e.g. `/api/workflows` or `/api/health`.
   * @param init     Standard RequestInit options (method, body, headers, etc.)
   */
  private async request<T = unknown>(wsPath: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.proxyBase}?path=${encodeURIComponent(wsPath)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });

      if (!response.ok) {
        let errorBody: { error?: string; code?: string } = {};
        try {
          errorBody = await response.json();
        } catch {
          // response may not be JSON
        }
        throw new WorkflowStudioError(
          errorBody.error || `Workflow Studio responded with ${response.status}`,
          response.status,
          errorBody.code,
        );
      }

      // Some endpoints (204 No Content, etc.) may not return a body
      const text = await response.text();
      return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
    } catch (err) {
      if (err instanceof WorkflowStudioError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new WorkflowStudioError(
          `Request to ${wsPath} timed out after ${this.timeoutMs}ms`,
          408,
          'TIMEOUT',
        );
      }

      throw new WorkflowStudioError(
        err instanceof Error ? err.message : String(err),
        0,
        'NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** GET /api/health — Check if Workflow Studio is reachable. */
  async healthCheck(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/health');
  }

  /**
   * GET /api/workflows — List all workflows visible to the current user.
   *
   * @param workspaceId  Optional workspace filter.
   * @param scope        Optional scope: 'active' | 'archived' | 'all'. Defaults to 'active'.
   */
  async listWorkflows(
    workspaceId?: string,
    scope: 'active' | 'archived' | 'all' = 'active',
  ): Promise<WorkflowSummary[]> {
    const params = new URLSearchParams({ scope });
    if (workspaceId) params.set('workspaceId', workspaceId);

    const res = await this.request<{ data: WorkflowSummary[] }>(
      `/api/workflows?${params.toString()}`,
    );
    return res.data ?? [];
  }

  /**
   * GET /api/workflows/:id — Fetch a single workflow by ID.
   */
  async getWorkflow(id: string): Promise<WorkflowDetail> {
    return this.request<WorkflowDetail>(`/api/workflows/${encodeURIComponent(id)}`);
  }

  /**
   * POST /api/workflows/:id/execute — Trigger a workflow execution.
   *
   * @param id      Workflow ID.
   * @param inputs  Optional key-value inputs to pass into the workflow.
   * @returns       Execution metadata (ID, status, initial result).
   */
  async executeWorkflow(
    id: string,
    inputs?: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    return this.request<ExecutionResult>(
      `/api/workflows/${encodeURIComponent(id)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify(inputs ? { inputs } : {}),
      },
    );
  }

  /**
   * GET /api/workflows/:workflowId/executions/:executionId/stream
   * Poll or stream execution results.
   *
   * Note: The WS execution model nests executions under workflows.
   */
  async getExecution(workflowId: string, executionId: string): Promise<ExecutionResult> {
    return this.request<ExecutionResult>(
      `/api/workflows/${encodeURIComponent(workflowId)}/executions/${encodeURIComponent(executionId)}/stream`,
    );
  }

  /**
   * GET /api/jobs/:jobId — Check the status of an async job.
   */
  async getJob(jobId: string): Promise<ExecutionResult> {
    return this.request<ExecutionResult>(`/api/jobs/${encodeURIComponent(jobId)}`);
  }

  /**
   * POST /api/workflows/:id/executions/:executionId/cancel — Cancel a running execution.
   */
  async cancelExecution(workflowId: string, executionId: string): Promise<void> {
    await this.request<void>(
      `/api/workflows/${encodeURIComponent(workflowId)}/executions/${encodeURIComponent(executionId)}/cancel`,
      { method: 'POST' },
    );
  }
}

/** Singleton instance for convenience. */
export const workflowStudio = new WorkflowStudioClient();
