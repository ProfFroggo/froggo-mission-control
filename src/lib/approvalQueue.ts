// File-based approval queue integration
// Polls ~/clawd/approvals/queue.json for items I add

import { useStore, ApprovalType } from '../store/store';

declare global {
  interface Window {
    clawdbot?: {
      approvals?: {
        read: () => Promise<{ items: QueueItem[] }>;
        clear: () => Promise<{ success: boolean }>;
        remove: (id: string) => Promise<{ success: boolean }>;
        onUpdate: (callback: (items: QueueItem[]) => void) => () => void;
      };
    };
  }
}

interface QueueItem {
  id?: string;
  type: string;
  title: string;
  content: string;
  context?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

const seenIds = new Set<string>();

function processQueueItems(items: QueueItem[]) {
  const store = useStore.getState();
  
  for (const item of items) {
    // Generate ID if not present
    const id = item.id || `queue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    // Skip if we've already processed this
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    
    // Validate type
    const validTypes: ApprovalType[] = ['tweet', 'reply', 'email', 'message', 'task', 'action'];
    const type = validTypes.includes(item.type as ApprovalType) 
      ? item.type as ApprovalType 
      : 'action';
    
    // Add to store
    store.addApproval({
      type,
      title: item.title,
      content: item.content,
      context: item.context,
      metadata: item.metadata,
    });
    
    console.log('[ApprovalQueue] Added item:', item.title);
  }
}

export function initApprovalQueue() {
  // Only works in Electron
  if (!window.clawdbot?.approvals) {
    console.log('[ApprovalQueue] Not in Electron, using polling fallback');
    startPolling();
    return () => {};
  }
  
  // Initial read
  window.clawdbot.approvals.read().then(data => {
    if (data.items?.length > 0) {
      processQueueItems(data.items);
      // Clear after processing
      window.clawdbot!.approvals!.clear();
    }
  });
  
  // Listen for updates
  const unsubscribe = window.clawdbot.approvals.onUpdate((items) => {
    if (items?.length > 0) {
      processQueueItems(items);
      window.clawdbot!.approvals!.clear();
    }
  });
  
  return unsubscribe;
}

// Polling fallback for non-Electron or when IPC isn't available
let pollInterval: number | null = null;

async function pollQueue() {
  try {
    // Try Electron IPC first
    if (window.clawdbot?.approvals) {
      const data = await window.clawdbot.approvals.read();
      if (data.items?.length > 0) {
        processQueueItems(data.items);
        window.clawdbot.approvals.clear();
      }
      return;
    }
    
    // Fallback: try HTTP (if we add an endpoint later)
    // For now, just log
  } catch (error) {
    // Silent fail
  }
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = window.setInterval(pollQueue, 3000);
  pollQueue(); // Initial poll
}

export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
