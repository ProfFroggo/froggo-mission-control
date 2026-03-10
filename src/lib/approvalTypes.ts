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
  | 'git_push';

export interface ApprovalTypeConfig {
  label: string;
  /** Combined Tailwind classes for the badge (text color + background). Uses CSS variable tokens. */
  className: string;
}

export const APPROVAL_TYPE_CONFIG: Record<string, ApprovalTypeConfig> = {
  task:        { label: 'Task',        className: 'text-warning bg-warning-subtle' },
  tweet:       { label: 'X Post',      className: 'text-info bg-info-subtle' },
  post_x:      { label: 'X Post',      className: 'text-info bg-info-subtle' },
  reply:       { label: 'Reply',       className: 'text-info bg-info-subtle' },
  email:       { label: 'Email',       className: 'text-success bg-success-subtle' },
  send_email:  { label: 'Email',       className: 'text-success bg-success-subtle' },
  message:     { label: 'Message',     className: 'text-review bg-review-subtle' },
  action:      { label: 'Action',      className: 'text-success bg-success-subtle' },
  delete_file: { label: 'Delete File', className: 'text-error bg-error-subtle' },
  git_push:    { label: 'Git Push',    className: 'text-warning bg-warning-subtle' },
};

const FALLBACK_CONFIG: ApprovalTypeConfig = {
  label: 'Action',
  className: 'text-success bg-success-subtle',
};

export function getApprovalTypeConfig(type: string): ApprovalTypeConfig {
  return APPROVAL_TYPE_CONFIG[type] ?? FALLBACK_CONFIG;
}
