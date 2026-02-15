/**
 * Smart Folder Rule Engine
 * 
 * Auto-assigns conversations to folders based on configurable rules.
 * Rules can match on: sender, keywords, platform, priority, time, etc.
 */

export type RuleConditionType = 
  | 'sender_matches'        // Sender identifier matches pattern
  | 'sender_name_contains'  // Sender display name contains text
  | 'content_contains'      // Message content contains keyword(s)
  | 'platform_is'           // Platform equals (whatsapp, telegram, discord, etc)
  | 'priority_above'        // Priority score > threshold
  | 'priority_below'        // Priority score < threshold
  | 'has_attachment'        // Message has attachments
  | 'is_urgent'             // Message marked as urgent
  | 'time_range'            // Message sent within time range
  | 'reply_needed'          // Message needs reply
  | 'domain_matches';       // Email domain matches

export type RuleOperator = 'AND' | 'OR';

export interface RuleCondition {
  type: RuleConditionType;
  value: string | number | boolean;
  negate?: boolean; // NOT condition
}

export interface FolderRule {
  id: string;
  folderId: number;
  name: string;
  enabled: boolean;
  operator: RuleOperator; // How to combine conditions
  conditions: RuleCondition[];
  priority: number; // Higher priority rules run first
  createdAt: string;
  updatedAt: string;
}

export interface ConversationData {
  sessionKey: string;
  sender?: string;
  senderName?: string;
  platform?: string;
  content?: string;
  priorityScore?: number;
  isUrgent?: boolean;
  hasAttachment?: boolean;
  replyNeeded?: boolean;
  timestamp?: string;
}

/**
 * Evaluate a single condition against conversation data
 */
export function evaluateCondition(
  condition: RuleCondition,
  data: ConversationData
): boolean {
  let result = false;

  switch (condition.type) {
    case 'sender_matches':
      result = data.sender
        ? matchesPattern(data.sender, String(condition.value))
        : false;
      break;

    case 'sender_name_contains':
      result = data.senderName
        ? data.senderName.toLowerCase().includes(String(condition.value).toLowerCase())
        : false;
      break;

    case 'content_contains':
      result = data.content
        ? containsKeywords(data.content, String(condition.value))
        : false;
      break;

    case 'platform_is':
      result = data.platform
        ? data.platform.toLowerCase() === String(condition.value).toLowerCase()
        : false;
      break;

    case 'priority_above':
      result = data.priorityScore !== undefined
        ? data.priorityScore > Number(condition.value)
        : false;
      break;

    case 'priority_below':
      result = data.priorityScore !== undefined
        ? data.priorityScore < Number(condition.value)
        : false;
      break;

    case 'has_attachment':
      result = Boolean(data.hasAttachment);
      break;

    case 'is_urgent':
      result = Boolean(data.isUrgent);
      break;

    case 'reply_needed':
      result = Boolean(data.replyNeeded);
      break;

    case 'time_range':
      result = isInTimeRange(data.timestamp, String(condition.value));
      break;

    case 'domain_matches':
      result = data.sender
        ? matchesDomain(data.sender, String(condition.value))
        : false;
      break;

    default:
      console.debug(`Unknown condition type: ${condition.type}`);
      result = false;
  }

  // Apply negation if specified
  return condition.negate ? !result : result;
}

/**
 * Evaluate a complete rule against conversation data
 */
export function evaluateRule(rule: FolderRule, data: ConversationData): boolean {
  if (!rule.enabled || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map(cond => evaluateCondition(cond, data));

  // Combine results based on operator
  if (rule.operator === 'AND') {
    return results.every(r => r === true);
  } else {
    return results.some(r => r === true);
  }
}

/**
 * Evaluate all rules for a conversation and return matching folder IDs
 */
export function evaluateAllRules(
  rules: FolderRule[],
  data: ConversationData
): number[] {
  // Sort by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  const matchingFolderIds: number[] = [];

  for (const rule of sortedRules) {
    if (evaluateRule(rule, data)) {
      matchingFolderIds.push(rule.folderId);
    }
  }

  // Return unique folder IDs
  return [...new Set(matchingFolderIds)];
}

// Helper Functions

/**
 * Check if string matches pattern (supports wildcards)
 */
function matchesPattern(str: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  // * matches any characters, ? matches single character
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*') // * -> .*
    .replace(/\?/g, '.'); // ? -> .
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(str);
}

/**
 * Check if content contains keywords (comma-separated)
 */
function containsKeywords(content: string, keywords: string): boolean {
  const lowerContent = content.toLowerCase();
  const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
  
  return keywordList.some(keyword => lowerContent.includes(keyword));
}

/**
 * Check if email domain matches pattern
 */
function matchesDomain(email: string, domain: string): boolean {
  const emailDomain = email.split('@')[1];
  if (!emailDomain) return false;
  
  return matchesPattern(emailDomain, domain);
}

/**
 * Check if timestamp is within time range
 * Format: "HH:MM-HH:MM" (e.g., "09:00-17:00" for business hours)
 */
function isInTimeRange(timestamp: string | undefined, range: string): boolean {
  if (!timestamp) return false;

  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [start, end] = range.split('-');
  if (!start || !end) return false;

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (endTime > startTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Wraps midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}

// Rule Templates for quick setup

export const RULE_TEMPLATES: Partial<FolderRule>[] = [
  {
    name: 'High Priority Messages',
    operator: 'AND',
    conditions: [
      { type: 'priority_above', value: 70 }
    ],
    priority: 100
  },
  {
    name: 'Work Emails',
    operator: 'OR',
    conditions: [
      { type: 'domain_matches', value: '*.example.com' },
      { type: 'content_contains', value: 'work,meeting,project,deadline' }
    ],
    priority: 80
  },
  {
    name: 'Urgent Messages',
    operator: 'OR',
    conditions: [
      { type: 'is_urgent', value: true },
      { type: 'content_contains', value: 'urgent,asap,emergency,critical' }
    ],
    priority: 90
  },
  {
    name: 'Business Hours Only',
    operator: 'AND',
    conditions: [
      { type: 'time_range', value: '09:00-17:00' }
    ],
    priority: 50
  },
  {
    name: 'Specific Person',
    operator: 'OR',
    conditions: [
      { type: 'sender_matches', value: '*@example.com' },
      { type: 'sender_name_contains', value: 'John' }
    ],
    priority: 70
  }
];

/**
 * Validate rule syntax
 */
export function validateRule(rule: Partial<FolderRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.name || rule.name.trim().length === 0) {
    errors.push('Rule name is required');
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push('At least one condition is required');
  }

  if (rule.conditions) {
    rule.conditions.forEach((cond, idx) => {
      if (!cond.type) {
        errors.push(`Condition ${idx + 1}: type is required`);
      }
      if (cond.value === undefined || cond.value === null || cond.value === '') {
        errors.push(`Condition ${idx + 1}: value is required`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate human-readable description of a rule
 */
export function describeRule(rule: FolderRule): string {
  if (rule.conditions.length === 0) return 'No conditions';

  const descriptions = rule.conditions.map(cond => {
    const prefix = cond.negate ? 'NOT ' : '';
    
    switch (cond.type) {
      case 'sender_matches':
        return `${prefix}sender is ${cond.value}`;
      case 'sender_name_contains':
        return `${prefix}sender name contains "${cond.value}"`;
      case 'content_contains':
        return `${prefix}content contains "${cond.value}"`;
      case 'platform_is':
        return `${prefix}from ${cond.value}`;
      case 'priority_above':
        return `${prefix}priority > ${cond.value}`;
      case 'priority_below':
        return `${prefix}priority < ${cond.value}`;
      case 'has_attachment':
        return `${prefix}has attachment`;
      case 'is_urgent':
        return `${prefix}is urgent`;
      case 'reply_needed':
        return `${prefix}needs reply`;
      case 'time_range':
        return `${prefix}received during ${cond.value}`;
      case 'domain_matches':
        return `${prefix}domain is ${cond.value}`;
      default:
        return `${prefix}${cond.type} = ${cond.value}`;
    }
  });

  const joiner = rule.operator === 'AND' ? ' AND ' : ' OR ';
  return descriptions.join(joiner);
}
