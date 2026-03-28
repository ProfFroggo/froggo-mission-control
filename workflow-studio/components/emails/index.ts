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
