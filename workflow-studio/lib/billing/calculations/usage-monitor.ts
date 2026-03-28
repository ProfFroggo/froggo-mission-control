/**
 * Usage monitor stub — local mode, no usage limits.
 */
export async function checkServerSideUsageLimits(..._args: any[]): Promise<{ allowed: boolean }> {
  return { allowed: true }
}
