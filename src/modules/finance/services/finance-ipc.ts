// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Finance IPC service — now backed by REST API routes instead of Electron IPC.
 */

import { financeApi } from '../../../lib/api';

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
      const params: Record<string, string> = { limit: String(limit) };
      if (accountId) params.accountId = accountId;
      return financeApi.getTransactions(params);
    },

    async getBudget(budgetId?: string) {
      return financeApi.getBudget();
    },

    async getWalletInfo() {
      return financeApi.getAccounts();
    },

    async getAgentBudgets() {
      return financeApi.getBudget();
    },

    async queryAgent(question: string) {
      return { response: 'Finance agent not available in web mode' };
    },

    async getAgentStatus() {
      return { available: false };
    },
  };
}
