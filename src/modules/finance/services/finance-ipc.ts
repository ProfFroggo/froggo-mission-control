/**
 * Finance IPC service — thin wrapper around electron IPC calls.
 *
 * Provides a typed API for the Finance module to communicate with
 * the electron main process without direct ipcRenderer references.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipc = (window as any).electronAPI;

export interface FinanceService {
  getTransactions(accountId?: string, limit?: number): Promise<unknown[]>;
  getBudget(budgetId?: string): Promise<unknown>;
  getWalletInfo(): Promise<unknown>;
  getAgentBudgets(): Promise<unknown[]>;
  queryAgent(question: string): Promise<{ response: string }>;
  getAgentStatus(): Promise<{ available: boolean }>;
}

export function createFinanceService(): FinanceService {
  return {
    async getTransactions(accountId?: string, limit = 50) {
      if (!ipc?.invoke) return [];
      return ipc.invoke('finance:getTransactions', accountId, limit);
    },

    async getBudget(budgetId?: string) {
      if (!ipc?.invoke) return null;
      return ipc.invoke('finance:getBudget', budgetId);
    },

    async getWalletInfo() {
      if (!ipc?.invoke) return null;
      return ipc.invoke('finance:getWalletInfo');
    },

    async getAgentBudgets() {
      if (!ipc?.invoke) return [];
      return ipc.invoke('finance:getAgentBudgets');
    },

    async queryAgent(question: string) {
      if (!ipc?.invoke) return { response: 'Finance agent not available' };
      return ipc.invoke('financeAgent:query', question);
    },

    async getAgentStatus() {
      if (!ipc?.invoke) return { available: false };
      return ipc.invoke('financeAgent:status');
    },
  };
}
