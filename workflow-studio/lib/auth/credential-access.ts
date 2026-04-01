/**
 * Credential access stub — local mode, all access allowed.
 */

export interface AccessResult {
  ok: boolean
  status?: number
  reason?: string
  notFound?: boolean
  credentialOwnerUserId?: string
  [key: string]: any
}

export interface DocumentAccessCheck {
  ok: boolean
  status?: number
  reason?: string
  notFound?: boolean
  [key: string]: any
}

export interface KnowledgeBaseAccessCheck {
  ok: boolean
  status?: number
  reason?: string
  notFound?: boolean
  [key: string]: any
}

export async function authorizeCredentialUse(..._args: any[]): Promise<AccessResult> {
  return { ok: true }
}

export async function checkCredentialAccess(..._args: any[]): Promise<AccessResult> {
  return { ok: true }
}

export async function checkDocumentAccess(..._args: any[]): Promise<DocumentAccessCheck> {
  return { ok: true }
}

export async function checkKnowledgeBaseAccess(..._args: any[]): Promise<KnowledgeBaseAccessCheck> {
  return { ok: true }
}

export async function checkWorkflowAccess(..._args: any[]): Promise<AccessResult> {
  return { ok: true }
}

export async function checkWorkspaceAccess(..._args: any[]): Promise<AccessResult> {
  return { ok: true }
}

export interface ChunkAccessCheck {
  ok: boolean
  status?: number
  reason?: string
  notFound?: boolean
  [key: string]: any
}

export async function checkChunkAccess(..._args: any[]): Promise<ChunkAccessCheck> {
  return { ok: true }
}
