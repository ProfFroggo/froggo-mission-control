/**
 * OAuth stub — local mode, no OAuth providers.
 */

export type OAuthProvider = string
export type OAuthService = string
export interface OAuthServiceConfig {
  providerId: string
  name: string
  description?: string
  icon?: any
  category?: string
  scopes: string[]
  services?: any[]
  baseProvider?: string
  [key: string]: any
}
export interface Credential {
  id: string
  name?: string
  providerId: string
  provider?: string
  accessToken: string
  refreshToken?: string
  [key: string]: any
}

export const OAUTH_PROVIDERS: Record<string, OAuthServiceConfig> & OAuthServiceConfig[] = [] as any

export function getServiceConfigByProviderId(_id: string): OAuthServiceConfig | undefined {
  return undefined
}

export function getProviderIdFromServiceId(_serviceId: string): string | undefined {
  return undefined
}

export function getCanonicalScopesForProvider(_provider: string): string[] {
  return []
}

export function getScopeDescription(_scope: string): string {
  return _scope
}

export function getAllOAuthServices(): any[] {
  return []
}

export function parseProvider(_provider: string): any {
  return { baseProvider: _provider, serviceId: _provider }
}

export async function refreshOAuthToken(_credential: any): Promise<any> {
  return null
}
