/**
 * Local auth hybrid stub — always returns authenticated.
 */
import type { NextRequest } from 'next/server'
import { ANONYMOUS_USER_ID } from './constants'

export const AuthType = {
  SESSION: 'session',
  API_KEY: 'api_key',
  INTERNAL_JWT: 'internal_jwt',
} as const

export type AuthTypeValue = (typeof AuthType)[keyof typeof AuthType]

export interface AuthResult {
  success: boolean
  userId?: string
  workspaceId?: string
  userName?: string | null
  userEmail?: string | null
  authType?: AuthTypeValue
  apiKeyType?: 'personal' | 'workspace'
  error?: string
}

const LOCAL_AUTH_RESULT: AuthResult = {
  success: true,
  userId: ANONYMOUS_USER_ID,
  userName: 'Local User',
  userEmail: 'local@localhost',
  authType: AuthType.SESSION,
}

/** Always returns authenticated — local mode */
export async function checkHybridAuth(
  _request: NextRequest,
  _options?: { requireWorkflowId?: boolean }
): Promise<AuthResult> {
  return LOCAL_AUTH_RESULT
}

/** Always returns authenticated — local mode */
export async function checkInternalAuth(
  _request: NextRequest,
  _options?: { requireWorkflowId?: boolean }
): Promise<AuthResult> {
  return { ...LOCAL_AUTH_RESULT, authType: AuthType.INTERNAL_JWT }
}

/** Always returns authenticated — local mode */
export async function checkSessionOrInternalAuth(
  _request: NextRequest,
  _options?: { requireWorkflowId?: boolean }
): Promise<AuthResult> {
  return LOCAL_AUTH_RESULT
}
