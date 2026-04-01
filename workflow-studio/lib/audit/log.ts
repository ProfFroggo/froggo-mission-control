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
  VIEW = 'view',
  INVITE = 'invite',
  REVOKE = 'revoke',
  EXPORT = 'export',
  IMPORT = 'import',
  MCP_SERVER_UPDATED = 'mcp_server_updated',
  DEPLOY_TRIGGERED = 'deploy_triggered',
  // Workflow actions
  WORKFLOW_CREATED = 'workflow_created',
  WORKFLOW_DELETED = 'workflow_deleted',
  WORKFLOW_DEPLOYED = 'workflow_deployed',
  WORKFLOW_UNDEPLOYED = 'workflow_undeployed',
  WORKFLOW_DUPLICATED = 'workflow_duplicated',
  WORKFLOW_RESTORED = 'workflow_restored',
  WORKFLOW_DEPLOYMENT_ACTIVATED = 'workflow_deployment_activated',
  WORKFLOW_DEPLOYMENT_REVERTED = 'workflow_deployment_reverted',
  WORKFLOW_VARIABLES_UPDATED = 'workflow_variables_updated',
  // Folder actions
  FOLDER_CREATED = 'folder_created',
  FOLDER_DELETED = 'folder_deleted',
  FOLDER_DUPLICATED = 'folder_duplicated',
  // Credential set actions
  CREDENTIAL_SET_CREATED = 'credential_set_created',
  CREDENTIAL_SET_UPDATED = 'credential_set_updated',
  CREDENTIAL_SET_DELETED = 'credential_set_deleted',
  CREDENTIAL_SET_INVITATION_CREATED = 'credential_set_invitation_created',
  CREDENTIAL_SET_INVITATION_ACCEPTED = 'credential_set_invitation_accepted',
  CREDENTIAL_SET_INVITATION_REVOKED = 'credential_set_invitation_revoked',
  CREDENTIAL_SET_INVITATION_RESENT = 'credential_set_invitation_resent',
  CREDENTIAL_SET_MEMBER_REMOVED = 'credential_set_member_removed',
  CREDENTIAL_SET_MEMBER_LEFT = 'credential_set_member_left',
  // Connector actions
  CONNECTOR_CREATED = 'connector_created',
  CONNECTOR_UPDATED = 'connector_updated',
  CONNECTOR_DELETED = 'connector_deleted',
  CONNECTOR_SYNCED = 'connector_synced',
  CONNECTOR_DOCUMENT_RESTORED = 'connector_document_restored',
  CONNECTOR_DOCUMENT_EXCLUDED = 'connector_document_excluded',
  // Knowledge base actions
  KNOWLEDGE_BASE_CREATED = 'knowledge_base_created',
  KNOWLEDGE_BASE_UPDATED = 'knowledge_base_updated',
  KNOWLEDGE_BASE_DELETED = 'knowledge_base_deleted',
  KNOWLEDGE_BASE_RESTORED = 'knowledge_base_restored',
  // Document actions
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_DELETED = 'document_deleted',
  // File actions
  FILE_UPLOADED = 'file_uploaded',
  FILE_UPDATED = 'file_updated',
  FILE_DELETED = 'file_deleted',
  FILE_RESTORED = 'file_restored',
  // Table actions
  TABLE_CREATED = 'table_created',
  TABLE_UPDATED = 'table_updated',
  TABLE_DELETED = 'table_deleted',
  TABLE_RESTORED = 'table_restored',
  // API key actions
  API_KEY_CREATED = 'api_key_created',
  API_KEY_UPDATED = 'api_key_updated',
  API_KEY_REVOKED = 'api_key_revoked',
  // MCP server actions
  MCP_SERVER_ADDED = 'mcp_server_added',
  MCP_SERVER_REMOVED = 'mcp_server_removed',
  // Webhook actions
  WEBHOOK_CREATED = 'webhook_created',
  WEBHOOK_DELETED = 'webhook_deleted',
  // Schedule actions
  SCHEDULE_UPDATED = 'schedule_updated',
  // Template actions
  TEMPLATE_CREATED = 'template_created',
  TEMPLATE_UPDATED = 'template_updated',
  TEMPLATE_DELETED = 'template_deleted',
  // Environment actions
  ENVIRONMENT_UPDATED = 'environment_updated',
  // Member actions
  MEMBER_INVITED = 'member_invited',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  INVITATION_ACCEPTED = 'invitation_accepted',
  INVITATION_REVOKED = 'invitation_revoked',
  // Workspace actions
  WORKSPACE_CREATED = 'workspace_created',
  WORKSPACE_DELETED = 'workspace_deleted',
  WORKSPACE_DUPLICATED = 'workspace_duplicated',
  // Notification actions
  NOTIFICATION_CREATED = 'notification_created',
  NOTIFICATION_UPDATED = 'notification_updated',
  NOTIFICATION_DELETED = 'notification_deleted',
  // BYOK actions
  BYOK_KEY_CREATED = 'byok_key_created',
  BYOK_KEY_DELETED = 'byok_key_deleted',
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
  CREDENTIAL_SET = 'credential_set',
  WORKSPACE = 'workspace',
  API_KEY = 'api_key',
  ENVIRONMENT = 'environment',
  CUSTOM_TOOL = 'custom_tool',
  TEMPLATE = 'template',
  MCP_CONFIG = 'mcp_config',
  DOCUMENT = 'document',
  CONNECTOR = 'connector',
  KNOWLEDGE_CONNECTOR = 'knowledge_connector',
  CHAT = 'chat',
  FORM = 'form',
  BYOK_KEY = 'byok_key',
  NOTIFICATION = 'notification',
}

export async function recordAudit(..._args: any[]): Promise<void> {
  // no-op in local mode
}

export default { recordAudit, AuditAction, AuditResourceType }
