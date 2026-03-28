/**
 * Internal JWT verification stub — local mode, always valid.
 */
import { ANONYMOUS_USER_ID } from './constants'

export async function verifyInternalToken(_token: string): Promise<string | null> {
  return ANONYMOUS_USER_ID
}

export function generateInternalToken(): string {
  return 'local-internal-token'
}

export async function verifyCronAuth(_request: any): Promise<boolean> {
  return true
}
