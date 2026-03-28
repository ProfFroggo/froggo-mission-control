/**
 * OAuth stub — local mode, no OAuth providers.
 */

export type OAuthProvider = string
export type OAuthService = string
export interface OAuthServiceConfig {
  providerId: string
  name: string
  scopes: string[]
}
export interface Credential {
  id: string
  providerId: string
  accessToken: string
  refreshToken?: string
}

export const OAUTH_PROVIDERS: OAuthServiceConfig[] = []

export function getServiceConfigByProviderId(_id: string): OAuthServiceConfig | undefined {
  return undefined
}

export function getProviderIdFromServiceId(_serviceId: string): string | undefined {
  return undefined
}

export function getCanonicalScopesForProvider(_provider: string): string[] {
  return []
}

export function getAllOAuthServices(): OAuthService[] {
  return []
}

export function parseProvider(_provider: string): OAuthProvider | null {
  return null
}

export async function refreshOAuthToken(_credential: any): Promise<any> {
  return null
}
