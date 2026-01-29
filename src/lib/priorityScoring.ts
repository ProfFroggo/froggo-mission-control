/**
 * Priority Scoring System for Inbox
 * 
 * Scores messages based on:
 * - Sender importance (from froggo-db VIP system or metadata)
 * - Urgency keywords in title/content
 * - Time sensitivity (age of message)
 * - Message type priority
 * - Context signals
 * 
 * Score range: 0-100 (higher = more urgent)
 */

export interface PriorityScore {
  total: number;
  breakdown: {
    sender: number;
    urgency: number;
    timeSensitivity: number;
    type: number;
    context: number;
  };
  flags: string[]; // Reasons for high priority
  vipInfo?: VipInfo | null; // VIP sender info if matched
}

export interface VipInfo {
  id: number;
  identifier: string;
  label: string;
  priority_boost: number;
  category?: string;
  notes?: string;
}

export interface InboxItemForScoring {
  type: string;
  title: string;
  content: string;
  context?: string;
  metadata?: any;
  created: string;
  source_channel?: string;
}

// Urgency keyword weights (keywords → score boost)
const URGENCY_KEYWORDS = {
  // Critical (20 points)
  critical: 20,
  urgent: 20,
  emergency: 20,
  asap: 20,
  'now': 18,
  immediate: 20,
  
  // High priority (15 points)
  important: 15,
  priority: 15,
  deadline: 15,
  'breaking': 15,
  'alert': 15,
  
  // Medium priority (10 points)
  soon: 10,
  today: 10,
  'time-sensitive': 12,
  'time sensitive': 12,
  'quick': 8,
  'waiting': 8,
  'blocked': 12,
  
  // Questions/requests (5-8 points)
  'question': 5,
  'help': 7,
  'need': 6,
  'please': 5,
  '?': 3, // Question mark
  
  // Action verbs (5 points)
  'approve': 5,
  'review': 5,
  'check': 5,
  'verify': 5,
  'confirm': 5,
};

// Important senders (name/identifier → base score)
const IMPORTANT_SENDERS: Record<string, number> = {
  'kevin': 25,
  'kmac': 25,
  'kevin.macarthur': 25,
  'boss': 20,
  'manager': 15,
  'lead': 15,
  'ceo': 20,
  'cto': 18,
  'team lead': 15,
  // Add more as needed
};

// Type-based priority
const TYPE_PRIORITY: Record<string, number> = {
  'task': 15,      // Tasks need action
  'email': 12,     // Emails often important
  'message': 10,   // Direct messages
  'reply': 8,      // Replies less urgent
  'tweet': 5,      // Tweets least urgent
  'action': 15,    // Actions need execution
};

// Time decay curve (age in hours → penalty)
function getTimeDecayPenalty(ageHours: number): number {
  if (ageHours < 1) return 0;        // < 1 hour: no penalty
  if (ageHours < 6) return 5;        // 1-6 hours: small penalty
  if (ageHours < 24) return 10;      // 6-24 hours: medium penalty
  if (ageHours < 72) return 15;      // 1-3 days: high penalty
  return 20;                          // > 3 days: max penalty
}

// VIP cache (in-memory for performance)
let vipCache: VipInfo[] | null = null;
let vipCacheTime: number = 0;
const VIP_CACHE_TTL = 60000; // 1 minute

// Load VIPs from database (cached)
async function loadVips(): Promise<VipInfo[]> {
  const now = Date.now();
  if (vipCache && (now - vipCacheTime) < VIP_CACHE_TTL) {
    return vipCache;
  }
  
  try {
    // Check if running in Electron with clawdbot API
    if (window.clawdbot?.vip?.list) {
      const vips = await window.clawdbot.vip.list();
      vipCache = vips;
      vipCacheTime = now;
      return vips;
    }
  } catch (error) {
    console.warn('[VIP] Failed to load VIPs:', error);
  }
  
  return [];
}

// Extract sender identifier from inbox item
function extractSenderIdentifier(item: InboxItemForScoring): string | null {
  const metadata = item.metadata || {};
  
  // Try various sender fields
  const sender = (
    metadata.from || 
    metadata.sender || 
    metadata.author || 
    metadata.email ||
    metadata.phone ||
    metadata.username ||
    ''
  ).trim();
  
  return sender || null;
}

// Check if sender matches VIP (supports exact, domain, and pattern matching)
function matchVip(sender: string, vips: VipInfo[]): VipInfo | null {
  if (!sender) return null;
  
  const senderLower = sender.toLowerCase();
  
  // 1. Exact match (email, phone, username)
  for (const vip of vips) {
    if (vip.identifier.toLowerCase() === senderLower) {
      return vip;
    }
  }
  
  // 2. Domain match (for email addresses)
  if (sender.includes('@')) {
    const domain = sender.split('@')[1].toLowerCase();
    for (const vip of vips) {
      if (vip.identifier_type === 'domain' && vip.identifier.toLowerCase() === domain) {
        return vip;
      }
    }
  }
  
  // 3. Pattern match (wildcard/regex)
  for (const vip of vips) {
    if (vip.identifier_type === 'pattern') {
      const pattern = vip.identifier.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      if (regex.test(sender)) {
        return vip;
      }
    }
  }
  
  return null;
}

// Synchronous VIP check using cached data
function checkVipSync(sender: string): VipInfo | null {
  if (!vipCache) return null;
  return matchVip(sender, vipCache);
}

// Score sender importance (with VIP detection)
async function scoreSenderAsync(item: InboxItemForScoring): Promise<{ score: number; flags: string[]; vipInfo: VipInfo | null }> {
  const flags: string[] = [];
  let score = 0;
  let vipInfo: VipInfo | null = null;
  
  // Extract sender identifier
  const sender = extractSenderIdentifier(item);
  
  // Check VIP status
  if (sender) {
    const vips = await loadVips();
    vipInfo = matchVip(sender, vips);
    
    if (vipInfo) {
      score += vipInfo.priority_boost;
      const categoryBadge = vipInfo.category ? ` [${vipInfo.category}]` : '';
      flags.push(`⭐ VIP: ${vipInfo.label}${categoryBadge} (+${vipInfo.priority_boost})`);
    }
  }
  
  // Fallback to hardcoded important senders if no VIP match
  if (!vipInfo && sender) {
    const metadata = item.metadata || {};
    const senderText = (
      metadata.from || 
      metadata.sender || 
      metadata.author || 
      item.source_channel || 
      ''
    ).toLowerCase();
    
    for (const [name, points] of Object.entries(IMPORTANT_SENDERS)) {
      if (senderText.includes(name.toLowerCase())) {
        score = Math.max(score, points);
        flags.push(`Important sender: ${name}`);
        break;
      }
    }
  }
  
  // Boost for direct channels (WhatsApp, direct message)
  if (item.source_channel?.includes('whatsapp') || 
      item.source_channel?.includes('direct')) {
    score += 10;
    flags.push('Direct message');
  }
  
  return { score, flags, vipInfo };
}

// Synchronous fallback for scoreSender (uses cached VIPs)
function scoreSender(item: InboxItemForScoring): { score: number; flags: string[]; vipInfo: VipInfo | null } {
  const flags: string[] = [];
  let score = 0;
  let vipInfo: VipInfo | null = null;
  
  // Extract sender identifier
  const sender = extractSenderIdentifier(item);
  
  // Check VIP status using cache
  if (sender && vipCache) {
    vipInfo = checkVipSync(sender);
    
    if (vipInfo) {
      score += vipInfo.priority_boost;
      const categoryBadge = vipInfo.category ? ` [${vipInfo.category}]` : '';
      flags.push(`⭐ VIP: ${vipInfo.label}${categoryBadge} (+${vipInfo.priority_boost})`);
    }
  }
  
  // Fallback to hardcoded important senders
  if (!vipInfo && sender) {
    const metadata = item.metadata || {};
    const senderText = (
      metadata.from || 
      metadata.sender || 
      metadata.author || 
      item.source_channel || 
      ''
    ).toLowerCase();
    
    for (const [name, points] of Object.entries(IMPORTANT_SENDERS)) {
      if (senderText.includes(name.toLowerCase())) {
        score = Math.max(score, points);
        flags.push(`Important sender: ${name}`);
        break;
      }
    }
  }
  
  // Boost for direct channels
  if (item.source_channel?.includes('whatsapp') || 
      item.source_channel?.includes('direct')) {
    score += 10;
    flags.push('Direct message');
  }
  
  return { score, flags, vipInfo };
}

// Score urgency keywords in content
function scoreUrgency(item: InboxItemForScoring): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  
  const text = `${item.title} ${item.content} ${item.context || ''}`.toLowerCase();
  
  // Check for urgency keywords
  const matchedKeywords: string[] = [];
  for (const [keyword, points] of Object.entries(URGENCY_KEYWORDS)) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
      score += points;
    }
  }
  
  // Cap urgency score at 30
  score = Math.min(score, 30);
  
  if (matchedKeywords.length > 0) {
    flags.push(`Urgency keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }
  
  // Exclamation marks indicate urgency (up to 3)
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 0) {
    const exclamationBoost = Math.min(exclamations * 2, 6);
    score += exclamationBoost;
    if (exclamations >= 2) {
      flags.push(`High emphasis (${exclamations}!)`);
    }
  }
  
  // ALL CAPS in title indicates urgency
  if (item.title === item.title.toUpperCase() && item.title.length > 5) {
    score += 8;
    flags.push('All caps title');
  }
  
  return { score, flags };
}

// Score time sensitivity
function scoreTimeSensitivity(item: InboxItemForScoring): { score: number; flags: string[] } {
  const flags: string[] = [];
  
  const createdTime = new Date(item.created).getTime();
  const ageMs = Date.now() - createdTime;
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Fresh messages get bonus points
  let score = 0;
  if (ageHours < 0.5) {
    score = 15;
    flags.push('Just received (fresh)');
  } else if (ageHours < 2) {
    score = 10;
    flags.push('Very recent');
  } else if (ageHours < 6) {
    score = 5;
  }
  
  // Apply decay penalty
  const penalty = getTimeDecayPenalty(ageHours);
  score -= penalty;
  
  if (ageHours > 72) {
    flags.push('Aging (>3 days old)');
  } else if (ageHours > 24) {
    flags.push('Old (>1 day)');
  }
  
  return { score, flags };
}

// Score based on type
function scoreType(item: InboxItemForScoring): { score: number; flags: string[] } {
  const flags: string[] = [];
  const score = TYPE_PRIORITY[item.type] || 5;
  
  if (score >= 15) {
    flags.push(`High-priority type: ${item.type}`);
  }
  
  return { score, flags };
}

// Score based on context signals
function scoreContext(item: InboxItemForScoring): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  
  const context = (item.context || '').toLowerCase();
  const metadata = item.metadata || {};
  
  // Check for scheduled/time-bound items
  if (metadata.scheduledFor || metadata.dueDate) {
    score += 8;
    flags.push('Time-bound item');
  }
  
  // Check for mentions of meetings/calls
  if (context.includes('meeting') || context.includes('call') || context.includes('calendar')) {
    score += 8;
    flags.push('Meeting/calendar related');
  }
  
  // Check for security/injection warnings
  if (metadata.injectionWarning) {
    const risk = metadata.injectionWarning.risk;
    if (risk === 'critical' || risk === 'high') {
      score += 15;
      flags.push(`Security: ${risk} risk`);
    }
  }
  
  // Check for blocking other work
  if (context.includes('blocked') || context.includes('waiting')) {
    score += 10;
    flags.push('Blocking other work');
  }
  
  // Check for external stakeholders
  if (context.includes('client') || context.includes('customer') || context.includes('external')) {
    score += 8;
    flags.push('External stakeholder');
  }
  
  return { score, flags };
}

/**
 * Calculate priority score for an inbox item
 */
export function calculatePriorityScore(item: InboxItemForScoring): PriorityScore {
  const sender = scoreSender(item);
  const urgency = scoreUrgency(item);
  const timeSensitivity = scoreTimeSensitivity(item);
  const type = scoreType(item);
  const context = scoreContext(item);
  
  const breakdown = {
    sender: sender.score,
    urgency: urgency.score,
    timeSensitivity: timeSensitivity.score,
    type: type.score,
    context: context.score,
  };
  
  const total = Math.max(0, Math.min(100, 
    breakdown.sender + 
    breakdown.urgency + 
    breakdown.timeSensitivity + 
    breakdown.type + 
    breakdown.context
  ));
  
  const flags = [
    ...sender.flags,
    ...urgency.flags,
    ...timeSensitivity.flags,
    ...type.flags,
    ...context.flags,
  ];
  
  return {
    total,
    breakdown,
    flags,
    vipInfo: sender.vipInfo,
  };
}

/**
 * Async version of calculatePriorityScore (with fresh VIP lookup)
 */
export async function calculatePriorityScoreAsync(item: InboxItemForScoring): Promise<PriorityScore> {
  const sender = await scoreSenderAsync(item);
  const urgency = scoreUrgency(item);
  const timeSensitivity = scoreTimeSensitivity(item);
  const type = scoreType(item);
  const context = scoreContext(item);
  
  const breakdown = {
    sender: sender.score,
    urgency: urgency.score,
    timeSensitivity: timeSensitivity.score,
    type: type.score,
    context: context.score,
  };
  
  const total = Math.max(0, Math.min(100, 
    breakdown.sender + 
    breakdown.urgency + 
    breakdown.timeSensitivity + 
    breakdown.type + 
    breakdown.context
  ));
  
  const flags = [
    ...sender.flags,
    ...urgency.flags,
    ...timeSensitivity.flags,
    ...type.flags,
    ...context.flags,
  ];
  
  return {
    total,
    breakdown,
    flags,
    vipInfo: sender.vipInfo,
  };
}

/**
 * Preload VIP cache (call on app init)
 */
export function preloadVipCache(): Promise<void> {
  return loadVips().then(() => undefined).catch(err => {
    console.warn('[VIP] Failed to preload cache:', err);
  });
}

/**
 * Get priority level label
 */
export function getPriorityLevel(score: number): {
  level: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  color: string;
} {
  if (score >= 70) {
    return { level: 'critical', label: 'Critical', color: 'text-red-400 bg-red-500/20' };
  } else if (score >= 50) {
    return { level: 'high', label: 'High', color: 'text-orange-400 bg-orange-500/20' };
  } else if (score >= 30) {
    return { level: 'medium', label: 'Medium', color: 'text-yellow-400 bg-yellow-500/20' };
  } else {
    return { level: 'low', label: 'Low', color: 'text-green-400 bg-green-500/20' };
  }
}

/**
 * Sort items by priority score (highest first)
 */
export function sortByPriority<T extends InboxItemForScoring & { priorityScore?: number }>(
  items: T[]
): T[] {
  return items.sort((a, b) => {
    const scoreA = a.priorityScore ?? calculatePriorityScore(a).total;
    const scoreB = b.priorityScore ?? calculatePriorityScore(b).total;
    return scoreB - scoreA; // Descending
  });
}

/**
 * Group items by priority level
 */
export function groupByPriority<T extends InboxItemForScoring & { priorityScore?: number }>(
  items: T[]
): {
  critical: T[];
  high: T[];
  medium: T[];
  low: T[];
} {
  const groups = {
    critical: [] as T[],
    high: [] as T[],
    medium: [] as T[],
    low: [] as T[],
  };
  
  items.forEach(item => {
    const score = item.priorityScore ?? calculatePriorityScore(item).total;
    const { level } = getPriorityLevel(score);
    groups[level].push(item);
  });
  
  return groups;
}
