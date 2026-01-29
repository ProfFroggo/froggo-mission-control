import { vi } from 'vitest';

export interface GatewayMessage {
  message: string;
  context?: any;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  project?: string;
  assignedTo?: string;
  reviewerId?: string;
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  label: string;
  channel: string;
  createdAt: number;
}

let mockTasks: Task[] = [];
let mockSessions: Session[] = [];
let mockAgents: any[] = [];

export const resetMockData = () => {
  mockTasks = [
    {
      id: 'task-1',
      title: 'Test Task 1',
      description: 'Description for task 1',
      status: 'todo',
      priority: 'p1',
      project: 'Dev',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'task-2',
      title: 'Test Task 2',
      status: 'in-progress',
      priority: 'p0',
      project: 'Dev',
      assignedTo: 'coder',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  mockSessions = [
    {
      id: 'session-1',
      label: 'test-session',
      channel: 'whatsapp',
      createdAt: Date.now(),
    },
  ];

  mockAgents = [
    {
      id: 'coder',
      name: 'Coder',
      status: 'idle',
      currentTask: null,
    },
  ];
};

export const createGatewayMock = () => {
  resetMockData();

  return {
    send: vi.fn().mockImplementation((msg: GatewayMessage) => {
      return Promise.resolve({ reply: 'Mock gateway response', success: true });
    }),
    
    sessions: vi.fn().mockImplementation(() => {
      return Promise.resolve(mockSessions);
    }),
    
    spawnAgent: vi.fn().mockImplementation((params: any) => {
      const newSession = {
        id: `session-${Date.now()}`,
        label: params.label || 'agent-session',
        channel: 'agent',
        createdAt: Date.now(),
      };
      mockSessions.push(newSession);
      return Promise.resolve(newSession);
    }),
    
    terminateSession: vi.fn().mockImplementation((sessionId: string) => {
      mockSessions = mockSessions.filter(s => s.id !== sessionId);
      return Promise.resolve({ success: true });
    }),
    
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    
    on: vi.fn(),
    off: vi.fn(),
    
    state: 'connected',
  };
};

export const createDbMock = () => {
  return {
    tasks: {
      list: vi.fn().mockImplementation(() => Promise.resolve([...mockTasks])),
      
      get: vi.fn().mockImplementation((id: string) => {
        const task = mockTasks.find(t => t.id === id);
        return Promise.resolve(task);
      }),
      
      create: vi.fn().mockImplementation((task: Partial<Task>) => {
        const newTask = {
          id: `task-${Date.now()}`,
          ...task,
          status: task.status || 'todo',
          priority: task.priority || 'p2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as Task;
        mockTasks.push(newTask);
        return Promise.resolve(newTask);
      }),
      
      update: vi.fn().mockImplementation((id: string, updates: Partial<Task>) => {
        const index = mockTasks.findIndex(t => t.id === id);
        if (index !== -1) {
          mockTasks[index] = { ...mockTasks[index], ...updates, updatedAt: Date.now() };
          return Promise.resolve(mockTasks[index]);
        }
        return Promise.reject(new Error('Task not found'));
      }),
      
      delete: vi.fn().mockImplementation((id: string) => {
        mockTasks = mockTasks.filter(t => t.id !== id);
        return Promise.resolve({ success: true });
      }),
    },
    
    agents: {
      list: vi.fn().mockImplementation(() => Promise.resolve([...mockAgents])),
      
      get: vi.fn().mockImplementation((id: string) => {
        const agent = mockAgents.find(a => a.id === id);
        return Promise.resolve(agent);
      }),
    },
    
    subtasks: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
};

export const createInboxMock = () => {
  let mockInboxItems: any[] = [];
  
  return {
    list: vi.fn().mockImplementation(() => Promise.resolve([...mockInboxItems])),
    
    approve: vi.fn().mockImplementation((id: string) => {
      mockInboxItems = mockInboxItems.filter(item => item.id !== id);
      return Promise.resolve({ success: true });
    }),
    
    reject: vi.fn().mockImplementation((id: string) => {
      mockInboxItems = mockInboxItems.filter(item => item.id !== id);
      return Promise.resolve({ success: true });
    }),
    
    approveAll: vi.fn().mockImplementation(() => {
      mockInboxItems = [];
      return Promise.resolve({ success: true, count: mockInboxItems.length });
    }),
  };
};

export const setupGlobalMocks = () => {
  const gatewayMock = createGatewayMock();
  const dbMock = createDbMock();
  const inboxMock = createInboxMock();
  
  (window as any).clawdbot = {
    gateway: gatewayMock,
    db: dbMock,
    inbox: inboxMock,
  };
  
  return { gatewayMock, dbMock, inboxMock };
};

export { mockTasks, mockSessions, mockAgents };
