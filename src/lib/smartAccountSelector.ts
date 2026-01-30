/**
 * Smart Account Selector
 * 
 * Context-aware account selection - chooses the right account based on:
 * - Which account received the message/invite
 * - Reply-to address matching
 * - Source-based routing
 * 
 * NO DEFAULT ACCOUNTS - Every account is equal, AI decides based on context.
 */

import { ConnectedAccount } from '../types/accounts';

export interface AccountSelectionContext {
  // Email context
  receivedAt?: string;        // Email address that received the message
  replyTo?: string;           // Reply-to header
  to?: string[];              // To recipients
  cc?: string[];              // CC recipients
  
  // Calendar context
  calendarSource?: string;    // Which calendar service (google, icloud, etc)
  calendarAccount?: string;   // Specific calendar account
  inviteFrom?: string;        // Invite sender email
  
  // Generic context
  conversationId?: string;    // Track conversation thread
  previousAccount?: string;   // Account used in previous message in thread
}

export interface AccountSelection {
  account: ConnectedAccount;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives?: ConnectedAccount[];
}

/**
 * Smart account selector
 */
export class SmartAccountSelector {
  private accounts: ConnectedAccount[] = [];
  private conversationHistory: Map<string, string> = new Map(); // conversationId -> accountId

  constructor(accounts: ConnectedAccount[]) {
    this.accounts = accounts;
  }

  /**
   * Select the best account for the given context
   */
  selectAccount(context: AccountSelectionContext): AccountSelection | null {
    if (this.accounts.length === 0) {
      return null;
    }

    // Strategy 1: Exact match on received-at address (HIGHEST PRIORITY)
    if (context.receivedAt) {
      const match = this.accounts.find(a => 
        a.email.toLowerCase() === context.receivedAt?.toLowerCase() &&
        a.status === 'connected'
      );
      if (match) {
        return {
          account: match,
          confidence: 'high',
          reason: `Email received at ${context.receivedAt} - replying from same address`,
        };
      }
    }

    // Strategy 2: Reply-to address match
    if (context.replyTo) {
      const match = this.accounts.find(a => 
        a.email.toLowerCase() === context.replyTo?.toLowerCase() &&
        a.status === 'connected'
      );
      if (match) {
        return {
          account: match,
          confidence: 'high',
          reason: `Reply-to address matches ${context.replyTo}`,
        };
      }
    }

    // Strategy 3: Conversation thread continuity
    if (context.conversationId && context.previousAccount) {
      const match = this.accounts.find(a => 
        a.id === context.previousAccount &&
        a.status === 'connected'
      );
      if (match) {
        this.conversationHistory.set(context.conversationId, match.id);
        return {
          account: match,
          confidence: 'high',
          reason: `Continuing conversation thread with ${match.email}`,
        };
      }
    }

    // Strategy 4: Calendar account match
    if (context.calendarAccount) {
      const match = this.accounts.find(a => 
        a.email.toLowerCase() === context.calendarAccount?.toLowerCase() &&
        a.dataTypes.includes('calendar') &&
        a.status === 'connected'
      );
      if (match) {
        return {
          account: match,
          confidence: 'high',
          reason: `Calendar invite on ${context.calendarAccount} - using same account`,
        };
      }
    }

    // Strategy 5: Domain matching (e.g., @bitso.com → kevin.macarthur@bitso.com)
    if (context.receivedAt) {
      const domain = context.receivedAt.split('@')[1];
      const domainMatches = this.accounts.filter(a => 
        a.email.endsWith(`@${domain}`) &&
        a.status === 'connected'
      );
      if (domainMatches.length === 1) {
        return {
          account: domainMatches[0],
          confidence: 'medium',
          reason: `Domain match (@${domain}) - using ${domainMatches[0].email}`,
          alternatives: this.accounts.filter(a => a.status === 'connected' && a.id !== domainMatches[0].id),
        };
      }
    }

    // Strategy 6: Data type matching (e.g., need email capability)
    const requiredDataType = context.receivedAt ? 'email' : context.calendarAccount ? 'calendar' : null;
    if (requiredDataType) {
      const capableAccounts = this.accounts.filter(a => 
        a.dataTypes.includes(requiredDataType) &&
        a.status === 'connected'
      );
      if (capableAccounts.length === 1) {
        return {
          account: capableAccounts[0],
          confidence: 'medium',
          reason: `Only account with ${requiredDataType} capability`,
          alternatives: [],
        };
      }
      if (capableAccounts.length > 1) {
        return {
          account: capableAccounts[0],
          confidence: 'low',
          reason: `Multiple accounts available - defaulting to ${capableAccounts[0].email}`,
          alternatives: capableAccounts.slice(1),
        };
      }
    }

    // Strategy 7: First connected account (LAST RESORT)
    const firstConnected = this.accounts.find(a => a.status === 'connected');
    if (firstConnected) {
      return {
        account: firstConnected,
        confidence: 'low',
        reason: `No context available - using ${firstConnected.email} (consider adding more context)`,
        alternatives: this.accounts.filter(a => a.status === 'connected' && a.id !== firstConnected.id),
      };
    }

    return null;
  }

  /**
   * Get all accounts that match the context (for manual override)
   */
  getMatchingAccounts(context: AccountSelectionContext): ConnectedAccount[] {
    // const matches: ConnectedAccount[] = [];
    
    // All accounts that can handle this context
    const requiredDataType = context.receivedAt ? 'email' : context.calendarAccount ? 'calendar' : null;
    
    if (requiredDataType) {
      return this.accounts.filter(a => 
        a.dataTypes.includes(requiredDataType) &&
        a.status === 'connected'
      );
    }

    return this.accounts.filter(a => a.status === 'connected');
  }

  /**
   * Track conversation for continuity
   */
  trackConversation(conversationId: string, accountId: string) {
    this.conversationHistory.set(conversationId, accountId);
  }

  /**
   * Clear conversation history (for cleanup)
   */
  clearHistory() {
    this.conversationHistory.clear();
  }
}

/**
 * Selection rules explanation (for UI display)
 */
export const SELECTION_RULES = [
  {
    priority: 1,
    rule: 'Exact Address Match',
    description: 'Email received at your primary address → Reply from that address', // TODO: use dynamic user email from settings
    example: 'Highest priority - ensures replies come from the right address',
  },
  {
    priority: 2,
    rule: 'Reply-To Header',
    description: 'Uses reply-to address from original message',
    example: 'Respects email threading and conversation flow',
  },
  {
    priority: 3,
    rule: 'Conversation Continuity',
    description: 'Continues thread with same account used previously',
    example: 'Keeps multi-message conversations consistent',
  },
  {
    priority: 4,
    rule: 'Calendar Source',
    description: 'Invite on iCloud calendar → Uses iCloud account',
    example: 'Matches calendar events to their source',
  },
  {
    priority: 5,
    rule: 'Domain Match',
    description: '@bitso.com email → kevin.macarthur@bitso.com',
    example: 'Uses company email for company communications',
  },
  {
    priority: 6,
    rule: 'Capability Match',
    description: 'Uses accounts with required data type (email, calendar, etc)',
    example: 'Ensures account can handle the action',
  },
  {
    priority: 7,
    rule: 'Context-Free',
    description: 'No context available - suggests adding more info',
    example: 'Last resort - indicates missing context',
  },
];

/**
 * Format account selection for display
 */
export function formatAccountSelection(selection: AccountSelection): string {
  const confidence = selection.confidence === 'high' ? '✅' : 
                     selection.confidence === 'medium' ? '⚠️' : '❓';
  
  let message = `${confidence} ${selection.account.email}\n${selection.reason}`;
  
  if (selection.alternatives && selection.alternatives.length > 0) {
    message += `\n\nAlternatives: ${selection.alternatives.map(a => a.email).join(', ')}`;
  }
  
  return message;
}

/**
 * Helper: Extract conversation ID from email headers
 */
export function extractConversationId(headers: any): string | undefined {
  // Check for Message-ID, In-Reply-To, References headers
  return headers?.['message-id'] || 
         headers?.['in-reply-to'] || 
         headers?.['references']?.split(' ')[0];
}
