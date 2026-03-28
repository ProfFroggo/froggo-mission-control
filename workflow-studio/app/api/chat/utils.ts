/**
 * Chat API utilities stub — stripped during Sim Studio fork.
 */

export async function checkChatAccess(
  _chatId: string,
  _userId: string
): Promise<{ hasAccess: boolean }> {
  return { hasAccess: true }
}

export async function checkWorkflowAccessForChatCreation(
  _workflowId: string,
  _userId: string
): Promise<{ hasAccess: boolean }> {
  return { hasAccess: true }
}
