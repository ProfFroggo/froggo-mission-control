/**
 * Anonymous session stub for local mode.
 */
import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from './constants'

export interface AnonymousSession {
  userId: string
  name: string
  email: string
}

export async function createAnonymousSession(): Promise<AnonymousSession> {
  return {
    userId: ANONYMOUS_USER_ID,
    name: ANONYMOUS_USER.name,
    email: ANONYMOUS_USER.email,
  }
}

export async function ensureAnonymousUserExists(): Promise<string> {
  return ANONYMOUS_USER_ID
}
