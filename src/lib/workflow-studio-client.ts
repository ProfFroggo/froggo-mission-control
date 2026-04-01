// Workflow Studio API client — direct calls to MC-native /api/local/ routes (no proxy)

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  color?: string;
  state?: string;
  is_deployed?: number;
  run_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  state: string;
  variables?: string;
}

export interface ExecutionResult {
  id: string;
  workflow_id: string;
  trigger: string;
  status: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
}

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  workflow?: {
    version: string;
    blocks: any[];
    connections: any[];
    loops: Record<string, unknown>;
  };
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
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = '/api/local', timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
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
          errorBody.error || `API responded with ${response.status}`,
          response.status,
          errorBody.code,
        );
      }

      const text = await response.text();
      return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
    } catch (err) {
      if (err instanceof WorkflowStudioError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new WorkflowStudioError(
          `Request to ${path} timed out after ${this.timeoutMs}ms`,
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

  // ── Workflows ──────────────────────────────────────────────────────────

  async listWorkflows(limit = 50, offset = 0): Promise<WorkflowSummary[]> {
    const res = await this.request<{ workflows: WorkflowSummary[] }>(
      `/workflows?limit=${limit}&offset=${offset}`,
    );
    return res.workflows ?? [];
  }

  async getWorkflow(id: string): Promise<WorkflowDetail> {
    return this.request<WorkflowDetail>(`/workflows/${encodeURIComponent(id)}`);
  }

  async createWorkflow(data: { name?: string; state?: unknown; description?: string }): Promise<WorkflowSummary & { id: string }> {
    return this.request(`/workflows`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id: string, data: { name?: string; state?: unknown; description?: string; color?: string }): Promise<WorkflowDetail> {
    return this.request<WorkflowDetail>(`/workflows/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ── Execution ──────────────────────────────────────────────────────────

  async executeWorkflow(id: string, inputs?: Record<string, unknown>): Promise<{
    id: string;
    workflowId: string;
    status: string;
    result?: Record<string, unknown>;
    error?: string;
    duration_ms?: number;
  }> {
    return this.request(`/workflows/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
      body: JSON.stringify(inputs ?? {}),
    });
  }

  async getExecution(id: string): Promise<ExecutionResult> {
    return this.request<ExecutionResult>(`/executions/${encodeURIComponent(id)}`);
  }

  async listExecutions(workflowId: string, limit = 50, offset = 0): Promise<ExecutionResult[]> {
    const res = await this.request<{ executions: ExecutionResult[] }>(
      `/workflows/${encodeURIComponent(workflowId)}/executions?limit=${limit}&offset=${offset}`,
    );
    return res.executions ?? [];
  }

  // ── Templates ──────────────────────────────────────────────────────────

  async listTemplates(): Promise<TemplateMeta[]> {
    const res = await this.request<{ templates: TemplateMeta[] }>('/templates');
    return res.templates ?? [];
  }

  async getTemplate(id: string): Promise<TemplateMeta> {
    return this.request<TemplateMeta>(`/templates?id=${encodeURIComponent(id)}`);
  }
}

/** Singleton instance. */
export const wsClient = new WorkflowStudioClient();
