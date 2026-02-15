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

const execAsync = promisify(exec);

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  context?: any;
}

interface AgentResponse {
  success: boolean;
  message?: string;
  error?: string;
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
      console.debug('[FinanceAgentBridge] Initializing Finance Manager agent session...');
      
      // Check if session already exists
      const exists = await this.checkSessionExists();
      if (exists) {
        console.debug('[FinanceAgentBridge] ✅ Finance Manager session already active');
        this.spawned = true;
        return true;
      }
      
      // Spawn new session
      return await this.spawnAgent();
    } catch (error: any) {
      console.error('[FinanceAgentBridge] Initialization error:', error.message);
      return false;
    }
  }
  
  /**
   * Check if the agent session exists
   */
  private async checkSessionExists(): Promise<boolean> {
    try {
      const cmd = 'openclaw sessions list --json';
      const { stdout } = await execAsync(cmd, {
        timeout: 10000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      });
      
      const sessions = JSON.parse(stdout);
      return sessions.sessions?.some((s: any) => s.key === this.sessionKey) || false;
    } catch (error) {
      console.error('[FinanceAgentBridge] Error checking session:', error);
      return false;
    }
  }
  
  /**
   * Spawn the Finance Manager agent session
   */
  private async spawnAgent(): Promise<boolean> {
    try {
      console.debug('[FinanceAgentBridge] Spawning Finance Manager agent...');
      
      const initMessage = 'You are now connected to the Finance dashboard. You have access to financial transaction data via froggo-db finance-* commands. Be ready to analyze finances, answer questions, and provide insights. Reply with: ready';
      
      const cmd = `openclaw agent --agent-id ${this.agentId} --session-key ${this.sessionKey} --message "${initMessage}" --no-deliver`;
      
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 30000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      });
      
      if (stderr && !stderr.includes('success')) {
        console.error('[FinanceAgentBridge] Error spawning agent:', stderr);
        return false;
      }
      
      console.debug('[FinanceAgentBridge] ✅ Finance Manager spawned successfully');
      this.spawned = true;
      
      return true;
    } catch (error: any) {
      console.error('[FinanceAgentBridge] Failed to spawn agent:', error.message);
      return false;
    }
  }
  
  /**
   * Send a message to the Finance Manager agent
   */
  async sendMessage(userMessage: string, context?: any): Promise<AgentResponse> {
    try {
      if (!this.spawned) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize Finance Manager agent' };
        }
      }
      
      // Add user message to history
      const userChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
        context
      };
      this.chatHistory.push(userChatMessage);
      this.saveChatHistory();
      
      // Build message with context if provided
      let fullMessage = userMessage;
      if (context) {
        fullMessage += `\n\nContext: ${JSON.stringify(context)}`;
      }
      
      // Escape message for shell
      const escapedMessage = fullMessage.replace(/'/g, "'\\''");
      
      // Send to agent
      console.debug('[FinanceAgentBridge] Sending message to Finance Manager...');
      const cmd = `openclaw agent --message '${escapedMessage}' --session-key '${this.sessionKey}' --agent-id ${this.agentId}`;
      
      const { stdout, stderr } = await execAsync(cmd, {
        encoding: 'utf-8',
        timeout: 60000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
      });
      
      // Extract agent response
      // Note: openclaw agent output includes metadata, need to parse actual response
      let agentMessage = stdout.trim();
      
      // Remove any leading/trailing metadata
      // The actual agent response is typically after the last newline or in the main output
      const lines = agentMessage.split('\n');
      const responseLines = lines.filter(line => 
        !line.startsWith('[') && 
        !line.includes('session-key') && 
        !line.includes('agent-id') &&
        line.trim().length > 0
      );
      agentMessage = responseLines.join('\n').trim();
      
      // Add agent response to history
      const agentChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: agentMessage,
        timestamp: Date.now()
      };
      this.chatHistory.push(agentChatMessage);
      this.saveChatHistory();
      
      // Emit message event for real-time updates
      this.emit('message', agentChatMessage);
      
      console.debug('[FinanceAgentBridge] ✅ Received response from Finance Manager');
      
      return {
        success: true,
        message: agentMessage
      };
    } catch (error: any) {
      console.error('[FinanceAgentBridge] Error sending message:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get chat history
   */
  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }
  
  /**
   * Clear chat history
   */
  async clearChatHistory(): Promise<void> {
    this.chatHistory = [];
    try {
      await fs.promises.unlink(this.historyPath);
    } catch (error) {
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
      
      console.debug(`[FinanceAgentBridge] Loaded ${this.chatHistory.length} messages from history`);
    } catch (error: any) {
      console.error('[FinanceAgentBridge] Error loading chat history:', error.message);
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
    } catch (error: any) {
      console.error('[FinanceAgentBridge] Error saving chat history:', error.message);
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
      } catch (error: any) {
        console.error('[FinanceAgentBridge] Failed to store insight:', error.message);
      }
    }
    
    return response;
  }
  
  /**
   * Store an analysis result as an insight in the database
   */
  private async storeAnalysisAsInsight(content: string, analysisType: string): Promise<void> {
    // Generate a unique ID
    const id = `insight-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Determine insight type and title based on analysis type
    let type = 'recommendation';
    let title = 'Financial Analysis';
    let severity = 'info';
    
    if (analysisType === 'csv_upload') {
      type = 'spending_pattern';
      title = 'New Transactions Analysis';
      
      // Check for warning keywords
      if (content.toLowerCase().includes('over budget') || content.toLowerCase().includes('overspent')) {
        severity = 'warning';
      }
      if (content.toLowerCase().includes('critical') || content.toLowerCase().includes('urgent')) {
        severity = 'critical';
      }
    }
    
    // Escape content for SQL (use parameterized query via Python script)
    const tmpFile = path.join(tmpdir(), `insight-${Date.now()}.json`);
    
    fs.writeFileSync(tmpFile, JSON.stringify({
      id,
      type,
      title,
      content,
      severity,
      generated_at: Date.now()
    }));
    
    // Use sqlite3 to insert (safer than string interpolation)
    const dbPath = path.join(homedir(), 'froggo', 'data', 'froggo.db');
    const cmd = `sqlite3 "${dbPath}" "INSERT INTO finance_ai_insights (id, type, title, content, severity, generated_at) SELECT json_extract(value, '$.id'), json_extract(value, '$.type'), json_extract(value, '$.title'), json_extract(value, '$.content'), json_extract(value, '$.severity'), json_extract(value, '$.generated_at') FROM json_each(readfile('${tmpFile}'))"`;
    
    try {
      await execAsync(cmd);
      console.debug(`[FinanceAgentBridge] ✅ Stored insight: ${title}`);
    } finally {
      // Clean up temp file
      fs.unlinkSync(tmpFile);
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
  console.debug('[FinanceAgentBridge] Initialization complete');
}
