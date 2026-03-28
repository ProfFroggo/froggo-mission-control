/**
 * Admin API types stub — stripped during Sim Studio fork.
 */

export function extractWorkflowMetadata(parsed: any): {
  name: string
  color: string | null
  description: string | null
} {
  return {
    name: parsed?.name || parsed?.workflow?.name || 'Untitled Workflow',
    color: parsed?.color || parsed?.workflow?.color || null,
    description: parsed?.description || parsed?.workflow?.description || null,
  }
}
