/**
 * Schedule execution stub — local mode.
 */
export async function executeWebhookJob(_payload: any): Promise<void> {
  // no-op in local mode
}

export async function executeScheduleJob(_payload: any): Promise<any> {
  // no-op in local mode
  return {}
}

export async function executeJobInline(_payload: any): Promise<void> {
  // no-op in local mode
}

export async function releaseScheduleLock(
  _scheduleId: string,
  _requestId: string,
  _queuedAt: Date,
  _errorContext?: string
): Promise<void> {
  // no-op in local mode
}
