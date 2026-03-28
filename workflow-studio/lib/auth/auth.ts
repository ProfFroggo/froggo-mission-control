/**
 * Local auth stub — always returns the local user session.
 * No better-auth, no billing, no SSO.
 */
import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from './constants'

interface Session {
  user: typeof ANONYMOUS_USER
  session: { id: string; userId: string; expiresAt: Date }
}

/** No-op auth handler — always authenticated */
export const auth = {
  handler: async (_req: Request) => new Response(JSON.stringify({ session: getLocalSession() })),
}

function getLocalSession(): Session {
  return {
    user: { ...ANONYMOUS_USER },
    session: {
      id: 'local-session',
      userId: ANONYMOUS_USER_ID,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  }
}

/** Always returns a valid session */
export async function getSession(): Promise<Session> {
  return getLocalSession()
}

/** No-op sign in */
export async function signIn(_email: string, _password: string) {
  return { user: ANONYMOUS_USER, session: getLocalSession().session }
}

/** No-op sign up */
export async function signUp(_email: string, _password: string, _name?: string) {
  return { user: ANONYMOUS_USER, session: getLocalSession().session }
}
