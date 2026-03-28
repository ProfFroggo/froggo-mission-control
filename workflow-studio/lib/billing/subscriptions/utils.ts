/**
 * Subscription utils stub — local mode.
 */
export function hasPaidSubscriptionStatus(_status: any): boolean { return true }
export function hasUsableSubscriptionAccess(..._args: any[]): boolean { return true }
export function checkEnterprisePlan(_params: any): boolean { return false }
export function getEffectiveSeats(_params: any): number { return Infinity }
export const ENTITLED_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const
export const USABLE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const
