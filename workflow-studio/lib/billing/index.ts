/**
 * Billing stub — local mode, no billing.
 * All checks return permissive defaults.
 */

export function isOrganizationOnTeamOrEnterprisePlan(_orgId?: string): boolean {
  return true // local mode = all features enabled
}

export async function checkServerSideUsageLimits(_params: any): Promise<{ allowed: boolean }> {
  return { allowed: true }
}

export function hasSSOAccess(_params: any): boolean {
  return true
}

export function hasCredentialSetsAccess(_params: any): boolean {
  return true
}

export function sendPlanWelcomeEmail(_params: any): void {}
export function authorizeSubscriptionReference(_params: any): boolean { return true }
