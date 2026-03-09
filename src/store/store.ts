// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gateway } from '../lib/gateway';
import { notifyNewApproval } from '../lib/notifications';
import { matchTaskToAgent } from '../lib/agents';
import { createLogger } from '../utils/logger';
import { showToast } from '../components/Toast';
import { taskApi, agentApi, approvalApi, inboxApi, chatApi } from '@/lib/api';

// Migrate old localStorage key on first load
if (typeof window !== 'undefined') {
  try {
    const old = localStorage.getItem('clawd-dashboard');
    if (old && !localStorage.getItem('mission-control-dashboard')) {
      localStorage.setItem('mission-control-dashboard', old);
    }
    // Clean up old key regardless
    localStorage.removeItem('clawd-dashboard');
  } catch {
    // QuotaExceededError or similar — clear stale data and continue
    localStorage.removeItem('clawd-dashboard');
    localStorage.removeItem('mission-control-dashboard');
  }
}

const storeLogger = createLogger('Store');

// Guard against concurrent updateTask calls for the same task ID
// Prevents rollback state corruption when two calls race for the same task
const pendingTaskUpdates = new Set<string>();

export type TaskStatus = 'todo' | 'internal-review' | 'in-progress' | 'review' | 'human-review' | 'done' | 'failed' | 'cancelled';
export type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3'; // p0 = urgent, p3 = low

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  taskId?: string;
  title: string;
  description?: string;
  completed: boolean;
  assignedTo?: string;
  completedAt?: number;
  completedBy?: string;
  position?: number;
  createdAt?: number;
}

export interface TaskActivity {
  id: number;
  taskId: string;
  agentId?: string;
  action: string;
  message: string;
  details?: string;
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  project: string;
  project_id?: string; // FK to projects.id
  labels?: string[]; // Label IDs
  assignedTo?: string;
  reviewerId?: string; // Review agent assigned to check work
  subtasks?: Subtask[];
  planningNotes?: string; // Planning/brainstorming notes
  tags?: string; // JSON string of tags array
  reviewStatus?: 'pending' | 'in-review' | 'approved' | 'needs-changes' | 'rejected';
  reviewNotes?: string;
  dueDate?: number; // Unix timestamp
  estimatedHours?: number;
  blockedBy?: string[]; // Task IDs this is blocked by
  blocks?: string[]; // Task IDs this blocks
  progress?: number; // 0-100 percentage
  lastAgentUpdate?: string; // Last status message from agent
  completedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  // Multi-stage project fields
  projectName?: string;
  stageNumber?: number;
  stageName?: string;
  nextStage?: string;
  parentTaskId?: string;
  recurrence?: TaskRecurrence | null;
  recurrenceParentId?: string | null;
}

export interface TaskRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // every N units
  endType: 'never' | 'after' | 'on';
  endAfter?: number; // occurrences remaining (counts down)
  endDate?: number; // unix timestamp
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  status: 'active' | 'busy' | 'idle' | 'offline' | 'suspended' | 'archived' | 'draft' | 'disabled';
  capabilities?: string[];
  sessionKey?: string;
  currentTaskId?: string;
  lastActivity?: number;
  trust_tier?: 'restricted' | 'apprentice' | 'worker' | 'trusted' | 'admin';
}

export interface Session {
  key: string;
  agentId?: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}

// Real session from mission-control DB
export interface GatewaySession {
  key: string;
  kind: 'direct' | 'group';
  updatedAt: number;
  ageMs: number;
  sessionId: string;
  model?: string;
  totalTokens?: number;
  contextTokens?: number;
  label?: string; // Sub-agent label when spawned with sessions_spawn
  channel?: string; // Delivery channel (discord, whatsapp, etc.)
  inputTokens?: number;
  outputTokens?: number;
  // Derived fields for UI
  type: 'main' | 'subagent' | 'cron' | 'discord' | 'telegram' | 'whatsapp' | 'web' | 'other';
  displayName: string;
  isActive: boolean; // Active within last 5 minutes
}

export interface Activity {
  id: string;
  type: 'task' | 'chat' | 'agent' | 'system' | 'error';
  message: string;
  timestamp: number;
  sessionKey?: string;
}

export interface XDraft {
  id: string;
  text: string;
  scheduledFor?: string;
  status: 'draft' | 'pending';
  createdAt: number;
}

export type ApprovalType = 'tweet' | 'reply' | 'email' | 'message' | 'task' | 'action';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'adjusted';

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  content: string;
  context?: string;
  metadata?: {
    to?: string;
    from?: string;
    subject?: string;
    account?: string;
    platform?: string;
    replyTo?: string;
    scheduledFor?: string;
    actionType?: string;
    actionPayload?: Record<string, unknown>;
  };
  status: ApprovalStatus;
  createdAt: number;
  updatedAt?: number;
  feedback?: string;
}

interface Store {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Loading states
  loading: {
    tasks: boolean;
    sessions: boolean;
    agents: boolean;
    approvals: boolean;
    activities: boolean;
    [key: string]: boolean;
  };
  setLoading: (key: string, value: boolean) => void;

  // Voice controls
  isMuted: boolean;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
  isMeetingActive: boolean;
  setMeetingActive: (v: boolean) => void;
  toggleMeeting: () => void;

  // Sessions from gateway
  sessions: Session[];
  setSessions: (s: Session[]) => void;
  fetchSessions: () => Promise<void>;

  // Real Gateway sessions (from CLI)
  gatewaySessions: GatewaySession[];
  loadGatewaySessions: () => Promise<void>;

  // Tasks (local)
  tasks: Task[];
  taskCounts: { totalDone: number; totalArchived: number };
  loadTasksFromDB: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => Promise<void>;
  assignTask: (id: string, agentId: string | undefined) => void;
  
  // Subtasks (DB-backed)
  loadSubtasksForTask: (taskId: string) => Promise<Subtask[]>;
  addSubtask: (taskId: string, title: string, description?: string, assignedTo?: string) => Promise<Subtask | null>;
  updateSubtask: (subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => Promise<boolean>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<boolean>;
  
  // Task Activity (DB-backed)
  loadTaskActivity: (taskId: string, limit?: number) => Promise<TaskActivity[]>;
  logTaskActivity: (taskId: string, action: string, message: string, agentId?: string, details?: string) => Promise<boolean>;

  // Agents (loaded from registry + dynamic)
  agents: Agent[];
  fetchAgents: () => Promise<void>;
  spawnAgentForTask: (taskId: string) => Promise<void>;
  createWorkerAgent: (name: string, task: string) => Promise<string>;
  updateAgentStatus: (agentId: string, status: Agent['status'], sessionKey?: string) => void;

  // Activity feed
  activities: Activity[];
  addActivity: (a: Omit<Activity, 'id'>) => void;
  clearActivities: () => void;

  // Approvals inbox
  approvals: ApprovalItem[];
  addApproval: (a: Omit<ApprovalItem, 'id' | 'status' | 'createdAt'>) => void;
  approveItem: (id: string) => void;
  rejectItem: (id: string) => void;
  adjustItem: (id: string, feedback: string) => void;
  loadApprovals: () => Promise<void>;

  // X drafts
  xDrafts: XDraft[];
  addXDraft: (text: string, scheduledFor?: string) => XDraft;
  updateXDraft: (id: string, updates: Partial<XDraft>) => void;
  deleteXDraft: (id: string) => void;
  markXDraftPosted: (id: string) => void;

}

// Execute approved items — delegates to gateway agent for all external actions
async function executeApproval(item: ApprovalItem): Promise<{ success: boolean; error?: string }> {
  try {
    switch (item.type) {
      case 'tweet':
      case 'reply': {
        await gateway.sendToSession('main', `[APPROVED] Post this ${item.type}: ${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        break;
      }
      case 'email': {
        await gateway.sendToSession('main', `[APPROVED] Send email to ${item.metadata?.to}: ${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        break;
      }
      case 'message': {
        await gateway.sendToSession('main', `[APPROVED] Send ${item.metadata?.platform} message to ${item.metadata?.to}: ${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        break;
      }
      case 'task': {
        // Notify agent to create task (tasks are managed by the agent/mission-control-db)
        await gateway.sendToSession('main', `[APPROVED] Create task: ${item.title}\n${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        break;
      }
      case 'action':
      default: {
        // Generic actions - notify agent to execute
        await gateway.sendToSession('main', `[APPROVED] Execute action: ${item.title}\n${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        break;
      }
    }
    return { success: true };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[Approval] Failed to execute:', e);
    // Notify agent about the failure so it can retry or handle
    await gateway.sendToSession('main', `[APPROVAL_EXEC_FAILED] ${item.type}: "${item.title}" - Error: ${errorMessage}\n\nContent: ${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
    return { success: false, error: errorMessage };
  }
}


// No fallback agents - agents are loaded exclusively from the gateway registry
// This prevents phantom/duplicate agents from appearing in the UI

type PersistedStore = Pick<Store, 'xDrafts'>;

export const useStore = create<Store>()(
  persist<Store, [], [], PersistedStore>(
    (set, get) => ({
      connected: false,
      setConnected: (connected: boolean) => set({ connected }),

      // Loading states
      loading: {
        tasks: false,
        sessions: false,
        agents: false,
        approvals: false,
        activities: false,
      },
      setLoading: (key: string, value: boolean) => set((s: Store) => ({
        loading: { ...s.loading, [key]: value }
      })),

      // Voice controls
      isMuted: false,
      setMuted: (isMuted: boolean) => set({ isMuted }),
      toggleMuted: () => set((s: Store) => ({ isMuted: !s.isMuted })),
      isMeetingActive: false,
      setMeetingActive: (isMeetingActive: boolean) => set({ isMeetingActive }),
      toggleMeeting: () => set((s: Store) => ({ isMeetingActive: !s.isMeetingActive })),

      sessions: [],
      setSessions: (sessions: Session[]) => set({ sessions }),
      fetchSessions: async () => {
        try {
          get().setLoading('sessions', true);
          const result = await chatApi.getSessions();
          if (result?.success && result?.sessions) {
            set({ sessions: result.sessions || [] });
          }
        } catch (e) {
          console.error('Failed to fetch sessions:', e);
        } finally {
          get().setLoading('sessions', false);
        }
      },

      // Real Gateway sessions (from CLI)
      gatewaySessions: [],
      loadGatewaySessions: async () => {
        try {
          const result = await chatApi.getSessions();
          if (result?.success && result?.sessions && Array.isArray(result.sessions)) {
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            
            const processed: GatewaySession[] = result.sessions.map((s: { key?: string; kind?: 'direct' | 'group'; updatedAt?: number; ageMs?: number; sessionId?: string; model?: string; totalTokens?: number; contextTokens?: number; inputTokens?: number; outputTokens?: number; channel?: string; label?: string | null }) => {
              // Determine session type from key
              const key = s.key || '';
              const label = s.label || undefined;
              let type: GatewaySession['type'] = 'other';
              let displayName = key;
              
              // Sub-agents: key contains 'subagent'
              // When label is available, use it for display name
              if (key.includes('subagent')) {
                type = 'subagent';
                if (label) {
                  displayName = label;
                } else {
                  // Extract UUID suffix for display
                  const parts = key.split(':');
                  const uuid = parts[parts.length - 1];
                  displayName = `Sub-agent ${uuid.slice(0, 8)}`;
                }
              } else if (key.includes(':cron:')) {
                type = 'cron';
                displayName = 'Cron Job';
              } else if (key.includes(':discord:')) {
                type = 'discord';
                displayName = 'Discord';
              } else if (key.includes(':telegram:')) {
                type = 'telegram';
                displayName = 'Telegram';
              } else if (key.includes(':whatsapp:')) {
                type = 'whatsapp';
                displayName = 'WhatsApp';
              } else if (key.includes(':web:') || key.startsWith('web:')) {
                type = 'web';
                displayName = 'Web';
              } else if (key === 'agent:main:main' || key === 'main') {
                type = 'main';
                displayName = 'Main Agent';
              }
              
              return {
                key: s.key || '',
                kind: (s.kind || 'direct') as 'direct' | 'group',
                updatedAt: s.updatedAt || 0,
                ageMs: s.ageMs || 0,
                sessionId: s.sessionId || '',
                model: s.model,
                totalTokens: s.totalTokens,
                contextTokens: s.contextTokens,
                inputTokens: s.inputTokens,
                outputTokens: s.outputTokens,
                channel: s.channel,
                label,
                type,
                displayName,
                isActive: (now - (s.updatedAt || 0)) < fiveMinutes,
              };
            });
            
            // Enrich agent statuses from session data
            // Map session agent keys to dashboard agent IDs
            const agentKeyMap: Record<string, string> = {
              'mission-control': 'main',
            };
            const resolveAgentId = (key: string): string | null => {
              const match = (key || '').match(/^agent:([^:]+)/);
              if (!match) return null;
              const raw = match[1];
              return agentKeyMap[raw] || raw;
            };

            // Group non-subagent sessions by agent_id to determine activity
            const agentActivity = new Map<string, { latestUpdate: number; totalTokens: number; sessionCount: number; activeCount: number; model?: string; channel?: string }>();
            for (const s of processed) {
              if (s.type === 'subagent') continue;
              const agentId = resolveAgentId(s.key);
              if (!agentId) continue;
              const existing = agentActivity.get(agentId) || { latestUpdate: 0, totalTokens: 0, sessionCount: 0, activeCount: 0 };
              if ((s.updatedAt || 0) > existing.latestUpdate) {
                if (s.model) existing.model = s.model;
                if (s.channel) existing.channel = s.channel;
              }
              existing.latestUpdate = Math.max(existing.latestUpdate, s.updatedAt || 0);
              existing.totalTokens += s.totalTokens || 0;
              existing.sessionCount++;
              if (s.isActive) existing.activeCount++;
              agentActivity.set(agentId, existing);
            }

            // Count active subagents per parent agent
            const subagentCounts = new Map<string, number>();
            for (const s of processed) {
              if (s.type !== 'subagent') continue;
              const agentId = resolveAgentId(s.key);
              if (!agentId) continue;
              subagentCounts.set(agentId, (subagentCounts.get(agentId) || 0) + (s.isActive ? 1 : 0));
            }

            // Skip phantom agents — use exclusion instead of inclusion
            const PHANTOM_AGENTS = ['main', 'chat-agent'];

            set((state: Store) => ({
              // Also store raw sessions (previously fetched separately by fetchSessions)
              sessions: result.sessions || [],
              gatewaySessions: processed,
              agents: state.agents.map((agent: Agent) => {
                // Skip phantom/legacy agents
                if (PHANTOM_AGENTS.includes(agent.id)) {
                  return agent;
                }

                const activity = agentActivity.get(agent.id);
                const activeSubagents = subagentCounts.get(agent.id) || 0;

                // If no activity AND no active subagents, keep default status
                if (!activity && !activeSubagents) return agent;

                const ageMs = activity?.latestUpdate ? now - activity.latestUpdate : Infinity;
                let status: Agent['status'];
                if ((activity?.activeCount || 0) > 0 || activeSubagents > 0) {
                  status = 'active';
                } else if (ageMs < 30 * 60 * 1000) { // 30 minutes
                  status = 'idle';
                } else {
                  status = 'offline';
                }

                return {
                  ...agent,
                  status,
                  lastActivity: activity?.latestUpdate || agent.lastActivity,
                };
              }),
            }));
          }
        } catch (error) {
          console.error('Failed to load gateway sessions:', error);
        }
      },

      tasks: [], // Empty - loaded from mission-control-db only
      taskCounts: { totalDone: 0, totalArchived: 0 },
      loadTasksFromDB: async () => {
        const g = globalThis as any;
        if (g.__taskLoadInFlight) return;
        g.__taskLoadInFlight = true;
        try {
          get().setLoading('tasks', true);
          const result = await taskApi.getAll();
          // API returns a plain array; support both plain array and legacy wrapped format
          const taskArray: any[] = Array.isArray(result) ? result : (result?.tasks ?? []);
          // Convert to store format — DB uses camelCase column names
          const tasksWithoutSubtasks = taskArray.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: t.status as TaskStatus,
            priority: t.priority as TaskPriority | undefined,
            project: t.project || 'General',
            project_id: t.project_id || undefined,
            assignedTo: t.assignedTo === 'main' ? 'mission-control' : (t.assignedTo || undefined),
            reviewerId: t.reviewerId || undefined,
            reviewStatus: t.reviewStatus || undefined,
            planningNotes: t.planningNotes || undefined,
            dueDate: t.dueDate ? Number(t.dueDate) : undefined,
            lastAgentUpdate: t.lastAgentUpdate || undefined,
            createdAt: t.createdAt || Date.now(),
            updatedAt: t.updatedAt || Date.now(),
            subtasks: [] as Subtask[],
            recurrence: t.recurrence ?? null,
            recurrenceParentId: t.recurrenceParentId ?? null,
          }));

          // Load subtasks in parallel with batching (10 at a time)
          const BATCH_SIZE = 10;
          const tasksWithSubtasks: Task[] = [];

          for (let i = 0; i < tasksWithoutSubtasks.length; i += BATCH_SIZE) {
            const batch = tasksWithoutSubtasks.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map(async (task) => {
                try {
                  const subtaskResult = await taskApi.getSubtasks(task.id);
                  // API returns plain array
                  const subtasks = Array.isArray(subtaskResult) ? subtaskResult : (subtaskResult?.subtasks ?? []);
                  return { ...task, subtasks: subtasks as Subtask[] };
                } catch { /* ignore error */ }
                return task;
              })
            );
            tasksWithSubtasks.push(...batchResults as Task[]);
          }

          set({
            tasks: tasksWithSubtasks,
            taskCounts: {
              totalDone: taskArray.filter((t: any) => t.status === 'done').length,
              totalArchived: taskArray.filter((t: any) => t.status === 'cancelled').length,
            }
          });
        } catch (error) {
          console.error('Failed to load tasks from DB:', error);
        } finally {
          get().setLoading('tasks', false);
          setTimeout(() => { (globalThis as any).__taskLoadInFlight = false; }, 3000);
        }
      },
      addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newTask: Task = {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s: Store) => ({
          tasks: [...s.tasks, newTask]
        }));
        // Sync to mission-control-db
        taskApi.create(newTask).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
      },
      updateTask: (id: string, updates: Partial<Task>) => {
        // Drop concurrent update for the same task — prevents rollback state corruption
        if (pendingTaskUpdates.has(id)) {
          console.warn('[Store] Dropping concurrent update for task:', id);
          return;
        }
        pendingTaskUpdates.add(id);

        // Snapshot original values for rollback
        const original = get().tasks.find((t: Task) => t.id === id);
        const rollbackValues = original
          ? Object.keys(updates).reduce((acc, key) => ({ ...acc, [key]: (original as any)[key] }), {} as Partial<Task>)
          : null;
        // Optimistically update UI
        set((s: Store) => ({
          tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)
        }));

        // Persist to database via API
        taskApi.update(id, updates)
          .then((result: { success?: boolean; error?: string; id?: string }) => {
            // API returns updated task object (has .id) or { success, error }
            const failed = result?.error || (result && !result.id && result.success === false);
            if (failed) {
              console.error('[Store] Task update failed:', result?.error);
              if (rollbackValues) {
                set((s: Store) => ({
                  tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, ...rollbackValues } : t)
                }));
              }
            }
          })
          .catch((err: Error) => {
            console.error('[Store] Task update exception:', err);
            showToast('error', 'Task update failed', err.message);
            if (rollbackValues) {
              set((s: Store) => ({
                tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, ...rollbackValues } : t)
              }));
            }
          })
          .finally(() => {
            pendingTaskUpdates.delete(id);
          });
      },
      moveTask: (id: string, status: TaskStatus) => {
        const task = get().tasks.find((t: Task) => t.id === id);
        if (!task) return;

        // Status transition validation
        const VALID_TRANSITIONS: Record<string, string[]> = {
          'todo':             ['internal-review', 'human-review'],
          'internal-review':  ['todo', 'in-progress'],
          'in-progress':      ['review', 'todo', 'human-review'],
          'review':           ['done', 'in-progress', 'human-review'],
          'human-review':     ['in-progress', 'todo', 'internal-review'],
          'done':             ['in-progress'],
        };
        const allowed = VALID_TRANSITIONS[task.status];
        if (allowed && !allowed.includes(status)) {
          showToast('error', 'Invalid status change', `Cannot move from "${task.status}" to "${status}"`);
          return;
        }

        // B+C ENFORCEMENT: Both requirements must be met before marking done
        if (status === 'done') {
          const errors: string[] = [];
          
          // REQUIREMENT B: All subtasks must be complete
          const subtasks = task.subtasks || [];
          const hasSubtasks = subtasks.length > 0;
          const incompleteCount = subtasks.filter((st: Subtask) => !st.completed).length;
          
          if (hasSubtasks && incompleteCount > 0) {
            errors.push(`${incompleteCount}/${subtasks.length} subtasks incomplete`);
          }
          
          // REQUIREMENT C: Reviewer approval required
          // Task must have gone through 'review' status first
          if (task.status !== 'review') {
            errors.push('Task must be reviewed before marking done (move to review first)');
          }
          
          // Reviewer must be assigned
          if (!task.reviewerId) {
            errors.push('No reviewer assigned');
          }
          
          // Review status must be 'approved'
          if (task.reviewStatus !== 'approved') {
            errors.push('Review not approved (reviewer must approve first)');
          }
          
          // If any validation fails, block the move
          if (errors.length > 0) {
            get().addActivity({
              type: 'system',
              message: `⚠️ Cannot mark "${task.title}" as done:\n${errors.map(e => `• ${e}`).join('\n')}`,
              timestamp: Date.now(),
            });
            return; // Block the move
          }
        }
        
        const previousStatus = task.status;
        set((s: Store) => ({
          tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, status, updatedAt: Date.now() } : t)
        }));
        // Broadcast status change to main session
        gateway.sendToSession('main', `[TASK_UPDATE] "${task.title}" moved to ${status}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        // Sync to mission-control-db
        taskApi.update(task.id, { status }).catch((err: Error) => {
          console.error("[Store] Task move failed:", err);
          showToast('error', 'Task move failed', err.message);
          // Rollback optimistic update
          set((s: Store) => ({
            tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, status: previousStatus } : t)
          }));
        });
        
        // Log activity to task_activity table
        get().logTaskActivity(id, 'status_changed', `Status changed from ${previousStatus} to ${status}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        
        // Also add to activity feed
        get().addActivity({
          type: 'task',
          message: `📋 "${task.title}" moved to ${status}`,
          timestamp: Date.now(),
        });
      },
      deleteTask: async (id: string) => {
        // Snapshot task for rollback
        const taskToDelete = get().tasks.find((t: Task) => t.id === id);
        // Optimistic remove from UI
        set((s: Store) => ({ tasks: s.tasks.filter((t: Task) => t.id !== id) }));
        try {
          await taskApi.delete(id);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error('Failed to delete task from DB:', e);
          showToast('error', 'Task delete failed', errMsg);
          // Rollback: restore the removed task
          if (taskToDelete) {
            set((s: Store) => ({ tasks: [...s.tasks, taskToDelete] }));
          }
        }
      },
      assignTask: (id: string, agentId?: string) => {
        const task = get().tasks.find((t: Task) => t.id === id);
        const agent = agentId ? get().agents.find((a: Agent) => a.id === agentId) : null;
        set((s: Store) => ({
          tasks: s.tasks.map((t: Task) => t.id === id ? { ...t, assignedTo: agentId, updatedAt: Date.now() } : t)
        }));
        // Broadcast assignment to main session
        if (task) {
          const msg = agent 
            ? `[TASK_ASSIGNED] "${task.title}" assigned to ${agent.avatar} ${agent.name}`
            : `[TASK_UNASSIGNED] "${task.title}" unassigned`;
          gateway.sendToSession('main', msg).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
          // Sync to mission-control-db
          taskApi.update(task.id, { assignedTo: agentId || '' }).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
          
          // Log activity to task_activity table
          const action = agent ? 'assigned' : 'unassigned';
          const message = agent 
            ? `Task assigned to ${agent.name}`
            : 'Task unassigned';
          get().logTaskActivity(id, action, message, agentId).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
          
          // Also add to activity feed
          get().addActivity({
            type: 'task',
            message: agent 
              ? `🤖 "${task.title}" assigned to ${agent.avatar} ${agent.name}`
              : `📋 "${task.title}" unassigned`,
            timestamp: Date.now(),
          });
        }
      },

      // Subtask operations (DB-backed)
      loadSubtasksForTask: async (taskId: string) => {
        try {
          const result = await taskApi.getSubtasks(taskId);
          // API returns plain array
          const subtasks = Array.isArray(result) ? result : (result?.subtasks ?? []);
          set((s: Store) => ({
            tasks: s.tasks.map((t: Task) => t.id === taskId ? { ...t, subtasks } : t)
          }));
          return subtasks;
        } catch (error) {
          console.error('Failed to load subtasks:', error);
        }
        return [];
      },

      addSubtask: async (taskId: string, title: string, description?: string, assignedTo?: string) => {
        const subtaskId = `st-${Date.now()}`;
        const newSubtask: Subtask = {
          id: subtaskId,
          taskId,
          title,
          description,
          completed: false,
          assignedTo,
          createdAt: Date.now(),
        };

        try {
          const result = await taskApi.addSubtask(taskId, {
            id: subtaskId,
            title,
            description,
            assignedTo,
          });

          if (result?.success) {
            // Optimistically update local state
            set((s: Store) => ({
              tasks: s.tasks.map((t: Task) => t.id === taskId
                ? { ...t, subtasks: [...(t.subtasks || []), newSubtask], updatedAt: Date.now() }
                : t
              )
            }));
            return newSubtask;
          } else {
            console.error('[Store] Subtask add failed:', result?.error || 'Unknown error');
          }
        } catch (error) {
          console.error('[Store] Failed to add subtask (exception):', error);
        }
        return null;
      },

      updateSubtask: async (subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => {
        try {
          // Find the parent taskId from state
          const parentTask = get().tasks.find((t: Task) => (t.subtasks || []).some((st: Subtask) => st.id === subtaskId));
          const parentTaskId = parentTask?.id || subtaskId; // fallback to subtaskId if not found
          const result = await taskApi.updateSubtask(parentTaskId, subtaskId, updates);
          if (result && !result.error) {
            // Update local state
            set((s: Store) => ({
              tasks: s.tasks.map((t: Task) => ({
                ...t,
                subtasks: (t.subtasks || []).map(st => 
                  st.id === subtaskId 
                    ? { 
                        ...st, 
                        ...updates,
                        completedAt: updates.completed ? Date.now() : undefined,
                      }
                    : st
                ),
                updatedAt: Date.now(),
              }))
            }));
            return true;
          }
        } catch (error) {
          console.error('Failed to update subtask:', error);
        }
        return false;
      },

      deleteSubtask: async (taskId: string, subtaskId: string) => {
        try {
          const result = await taskApi.deleteSubtask(taskId, subtaskId);
          if (result?.success) {
            set((s: Store) => ({
              tasks: s.tasks.map((t: Task) => t.id === taskId
                ? { ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId), updatedAt: Date.now() }
                : t
              )
            }));
            return true;
          }
        } catch (error) {
          console.error('Failed to delete subtask:', error);
        }
        return false;
      },

      // Task Activity operations (DB-backed)
      loadTaskActivity: async (taskId: string, limit?: number) => {
        try {
          const result = await taskApi.getActivity(taskId);
          // API returns array directly
          if (Array.isArray(result)) return result;
          // Legacy shape
          if (result?.success) return result.activities || [];
        } catch (error) {
          console.error('Failed to load task activity:', error);
        }
        return [];
      },

      logTaskActivity: async (taskId: string, action: string, message: string, agentId?: string, details?: string) => {
        try {
          const result = await taskApi.addActivity(taskId, {
            action,
            message,
            agentId,
            details,
          });
          return result?.success || false;
        } catch (error) {
          console.error('Failed to log task activity:', error);
          return false;
        }
      },

      agents: [], // Start empty - loaded from gateway only

      fetchAgents: async () => {
        try {
          get().setLoading('agents', true);
          const result = await agentApi.getAll();
          // REST API returns a plain array; gateway returns { success, agents }
          const agentList: any[] = Array.isArray(result) ? result : (Array.isArray(result?.agents) ? result.agents : []);
          if (agentList.length > 0) {
            const agents: Agent[] = agentList.map((a: any) => ({
              id: a.id,
              name: a.name || a.identityName || a.id,
              avatar: a.emoji || a.identityEmoji || '🤖',
              description: a.role || a.description || '',
              status: (a.status as Agent['status']) || 'idle',
              capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
              trust_tier: a.trust_tier,
            }));

            // Preserve runtime state (status/sessionKey/currentTaskId/lastActivity) from current agents
            const current = get().agents;
            const fresh = agents.map((agent: Agent) => {
              const existing = current.find((a: Agent) => a.id === agent.id);
              return existing
                ? { ...agent, status: existing.status, sessionKey: existing.sessionKey, currentTaskId: existing.currentTaskId, lastActivity: existing.lastActivity }
                : agent;
            });

            set({ agents: fresh });
          } else if (!Array.isArray(result) && result?.error) {
            console.error('[Store] Agent fetch error:', result.error);
          }
        } catch (e) {
          console.error('[Store] Failed to fetch agents:', e);
        } finally {
          get().setLoading('agents', false);
        }
      },

      // Spawn an agent to work on a task
      spawnAgentForTask: async (taskId: string) => {
        const state = get();
        const task = state.tasks.find((t: Task) => t.id === taskId);
        if (!task) return;

        // Determine which agent to use
        const agentId = task.assignedTo || matchTaskToAgent(task.title, task.description || '');
        const agent = state.agents.find((a: Agent) => a.id === agentId);
        
        if (!agent) return;

        try {
          // Update mission-control-db FIRST to prevent race with polling
          await taskApi.update(taskId, {
            status: 'in-progress',
            assignedTo: agentId
          });

          // Update task and agent status locally
          set((s: Store) => ({
            agents: s.agents.map((a: Agent) => 
              a.id === agentId ? { ...a, status: 'busy' as const, currentTaskId: taskId } : a
            ),
            tasks: s.tasks.map((t: Task) => 
              t.id === taskId ? { ...t, status: 'in-progress' as TaskStatus, assignedTo: agentId, updatedAt: Date.now() } : t
            ),
          }));

          // IMMEDIATELY dispatch task to agent via task dispatch endpoint
          try {
            await fetch('/api/tasks/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId }),
            });
          } catch (_spawnErr) {
            // Dispatch failure is non-blocking — task status is already updated
          }

          get().addActivity({
            type: 'agent',
            message: `${agent.avatar} ${agent.name} started: ${task.title}`,
            timestamp: Date.now(),
          });
          
          // Log to task_activity table for persistence
          get().logTaskActivity(taskId, 'agent_started', `${agent.name} agent started working on task`, agentId).catch((err: Error) => { console.error("[Store] Operation failed:", err); });

        } catch (e) {
          console.error('Failed to start task:', e);
          set((s: Store) => ({
            agents: s.agents.map((a: Agent) => 
              a.id === agentId ? { ...a, status: 'idle' as const, currentTaskId: undefined } : a
            ),
            tasks: s.tasks.map((t: Task) => 
              t.id === taskId ? { ...t, status: 'todo' as TaskStatus, updatedAt: Date.now() } : t
            ),
          }));
        }
      },

      // Create a new worker agent dynamically
      createWorkerAgent: async (name: string, task: string) => {
        const workerId = `worker-${Date.now().toString(36)}`;
        
        try {
          // Add to agents list first
          set((s: Store) => ({
            agents: [...s.agents, {
              id: workerId,
              name,
              avatar: '⚙️',
              description: task.slice(0, 50) + '...',
              status: 'busy' as const,
              capabilities: ['task'],
              lastActivity: Date.now(),
            }],
          }));

          // Send task to Mission Control to execute
          const workerPrompt = `## New Worker Task: ${name}

**Worker ID:** ${workerId}
**Task:** ${task}

Execute this task. When done, report back with:
- What was accomplished
- Any outputs or results
- Suggested follow-up actions (if any)

Start now.`;

          await gateway.sendChat(workerPrompt);

          get().addActivity({
            type: 'agent',
            message: `⚙️ Created worker: ${name}`,
            timestamp: Date.now(),
          });

          return workerId;
        } catch (e) {
          console.error('Failed to create worker:', e);
          // Remove the worker on failure
          set((s: Store) => ({
            agents: s.agents.filter((a: Agent) => a.id !== workerId),
          }));
          throw e;
        }
      },

      // Update agent status
      updateAgentStatus: (agentId: string, status: Agent['status'], sessionKey?: string) => {
        set((s: Store) => ({
          agents: s.agents.map((a: Agent) => 
            a.id === agentId ? { 
              ...a, 
              status, 
              sessionKey: sessionKey || a.sessionKey,
              lastActivity: Date.now(),
              currentTaskId: status === 'idle' ? undefined : a.currentTaskId,
            } : a
          ),
        }));
      },

      activities: [],
      addActivity: (a: Omit<Activity, 'id'>) => set((s: Store) => ({
        activities: [{ ...a, id: `act-${Date.now()}` }, ...s.activities].slice(0, 100)
      })),
      clearActivities: () => set({ activities: [] }),

      approvals: [],
      addApproval: (a: Omit<ApprovalItem, 'id' | 'status' | 'createdAt'>) => {
        // Notify user
        notifyNewApproval(a.title);
        
        return set((s: Store) => ({
          approvals: [{
            ...a,
            id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'pending' as ApprovalStatus,
            createdAt: Date.now(),
          }, ...s.approvals]
        }));
      },
      approveItem: (id: string) => {
        const state = get();
        const item = state.approvals.find((a: ApprovalItem) => a.id === id);
        if (item) {
          // Remove from inbox immediately (optimistic)
          set((s: Store) => ({
            approvals: s.approvals.filter((a: ApprovalItem) => a.id !== id),
          }));
          
          // Also mark as approved in the API (replaces file-based queue removal)
          approvalApi.respond(id, 'approved').catch((err: Error) => { console.error("[Store] Operation failed:", err); });
          
          // Execute the action asynchronously
          executeApproval(item).then(async (result) => {
            if (!result.success) {
              showToast('error', 'Approval execution failed', result.error || `Failed to execute ${item.type}`);
            }
            const taskData = {
              id: `task-exec-${Date.now()}`,
              title: `${result.success ? 'Done' : 'Failed'}: ${item.type}: ${item.title}`,
              description: result.success
                ? `Executed ${item.type}: ${item.content?.slice(0, 200)}`
                : `Failed to execute ${item.type}: ${result.error}\n\nContent: ${item.content?.slice(0, 200)}`,
              status: result.success ? 'done' : 'failed',
              project: 'Approvals',
              assignedTo: matchTaskToAgent(item.title, item.content || ''),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            // Sync to DB instead of local-only state
            await taskApi.create(taskData);
            await useStore.getState().loadTasksFromDB();

            // Notify main session
            if (result.success) {
              gateway.sendToSession('main', `[EXECUTED] ${item.type}: "${item.title}" completed successfully`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
            }
          }).catch((err: Error) => {
            console.error('[Store] Approval execution error:', err);
            showToast('error', 'Approval failed', err.message);
          });
        }
      },
      rejectItem: (id: string) => {
        const state = get();
        const item = state.approvals.find((a: ApprovalItem) => a.id === id);
        if (item) {
          // Log rejection via API (replaces IPC rejections.log — no REST equivalent, mark as rejected)
          // TODO Phase 4: migrate rejection logging if a dedicated endpoint is added
          approvalApi.respond(id, 'rejected').catch((err: Error) => {
            console.error("[Store] Rejection log failed:", err);
          });
          // Notify main session
          gateway.sendToSession('main', `[REJECTED] ${item.type}: "${item.title}" - logged to rejected_decisions`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        }
        set((s: Store) => ({
          approvals: s.approvals.filter((a: ApprovalItem) => a.id !== id), // Delete from inbox
        }));
      },
      adjustItem: (id: string, feedback: string) => {
        const state = get();
        const item = state.approvals.find((a: ApprovalItem) => a.id === id);
        if (item) {
          const revisionTask = {
            id: `task-revise-${Date.now()}`,
            title: `Revise: ${item.title}`,
            description: `Original ${item.type}:\n${item.content}\n\n---\nFeedback:\n${feedback}`,
            status: 'todo',
            project: 'Revisions',
            assignedTo: matchTaskToAgent(item.title, `${item.type} ${item.content || ''}`),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          // Mark as rejected/adjusted in API
          approvalApi.respond(id, 'rejected', `Revision requested: ${feedback}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
          // Remove from local approvals list
          set((s: Store) => ({
            approvals: s.approvals.filter((a: ApprovalItem) => a.id !== id),
          }));
          // Sync task to DB (not local-only)
          taskApi.create(revisionTask).then(() => {
            useStore.getState().loadTasksFromDB().catch((e: Error) => console.error('[Store] loadTasks error:', e));
          }).catch((err: Error) => {
            console.error("[Store] Revision task sync failed:", err);
            showToast('error', 'Revision task failed', err.message);
          });
          // Notify for revision
          gateway.sendToSession('main', `[REVISION_NEEDED] ${item.type}: "${item.title}"\n\nFeedback: ${feedback}\n\nOriginal:\n${item.content}`).catch((err: Error) => { console.error("[Store] Operation failed:", err); });
        }
      },
      loadApprovals: async () => {
        try {
          get().setLoading('approvals', true);
          {
            const result = await inboxApi.getAll();
            if (result?.success && Array.isArray(result.items)) {
              // Filter to only show human-review items (not agent review)
              const humanReviewItems = result.items.filter((item: any) => 
                item.status === 'human-review' || item.type === 'approval'
              );
              const approvalItems: ApprovalItem[] = humanReviewItems.map((item: InboxItem) => ({
                id: String(item.id),
                type: item.type as ApprovalType,
                title: item.title,
                content: item.content,
                status: (item.status || 'pending') as 'pending' | 'approved' | 'rejected',
                createdAt: new Date(item.createdAt || item.created || Date.now()).getTime(),
                context: item.context,
              }));
              set({ approvals: approvalItems });
            }
          }
        } catch (e) {
          console.error('[Store] Failed to load approvals:', e);
        } finally {
          get().setLoading('approvals', false);
        }
      },

      // X drafts - persisted to localStorage via Zustand persist
      xDrafts: [],
      addXDraft: (text: string, scheduledFor?: string) => {
        const newDraft: XDraft = {
          id: `draft-${Date.now()}`,
          text,
          scheduledFor,
          status: 'draft',
          createdAt: Date.now(),
        };
        set((s: Store) => ({
          xDrafts: [newDraft, ...s.xDrafts]
        }));
        return newDraft;
      },
      updateXDraft: (id: string, updates: Partial<XDraft>) => set((s: Store) => ({
        xDrafts: s.xDrafts.map(d => d.id === id ? { ...d, ...updates } : d)
      })),
      deleteXDraft: (id: string) => set((s: Store) => ({
        xDrafts: s.xDrafts.filter(d => d.id !== id)
      })),
      markXDraftPosted: (id: string) => set((s: Store) => ({
        // Remove posted drafts entirely instead of keeping them
        xDrafts: s.xDrafts.filter(d => d.id !== id)
      })),

    }),
    {
      name: 'mission-control-dashboard',
      partialize: (s) => ({
        // activities excluded — loaded from API on mount, too large for localStorage
        // Persist X drafts only (non-posted; posted are removed by markXDraftPosted)
        xDrafts: s.xDrafts.slice(0, 20),
      }),
      // Custom merge to ensure arrays are never undefined after hydration
      merge: (persistedState: unknown, currentState: Store): Store => ({
        ...currentState,
        xDrafts: (persistedState as { xDrafts?: XDraft[] })?.xDrafts ?? currentState.xDrafts ?? [],
      }),
    }
  )
);

// ---- Module-Level Gateway Listeners ----------------------------------------
// These listeners are intentionally module-scoped (never cleaned up).
// The Zustand store is a process-lifetime singleton -- these run once on
// import and persist for the entire app session. This is correct behavior.
// Do NOT wrap these in useEffect or add cleanup -- they are not per-component.
//
// Component-level listeners (e.g. WorkerModal, SkillModal, VoiceChatPanel)
// each manage their own cleanup via unsubscribe() or useEffect return.
// ---- End Listener Lifecycle Note -------------------------------------------

gateway.on('stateChange', ({ state, oldState }: { state: string; oldState: string }) => {
  const connected = state === 'connected';
  useStore.getState().setConnected(connected);
  
  if (state === 'connected' && oldState !== 'connected') {
    useStore.getState().fetchSessions();
    useStore.getState().addActivity({ type: 'system', message: 'Connected to gateway', timestamp: Date.now() });
  } else if (state === 'disconnected' && oldState === 'connected') {
    useStore.getState().addActivity({ type: 'system', message: 'Disconnected from gateway', timestamp: Date.now() });
  }
});

// Sync initial state
if (gateway.connected) {
  useStore.getState().setConnected(true);
}

// TODO Phase 4: migrate — IPC task notifications not available in web; handled via gateway events
// task notification IPC removed (no REST equivalent)

gateway.on('chat', (payload: { final?: boolean; content?: string; sessionKey?: string }) => {
  if (payload?.final && payload?.content) {
    useStore.getState().addActivity({
      type: 'chat',
      message: payload.content.slice(0, 100) + (payload.content.length > 100 ? '...' : ''),
      timestamp: Date.now(),
      sessionKey: payload.sessionKey,
    });
  }
});

// Listen for approval requests from Mission Control
gateway.on('approval.request', (payload: { type: ApprovalType; title: string; content: string; context?: string; metadata?: ApprovalItem['metadata'] }) => {
  if (payload?.type && payload?.title && payload?.content) {
    useStore.getState().addApproval({
      type: payload.type,
      title: payload.title,
      content: payload.content,
      context: payload.context,
      metadata: payload.metadata,
    });
    useStore.getState().addActivity({
      type: 'system',
      message: `📥 New approval: ${payload.title}`,
      timestamp: Date.now(),
    });
  }
});

// Shared debounced task refresh -- used by both gateway.on and IPC broadcast
const TASK_REFRESH_DEBOUNCE = 400;
function debouncedTaskRefresh() {
  clearTimeout((window as any).__taskRefreshTimer);
  (window as any).__taskRefreshTimer = setTimeout(() => {
    useStore.getState().loadTasksFromDB().catch((e: Error) => console.error('[Store] loadTasks error:', e));
  }, TASK_REFRESH_DEBOUNCE);
}

// Listen for task-related events for real-time updates
// These can be triggered by the main agent after creating tasks from Discord
gateway.on('task.created', (payload: { title?: string }) => {
  storeLogger.debug('[Store] Task created event received:', payload);
  debouncedTaskRefresh();
  useStore.getState().addActivity({
    type: 'task',
    message: `New task: ${payload?.title || 'Task created'}`,
    timestamp: Date.now(),
  });
});

gateway.on('task.updated', (payload: { id?: string }) => {
  storeLogger.debug('[Store] Task updated event received:', payload);
  debouncedTaskRefresh();
});

gateway.on('tasks.refresh', () => {
  debouncedTaskRefresh();
});

// NOTE: Previous gateway.on('*') catch-all removed in Phase 08-03.
// All task/chat events now handled by explicit listeners above:
// - task.created: handles [TASK_CREATED] pattern
// - task.updated: handles [TASK_START] pattern and status changes
// - chat.message: handles {"detected":true} task detection from AI
// If events are missed, add specific gateway.on('event.name') listener.

// TODO Phase 4: migrate — IPC gateway broadcasts not available in web; handled via gateway WebSocket events
// gateway broadcast IPC removed (no REST equivalent)

// Also check for approval patterns in chat messages
gateway.on('chat.message', (payload: { content?: string; context?: string; metadata?: ApprovalItem['metadata'] }) => {
  const content = payload?.content || '';

  // Detect task creation patterns from AI analysis
  if (typeof content === 'string' && content.includes('{"detected":true')) {
    debouncedTaskRefresh();
  }

  // Detect approval request patterns
  if (content.includes('[NEEDS_APPROVAL]') || content.includes('[DRAFT]')) {
    // Parse the approval from the message
    const typeMatch = content.match(/\[TYPE:(\w+)\]/);
    const titleMatch = content.match(/\[TITLE:([^\]]+)\]/);

    if (typeMatch && titleMatch) {
      const type = typeMatch[1].toLowerCase() as ApprovalType;
      const title = titleMatch[1];
      const contentStart = content.indexOf('[CONTENT]');
      const contentEnd = content.indexOf('[/CONTENT]');
      const approvalContent = contentStart > -1 && contentEnd > -1 
        ? content.slice(contentStart + 9, contentEnd).trim()
        : content;
      
      useStore.getState().addApproval({
        type: ['tweet', 'reply', 'email', 'message', 'task', 'action'].includes(type) ? type : 'action',
        title,
        content: approvalContent,
        context: payload.context,
        metadata: payload.metadata,
      });
    }
  }
});
