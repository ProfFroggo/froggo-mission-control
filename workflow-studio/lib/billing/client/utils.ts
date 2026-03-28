/**
 * Billing client utils stub — local mode.
 */
export function getSubscriptionAccessState(..._args: any[]): { hasAccess: boolean } {
  return { hasAccess: true }
}

export function getBillingStatus(..._args: any[]): string {
  return 'active'
}

export function getFilledPillColor(..._args: any[]): string {
  return 'gray'
}

export function getSubscriptionStatus(..._args: any[]): string {
  return 'active'
}

export function getUsage(..._args: any[]): { current: number; limit: number; percentage: number } {
  return { current: 0, limit: Infinity, percentage: 0 }
}
