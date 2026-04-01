/**
 * Inbox types stub — stripped during Sim Studio fork.
 */

export type InboxTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected'

export type RejectionReason = string

export interface AgentMailWebhookPayload {
  event_type: string
  message: {
    id?: string
    from?: string
    to?: string
    subject?: string
    body?: string
    [key: string]: any
  }
  [key: string]: any
}
