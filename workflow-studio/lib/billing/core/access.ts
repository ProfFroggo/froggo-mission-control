/**
 * Billing core access stub — local mode.
 */
export async function getEffectiveBillingStatus(..._args: any[]): Promise<{ billingBlocked: boolean; status: string }> {
  return { billingBlocked: false, status: 'active' }
}
