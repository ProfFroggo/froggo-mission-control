// Shared approval type badge configuration
// Used by ApprovalQueuePanel and InboxPanel for consistent badge colors and labels.

export type ApprovalType =
  | 'task'
  | 'tweet'
  | 'post_x'
  | 'reply'
  | 'email'
  | 'send_email'
  | 'message'
  | 'action'
  | 'delete_file'
  | 'git_push'
  | 'tool_permission';

export interface ApprovalTypeConfig {
  label: string;
  /** Combined Tailwind classes for the badge (text color + background). Uses CSS variable tokens. */
  className: string;
}

export const APPROVAL_TYPE_CONFIG: Record<string, ApprovalTypeConfig> = {
  task:        { label: 'Task',        className: 'text-[var(--color-warning)] bg-[var(--color-warning)]-subtle' },
  tweet:       { label: 'X Post',      className: 'text-[var(--color-info)] bg-[var(--color-info)]-subtle' },
  post_x:      { label: 'X Post',      className: 'text-[var(--color-info)] bg-[var(--color-info)]-subtle' },
  reply:       { label: 'Reply',       className: 'text-[var(--color-info)] bg-[var(--color-info)]-subtle' },
  email:       { label: 'Email',       className: 'text-[var(--color-success)] bg-[var(--color-success)]-subtle' },
  send_email:  { label: 'Email',       className: 'text-[var(--color-success)] bg-[var(--color-success)]-subtle' },
  message:     { label: 'Message',     className: 'text-review bg-review-subtle' },
  action:      { label: 'Action',      className: 'text-[var(--color-success)] bg-[var(--color-success)]-subtle' },
  delete_file: { label: 'Delete File', className: 'text-[var(--color-error)] bg-[var(--color-error)]-subtle' },
  git_push:       { label: 'Git Push',       className: 'text-[var(--color-warning)] bg-[var(--color-warning)]-subtle' },
  tool_permission: { label: 'Tool Permission', className: 'text-[var(--color-info)] bg-[var(--color-info)]-subtle' },
};

const FALLBACK_CONFIG: ApprovalTypeConfig = {
  label: 'Action',
  className: 'text-[var(--color-success)] bg-[var(--color-success)]-subtle',
};

export function getApprovalTypeConfig(type: string): ApprovalTypeConfig {
  return APPROVAL_TYPE_CONFIG[type] ?? FALLBACK_CONFIG;
}
