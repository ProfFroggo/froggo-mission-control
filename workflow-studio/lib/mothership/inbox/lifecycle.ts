/**
 * Inbox lifecycle stub — stripped during Sim Studio fork.
 */

export async function enableInbox(
  _workspaceId: string,
  _options?: { username?: string }
): Promise<any> {
  return { enabled: false, address: null }
}

export async function disableInbox(_workspaceId: string): Promise<void> {
  // No-op
}

export async function updateInboxAddress(
  _workspaceId: string,
  _username: string
): Promise<any> {
  return { enabled: false, address: null }
}
