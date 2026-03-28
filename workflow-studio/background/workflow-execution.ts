/**
 * Background job stub — local mode runs workflows synchronously.
 */

export interface WorkflowExecutionPayload {
  workflowId: string
  userId: string
  workspaceId?: string
  triggerType?: string
  inputs?: Record<string, any>
}

export async function executeWorkflowJob(payload: WorkflowExecutionPayload): Promise<any> {
  // In local mode, this would call the executor directly
  const { executeWorkflow } = await import('@/lib/workflows/executor/execute-workflow')
  return executeWorkflow(
    { id: payload.workflowId, workspaceId: payload.workspaceId || '' } as any,
    `job-${payload.workflowId}`,
    payload.inputs,
    payload.userId
  )
}
