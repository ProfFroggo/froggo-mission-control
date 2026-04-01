/**
 * Socket permissions middleware stub — stripped during Sim Studio fork.
 */

export interface WorkflowAccessResult {
  hasAccess: boolean
  workspaceId?: string
  error?: string
}

export async function verifyWorkflowAccess(
  _userId: string,
  _workflowId: string
): Promise<WorkflowAccessResult> {
  return { hasAccess: true }
}
