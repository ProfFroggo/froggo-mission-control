import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gateway } from '../lib/gateway';
import { notifyNewApproval } from '../lib/notifications';
import { spawnAgent, spawnWorker, matchTaskToAgent, AGENTS } from '../lib/agents';

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'failed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignedTo?: string;
  completedAt?: number;
  completedBy?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  project: string;
  assignedTo?: string;
  reviewerId?: string; // Review agent assigned to check work
  subtasks?: Subtask[];
  reviewStatus?: 'pending' | 'in-review' | 'approved' | 'needs-changes';
  reviewNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  status: 'active' | 'busy' | 'idle' | 'offline';
  capabilities?: string[];
  sessionKey?: string;
  currentTaskId?: string;
  lastActivity?: number;
}

export interface Session {
  key: string;
  agentId?: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}

export interface Activity {
  id: string;
  type: 'task' | 'chat' | 'agent' | 'system';
  message: string;
  timestamp: number;
  sessionKey?: string;
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
    platform?: string;
    replyTo?: string;
    scheduledFor?: string;
    actionType?: string;
    actionPayload?: any;
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

  // Tasks (local)
  tasks: Task[];
  loadTasksFromDB: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
  assignTask: (id: string, agentId: string | undefined) => void;

  // Agents (predefined + dynamic)
  agents: Agent[];
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
  clearCompletedApprovals: () => void;

  // Orchestration - Froggo management
  autoAssignTask: (taskId: string) => void;
  processAgentOutput: (agentId: string, output: string, taskId: string) => void;
  getUnassignedTasks: () => Task[];
  getTasksNeedingReview: () => Task[];
}

// Execute approved items
async function executeApproval(item: ApprovalItem) {
  console.log('Executing approval:', item.type, item.title);
  
  try {
    switch (item.type) {
      case 'tweet':
      case 'reply':
        // Send to gateway to post via bird CLI
        await gateway.sendChat(`[APPROVED] Post this ${item.type}: ${item.content}`);
        break;
      case 'email':
        // Send email via gateway
        await gateway.sendChat(`[APPROVED] Send email to ${item.metadata?.to}: ${item.content}`);
        break;
      case 'message':
        // Send message via gateway
        await gateway.sendChat(`[APPROVED] Send ${item.metadata?.platform} message to ${item.metadata?.to}: ${item.content}`);
        break;
      case 'action':
        // Execute action via gateway
        await gateway.sendChat(`[APPROVED] Execute action: ${item.title}\n${item.content}`);
        break;
      case 'task':
        // Create/update task
        await gateway.sendChat(`[APPROVED] Task: ${item.title}\n${item.content}`);
        break;
    }
  } catch (e) {
    console.error('Failed to execute approval:', e);
  }
}

const defaultAgents: Agent[] = [
  { id: 'main', name: 'Froggo', avatar: '🐸', description: 'Main assistant - orchestrates everything', status: 'active', capabilities: ['chat', 'code', 'web', 'email', 'orchestrate'] },
  { id: 'coder', name: 'Coder', avatar: '💻', description: 'Software engineering tasks', status: 'idle', capabilities: ['code', 'git', 'debug', 'test'] },
  { id: 'researcher', name: 'Researcher', avatar: '🔍', description: 'Research & analysis', status: 'idle', capabilities: ['web', 'analyze', 'summarize'] },
  { id: 'writer', name: 'Writer', avatar: '✍️', description: 'Content creation', status: 'idle', capabilities: ['write', 'edit', 'social'] },
  { id: 'chief', name: 'Chief', avatar: '👨‍💻', description: 'Lead Engineer (GSD methodology)', status: 'idle', capabilities: ['code', 'architecture', 'planning'] },
];

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      connected: false,
      setConnected: (connected) => set({ connected }),

      // Voice controls
      isMuted: false,
      setMuted: (isMuted) => set({ isMuted }),
      toggleMuted: () => set((s) => ({ isMuted: !s.isMuted })),
      isMeetingActive: false,
      setMeetingActive: (isMeetingActive) => set({ isMeetingActive }),
      toggleMeeting: () => set((s) => ({ isMeetingActive: !s.isMeetingActive })),

      sessions: [],
      setSessions: (sessions) => set({ sessions }),
      fetchSessions: async () => {
        try {
          const res = await gateway.getSessions();
          set({ sessions: res.sessions || [] });
        } catch (e) {
          console.error('Failed to fetch sessions:', e);
        }
      },

      tasks: [], // Empty - loaded from froggo-db only
      loadTasksFromDB: async () => {
        try {
          const result = await (window as any).clawdbot?.tasks?.list();
          if (result?.success && Array.isArray(result.tasks)) {
            // Convert froggo-db tasks to store format
            const tasks = result.tasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              status: t.status as TaskStatus,
              project: t.project || 'General',
              assignedTo: t.assigned_to,
              createdAt: t.created_at || Date.now(),
              updatedAt: t.updated_at || Date.now(),
            }));
            set({ tasks });
          }
        } catch (error) {
          console.error('Failed to load tasks from DB:', error);
        }
      },
      addTask: (task) => {
        const newTask = {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          tasks: [...s.tasks, newTask]
        }));
        // Sync to froggo-db
        (window as any).clawdbot?.tasks?.sync(newTask).catch(() => {});
      },
      updateTask: (id, updates) => set((s) => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)
      })),
      moveTask: (id, status) => {
        const task = get().tasks.find(t => t.id === id);
        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, status, updatedAt: Date.now() } : t)
        }));
        // Broadcast status change to main session
        if (task) {
          gateway.sendToSession('main', `[TASK_UPDATE] "${task.title}" moved to ${status}`).catch(() => {});
          // Sync to froggo-db
          (window as any).clawdbot?.tasks?.update(task.id, { status }).catch(() => {});
        }
      },
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter(t => t.id !== id) })),
      assignTask: (id, agentId) => {
        const task = get().tasks.find(t => t.id === id);
        const agent = agentId ? get().agents.find(a => a.id === agentId) : null;
        set((s) => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, assignedTo: agentId, updatedAt: Date.now() } : t)
        }));
        // Broadcast assignment to main session
        if (task) {
          const msg = agent 
            ? `[TASK_ASSIGNED] "${task.title}" assigned to ${agent.avatar} ${agent.name}`
            : `[TASK_UNASSIGNED] "${task.title}" unassigned`;
          gateway.sendToSession('main', msg).catch(() => {});
          // Sync to froggo-db
          (window as any).clawdbot?.tasks?.update(task.id, { assignedTo: agentId || '' }).catch(() => {});
        }
      },

      agents: defaultAgents,

      // Spawn an agent to work on a task
      spawnAgentForTask: async (taskId: string) => {
        const state = get();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Determine which agent to use
        const agentId = task.assignedTo || matchTaskToAgent(task.title, task.description || '');
        const agent = state.agents.find(a => a.id === agentId);
        
        if (!agent) return;

        try {
          // Update froggo-db FIRST to prevent race with polling
          await (window as any).clawdbot?.tasks?.update(taskId, { 
            status: 'in-progress',
            assignedTo: agentId 
          });

          // Update task and agent status locally
          set((s) => ({
            agents: s.agents.map(a => 
              a.id === agentId ? { ...a, status: 'busy' as const, currentTaskId: taskId } : a
            ),
            tasks: s.tasks.map(t => 
              t.id === taskId ? { ...t, status: 'in-progress' as TaskStatus, assignedTo: agentId, updatedAt: Date.now() } : t
            ),
          }));

          // Send execution trigger to Froggo (brain) in main session
          const triggerMessage = `[TASK_START] taskId: ${taskId}`;
          await gateway.sendToMain(triggerMessage);

          get().addActivity({
            type: 'agent',
            message: `${agent.avatar} ${agent.name} started: ${task.title}`,
            timestamp: Date.now(),
          });

        } catch (e) {
          console.error('Failed to start task:', e);
          set((s) => ({
            agents: s.agents.map(a => 
              a.id === agentId ? { ...a, status: 'idle' as const, currentTaskId: undefined } : a
            ),
            tasks: s.tasks.map(t => 
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
          set((s) => ({
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

          // Send task to Froggo to execute
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
          set((s) => ({
            agents: s.agents.filter(a => a.id !== workerId),
          }));
          throw e;
        }
      },

      // Update agent status
      updateAgentStatus: (agentId: string, status: Agent['status'], sessionKey?: string) => {
        set((s) => ({
          agents: s.agents.map(a => 
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
      addActivity: (a) => set((s) => ({
        activities: [{ ...a, id: `act-${Date.now()}` }, ...s.activities].slice(0, 100)
      })),
      clearActivities: () => set({ activities: [] }),

      // Approvals - seed with some examples
      approvals: [
        {
          id: 'appr-seed-1',
          type: 'tweet' as ApprovalType,
          title: 'Weekly Thread Draft',
          content: `Thread: Why your AI agent is probably trash 🧵

1/ Everyone's building AI agents rn but most miss the point entirely.

They focus on the tech stack when they should focus on the workflow.

2/ The best AI agents aren't the smartest. They're the most predictable.

Users need to trust what it will do. Surprises = churn.

3/ Here's what actually matters:
- Clear scope (what it does AND doesn't do)
- Consistent behavior  
- Graceful failures
- Human escalation path

4/ Stop building "autonomous" agents. Build collaborative ones.

The goal isn't to replace humans. It's to amplify them.`,
          context: 'Drafted based on your X growth strategy - thought leadership content',
          metadata: { platform: 'X/Twitter', scheduledFor: 'Tomorrow 9am' },
          status: 'pending' as ApprovalStatus,
          createdAt: Date.now() - 1800000,
        },
        {
          id: 'appr-seed-2',
          type: 'reply' as ApprovalType,
          title: 'Reply to @cobie',
          content: `This. The best products feel inevitable in hindsight but impossible to predict beforehand.

The pattern I've seen: founders who deeply understand one specific user segment always beat generalists trying to "disrupt an industry."`,
          context: 'Replying to thread about product-market fit',
          metadata: { platform: 'X/Twitter', replyTo: '@cobie: "PMF isn\'t about TAM..."' },
          status: 'pending' as ApprovalStatus,
          createdAt: Date.now() - 3600000,
        },
        {
          id: 'appr-seed-3',
          type: 'action' as ApprovalType,
          title: 'Schedule Team Sync',
          content: `Create recurring meeting:
- Title: "Weekly Team Sync"
- When: Every Monday 10:00 AM
- Duration: 30 min
- Attendees: Alberto, Maria, Dev team
- Location: Google Meet`,
          context: 'You mentioned wanting to set up regular syncs',
          metadata: { platform: 'Google Calendar' },
          status: 'pending' as ApprovalStatus,
          createdAt: Date.now() - 900000,
        },
      ],
      addApproval: (a) => {
        // Notify user
        notifyNewApproval(a.title);
        
        return set((s) => ({
          approvals: [{
            ...a,
            id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'pending' as ApprovalStatus,
            createdAt: Date.now(),
          }, ...s.approvals]
        }));
      },
      approveItem: (id) => {
        const state = get();
        const item = state.approvals.find(a => a.id === id);
        if (item) {
          // Execute the action
          executeApproval(item);
          // Create completion task
          const completionTask: Task = {
            id: `task-exec-${Date.now()}`,
            title: `Execute: ${item.title}`,
            description: `Approved ${item.type}: ${item.content?.slice(0, 200)}...`,
            status: 'in-progress',
            project: 'Approvals',
            assignedTo: 'main',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((s) => ({
            approvals: s.approvals.filter(a => a.id !== id), // Remove from inbox
            tasks: [completionTask, ...s.tasks],
          }));
          // Notify main session
          gateway.sendToSession('main', `[APPROVED] Execute ${item.type}: "${item.title}"\n\nContent:\n${item.content}`).catch(() => {});
        }
      },
      rejectItem: (id) => {
        const state = get();
        const item = state.approvals.find(a => a.id === id);
        if (item) {
          // Log rejection to froggo-db
          (window as any).clawdbot?.rejections?.log({
            type: item.type,
            title: item.title,
            content: item.content,
            reason: 'User rejected',
          }).catch(() => {});
          // Notify main session
          gateway.sendToSession('main', `[REJECTED] ${item.type}: "${item.title}" - logged to rejected_decisions`).catch(() => {});
        }
        set((s) => ({
          approvals: s.approvals.filter(a => a.id !== id), // Delete from inbox
        }));
      },
      adjustItem: (id, feedback) => {
        const state = get();
        const item = state.approvals.find(a => a.id === id);
        if (item) {
          // Create revision task
          const revisionTask: Task = {
            id: `task-revise-${Date.now()}`,
            title: `Revise: ${item.title}`,
            description: `Original ${item.type}:\n${item.content}\n\n---\nFeedback:\n${feedback}`,
            status: 'todo',
            project: 'Revisions',
            assignedTo: 'main',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((s) => ({
            approvals: s.approvals.filter(a => a.id !== id), // Delete from inbox
            tasks: [revisionTask, ...s.tasks],
          }));
          // Notify for revision
          gateway.sendToSession('main', `[REVISION_NEEDED] ${item.type}: "${item.title}"\n\nFeedback: ${feedback}\n\nOriginal:\n${item.content}`).catch(() => {});
        }
      },
      clearCompletedApprovals: () => set((s) => ({
        approvals: s.approvals.filter(a => a.status === 'pending')
      })),

      // Orchestration functions for Froggo

      // Auto-assign a task to the best agent
      autoAssignTask: (taskId: string) => {
        const state = get();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task || task.assignedTo) return;

        const agentId = matchTaskToAgent(task.title, task.description || '');
        
        set((s) => ({
          tasks: s.tasks.map(t => 
            t.id === taskId ? { ...t, assignedTo: agentId, updatedAt: Date.now() } : t
          ),
        }));

        get().addActivity({
          type: 'system',
          message: `🐸 Auto-assigned "${task.title}" to ${agentId}`,
          timestamp: Date.now(),
        });
      },

      // Process output from an agent and decide next steps
      processAgentOutput: (agentId: string, output: string, taskId: string) => {
        const state = get();
        const task = state.tasks.find(t => t.id === taskId);
        const agent = state.agents.find(a => a.id === agentId);
        
        if (!task || !agent) return;

        // Determine if output needs Kevin's approval
        const needsKevinApproval = 
          task.project === 'X/Twitter' ||
          output.toLowerCase().includes('tweet') ||
          output.toLowerCase().includes('email') ||
          output.toLowerCase().includes('message') ||
          output.toLowerCase().includes('post');

        if (needsKevinApproval) {
          // Queue for Kevin's approval
          get().addApproval({
            type: task.project === 'X/Twitter' ? 'tweet' : 'action',
            title: `${agent.avatar} ${agent.name}: ${task.title}`,
            content: output,
            context: `Completed by ${agent.name} agent`,
            metadata: {
              platform: task.project,
            },
          });

          // Move to review
          set((s) => ({
            tasks: s.tasks.map(t => 
              t.id === taskId ? { ...t, status: 'review' as TaskStatus, updatedAt: Date.now() } : t
            ),
          }));
        } else {
          // Froggo can approve internal work
          set((s) => ({
            tasks: s.tasks.map(t => 
              t.id === taskId ? { ...t, status: 'done' as TaskStatus, updatedAt: Date.now() } : t
            ),
          }));

          get().addActivity({
            type: 'system',
            message: `🐸 Approved: ${task.title}`,
            timestamp: Date.now(),
          });
        }

        // Reset agent status
        set((s) => ({
          agents: s.agents.map(a => 
            a.id === agentId ? { ...a, status: 'idle' as const, currentTaskId: undefined } : a
          ),
        }));
      },

      // Get tasks that need assignment
      getUnassignedTasks: () => {
        return get().tasks.filter(t => 
          !t.assignedTo && 
          t.status !== 'done' && 
          t.status !== 'review'
        );
      },

      // Get tasks in review status
      getTasksNeedingReview: () => {
        return get().tasks.filter(t => t.status === 'review');
      },
    }),
    {
      name: 'clawd-dashboard',
      partialize: (s) => ({ 
        // tasks removed - now sourced from froggo-db only
        // approvals removed - now sourced from froggo-db inbox only
        activities: s.activities.slice(0, 50),
        isMuted: s.isMuted,
      }),
    }
  )
);

// Setup gateway listeners
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

gateway.on('chat', (payload: any) => {
  if (payload?.final && payload?.content) {
    useStore.getState().addActivity({
      type: 'chat',
      message: payload.content.slice(0, 100) + (payload.content.length > 100 ? '...' : ''),
      timestamp: Date.now(),
      sessionKey: payload.sessionKey,
    });
  }
});

// Listen for approval requests from Froggo
gateway.on('approval.request', (payload: any) => {
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

// Also check for approval patterns in chat messages
gateway.on('chat.message', (payload: any) => {
  const content = payload?.content || '';
  
  // Detect approval request patterns
  if (content.includes('[NEEDS_APPROVAL]') || content.includes('[DRAFT]')) {
    // Parse the approval from the message
    const lines = content.split('\n');
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
