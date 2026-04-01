/**
 * Knowledge processing stub — local mode.
 */
export interface DocumentProcessingPayload {
  documentId: string
  knowledgeBaseId: string
  userId: string
}

export async function processDocument(_payload: DocumentProcessingPayload): Promise<void> {
  // no-op
}
