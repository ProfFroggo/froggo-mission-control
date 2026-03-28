/**
 * Permission check stub — local mode, all permissions granted.
 */
export function checkPermission(_params: any): boolean {
  return true
}

export async function checkPermissionAsync(_params: any): Promise<boolean> {
  return true
}

export function hasPermission(_userId: string, _permission: string): boolean {
  return true
}
