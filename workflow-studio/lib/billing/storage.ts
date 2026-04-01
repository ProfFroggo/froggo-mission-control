/**
 * Billing storage stub — local mode, no storage quotas.
 */
export async function checkStorageQuota(..._args: any[]): Promise<{ allowed: boolean }> {
  return { allowed: true }
}

export async function incrementStorageUsage(..._args: any[]): Promise<void> {}
export async function decrementStorageUsage(..._args: any[]): Promise<void> {}
