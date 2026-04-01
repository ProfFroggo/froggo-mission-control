/**
 * Notification delivery stub — local mode, no notifications.
 */
export async function sendWorkspaceNotifications(_params: any): Promise<void> {
  // no-op
}

export async function executeNotificationDelivery(_payload: any): Promise<void> {
  // no-op in local mode
}

export const workspaceNotificationDeliveryTask = {
  trigger: async (_payload: any): Promise<void> => {
    // no-op in local mode
  },
}
