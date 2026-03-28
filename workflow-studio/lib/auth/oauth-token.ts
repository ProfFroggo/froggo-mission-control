/**
 * OAuth token validation stub — stripped during Sim Studio fork.
 */

export interface OAuthTokenValidationResult {
  success: boolean
  userId?: string
  scopes?: string[]
  error?: string
}

export async function validateOAuthAccessToken(
  _token: string
): Promise<OAuthTokenValidationResult> {
  return { success: false, error: 'OAuth token validation not available in this build' }
}
