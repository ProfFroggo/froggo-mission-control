/**
 * Plan helpers stub — local mode, always on unlimited plan.
 */
export function isOrgPlan(_plan: any): boolean { return true }
export function isTeam(_plan: any): boolean { return false }
export function isPro(_plan: any): boolean { return true }
export function isFree(_plan: any): boolean { return false }
export function isPaid(_plan: any): boolean { return true }
export function isEnterprise(_plan: any): boolean { return false }
export function getDisplayPlanName(_plan: any): string { return 'Local' }
export function getPlanTierCredits(_plan: any): number { return Infinity }
export function getPlanTierDollars(_plan: any): number { return Infinity }
export function getPlanTypeForLimits(_plan: any): string { return 'unlimited' }
export function sqlIsPaid(..._args: any[]): any { return '1=1' }
