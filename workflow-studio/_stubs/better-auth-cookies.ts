/** better-auth/cookies stub — auth cookies not used in local mode. */
export function getCookies(_req?: any): Record<string, string> {
  return {}
}
export function setCookies(_res?: any, _cookies?: Record<string, string>): void {}
export function parseCookies(_cookieHeader?: string): Record<string, string> {
  return {}
}
export function getSessionCookie(_req?: any): string | null {
  return 'local-session'
}
