/**
 * Finance Agent Bridge & Dashboard Agents Handlers Module
 *
 * Channels: financeAgent:sendMessage/getChatHistory/clearHistory/
 * triggerAnalysis/getStatus, dashboardAgents:status
 *
 * 6 registerHandler calls total.
 */

import { registerHandler } from '../ipc-registry';
import { getFinanceAgentBridge } from '../finance-agent-bridge';
import { getDashboardAgentsStatus } from '../dashboard-agents';
import { safeLog } from '../logger';

export function registerFinanceAgentHandlers(): void {
  registerHandler('financeAgent:sendMessage', async (_event, message: string, context?: Record<string, unknown>) => {
    try {
      safeLog.log('[FinanceAgent] Sending message to Finance Manager:', message.substring(0, 100));
      const bridge = getFinanceAgentBridge();
      return await bridge.sendMessage(message, context);
    } catch (error: unknown) { safeLog.error('[FinanceAgent] Send message error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('financeAgent:getChatHistory', async () => {
    try { const bridge = getFinanceAgentBridge(); return { success: true, messages: bridge.getChatHistory() }; }
    catch (error: unknown) { safeLog.error('[FinanceAgent] Get chat history error:', error.message); return { success: false, messages: [], error: error.message }; }
  });

  registerHandler('financeAgent:clearHistory', async () => {
    try { const bridge = getFinanceAgentBridge(); await bridge.clearChatHistory(); return { success: true }; }
    catch (error: unknown) { safeLog.error('[FinanceAgent] Clear history error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('financeAgent:triggerAnalysis', async (_event, analysisType?: 'csv_upload' | 'manual') => {
    try {
      safeLog.log('[FinanceAgent] Triggering analysis:', analysisType || 'manual');
      const bridge = getFinanceAgentBridge();
      return await bridge.triggerAnalysis(analysisType);
    } catch (error: unknown) { safeLog.error('[FinanceAgent] Trigger analysis error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('financeAgent:getStatus', async () => {
    try { const bridge = getFinanceAgentBridge(); return { success: true, status: bridge.getStatus() }; }
    catch (error: unknown) { safeLog.error('[FinanceAgent] Get status error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('dashboardAgents:status', async () => {
    try { return { success: true, agents: getDashboardAgentsStatus() }; }
    catch (error: unknown) { safeLog.error('[DashboardAgents] Status error:', error); return { success: false, agents: [], error: error.message }; }
  });
}
