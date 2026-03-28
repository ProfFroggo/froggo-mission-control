/**
 * Auth client stub — local mode, always authenticated.
 */

const LOCAL_USER = { id: '00000000-0000-0000-0000-000000000000', name: 'Local User', email: 'local@localhost' }
const LOCAL_SESSION = { id: 'local-session' }

export function useSession() {
  return {
    data: { user: LOCAL_USER, session: LOCAL_SESSION },
    isPending: false,
    error: null,
  }
}

export const client = {
  useSession,
  signIn: {
    email: async (_params: any) => ({ data: { user: LOCAL_USER } }),
    social: async (_params: any) => ({ data: {} }),
  },
  signUp: {
    email: async (_params: any) => ({ data: { user: LOCAL_USER } }),
  },
  signOut: async () => {},
  getSession: async () => ({ data: { user: LOCAL_USER, session: LOCAL_SESSION } }),
  organization: {
    getFullOrganization: async (_params: any) => ({ data: null }),
    listOrganizations: async () => ({ data: [] }),
    setActive: async (_params: any) => {},
  },
  admin: {
    listUsers: async (_params: any) => ({ data: { users: [] } }),
  },
}

export const authClient = client
export default client
