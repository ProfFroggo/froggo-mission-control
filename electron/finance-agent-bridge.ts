/**
 * Finance Agent Bridge
 * Handles communication between the Finance panel UI and the Finance Manager agent
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { homedir, tmpdir } from 'os';
import { createLogger } from './utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('FinanceAgentBridge');

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  context?: Record<string, unknown>;
  hidden?: boolean;
}

interface AgentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface SessionInfo {
  key: string;
  agentId?: string;
  status?: string;
}

interface OpenclawSessionList {
  sessions?: SessionInfo[];
}

export class FinanceAgentBridge extends EventEmitter {
  private agentId = 'finance-manager';
  private sessionKey = 'agent:finance-manager:dashboard';
  private spawned = false;
  private chatHistory: ChatMessage[] = [];
  private historyPath: string;
  
  constructor() {
    super();
    // Store chat history in finance manager's memory directory
    const financeManagerDir = path.join(homedir(), 'agent-finance-manager', 'memory');
    this.historyPath = path.join(financeManagerDir, 'chat-history.jsonl');
    
    // Load existing chat history
    this.loadChatHistory();
  }
  
  /**
   * Initialize the finance manager agent session
   */
  async initialize(): Promise<boolean> {
    try {
      logger.debug('[FinanceAgentBridge] Initializing Finance Manager agent session...');
      
      // Check if session already exists
      const exists = await this.checkSessionExists();
      if (exists) {
        logger.debug('[FinanceAgentBridge] ✅ Finance Manager session already active');
        this.spawned = true;
        return true;
      }
      
      // Spawn new session
      return await this.spawnAgent();
    } catch (error) {
      logger.error('[FinanceAgentBridge] Initialization error:', (error as Error).message);
      return false;
    }
  }
  
  /**
   * Check if the agent session exists
   */
  private async checkSessionExists(): Promise<boolean> {
    // Skip session check — just try to send; openclaw agent handles sessions internally
    return this.spawned;
  }

  /**
   * Spawn the Finance Manager agent session
   */
  private async spawnAgent(): Promise<boolean> {
    try {
      logger.debug('[FinanceAgentBridge] Spawning Finance Manager agent...');

      const initMessage = 'You are now connected to the Finance dashboard. You have access to financial transaction data via froggo-db finance-* commands. Be ready to analyze finances, answer questions, and provide insights. Reply with: ready';

      const cmd = `openclaw agent --agent ${this.agentId} --message '${initMessage.replace(/'/g, "'\\''")}' --json`;

      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 60000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
      });

      logger.debug('[FinanceAgentBridge] Spawn output:', stdout?.slice(0, 200));
      if (stderr) logger.debug('[FinanceAgentBridge] Spawn stderr:', stderr?.slice(0, 200));

      this.spawned = true;
      return true;
    } catch (error) {
      logger.error('[FinanceAgentBridge] Failed to spawn agent:', (error as Error).message);
      return false;
    }
  }
  
  /**
   * Send a message to the Finance Manager agent
   */
  async sendMessage(userMessage: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    try {
      if (!this.spawned) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize Finance Manager agent' };
        }
      }
      
      // Add user message to history
      // Mark system-generated messages (uploads, analysis triggers) as hidden
      const isSystemMessage = context?.type === 'csv_upload' || context?.type === 'pdf_upload' || context?.analysisType != null;
      const userChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: isSystemMessage ? `[Uploaded ${(context?.filename as string) || 'file'} for AI review]` : userMessage,
        timestamp: Date.now(),
        context,
        hidden: isSystemMessage
      };
      this.chatHistory.push(userChatMessage);
      this.saveChatHistory();
      
      // Build message with conversation history + context for continuity
      let fullMessage = '';

      // Inject recent conversation history so agent has memory
      const recentHistory = this.chatHistory.slice(-10); // last 10 messages (5 exchanges)
      if (recentHistory.length > 1) {
        fullMessage += '<conversation_history>\n';
        for (const msg of recentHistory.slice(0, -1)) { // exclude the message we just added
          fullMessage += `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content.slice(0, 500)}\n`;
        }
        fullMessage += '</conversation_history>\n\n';
      }

      fullMessage += userMessage;
      if (context) {
        fullMessage += `\n\nContext: ${JSON.stringify(context)}`;
      }
      
      // Escape message for shell
      const escapedMessage = fullMessage.replace(/'/g, "'\\''");
      
      // Send to agent
      logger.debug('[FinanceAgentBridge] Sending message to Finance Manager...');
      const cmd = `openclaw agent --agent ${this.agentId} --message '${escapedMessage}' --json`;
      
      const { stdout } = await execAsync(cmd, {
        encoding: 'utf-8',
        timeout: 180000, // 3 min — large uploads need time for AI to parse + insert
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
      });

      // Extract agent response from JSON output
      let agentMessage = '';
      const raw = stdout.trim();
      try {
        const parsed = JSON.parse(raw);
        // openclaw agent --json returns { result: { payloads: [{ text: "..." }] } }
        const payloads = parsed?.result?.payloads;
        if (Array.isArray(payloads) && payloads.length > 0) {
          agentMessage = payloads.map((p: any) => p.text || '').join('\n').trim();
        }
        if (!agentMessage && parsed?.result?.text) {
          agentMessage = parsed.result.text;
        }
      } catch {
        // Fallback: not JSON, use raw output with line filtering
        const lines = raw.split('\n');
        agentMessage = lines.filter((line: string) =>
          !line.startsWith('[') && !line.startsWith('{') && line.trim().length > 0
        ).join('\n').trim();
      }
      if (!agentMessage) agentMessage = raw;
      
      // Add agent response to history (hide if responding to a system message)
      const agentChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: agentMessage,
        timestamp: Date.now(),
        hidden: isSystemMessage
      };
      this.chatHistory.push(agentChatMessage);
      this.saveChatHistory();
      
      // Emit message event for real-time updates
      this.emit('message', agentChatMessage);
      
      logger.debug('[FinanceAgentBridge] ✅ Received response from Finance Manager');
      
      return {
        success: true,
        message: agentMessage
      };
    } catch (error) {
      logger.error('[FinanceAgentBridge] Error sending message:', (error as Error).message);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Get chat history
   */
  getChatHistory(): ChatMessage[] {
    return this.chatHistory.filter(msg => !msg.hidden);
  }
  
  /**
   * Clear chat history
   */
  async clearChatHistory(): Promise<void> {
    this.chatHistory = [];
    try {
      await fs.promises.unlink(this.historyPath);
    } catch {
      // Ignore error if file doesn't exist
    }
  }
  
  /**
   * Load chat history from disk
   */
  private loadChatHistory(): void {
    try {
      if (!fs.existsSync(this.historyPath)) {
        return;
      }
      
      const data = fs.readFileSync(this.historyPath, 'utf-8');
      const lines = data.split('\n').filter(line => line.trim());
      
      this.chatHistory = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean) as ChatMessage[];
      
      logger.debug(`[FinanceAgentBridge] Loaded ${this.chatHistory.length} messages from history`);
    } catch (error) {
      logger.error('[FinanceAgentBridge] Error loading chat history:', (error as Error).message);
    }
  }
  
  /**
   * Save chat history to disk (JSONL format)
   */
  private saveChatHistory(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write as JSONL (one JSON object per line)
      const lines = this.chatHistory.map(msg => JSON.stringify(msg)).join('\n');
      fs.writeFileSync(this.historyPath, lines + '\n', 'utf-8');
    } catch (error) {
      logger.error('[FinanceAgentBridge] Error saving chat history:', (error as Error).message);
    }
  }
  
  /**
   * Trigger a financial analysis (for CSV uploads, etc.)
   */
  async triggerAnalysis(analysisType: 'csv_upload' | 'manual' = 'manual'): Promise<AgentResponse> {
    const message = analysisType === 'csv_upload'
      ? 'New transactions have been uploaded to the database. Please analyze them, check budgets, identify patterns or anomalies, and generate insights for the user. Be specific and actionable.'
      : 'Please analyze the current financial data and provide insights.';
    
    const response = await this.sendMessage(message, { analysisType });
    
    // Store the analysis as an insight in the database
    if (response.success && response.message) {
      try {
        await this.storeAnalysisAsInsight(response.message, analysisType);
      } catch (error) {
        logger.error('[FinanceAgentBridge] Failed to store insight:', (error as Error).message);
      }
    }
    
    return response;
  }
  
  /**
   * Store an analysis result as an insight in the database
   */
  private async storeAnalysisAsInsight(content: string, analysisType: string): Promise<void> {
    const id = `insight-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    let type = 'recommendation';
    let title = 'Financial Analysis';
    let severity = 'info';

    if (analysisType === 'csv_upload') {
      type = 'spending_pattern';
      title = 'New Transactions Analysis';

      if (content.toLowerCase().includes('over budget') || content.toLowerCase().includes('overspent')) {
        severity = 'warning';
      }
      if (content.toLowerCase().includes('critical') || content.toLowerCase().includes('urgent')) {
        severity = 'critical';
      }
    }

    // Use froggo-db CLI for safe parameterized insert
    const dbPath = path.join(homedir(), 'froggo', 'data', 'froggo.db');
    const now = Date.now();

    // Escape content for SQL single quotes
    const escaped = (s: string) => s.replace(/'/g, "''");

    const sql = `INSERT OR IGNORE INTO finance_ai_insights (id, type, title, content, severity, generated_at, created_at, updated_at) VALUES ('${escaped(id)}', '${escaped(type)}', '${escaped(title)}', '${escaped(content)}', '${escaped(severity)}', ${now}, ${now}, ${now})`;

    const cmd = `sqlite3 "${dbPath}" '${sql.replace(/'/g, "'\\''")}'`;

    try {
      await execAsync(cmd, { timeout: 5000 });
      logger.debug(`[FinanceAgentBridge] ✅ Stored insight: ${title}`);
    } catch (error) {
      // Fallback: write directly via better-sqlite3 if available
      logger.error('[FinanceAgentBridge] sqlite3 CLI insert failed, trying prepare():', (error as Error).message);
      try {
        // Dynamic import to avoid circular deps — prepare() from database.ts
        const { prepare } = await import('./database');
        prepare(`INSERT OR IGNORE INTO finance_ai_insights (id, type, title, content, severity, generated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, type, title, content, severity, now, now, now);
        logger.debug(`[FinanceAgentBridge] ✅ Stored insight via prepare(): ${title}`);
      } catch (innerError) {
        logger.error('[FinanceAgentBridge] Failed to store insight:', (innerError as Error).message);
      }
    }
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      agentId: this.agentId,
      sessionKey: this.sessionKey,
      spawned: this.spawned,
      messageCount: this.chatHistory.length
    };
  }
}

// Singleton instance
let bridgeInstance: FinanceAgentBridge | null = null;

/**
 * Get the Finance Agent Bridge instance
 */
export function getFinanceAgentBridge(): FinanceAgentBridge {
  if (!bridgeInstance) {
    bridgeInstance = new FinanceAgentBridge();
  }
  return bridgeInstance;
}

/**
 * Initialize the Finance Agent Bridge
 */
export async function initializeFinanceAgentBridge(): Promise<void> {
  const bridge = getFinanceAgentBridge();
  await bridge.initialize();
  logger.debug('[FinanceAgentBridge] Initialization complete');
}
