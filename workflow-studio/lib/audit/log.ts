/**
 * Audit logging stub — local mode, no audit trail.
 */

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  DEPLOY = 'deploy',
  EXECUTE = 'execute',
  ACCESS = 'access',
}

export enum AuditResourceType {
  WORKFLOW = 'workflow',
  CREDENTIAL = 'credential',
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  KNOWLEDGE_BASE = 'knowledge_base',
  FOLDER = 'folder',
  MCP_SERVER = 'mcp_server',
  TABLE = 'table',
  SETTING = 'setting',
  FILE = 'file',
}

export async function recordAudit(_params: {
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  userId?: string
  actorId?: string
  workspaceId?: string
  metadata?: Record<string, any>
  [key: string]: any
}): Promise<void> {
  // no-op in local mode
}

export default { recordAudit, AuditAction, AuditResourceType }
