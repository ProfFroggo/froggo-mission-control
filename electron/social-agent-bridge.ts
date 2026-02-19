/**
 * Social Agent Bridge
 * Handles communication between the X/Twitter panel UI and the Social Manager agent
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { createLogger } from './utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('SocialAgentBridge');

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

// Tab-specific system prompts to give the agent context about what the user is working on
const TAB_SYSTEM_PROMPTS: Record<string, string> = {
  research: 'You are helping with X/Twitter research. The user is on the Research tab, looking for content inspiration, trending topics, competitor analysis, and engagement opportunities.',
  plan: 'You are helping with X/Twitter content planning. The user is on the Plan tab, working on content calendars, brainstorming tweet ideas, outlining threads, and creating content strategies.',
  drafts: 'You are helping with X/Twitter draft creation. The user is on the Drafts tab, writing tweets, crafting thread hooks, polishing copy, and improving messaging.',
  calendar: 'You are helping manage the X/Twitter content calendar. The user is on the Calendar tab, scheduling content, optimizing posting times, and managing the editorial calendar.',
  mentions: 'You are helping monitor X/Twitter mentions. The user is on the Mentions tab, monitoring brand mentions, suggesting responses, and identifying engagement opportunities.',
  'reply-guy': 'You are helping with reply-style engagement on X/Twitter. The user is on the Reply Guy tab, crafting clever replies, quote tweets, and engagement responses to high-visibility tweets.',
  'content-mix': 'You are helping manage the X/Twitter content mix. The user is on the Content Mix tab, balancing content types, tracking content distribution across categories.',
  automations: 'You are helping manage X/Twitter automations. The user is on the Automations tab, setting up automated workflows, scheduling recurring content, and managing automation rules.',
  analytics: 'You are helping review X/Twitter analytics. The user is on the Analytics tab, interpreting performance data, identifying trends, and suggesting content optimizations based on metrics.',
  reddit: 'You are helping monitor Reddit for product mentions. The user is on the Reddit Monitor tab, monitoring subreddits, analyzing threads, and drafting authentic Reddit replies.',
  publish: 'You are helping compose and publish X/Twitter posts. The user is on the Publish tab, composing tweets, reviewing scheduled posts, and managing the publishing queue.',
};

export class SocialAgentBridge extends EventEmitter {
  private agentId = 'social-manager';
  private sessionKey = 'agent:social-manager:dashboard';
  private spawned = false;
  private chatHistory: ChatMessage[] = [];
  private historyPath: string;

  constructor() {
    super();
    // Store chat history in social manager's memory directory
    const socialManagerDir = path.join(homedir(), 'agent-social-manager', 'memory');
    this.historyPath = path.join(socialManagerDir, 'chat-history.jsonl');

    // Load existing chat history
    this.loadChatHistory();
  }

  /**
   * Initialize the social manager agent session
   */
  async initialize(): Promise<boolean> {
    try {
      logger.debug('[SocialAgentBridge] Initializing Social Manager agent session...');

      // Check if session already exists
      const exists = await this.checkSessionExists();
      if (exists) {
        logger.debug('[SocialAgentBridge] Social Manager session already active');
        this.spawned = true;
        return true;
      }

      // Spawn new session
      return await this.spawnAgent();
    } catch (error) {
      logger.error('[SocialAgentBridge] Initialization error:', (error as Error).message);
      return false;
    }
  }

  /**
   * Check if the agent session exists
   */
  private async checkSessionExists(): Promise<boolean> {
    // Skip session check -- just try to send; openclaw agent handles sessions internally
    return this.spawned;
  }

  /**
   * Spawn the Social Manager agent session
   */
  private async spawnAgent(): Promise<boolean> {
    try {
      logger.debug('[SocialAgentBridge] Spawning Social Manager agent...');

      const initMessage = 'You are now connected to the Social Media dashboard. You help manage X/Twitter content, research, planning, scheduling, mentions, analytics, automations, and Reddit monitoring. Be ready to assist with social media strategy. Reply with: ready';

      const cmd = `openclaw agent --agent ${this.agentId} --message '${initMessage.replace(/'/g, "'\\''")}' --json`;

      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 60000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
      });

      logger.debug('[SocialAgentBridge] Spawn output:', stdout?.slice(0, 200));
      if (stderr) logger.debug('[SocialAgentBridge] Spawn stderr:', stderr?.slice(0, 200));

      this.spawned = true;
      return true;
    } catch (error) {
      logger.error('[SocialAgentBridge] Failed to spawn agent:', (error as Error).message);
      return false;
    }
  }

  /**
   * Send a message to the Social Manager agent
   */
  async sendMessage(userMessage: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    try {
      if (!this.spawned) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize Social Manager agent' };
        }
      }

      // Add user message to history
      const userChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
        context,
      };
      this.chatHistory.push(userChatMessage);
      this.saveChatHistory();

      // Build message with conversation history + context for continuity
      let fullMessage = '';

      // Add tab-specific system prompt if tab is provided
      const tab = context?.tab as string | undefined;
      if (tab && TAB_SYSTEM_PROMPTS[tab]) {
        fullMessage += `<system_context>\n${TAB_SYSTEM_PROMPTS[tab]}\n</system_context>\n\n`;
      }

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
        // Exclude tab from context dump since it's already in the system prompt
        const { tab: _tab, ...restContext } = context;
        if (Object.keys(restContext).length > 0) {
          fullMessage += `\n\nContext: ${JSON.stringify(restContext)}`;
        }
      }

      // Escape message for shell
      const escapedMessage = fullMessage.replace(/'/g, "'\\''");

      // Send to agent
      logger.debug('[SocialAgentBridge] Sending message to Social Manager...');
      const cmd = `openclaw agent --agent ${this.agentId} --message '${escapedMessage}' --json`;

      const { stdout } = await execAsync(cmd, {
        encoding: 'utf-8',
        timeout: 180000, // 3 min
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

      // Add agent response to history
      const agentChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: agentMessage,
        timestamp: Date.now(),
      };
      this.chatHistory.push(agentChatMessage);
      this.saveChatHistory();

      // Emit message event for real-time updates
      this.emit('message', agentChatMessage);

      logger.debug('[SocialAgentBridge] Received response from Social Manager');

      return {
        success: true,
        message: agentMessage
      };
    } catch (error) {
      logger.error('[SocialAgentBridge] Error sending message:', (error as Error).message);
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

      logger.debug(`[SocialAgentBridge] Loaded ${this.chatHistory.length} messages from history`);
    } catch (error) {
      logger.error('[SocialAgentBridge] Error loading chat history:', (error as Error).message);
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
      logger.error('[SocialAgentBridge] Error saving chat history:', (error as Error).message);
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
let bridgeInstance: SocialAgentBridge | null = null;

/**
 * Get the Social Agent Bridge instance
 */
export function getSocialAgentBridge(): SocialAgentBridge {
  if (!bridgeInstance) {
    bridgeInstance = new SocialAgentBridge();
  }
  return bridgeInstance;
}

/**
 * Initialize the Social Agent Bridge
 */
export async function initializeSocialAgentBridge(): Promise<void> {
  const bridge = getSocialAgentBridge();
  await bridge.initialize();
  logger.debug('[SocialAgentBridge] Initialization complete');
}
