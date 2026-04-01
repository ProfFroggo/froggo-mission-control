/**
 * Subscription stub — local mode.
 */
export function writeBillingInterval(_params: any): void {}
export function getSubscription(_params: any): any { return null }
export async function getHighestPrioritySubscription(..._args: any[]): Promise<any> { return null }
export async function getUserSubscriptionState(..._args: any[]): Promise<any> { return { plan: 'local', isPaid: true } }
export function isOrganizationOnTeamOrEnterprisePlan(_orgId?: string): boolean { return true }
export async function hasInboxAccess(..._args: any[]): Promise<boolean> { return true }
