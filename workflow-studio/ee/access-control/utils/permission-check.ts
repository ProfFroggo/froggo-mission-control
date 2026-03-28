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

export function getUserPermissionConfig(_userId?: string): {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canAdmin: boolean
  canManageCredentials: boolean
  canManageWorkspaces: boolean
  canManageApiKeys: boolean
  canManageEnvironments: boolean
  canManageCustomTools: boolean
  canManageTemplates: boolean
  canManageMcpConfig: boolean
  [key: string]: boolean
} {
  return {
    canRead: true,
    canWrite: true,
    canDelete: true,
    canAdmin: true,
    canManageCredentials: true,
    canManageWorkspaces: true,
    canManageApiKeys: true,
    canManageEnvironments: true,
    canManageCustomTools: true,
    canManageTemplates: true,
    canManageMcpConfig: true,
  }
}

/** Validation stubs — all no-ops in local mode (everything allowed). */
export function validateBlockType(..._args: any[]): void {}
export function validateModelProvider(..._args: any[]): void {}
export function validateCustomToolsAllowed(..._args: any[]): void {}
export function validateMcpToolsAllowed(..._args: any[]): void {}
export function validateSkillsAllowed(..._args: any[]): void {}
export function validatePublicApiAllowed(..._args: any[]): void {}
export function validateInvitationsAllowed(..._args: any[]): void {}

export class PublicApiNotAllowedError extends Error {
  constructor(message = 'Public API not allowed') {
    super(message)
    this.name = 'PublicApiNotAllowedError'
  }
}

export class InvitationsNotAllowedError extends Error {
  constructor(message = 'Invitations not allowed') {
    super(message)
    this.name = 'InvitationsNotAllowedError'
  }
}
