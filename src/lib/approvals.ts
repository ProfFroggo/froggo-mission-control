// Approval utilities for Mission Control Dashboard

import { useStore, ApprovalType } from '../store/store';

export interface ApprovalRequest {
  type: ApprovalType;
  title: string;
  content: string;
  context?: string;
  metadata?: {
    to?: string;
    from?: string;
    platform?: string;
    replyTo?: string;
    scheduledFor?: string;
    actionType?: string;
    actionPayload?: any;
  };
}

// Parse approval from chat message
export function parseApprovalFromMessage(content: string): ApprovalRequest | null {
  if (!content.includes('[NEEDS_APPROVAL]') && !content.includes('[DRAFT]')) {
    return null;
  }

  const typeMatch = content.match(/\[TYPE:(\w+)\]/i);
  const titleMatch = content.match(/\[TITLE:([^\]]+)\]/i);
  const contentMatch = content.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/i);
  const contextMatch = content.match(/\[CONTEXT:([^\]]+)\]/i);
  const platformMatch = content.match(/\[PLATFORM:([^\]]+)\]/i);
  const toMatch = content.match(/\[TO:([^\]]+)\]/i);
  const scheduledMatch = content.match(/\[SCHEDULED:([^\]]+)\]/i);

  if (!typeMatch || !titleMatch) {
    return null;
  }

  const type = typeMatch[1].toLowerCase();
  const validTypes: ApprovalType[] = ['tweet', 'reply', 'email', 'message', 'task', 'action'];

  return {
    type: validTypes.includes(type as ApprovalType) ? type as ApprovalType : 'action',
    title: titleMatch[1],
    content: contentMatch ? contentMatch[1].trim() : content,
    context: contextMatch ? contextMatch[1] : undefined,
    metadata: {
      platform: platformMatch ? platformMatch[1] : undefined,
      to: toMatch ? toMatch[1] : undefined,
      scheduledFor: scheduledMatch ? scheduledMatch[1] : undefined,
    },
  };
}

// Queue approval from external source
export function queueApproval(request: ApprovalRequest) {
  useStore.getState().addApproval(request);
}

// Watch for approval files (for file-based queueing)
export async function loadApprovalsFromFile(path: string) {
  try {
    const response = await fetch(`file://${path}`);
    const data = await response.json();
    
    if (Array.isArray(data.items)) {
      data.items.forEach((item: ApprovalRequest) => {
        queueApproval(item);
      });
    }
  } catch (e) {
    // 'Failed to load approvals from file:', e;
  }
}

// Format approval for display
export function formatApprovalPreview(content: string, maxLength = 100): string {
  const clean = content.replace(/\[.*?\]/g, '').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + '...';
}

// Get icon for approval type
export function getApprovalIcon(type: ApprovalType): string {
  const icons: Record<ApprovalType, string> = {
    tweet: '🐦',
    reply: '↩️',
    email: '✉️',
    message: '💬',
    task: '📋',
    action: '⚡',
  };
  return icons[type] || '📥';
}
