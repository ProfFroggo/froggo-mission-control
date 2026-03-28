/** Local user ID — single-user mode, no auth required */
export const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000'

export const ANONYMOUS_USER = {
  id: ANONYMOUS_USER_ID,
  name: 'Local User',
  email: 'local@localhost',
  emailVerified: true,
  image: null,
} as const
