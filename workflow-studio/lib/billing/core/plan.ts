/**
 * Billing core plan stub — local mode.
 */
export interface HighestPrioritySubscription {
  plan: string
  status: string
  [key: string]: any
}

export async function getHighestPrioritySubscription(..._args: any[]): Promise<HighestPrioritySubscription | null> {
  return null
}
