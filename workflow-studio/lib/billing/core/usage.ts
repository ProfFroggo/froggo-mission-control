/**
 * Usage tracking stub — local mode.
 */
export async function handleNewUser(_params: any): Promise<void> {}
export async function trackUsage(_params: any): Promise<void> {}
export async function checkUsageStatus(..._args: any[]): Promise<{ allowed: boolean }> { return { allowed: true } }
export async function getOrgUsageLimit(..._args: any[]): Promise<number> { return Infinity }
export async function maybeSendUsageThresholdEmail(..._args: any[]): Promise<void> {}
export async function getEffectiveCurrentPeriodCost(..._args: any[]): Promise<number> { return 0 }
