/**
 * Usage log stub — local mode, no usage recording.
 */
export interface ModelUsageMetadata {
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  [key: string]: any
}

export async function recordUsage(..._args: any[]): Promise<void> {}
