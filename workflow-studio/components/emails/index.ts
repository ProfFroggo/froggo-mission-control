/**
 * Email templates stub — local mode, no email sending.
 */

export function getEmailSubject(_type: string): string {
  return 'Workflow Studio Notification'
}

export function renderOTPEmail(_params: any): string { return '' }
export function renderPasswordResetEmail(_params: any): string { return '' }
export function renderWelcomeEmail(_params: any): string { return '' }
export function renderPollingGroupInvitationEmail(_params: any): string { return '' }
export function WorkspaceInvitationEmail(_props: any): null { return null }

export interface EmailRateLimitsData {
  sync?: { requestsPerMinute: number; remaining: number; resetAt: string }
  async?: { requestsPerMinute: number; remaining: number; resetAt: string }
}

export interface EmailUsageData {
  currentPeriodCost?: number
  limit?: number
  percentUsed?: number
  isExceeded?: boolean
}

export async function renderWorkflowNotificationEmail(_params: {
  workflowName: string
  status: 'success' | 'error'
  trigger: string
  duration: string
  cost: string
  logUrl: string
  finalOutput?: unknown
  rateLimits?: EmailRateLimitsData
  usageData?: EmailUsageData
}): Promise<string> {
  return ''
}
