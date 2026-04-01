/**
 * Permission groups types stub — local mode, no permission restrictions.
 */
export interface PermissionGroupConfig {
  allowedIntegrations: string[] | null
  allowedModelProviders: string[] | null
  disableInvitations: boolean
  disablePublicApi: boolean
  [key: string]: any
}

export const DEFAULT_PERMISSION_GROUP_CONFIG: PermissionGroupConfig = {
  allowedIntegrations: null,
  allowedModelProviders: null,
  disableInvitations: false,
  disablePublicApi: false,
}
