/**
 * Notification alert rules stub — stripped during Sim Studio fork.
 */

export interface AlertCheckContext {
  workflowId?: string
  executionId?: string
  status?: string
  duration?: number
  error?: string
  [key: string]: any
}

export interface AlertConfig {
  id?: string
  type?: string
  enabled?: boolean
  conditions?: any
  channels?: any[]
  [key: string]: any
}

export function shouldTriggerAlert(_config: AlertConfig, _context: AlertCheckContext): boolean {
  return false
}
