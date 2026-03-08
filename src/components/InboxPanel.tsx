import { useState, useEffect, useRef, useCallback } from 'react';
import { Inbox, Check, X, XCircle, MessageSquare, Send, Mail, Calendar, Bot, ChevronDown, ChevronUp, Edit3, Clock, Filter, CheckCircle, RefreshCw, AlertTriangle, ShieldAlert, CalendarClock, Loader2, ArrowUp, ArrowDown, TrendingUp, Sparkles, Play } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import { SkeletonInbox } from './Skeleton';
import EmptyState from './EmptyState';
import { LoadingButton } from './LoadingStates';
import { calculatePriorityScore, getPriorityLevel } from '../lib/priorityScoring';
import AIAssistancePanel from './AIAssistancePanel';
import IconBadge from './IconBadge';
import MarkdownMessage from './MarkdownMessage';
import { matchTaskToAgent } from '../lib/agents';
import { createLogger } from '../utils/logger';
import { copyToClipboard } from '../utils/clipboard';
import { inboxApi, taskApi, sessionApi, approvalApi, scheduleApi } from '../lib/api';

const logger = createLogger('InboxPanel');

type ApprovalType = 'tweet' | 'reply' | 'email' | 'message' | 'task' | 'action';

interface InjectionWarning {
  detected: boolean;
  type: string;
  pattern: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

interface LocalInboxItem extends InboxItem {
  priority_score?: number;
  priority_metadata?: string;
}

// Helper to parse metadata and extract injection warning
const getInjectionWarning = (item: InboxItem): InjectionWarning | null => {
  if (!item.metadata) return null;
  try {
    const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
    return meta.injectionWarning || null;
  } catch {
    return null;
  }
};

// Risk level styling
const riskStyles: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-error-subtle', text: 'text-error', border: 'border-error-border' },
  high: { bg: 'bg-warning-subtle', text: 'text-warning', border: 'border-warning-border' },
  medium: { bg: 'bg-warning-subtle', text: 'text-warning', border: 'border-warning-border' },
  low: { bg: 'bg-info-subtle', text: 'text-info', border: 'border-info-border' },
};

const typeConfig: Record<ApprovalType, { icon: any; color: string; label: string }> = {
  tweet: { icon: Send, color: 'text-info bg-info-subtle', label: 'Tweet' },
  reply: { icon: MessageSquare, color: 'text-info bg-info-subtle', label: 'Reply' },
  email: { icon: Mail, color: 'text-success bg-success-subtle', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-review bg-review-subtle', label: 'Message' },
  task: { icon: Bot, color: 'text-warning bg-warning-subtle', label: 'Task' },
  action: { icon: Play, color: 'text-success bg-success-subtle', label: 'Action' },
};

// Helper component for shortcut rows
function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className="px-2 py-1 bg-mission-control-border rounded text-xs font-mono">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="mx-1 text-mission-control-text-dim">then</span>}
          </span>
        ))}
      </div>
      <span className="text-mission-control-text-dim text-xs ml-3">{description}</span>
    </div>
  );
}

type TabType = 'all' | 'approvals' | 'reviews';

export default function InboxPanel() {
  const [items, setItems] = useState<LocalInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingItems, setProcessingItems] = useState<Set<number | string>>(new Set());
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [feedbackId, setFeedbackId] = useState<number | string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [filter, setFilter] = useState<ApprovalType | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [rejectDialogItem, setRejectDialogItem] = useState<LocalInboxItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const rejectInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const recentlyRejectedTaskIds = useRef<Set<string>>(new Set());
  const recentlyApprovedIds = useRef<Set<number | string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  
  // Sorting state
  type SortMode = 'priority' | 'time' | 'type';
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [sortAscending, setSortAscending] = useState(false);
  
  // View mode state (list or priority lanes)
  type ViewMode = 'list' | 'lanes';
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Keyboard shortcuts state
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [gKeyPressed, setGKeyPressed] = useState(false);
  
  // Schedule modal state
  const [scheduleModal, setScheduleModal] = useState<{
    item: InboxItem;
    showDatePicker: boolean;
    date: string;
    time: string;
  } | null>(null);
  const [showAgentWarning, setShowAgentWarning] = useState(false);
  const [activeAgentSession, setActiveAgentSession] = useState<any>(null);
  const [pendingApprovalItem, setPendingApprovalItem] = useState<InboxItem | null>(null);
  const [abortingAgent, setAbortingAgent] = useState(false);
  
  // AI Assistance Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedItemForAI, setSelectedItemForAI] = useState<InboxItem | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      // Load inbox items via REST API
      const result = await inboxApi.getAll();
      let allItems: InboxItem[] = Array.isArray(result) ? result : (result?.items || []);
      
      // Also load tasks in "review" or "human-review" status that haven't been reviewed yet
      try {
        const [reviewResult, humanReviewResult] = await Promise.all([
          taskApi.getAll({ status: 'review' }),
          taskApi.getAll({ status: 'human-review' }),
        ]);
        const reviewTasks = [
          ...(Array.isArray(reviewResult) ? reviewResult : (reviewResult?.tasks || [])),
          ...(Array.isArray(humanReviewResult) ? humanReviewResult : (humanReviewResult?.tasks || [])),
        ];
        if (reviewTasks.length > 0) {
          // Convert tasks to inbox item format
          // Show tasks with reviewStatus starting with 'pending' (e.g. 'pending', 'pending-human')
          const taskItems = reviewTasks
            .filter((t: any) => !recentlyRejectedTaskIds.current.has(t.id))
            .filter((t: any) => !t.reviewStatus || t.reviewStatus.startsWith('pending'))
            .map((t: any) => ({
              id: `task-review-${t.id}`, // Prefix to distinguish from inbox items
              type: 'task' as const,
              title: `✅ Review: ${t.title}`,
              content: t.description || t.last_agent_update || 'Task completed, ready for review',
              context: `Project: ${t.project || 'General'}`,
              status: 'pending', // Review inbox item status (not task status)
              source_channel: 'kanban',
              created: new Date(t.created_at || Date.now()).toISOString(),
              metadata: JSON.stringify({ taskId: t.id, project: t.project, taskStatus: t.status }),
              isTask: true, // Flag to handle differently
            }));
          allItems = [...taskItems, ...allItems];
        }
      } catch (_e) {
        // Task items unavailable, continue with other inbox items
      }
      
      // Also load tasks in "human-review" status (approval required)
      try {
        const humanReviewResult2 = await taskApi.getAll({ status: 'human-review' });
        const hrTasks = Array.isArray(humanReviewResult2) ? humanReviewResult2 : (humanReviewResult2?.tasks || []);
        if (hrTasks.length > 0) {
          const humanReviewItems = hrTasks
            .filter((t: any) => !recentlyRejectedTaskIds.current.has(t.id))
            .filter((t: any) => t.approval_status === 'pending') // Only show pending approvals
            .map((t: any) => ({
              id: `task-approval-${t.id}`, // Prefix for human approval
              type: 'task' as const,
              title: `🚦 Human Approval: ${t.title}`,
              content: t.planning_notes || t.description || t.last_agent_update || 'Task requires human approval',
              context: `Project: ${t.project || 'General'} | Priority: ${t.priority || 'p3'}`,
              status: 'pending',
              source_channel: 'kanban',
              created: new Date(t.created_at || Date.now()).toISOString(),
              metadata: JSON.stringify({ taskId: t.id, project: t.project, taskStatus: t.status, approvalRequired: true }),
              isTask: true,
            }));
          allItems = [...humanReviewItems, ...allItems];
        }
      } catch (_e) {
        // Human review tasks unavailable, continue
      }
      
      // BUGFIX: Filter out items currently being processed OR recently approved to prevent flash
      // When items are approved/rejected, they're removed optimistically but may
      // reappear on next poll if API hasn't finished updating. Exclude processing IDs and recently approved.
      const filteredItems = allItems.filter(i => !processingItems.has(i.id) && !recentlyApprovedIds.current.has(i.id));
      setItems(filteredItems);
    } catch (error) {
      // 'Failed to load inbox:', error;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadInbox wrapped in useCallback, safe to call without adding to deps
  }, []);

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [loadInbox]);

  // Helper to determine if an item is a review vs approval
  const isReviewItem = (item: InboxItem): boolean => {
    // Task items are reviews (completed work)
    if ((item as any).isTask) return true;
    
    // Check metadata for review flag
    if (item.metadata) {
      try {
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.isReview) return true;
      } catch { /* ignore */ }
    }
    
    // Everything else is an approval (blocking decision)
    return false;
  };

  // Derive filtered lists from items (must be before useEffect that uses them!)
  const pendingItems = items.filter(i => i.status === 'pending');
  const completedItems = items.filter(i => i.status !== 'pending');
  
  // Apply tab filter first
  let tabFiltered = pendingItems;
  if (activeTab === 'approvals') {
    tabFiltered = pendingItems.filter(i => !isReviewItem(i));
  } else if (activeTab === 'reviews') {
    tabFiltered = pendingItems.filter(i => isReviewItem(i));
  }
  // 'all' shows everything
  
  // Then apply type filter
  let filteredPending = filter === 'all' ? tabFiltered : tabFiltered.filter(i => i.type === filter);
  
  // Calculate priority scores if not present and sort
  filteredPending = filteredPending.map(item => {
    if (item.priority_score === undefined || item.priority_score === null) {
      // Calculate on-the-fly if not in DB
      let metadata: Record<string, any> = {};
      try { metadata = item.metadata ? JSON.parse(item.metadata) : {}; } catch { /* malformed JSON */ }
      const score = calculatePriorityScore({
        type: item.type,
        title: item.title,
        content: item.content,
        context: item.context,
        metadata,
        created: item.created ?? '',
        source_channel: item.source_channel,
      });
      return { ...item, priority_score: score.total };
    }
    return item;
  });
  
  // Sort based on sortMode
  filteredPending = [...filteredPending].sort((a, b) => {
    let comparison = 0;
    
    switch (sortMode) {
      case 'priority':
        comparison = (b.priority_score || 0) - (a.priority_score || 0);
        break;
      case 'time':
        comparison = new Date(b.created ?? '').getTime() - new Date(a.created ?? '').getTime();
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
    }
    
    return sortAscending ? -comparison : comparison;
  });

  // Enhanced Keyboard shortcuts (Gmail-style)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // handleKeyDown recreates on each render, capturing latest state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input/textarea or if modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (rejectDialogItem || scheduleModal || showAgentWarning) return;
      
      const navItems = filteredPending;
      const key = e.key.toLowerCase();
      
      // Handle 'g' key for "go to" combinations
      if (key === 'g') {
        e.preventDefault();
        setGKeyPressed(true);
        setTimeout(() => setGKeyPressed(false), 1500); // Reset after 1.5s
        return;
      }
      
      // Handle "g + ?" combinations
      if (gKeyPressed) {
        e.preventDefault();
        setGKeyPressed(false);
        switch (key) {
          case 'i': // g + i: Go to inbox (pending)
            setShowCompleted(false);
            setFilter('all');
            setFocusedIndex(0);
            showToast('info', 'Viewing Inbox');
            break;
          case 's': // g + s: Go to starred/completed
            setShowCompleted(true);
            showToast('info', 'Viewing Completed');
            break;
          case 'a': // g + a: Go to all
            setFilter('all');
            setFocusedIndex(0);
            break;
          case 't': // g + t: Go to tweets
            setFilter('tweet');
            setFocusedIndex(0);
            break;
          case 'e': // g + e: Go to emails
            setFilter('email');
            setFocusedIndex(0);
            break;
        }
        return;
      }
      
      // Show help
      if (key === '?') {
        e.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
        return;
      }
      
      // Close help with Escape
      if (key === 'escape' && showKeyboardHelp) {
        e.preventDefault();
        setShowKeyboardHelp(false);
        return;
      }
      
      // Navigation shortcuts
      switch (key) {
        case 'j': // Next item
          e.preventDefault();
          if (navItems.length > 0) {
            setFocusedIndex(i => {
              const next = Math.min(i + 1, navItems.length - 1);
              // Scroll into view
              setTimeout(() => {
                const element = document.querySelector(`[data-inbox-index="${next}"]`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
              return next;
            });
          }
          break;
          
        case 'k': // Previous item
          e.preventDefault();
          if (navItems.length > 0) {
            setFocusedIndex(i => {
              const next = Math.max(i - 1, 0);
              // Scroll into view
              setTimeout(() => {
                const element = document.querySelector(`[data-inbox-index="${next}"]`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
              return next;
            });
          }
          break;
          
        case 'o':
        case 'enter': // Open/expand focused item
          e.preventDefault();
          if (navItems[focusedIndex]) {
            setExpandedId(expandedId === navItems[focusedIndex].id ? null : navItems[focusedIndex].id);
          }
          break;
          
        case 'u': // Go back (collapse if expanded)
          e.preventDefault();
          if (expandedId !== null) {
            setExpandedId(null);
          }
          break;
          
        // Selection shortcuts
        case 'x': // Toggle selection (Shift+X = bulk approve)
          e.preventDefault();
          if (e.shiftKey) {
            if (selectedIds.size > 0) {
              handleBulkApprove();
            }
          } else if (navItems[focusedIndex]) {
            toggleSelection(Number(navItems[focusedIndex].id));
          }
          break;
          
        case '*': // Select/deselect all
          e.preventDefault();
          if (selectedIds.size > 0) {
            clearSelection();
          } else {
            selectAll();
          }
          break;
          
        // Action shortcuts
        case 'a': // Approve focused item (Shift+A = approve all)
          e.preventDefault();
          if (e.shiftKey) {
            handleApproveAll();
          } else if (navItems[focusedIndex]) {
            handleApprove(navItems[focusedIndex]);
          }
          break;
          
        case 'r': // Reject focused item
          e.preventDefault();
          if (navItems[focusedIndex]) {
            setRejectDialogItem(navItems[focusedIndex]);
          }
          break;
          
        case 'e': // Archive (same as approve for inbox)
          e.preventDefault();
          if (navItems[focusedIndex]) {
            handleApprove(navItems[focusedIndex]);
          }
          break;
          
        // Shift+A and Shift+X handled in 'a' and 'x' cases above
          
        // Filter shortcuts
        case '/': {
          // Focus search/filter (can be implemented later)
          e.preventDefault();
          // For now, just cycle through filters
          const filters: (ApprovalType | 'all')[] = ['all', 'tweet', 'email', 'message', 'task'];
          const currentIndex = filters.indexOf(filter);
          const nextFilter = filters[(currentIndex + 1) % filters.length];
          setFilter(nextFilter);
          setFocusedIndex(0);
          break;
        }

        case '1': case '2': case '3': case '4': case '5': {
          // Quick filter: 1=all, 2=tweet, 3=email, 4=message, 5=task
          e.preventDefault();
          const filterMap: Record<string, ApprovalType | 'all'> = {
            '1': 'all',
            '2': 'tweet',
            '3': 'email',
            '4': 'message',
            '5': 'task',
          };
          setFilter(filterMap[key] || 'all');
          setFocusedIndex(0);
          break;
        }
          
        // Sorting shortcuts
        case 'p': // Sort by priority
          e.preventDefault();
          setSortMode('priority');
          break;
          
        case 't': // Sort by time
          e.preventDefault();
          setSortMode('time');
          break;
          
        case 's': // Toggle sort direction
          e.preventDefault();
          setSortAscending(!sortAscending);
          break;
          
        case 'v': // Toggle view mode (list/lanes)
          e.preventDefault();
          setViewMode(viewMode === 'list' ? 'lanes' : 'list');
          showToast('info', `View: ${viewMode === 'list' ? 'Priority Lanes' : 'List'}`);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // handleKeyDown recreates on each render, safe pattern
  }, [filteredPending, focusedIndex, expandedId, selectedIds, filter, sortMode, sortAscending, gKeyPressed, showKeyboardHelp, rejectDialogItem, scheduleModal, showAgentWarning]);

  // Check if agent is still active on this task
  const checkForActiveAgent = async (taskId: string) => {
    try {
      const result = await sessionApi.getAll();
      const sessions = Array.isArray(result) ? result : (result?.sessions || []);
      if (sessions.length > 0) {
        // Find session with label matching task ID
        const activeSession = sessions.find((s: any) => {
          // Session is active if updated within last 5 minutes
          const isActive = (Date.now() - s.updatedAt) < 5 * 60 * 1000;
          // Label contains task ID (e.g., "coder-task-123")
          const matchesTask = s.label && s.label.includes(taskId);
          return isActive && matchesTask;
        });
        
        return activeSession || null;
      }
    } catch (err) {
      // 'Failed to check for active agent:', err;
    }
    return null;
  };

  const handleApprove = async (item: InboxItem) => {
    // Mark item as processing
    setProcessingItems(prev => new Set(prev).add(item.id));
    
    // Helper to clear processing state
    const clearProcessing = () => {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    };
    
    // For task review items, check if agent is still active
    if ((item as any).isTask && item.metadata) {
      try {
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          const activeAgent = await checkForActiveAgent(meta.taskId);
          if (activeAgent) {
            // Agent is still active - show warning
            setActiveAgentSession(activeAgent);
            setPendingApprovalItem(item);
            setShowAgentWarning(true);
            clearProcessing();
            return; // Don't proceed with approval
          }
        }
      } catch (err) {
        // 'Error checking for active agent:', err;
      }
    }
    
    // For tweets, show schedule modal
    if (item.type === 'tweet') {
      // Set default time to next hour rounded
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().slice(0, 5);
      
      setScheduleModal({
        item,
        showDatePicker: false,
        date: dateStr,
        time: timeStr,
      });
      clearProcessing();
      return;
    }
    
    // For emails: 2-stage workflow
    if (item.type === 'email') {
      // Parse metadata to check if this is Stage 2 (ready to send)
      let metadata: any = {};
      if (item.metadata) {
        try {
          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        } catch { /* ignore */ }
      }
      
      // Stage 2: Email is ready to send - show Send/Schedule modal
      if (metadata.readyToSend) {
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().slice(0, 5);
        
        setScheduleModal({
          item,
          showDatePicker: false,
          date: dateStr,
          time: timeStr,
        });
        clearProcessing();
        return;
      }
      
      // Stage 1: Content approved - create "Send Email to [recipient]" item
      const recipient = metadata.recipient || metadata.to || 'recipient';
      const subject = metadata.subject || 'No Subject';
      const account = metadata.account || '';
      
      // Create Stage 2 inbox item
      const stage2Item = {
        type: 'email',
        title: `📤 Send Email to ${recipient}`,
        content: item.content,
        context: `Subject: ${subject}${account ? ` | From: ${account}` : ''}\n\nApproved content ready to send.`,
        channel: 'email-stage2',
        metadata: JSON.stringify({
          ...metadata,
          readyToSend: true,
          originalInboxId: item.id,
          recipient,
          subject,
          account,
        }),
      };
      
      try {
        // Add Stage 2 item to inbox
        const result = await inboxApi.create(stage2Item);

        if (result) {
          // Mark original as approved (Stage 1 complete)
          setItems(prev => prev.filter(i => i.id !== item.id));
          await inboxApi.update(Number(item.id), { status: 'approved' });
          showToast('success', 'Email content approved', `Ready to send to ${recipient}`);
        } else {
          showToast('error', 'Failed to create send task', result?.error);
        }
      } catch (error: unknown) {
        // '[Inbox] Stage 1 email approval error:', error;
        showToast('error', 'Approval failed', error instanceof Error ? error.message : String(error));
      }
      clearProcessing();
      return;
    }
    
    // For other types, execute immediately (existing behavior)
    try {
      await executeApproval(item);
    } finally {
      clearProcessing();
    }
  };
  
  const executeApproval = async (item: InboxItem) => {
    // BUGFIX: Track recently approved to prevent bounce-back during polling
    recentlyApprovedIds.current.add(item.id);
    // Clear from recently approved after 10 seconds (should be enough for API to sync)
    setTimeout(() => recentlyApprovedIds.current.delete(item.id), 10000);
    
    // OPTIMISTIC UI: Remove item immediately for instant feedback
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('success', 'Approved ✓', item.title);
    
    // Then sync in background
    try {
      // Check if this is a task review (not a regular inbox item)
      if ((item as any).isTask && item.metadata) {
        // This is a task in review status - approve and move to done
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          // FIX: Update BOTH reviewStatus (to mark as reviewed) AND status (to move to done)
          await taskApi.update(meta.taskId, {
            reviewStatus: 'approved',
            status: 'done'
          } as any);
          return;
        }
      }

      // Regular inbox item - update and create execution task
      await inboxApi.update(Number(item.id), { status: 'approved' });
      
      // Create task as IN-PROGRESS so watcher picks it up and executes
      const projectMap: Record<string, string> = {
        'tweet': 'X',
        'reply': 'X',
        'email': 'Email',
        'message': 'Message',
        'whatsapp': 'Message',
        'telegram': 'Message',
      };
      
      // Parse metadata safely
      let metadata = {};
      if (item.metadata) {
        try {
          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        } catch (_e) {
          // Keep metadata as-is if JSON parse fails
        }
      }
      
      const taskData = {
        id: `task-${Date.now()}`,
        title: item.title,
        description: item.content,
        status: 'in-progress',
        project: projectMap[item.type] || 'Approved',
        assignedTo: matchTaskToAgent(item.title, item.content || ''),
        metadata,
      };
      
      const result = await taskApi.create(taskData);
      if (!result) {
        logger.error('Task creation failed');
      } else {
        // SAFEGUARD: Verify the status is correct after a brief delay
        setTimeout(async () => {
          try {
            await taskApi.update(taskData.id, { status: 'in-progress' });
          } catch (_e) {
            // Non-blocking: status update is best-effort
          }
        }, 500);
      }
    } catch (error) {
      // Revert on error
      // '[Inbox] Error in executeApproval:', error;
      showToast('error', 'Approval failed', 'Reverting...');
      loadInbox(); // Reload to revert
    }
  };

  const handleReject = (item: InboxItem, reason?: string) => {
    if (reason) {
      // Direct reject with provided reason (for bulk operations)
      directReject(item, reason);
    } else {
      // Open rejection dialog for manual reason
      setRejectDialogItem(item);
      setRejectReason('');
      setTimeout(() => rejectInputRef.current?.focus(), 100);
    }
  };

  const directReject = async (item: InboxItem, reason: string) => {
    setProcessingItems(prev => new Set(prev).add(item.id));
    
    // BUGFIX: Track recently rejected to prevent bounce-back during polling
    recentlyApprovedIds.current.add(item.id); // Use same tracking mechanism
    setTimeout(() => recentlyApprovedIds.current.delete(item.id), 10000);
    
    try {
      // OPTIMISTIC UI: Remove immediately
      setItems(prev => prev.filter(i => i.id !== item.id));
      showToast('warning', 'Rejected ✗', item.title);
      
      // Check if this is a task review item
      const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
      
      if (isTaskItem && item.metadata) {
        // For task items, update the task status back to in-progress and mark review as rejected
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          // Prevent poll from re-adding this task while status update propagates
          recentlyRejectedTaskIds.current.add(meta.taskId);
          setTimeout(() => recentlyRejectedTaskIds.current.delete(meta.taskId), 120000);
          try {
            // FIX: Update BOTH reviewStatus (mark as rejected) AND status (send back to in-progress)
            await taskApi.update(meta.taskId, {
              reviewStatus: 'rejected',
              status: 'in-progress'
            });
          } catch (updateErr) {
            // '[Inbox] Failed to update task status on reject, retrying...', updateErr;
            // Retry once after a short delay
            setTimeout(async () => {
              try {
                await taskApi.update(meta.taskId, {
                  reviewStatus: 'rejected',
                  status: 'in-progress'
                });
              } catch (retryErr) {
                // '[Inbox] Retry also failed:', retryErr;
              }
            }, 2000);
          }
          gateway.sendToMain(`[TASK_REVISION] Task "${item.title}" needs revision.\nReason: ${reason}`);
        }
      } else {
        // Regular inbox item
        await inboxApi.update(Number(item.id), {
          status: 'rejected',
          feedback: reason
        });
      }

      // Log rejection (best-effort via settings)
      try {
        await fetch('/api/inbox/rejections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, title: item.title, content: item.content, reason }),
        });
      } catch (_e) { /* non-critical */ }
    } catch (error) {
      // 'Reject error:', error;
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const confirmReject = async () => {
    if (!rejectDialogItem) return;
    
    const reason = rejectReason.trim() || "No reason provided";
    const item = rejectDialogItem;
    
    // BUGFIX: Track recently rejected to prevent bounce-back during polling
    recentlyApprovedIds.current.add(item.id); // Use same tracking mechanism
    setTimeout(() => recentlyApprovedIds.current.delete(item.id), 10000);
    
    // OPTIMISTIC UI: Remove immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
    setRejectDialogItem(null);
    setRejectReason('');
    showToast('warning', 'Rejected ✗', item.title);
    
    // Sync in background
    try {
      // Check if this is a task review item (has string ID like "task-review-XXX")
      const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
      
      if (isTaskItem && item.metadata) {
        // For task items, update the task status back to in-progress with feedback
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        if (meta.taskId) {
          // Prevent poll from re-adding this task while status update propagates
          recentlyRejectedTaskIds.current.add(meta.taskId);
          setTimeout(() => recentlyRejectedTaskIds.current.delete(meta.taskId), 120000);
          try {
            await taskApi.update(meta.taskId, { status: 'in-progress' });
          } catch (updateErr) {
            // '[Inbox] Failed to update task status on reject, retrying...', updateErr;
            setTimeout(async () => {
              try {
                await taskApi.update(meta.taskId, { status: 'in-progress' });
              } catch (retryErr) {
                // '[Inbox] Retry also failed:', retryErr;
              }
            }, 2000);
          }
          // Log activity with rejection reason
          gateway.sendToMain(`[TASK_REVISION] Task "${item.title}" needs revision.\nReason: ${reason}`);
        }
      } else {
        // Regular inbox item
        await inboxApi.update(Number(item.id), {
          status: 'rejected',
          feedback: reason
        });
      }

      // Log rejection (best-effort)
      try {
        await fetch('/api/inbox/rejections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, title: item.title, content: item.content, reason }),
        });
      } catch (_e) { /* non-critical */ }
      
      if (reason !== "No reason provided") {
        gateway.sendToMain(`[REJECTION_LESSON] ${item.type}: "${item.title}"\nReason: ${reason}\n\nLearn from this.`);
      }
    } catch (error) {
      // '[Inbox] Reject failed:', error;
      loadInbox(); // Revert
    }
  };

  const handleAdjust = async (item: InboxItem) => {
    if (!feedbackText.trim()) return;
    
    // OPTIMISTIC UI: Remove from pending list immediately
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('info', 'Revision requested', 'Creating task...');

    // Check if this is a task review item
    const isTaskItem = (item as any).isTask || String(item.id).startsWith('task-review-');
    
    if (isTaskItem && item.metadata) {
      // For task items, update the task status back to in-progress with feedback
      let meta: Record<string, any> = {};
      try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata; } catch { /* malformed JSON */ }
      if (meta.taskId) {
        await taskApi.update(meta.taskId, { status: 'in-progress' });
        // Send feedback to agent
        gateway.sendToMain(`[TASK_FEEDBACK] Task "${item.title}" needs revision.\nFeedback: ${feedbackText}`);
        showToast('success', 'Feedback sent', 'Task moved back to In Progress');
      }
    } else {
      // Regular inbox item - update status and create revision task
      await inboxApi.update(Number(item.id), {
        status: 'needs-revision',
        feedback: feedbackText
      });

      // Create a TASK in Kanban for the revision
      const taskData = {
        id: `task-${Date.now()}`,
        title: `Revise: ${item.title}`,
        description: `Original:\n${item.content}\n\nFeedback:\n${feedbackText}\n\n[Inbox ID: ${item.id}]`,
        status: 'in-progress',
        project: item.type === 'tweet' || item.type === 'reply' ? 'X' :
                 item.type === 'email' ? 'Email' : 'Revisions',
        assignedTo: matchTaskToAgent(item.title, `${item.type} ${item.content || ''}`),
      };

      const result = await taskApi.create(taskData);
      if (result) {
        showToast('success', 'Revision task created', 'Check Tasks tab');
        try { await taskApi.update(taskData.id, { status: 'in-progress' }); } catch (_e) { /* best-effort */ }
      } else {
        logger.error('Task creation failed:', result);
        showToast('error', 'Revision task failed', 'Unknown error');
      }
    }
    
    setFeedbackId(null);
    setFeedbackText('');
    // Don't reload - already removed optimistically
  };

  const handleApproveAll = () => {
    pendingItems.forEach(item => handleApprove(item));
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pendingItems.map(i => i.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkApprove = () => {
    selectedIds.forEach(id => {
      const item = pendingItems.find(i => i.id === id);
      if (item) handleApprove(item);
    });
    clearSelection();
  };

  const handleBulkReject = () => {
    selectedIds.forEach(id => {
      const item = pendingItems.find(i => i.id === id);
      if (item) handleReject(item, 'Bulk rejected');
    });
    clearSelection();
  };

  const formatTime = (created: string) => {
    const ts = new Date(created).getTime();
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const handleToggleAIPanel = (item: InboxItem) => {
    if (selectedItemForAI?.id === item.id && showAIPanel) {
      // Clicking the same item closes the panel
      setShowAIPanel(false);
      setSelectedItemForAI(null);
    } else {
      // Open panel with new item
      setSelectedItemForAI(item);
      setShowAIPanel(true);
    }
  };

  const handleApplySuggestion = async (suggestion: string) => {
    // For now, copy to clipboard - could be extended to apply to content field
    const success = await copyToClipboard(suggestion);
    if (success) {
      showToast('success', 'Suggestion copied to clipboard');
    } else {
      showToast('error', 'Copy failed', 'Unable to copy to clipboard');
    }
  };

  return (
    <div className="h-full flex">
      {/* Main Inbox Content */}
      <div className="flex-1 min-w-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <Inbox size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-heading-2">Approval Inbox</h1>
              <p className="text-sm text-mission-control-text-dim">
                {pendingItems.length} pending • {completedItems.length} completed
                <span className="ml-2 text-mission-control-text-dim/50">
                  • Press <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded text-xs font-mono">?</kbd> for shortcuts
                </span>
              </p>
              {gKeyPressed && (
                <div className="mt-2 icon-text text-xs">
                  <span className="px-2 py-1 bg-mission-control-accent text-white rounded font-mono animate-pulse">
                    g
                  </span>
                  <span className="text-mission-control-text-dim">
                    Press: <kbd className="px-1 bg-mission-control-border rounded">i</kbd> inbox • 
                    <kbd className="px-1 bg-mission-control-border rounded ml-1">s</kbd> starred • 
                    <kbd className="px-1 bg-mission-control-border rounded ml-1">a</kbd> all • 
                    <kbd className="px-1 bg-mission-control-border rounded ml-1">t</kbd> tweets • 
                    <kbd className="px-1 bg-mission-control-border rounded ml-1">e</kbd> emails
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="icon-text px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <span className="text-xs font-mono">⌨️</span>
              Shortcuts
            </button>
            <button
              onClick={loadInbox}
              className="icon-text px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {selectedIds.size > 0 ? (
              <div className="icon-text">
                <span className="text-sm text-mission-control-text-dim">{selectedIds.size} selected</span>
                <button
                  onClick={handleBulkApprove}
                  className="icon-text px-3 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors text-sm"
                >
                   <CheckCircle size={16} className="flex-shrink-0" />
                  Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  className="icon-text px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm"
                >
                   <XCircle size={16} className="flex-shrink-0" />
                  Reject
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2 py-2 text-mission-control-text-dim hover:text-mission-control-text transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            ) : pendingItems.length > 1 && (
              <div className="icon-text">
                <button
                  onClick={selectAll}
                  className="text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={handleApproveAll}
                  className="icon-text px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                >
                   <CheckCircle size={16} className="flex-shrink-0" />
                  Approve All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setActiveTab('all'); setFocusedIndex(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
            }`}
          >
            <Inbox size={16} className="flex-shrink-0" />
            All
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'all' ? 'bg-mission-control-text/20' : 'bg-mission-control-bg'
            }`}>
              {pendingItems.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('approvals'); setFocusedIndex(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'approvals'
                ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
            }`}
          >
            <ShieldAlert size={16} className="flex-shrink-0" />
            Approvals
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'approvals' ? 'bg-mission-control-text/20' : 'bg-mission-control-bg'
            }`}>
              {pendingItems.filter(i => !isReviewItem(i)).length}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('reviews'); setFocusedIndex(0); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'reviews'
                ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
            }`}
          >
            <CheckCircle size={16} className="flex-shrink-0" />
            Reviews
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'reviews' ? 'bg-mission-control-text/20' : 'bg-mission-control-bg'
            }`}>
              {pendingItems.filter(i => isReviewItem(i)).length}
            </span>
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-mission-control-text-dim font-medium">Sort by:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortMode('priority')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortMode === 'priority'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
              }`}
            >
               <TrendingUp size={14} className="flex-shrink-0" />
              Priority
            </button>
            <button
              onClick={() => setSortMode('time')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortMode === 'time'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
              }`}
            >
               <Clock size={14} className="flex-shrink-0" />
              Time
            </button>
            <button
              onClick={() => setSortMode('type')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortMode === 'type'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
              }`}
            >
               <Filter size={14} className="flex-shrink-0" />
              Type
            </button>
            <button
              onClick={() => setSortAscending(!sortAscending)}
              className="p-1.5 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/70 transition-colors"
              title={sortAscending ? 'Ascending' : 'Descending'}
            >
              {sortAscending ? <ArrowUp size={16} className="flex-shrink-0" /> : <ArrowDown size={16} className="flex-shrink-0" />}
            </button>
          </div>
          
          {/* View Mode Toggle */}
          <div className="icon-text ml-auto">
            <span className="text-xs text-mission-control-text-dim font-medium">View:</span>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'lanes' : 'list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === 'lanes'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
              }`}
              title="Toggle priority lanes (v)"
            >
               <Inbox size={24} className="flex-shrink-0" />
              {viewMode === 'list' ? 'List' : 'Lanes'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === 'all' 
                ? 'bg-mission-control-accent text-white' 
                : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
            }`}
          >
            All ({pendingItems.length})
          </button>
          {Object.entries(typeConfig).map(([type, config]) => {
            const Icon = config.icon;
            const count = pendingItems.filter(i => i.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilter(type as ApprovalType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === type
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Pending Items */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {loading && pendingItems.length === 0 ? (
          <div className="p-6">
            <SkeletonInbox />
          </div>
        ) : filteredPending.length === 0 ? (
          <EmptyState 
            type="inbox" 
            description="Items will appear here when they need your review"
          />
        ) : (
          <div className="p-6 space-y-4">
            {filteredPending.map((item, index) => {
              const config = typeConfig[item.type as ApprovalType] ?? typeConfig['action'];
              const Icon = config.icon;
              const isExpanded = expandedId === item.id;
              const showFeedback = feedbackId === item.id;
              const isFocused = index === focusedIndex;

              return (
                <div
                  key={item.id}
                  data-inbox-index={index}
                  className={`card overflow-hidden transition-all ${
                    isFocused 
                      ? 'border-mission-control-accent ring-2 ring-mission-control-accent/30' 
                      : 'hover:border-mission-control-accent/30'
                  } ${(() => {
                    const warning = getInjectionWarning(item);
                    return warning ? riskStyles[warning.risk]?.border || '' : '';
                  })()}`}
                >
                  {/* Injection Warning Banner */}
                  {(() => {
                    const warning = getInjectionWarning(item);
                    if (!warning) return null;
                    const style = riskStyles[warning.risk] || riskStyles.high;
                    return (
                      <div className={`${style.bg} ${style.text} px-4 py-2 flex items-center gap-2 border-b ${style.border}`}>
                        <ShieldAlert size={20} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="icon-text flex-wrap">
                            <span className="font-semibold text-sm">⚠️ Potential {warning.type.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${style.bg} font-medium uppercase`}>
                              {warning.risk} risk
                            </span>
                          </div>
                          <p className="text-xs opacity-80 mt-0.5">
                            Pattern detected: <code className="bg-mission-control-bg/20 px-1 rounded">{warning.pattern}</code>
                          </p>
                        </div>
                        <AlertTriangle size={20} className="flex-shrink-0 animate-pulse" />
                      </div>
                    );
                  })()}
                  
                  {/* Header */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Selection checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(Number(item.id))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 mt-1 rounded border-mission-control-border text-mission-control-accent focus:ring-mission-control-accent focus:ring-offset-0 bg-mission-control-bg cursor-pointer"
                      />
                      <IconBadge icon={Icon} size={18} color={config.color} />
                      <div className="flex-1 min-w-0">
                        <div className="icon-text mb-1 flex-wrap">
                          <span className="text-xs font-medium px-2 py-0.5 bg-mission-control-border rounded">
                            {config.label}
                          </span>
                          
                          {/* Keyboard hint for focused item */}
                          {isFocused && (
                            <span className="text-xs text-mission-control-accent font-mono flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                              <kbd className="px-1.5 py-0.5 bg-mission-control-accent/20 rounded flex-shrink-0">o</kbd> open
                              <kbd className="px-1.5 py-0.5 bg-mission-control-accent/20 rounded ml-1 flex-shrink-0">a</kbd> approve
                              <kbd className="px-1.5 py-0.5 bg-mission-control-accent/20 rounded ml-1 flex-shrink-0">x</kbd> select
                            </span>
                          )}
                          
                          {/* Priority Badge */}
                          {item.priority_score !== undefined && item.priority_score !== null && (
                            (() => {
                              const { label, color } = getPriorityLevel(item.priority_score);
                              return (
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${color}`}
                                  title={`Priority Score: ${item.priority_score}`}
                                >
                                  <TrendingUp size={14} className="flex-shrink-0" />
                                  <span className="flex-shrink-0">{label} ({item.priority_score})</span>
                                </span>
                              );
                            })()
                          )}
                          
                          {/* Warning badge in header too for collapsed view */}
                          {getInjectionWarning(item) && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${
                              riskStyles[getInjectionWarning(item)!.risk]?.bg
                            } ${riskStyles[getInjectionWarning(item)!.risk]?.text}`}>
                              <AlertTriangle size={14} className="flex-shrink-0" />
                              <span className="flex-shrink-0">{getInjectionWarning(item)!.risk.toUpperCase()}</span>
                            </span>
                          )}
                          <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                             <Clock size={14} className="flex-shrink-0" />
                            {formatTime(item.created ?? '')}
                          </span>
                          {item.source_channel && (
                            <span className="text-xs text-mission-control-text-dim">
                              from {item.source_channel}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium truncate">{item.title}</h3>
                        {item.context && (
                          <p className="text-xs text-mission-control-text-dim mt-1">{item.context}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleAIPanel(item)}
                        className={`p-2 hover:bg-mission-control-border rounded-lg transition-colors ${
                          selectedItemForAI?.id === item.id && showAIPanel
                            ? 'bg-mission-control-accent text-white'
                            : ''
                        }`}
                        title="AI Assistance"
                        aria-label="AI Assistance"
                      >
                         <Sparkles size={16} className="flex-shrink-0" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="p-2 hover:bg-mission-control-border rounded-lg transition-colors flex-shrink-0"
                        title={isExpanded ? "Collapse" : "Expand"}
                        aria-label={isExpanded ? "Collapse item" : "Expand item"}
                      >
                        {isExpanded ?  <ChevronUp size={16} className="flex-shrink-0" /> :  <ChevronDown size={16} className="flex-shrink-0" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-mission-control-border bg-mission-control-bg/30">
                      {/* Priority Score Breakdown */}
                      {item.priority_score !== undefined && item.priority_metadata && (
                        <div className="mt-4 mb-4 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
                          <div className="icon-text mb-2">
                            <TrendingUp size={16} className="text-mission-control-accent" />
                            <span className="text-sm font-medium">Priority Analysis</span>
                          </div>
                          {(() => {
                            try {
                              const meta = JSON.parse(item.priority_metadata);
                              const { breakdown, flags } = meta;
                              return (
                                <>
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Sender:</span>
                                      <span className="ml-1 text-mission-control-accent font-medium">{breakdown.sender}</span>
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Urgency:</span>
                                      <span className="ml-1 text-mission-control-accent font-medium">{breakdown.urgency}</span>
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Time:</span>
                                      <span className="ml-1 text-mission-control-accent font-medium">{breakdown.timeSensitivity}</span>
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Type:</span>
                                      <span className="ml-1 text-mission-control-accent font-medium">{breakdown.type}</span>
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Context:</span>
                                      <span className="ml-1 text-mission-control-accent font-medium">{breakdown.context}</span>
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-mission-control-text-dim">Total:</span>
                                      <span className="ml-1 text-mission-control-accent font-bold">{item.priority_score}</span>
                                    </div>
                                  </div>
                                  {flags && flags.length > 0 && (
                                    <div className="text-xs text-mission-control-text-dim">
                                      <span className="font-medium">Factors: </span>
                                      {flags.join(', ')}
                                    </div>
                                  )}
                                </>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                      
                      <div className="mt-4 mb-4">
                        <div className="text-sm text-mission-control-text-dim mb-2">Content:</div>
                        <div className="bg-mission-control-bg p-3 rounded-lg text-sm whitespace-pre-wrap font-mono border border-mission-control-border text-left overflow-x-auto">
                          <MarkdownMessage content={item.content} />
                        </div>
                      </div>

                      {/* Feedback Form */}
                      {showFeedback && (
                        <div className="mb-4 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Enter your feedback for revision..."
                            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-mission-control-accent"
                            rows={3}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleAdjust(item)}
                              className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm hover:bg-mission-control-accent/90 transition-colors"
                            >
                              Send Feedback
                            </button>
                            <button
                              onClick={() => {
                                setFeedbackId(null);
                                setFeedbackText('');
                              }}
                              className="px-3 py-1.5 bg-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:bg-mission-control-border/70 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <LoadingButton
                          loading={processingItems.has(item.id)}
                          onClick={() => handleApprove(item)}
                          variant="primary"
                          className="bg-green-500 hover:bg-green-600"
                          icon={ <Check size={16} className="flex-shrink-0" />}
                        >
                          Approve
                        </LoadingButton>
                        <LoadingButton
                          onClick={() => setFeedbackId(showFeedback ? null : item.id)}
                          variant="primary"
                          className="bg-mission-control-accent hover:bg-mission-control-accent-dim"
                          icon={ <Edit3 size={16} className="flex-shrink-0" />}
                        >
                          Adjust
                        </LoadingButton>
                        <LoadingButton
                          loading={processingItems.has(item.id)}
                          onClick={() => handleReject(item)}
                          variant="danger"
                          icon={ <X size={16} className="flex-shrink-0" />}
                        >
                          Reject
                        </LoadingButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Items (collapsible) */}
      {completedItems.length > 0 && (
        <div className="border-t border-mission-control-border bg-mission-control-surface/50">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full p-4 flex items-center justify-between hover:bg-mission-control-surface/70 transition-colors"
          >
            <div className="icon-text text-sm text-mission-control-text-dim">
               <CheckCircle size={16} className="flex-shrink-0" />
              Completed ({completedItems.length})
            </div>
            {showCompleted ?  <ChevronUp size={16} className="flex-shrink-0" /> :  <ChevronDown size={16} className="flex-shrink-0" />}
          </button>
          
          {showCompleted && (
            <div className="px-6 pb-4 max-h-64 overflow-y-auto space-y-2">
              {completedItems.map((item) => {
                const config = typeConfig[item.type as ApprovalType] ?? typeConfig['action'];
                const Icon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-mission-control-bg rounded-lg border border-mission-control-border opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={config.color.split(' ')[0]} />
                      <div>
                        <div className="text-sm">{item.title}</div>
                        <div className="text-xs text-mission-control-text-dim">{formatTime(item.created ?? '')}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      item.status === 'approved' ? 'bg-success-subtle text-success' :
                      item.status === 'rejected' ? 'bg-error-subtle text-error' :
                      'bg-info-subtle text-info'
                    }`}>
                      {item.status}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectDialogItem && (
        <div 
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" 
          onClick={() => setRejectDialogItem(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setRejectDialogItem(null); } }}
          role="button"
          tabIndex={0}
          aria-label="Close reject dialog"
        >
          <div 
            className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 max-w-md w-full mx-4" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h3 className="text-heading-3 mb-4">Why are you rejecting this?</h3>
            <p className="text-sm text-mission-control-text-dim mb-4">This helps me learn what you don&apos;t want.</p>
            <input
              ref={rejectInputRef}
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmReject();
                if (e.key === 'Escape') setRejectDialogItem(null);
              }}
              placeholder="e.g., Too promotional, wrong tone, not relevant..."
              className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectDialogItem(null)}
                className="px-4 py-2 text-sm text-mission-control-text-dim hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-error-subtle text-error hover:bg-error-subtle rounded text-sm transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div 
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" 
          onClick={() => setScheduleModal(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setScheduleModal(null); } }}
          role="button"
          tabIndex={0}
          aria-label="Close schedule modal"
        >
          <div 
            className="bg-mission-control-surface border border-mission-control-border rounded-xl p-6 max-w-lg w-full mx-4" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${(typeConfig[scheduleModal.item.type as ApprovalType] ?? typeConfig['action']).color}`}>
                {scheduleModal.item.type === 'tweet' ?  <Send size={20} className="flex-shrink-0" /> :  <Mail size={20} className="flex-shrink-0" />}
              </div>
              <div>
                <h3 className="text-heading-3">Send or Schedule?</h3>
                <p className="text-sm text-mission-control-text-dim">{scheduleModal.item.title}</p>
              </div>
            </div>

            {/* Content Preview */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 mb-6 max-h-32 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono text-mission-control-text-dim">
                {scheduleModal.item.content}
              </pre>
            </div>

            {/* Date/Time Picker (shown when Schedule is clicked) */}
            {scheduleModal.showDatePicker && (
              <div className="mb-6 p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
                <div className="icon-text mb-3">
                  <CalendarClock size={16} className="text-mission-control-accent" />
                  <span className="text-sm font-medium">Schedule for:</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="schedule-date" className="text-xs text-mission-control-text-dim mb-1 block">Date</label>
                    <input
                      id="schedule-date"
                      type="date"
                      value={scheduleModal.date}
                      onChange={(e) => setScheduleModal({ ...scheduleModal, date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mission-control-accent"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label htmlFor="schedule-time" className="text-xs text-mission-control-text-dim mb-1 block">Time</label>
                    <input
                      id="schedule-time"
                      type="time"
                      value={scheduleModal.time}
                      onChange={(e) => setScheduleModal({ ...scheduleModal, time: e.target.value })}
                      className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mission-control-accent"
                    />
                  </div>
                </div>
                {/* Friendly time display */}
                {scheduleModal.date && scheduleModal.time && (
                  <p className="text-xs text-mission-control-text-dim mt-2">
                    Will be sent on {new Date(`${scheduleModal.date}T${scheduleModal.time}`).toLocaleString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!scheduleModal.showDatePicker ? (
                <>
                  {/* Initial state: Send Now / Schedule */}
                  <button
                    onClick={async () => {
                      const item = scheduleModal.item;
                      setScheduleModal(null);
                      
                      // For emails (Stage 2), send via email:send IPC
                      if (item.type === 'email') {
                        let metadata: any = {};
                        if (item.metadata) {
                          try {
                            metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                          } catch { /* ignore */ }
                        }
                        
                        const recipient = metadata.recipient || metadata.to;
                        const subject = metadata.subject || 'No Subject';
                        const account = metadata.account;
                        
                        if (!recipient) {
                          showToast('error', 'No recipient', 'Email needs a recipient address');
                          return;
                        }
                        
                        // Optimistic UI
                        setItems(prev => prev.filter(i => i.id !== item.id));
                        showToast('info', 'Sending email...', `To: ${recipient}`);
                        
                        try {
                          const result = await fetch('/api/inbox/send-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ to: recipient, subject, body: item.content, account }),
                          }).then(r => r.json());

                          if (result?.success) {
                            await inboxApi.update(Number(item.id), { status: 'approved' });
                            showToast('success', 'Email sent ✓', `To: ${recipient}`);
                          } else {
                            showToast('error', 'Email failed', result?.error);
                            loadInbox(); // Revert
                          }
                        } catch (e: unknown) {
                          showToast('error', 'Send error', e instanceof Error ? e.message : String(e));
                          loadInbox();
                        }
                        return;
                      }

                      // For tweets, use existing executeApproval
                      executeApproval(item);
                    }}
                    className="flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                     <Send size={16} className="flex-shrink-0" />
                    Send Now
                  </button>
                  <button
                    onClick={() => setScheduleModal({ ...scheduleModal, showDatePicker: true })}
                    className="flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium"
                  >
                     <Calendar size={16} className="flex-shrink-0" />
                    Schedule
                  </button>
                </>
              ) : (
                <>
                  {/* Schedule picker state: Back / Confirm */}
                  <button
                    onClick={() => setScheduleModal({ ...scheduleModal, showDatePicker: false })}
                    className="px-4 py-3 bg-mission-control-surface text-mission-control-text-dim rounded-lg hover:bg-mission-control-border transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      if (!scheduleModal.date || !scheduleModal.time) {
                        showToast('error', 'Please select date and time');
                        return;
                      }
                      
                      const scheduledFor = `${scheduleModal.date}T${scheduleModal.time}:00`;
                      const item = scheduleModal.item;
                      
                      // Parse metadata for email details
                      let metadata: any = {};
                      if (item.metadata) {
                        try {
                          metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                        } catch { /* ignore */ }
                      }
                      
                      // Add to schedule
                      try {
                        const result = await scheduleApi.create({
                          type: item.type,
                          content: item.content,
                          scheduledFor,
                          metadata: {
                            ...metadata,
                            title: item.title,
                            originalInboxId: item.id,
                          },
                        });

                        if (result) {
                          // Remove from inbox
                          setItems(prev => prev.filter(i => i.id !== item.id));
                          await inboxApi.update(Number(item.id), { status: 'scheduled' });
                          
                          const friendlyTime = new Date(scheduledFor).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          });
                          showToast('success', `Scheduled for ${friendlyTime}`, item.title);
                        } else {
                          showToast('error', 'Failed to schedule', (result as any).error || 'Unknown error');
                        }
                      } catch (e: unknown) {
                        showToast('error', 'Schedule error', e instanceof Error ? e.message : String(e));
                      }
                      
                      setScheduleModal(null);
                    }}
                    disabled={!scheduleModal.date || !scheduleModal.time}
                    className="flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <CalendarClock size={16} className="flex-shrink-0" />
                    Confirm Schedule
                  </button>
                </>
              )}
            </div>

            {/* Cancel link */}
            <button
              onClick={() => setScheduleModal(null)}
              className="w-full mt-3 py-2 text-sm text-mission-control-text-dim hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Overlay */}
      {showKeyboardHelp && (
        <div 
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" 
          onClick={() => setShowKeyboardHelp(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowKeyboardHelp(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close keyboard help"
        >
          <div 
            className="bg-mission-control-surface border border-mission-control-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-heading-2 mb-1">Keyboard Shortcuts</h2>
                <p className="text-sm text-mission-control-text-dim">Gmail-style navigation and actions</p>
              </div>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                title="Close"
                aria-label="Close keyboard shortcuts"
              >
                 <X size={20} className="flex-shrink-0" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Navigation */}
              <div>
                <h3 className="text-sm font-semibold text-mission-control-accent mb-3 uppercase tracking-wider">Navigation</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['j']} description="Next item" />
                  <ShortcutRow keys={['k']} description="Previous item" />
                  <ShortcutRow keys={['o', 'Enter']} description="Open/expand item" />
                  <ShortcutRow keys={['u']} description="Go back (collapse)" />
                  <ShortcutRow keys={['g', 'i']} description="Go to inbox" />
                  <ShortcutRow keys={['g', 's']} description="Go to completed" />
                  <ShortcutRow keys={['g', 'a']} description="Show all types" />
                  <ShortcutRow keys={['g', 't']} description="Show tweets only" />
                  <ShortcutRow keys={['g', 'e']} description="Show emails only" />
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-semibold text-mission-control-accent mb-3 uppercase tracking-wider">Actions</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['a']} description="Approve focused item" />
                  <ShortcutRow keys={['e']} description="Archive (approve)" />
                  <ShortcutRow keys={['r']} description="Reject focused item" />
                  <ShortcutRow keys={['Shift', 'A']} description="Approve all" />
                  <ShortcutRow keys={['x']} description="Select/deselect focused" />
                  <ShortcutRow keys={['*']} description="Select/deselect all" />
                  <ShortcutRow keys={['Shift', 'X']} description="Approve selected" />
                </div>
              </div>

              {/* Filtering */}
              <div>
                <h3 className="text-sm font-semibold text-mission-control-accent mb-3 uppercase tracking-wider">Filtering</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['/']} description="Cycle through filters" />
                  <ShortcutRow keys={['1']} description="Show all" />
                  <ShortcutRow keys={['2']} description="Show tweets" />
                  <ShortcutRow keys={['3']} description="Show emails" />
                  <ShortcutRow keys={['4']} description="Show messages" />
                  <ShortcutRow keys={['5']} description="Show tasks" />
                </div>
              </div>

              {/* Sorting */}
              <div>
                <h3 className="text-sm font-semibold text-mission-control-accent mb-3 uppercase tracking-wider">Sorting</h3>
                <div className="space-y-2">
                  <ShortcutRow keys={['p']} description="Sort by priority" />
                  <ShortcutRow keys={['t']} description="Sort by time" />
                  <ShortcutRow keys={['s']} description="Toggle sort order" />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-mission-control-border">
              <p className="text-xs text-mission-control-text-dim text-center">
                Press <kbd className="px-2 py-1 bg-mission-control-border rounded text-xs">?</kbd> to toggle this help • 
                Press <kbd className="px-2 py-1 bg-mission-control-border rounded text-xs">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Still Active Warning Modal */}
      {showAgentWarning && activeAgentSession && pendingApprovalItem && (
        <button
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 bg-transparent border-0 cursor-default"
          onClick={() => setShowAgentWarning(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setShowAgentWarning(false); }}
          aria-label="Close agent warning"
          type="button"
        >
          <div role="dialog" aria-modal="true" aria-label="Agent active warning" className="bg-mission-control-surface border border-mission-control-border rounded-xl p-6 max-w-lg w-full mx-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-warning-subtle rounded-lg">
                <AlertTriangle size={24} className="text-warning" />
              </div>
              <div>
                <h3 className="text-heading-3">Agent Still Active</h3>
                <p className="text-sm text-mission-control-text-dim">Cannot approve yet</p>
              </div>
            </div>

            {/* Warning Content */}
            <div className="bg-warning-subtle border border-warning-border rounded-lg p-4 mb-4">
              <p className="text-sm text-warning mb-2">
                ⚠️ An agent is currently working on this task
              </p>
              <div className="text-xs text-mission-control-text-dim space-y-1">
                <div>
                  <span className="font-medium">Session:</span> {activeAgentSession.displayName || activeAgentSession.label || 'Unknown'}
                </div>
                <div>
                  <span className="font-medium">Last active:</span> {formatTime(activeAgentSession.updatedAt.toString())}
                </div>
                <div>
                  <span className="font-medium">Task:</span> {pendingApprovalItem.title}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-mission-control-text-dim mb-3">
              If you approve now, the agent might reset the task status when it finishes, creating an approval loop.
            </p>
            
            <p className="text-sm text-white font-medium mb-4">
              You should abort the agent session before approving.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAgentWarning(false);
                  setActiveAgentSession(null);
                  setPendingApprovalItem(null);
                }}
                className="flex-1 min-w-0 px-4 py-3 bg-mission-control-surface text-mission-control-text-dim rounded-lg hover:bg-mission-control-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setAbortingAgent(true);
                  try {
                    // Kill the agent session
                    const result = await fetch(`/api/agents/${activeAgentSession.sessionId}/kill`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agentId: activeAgentSession.sessionId }),
                    }).then(r => r.json());
                    
                    if (result?.success) {
                      showToast('success', 'Agent aborted', 'Proceeding with approval...');
                      
                      // Wait a moment for session to fully terminate
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      // Now approve the task
                      const meta = typeof pendingApprovalItem.metadata === 'string' 
                        ? JSON.parse(pendingApprovalItem.metadata) 
                        : pendingApprovalItem.metadata;
                      
                      if (meta.taskId) {
                        await taskApi.update(meta.taskId, { status: 'done' });
                        setItems(prev => prev.filter(i => i.id !== pendingApprovalItem.id));
                        showToast('success', 'Task approved and completed ✓');
                      }
                      
                      setShowAgentWarning(false);
                      setActiveAgentSession(null);
                      setPendingApprovalItem(null);
                    } else {
                      showToast('error', 'Failed to abort agent', result?.stderr || 'Unknown error');
                    }
                  } catch (err: unknown) {
                    showToast('error', 'Abort failed', err instanceof Error ? err.message : String(err));
                  } finally {
                    setAbortingAgent(false);
                  }
                }}
                disabled={abortingAgent}
                className="flex-1 min-w-0 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
              >
                {abortingAgent ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Aborting...
                  </>
                ) : (
                  <>
                     <XCircle size={16} className="flex-shrink-0" />
                    Abort & Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </button>
      )}
      </div>

      {/* AI Assistance Panel (side panel) */}
      {showAIPanel && (
        <AIAssistancePanel
          selectedItem={selectedItemForAI as any}
          onClose={() => {
            setShowAIPanel(false);
            setSelectedItemForAI(null);
          }}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
    </div>
  );
}
