/**
 * Comms Handlers Module
 *
 * Communications-domain IPC handlers extracted from main.ts:
 * - inbox:addWithMetadata, list, add, update, approveAll, listRevisions,
 *   submitRevision, getRevisionContext, toggleStar, markRead, addTag,
 *   removeTag, setProject, search, filter, getSuggestions, check-history,
 *   trigger-backfill (18)
 * - messages:recent, context, send, unread (4)
 * - conversations:archive, unarchive, archived, isArchived, markRead, delete (6)
 * - vip:list, add, update, remove, check (5)
 * - email:send, accounts, unread, body, search, queue-send, checkImportant (7)
 * - search:discord, telegram, whatsapp (3)
 *
 * 43 registerHandler calls total.
 *
 * Also includes comms polling infrastructure (refreshCommsBackground,
 * startCommsPolling, startEmailAutoCheck) exported for main.ts app.on('ready').
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { BrowserWindow } from 'electron';
import { registerHandler } from '../ipc-registry';
import { prepare, db } from '../database';
import { safeLog } from '../logger';
import {
  SCRIPTS_DIR, TOOLS_DIR, DATA_DIR,
  FROGGO_DB, FROGGO_DB_CLI, TGCLI, DISCORDCLI, SHELL_PATH,
} from '../paths';

// ── Renderer broadcast (replaces safeSend from main.ts) ──────────────────────

function sendToRenderer(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      try { win.webContents.send(channel, ...args); } catch { /* ignore */ }
    }
  });
}

// ── Default email account helper ─────────────────────────────────────────────

function getDefaultGogEmail(): string {
  try {
    const gogList = execSync('/opt/homebrew/bin/gog auth list --json', {
      timeout: 5000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    }).toString();
    const gogData = JSON.parse(gogList);
    const accounts = (gogData.accounts || []).filter((a: any) => a.services?.includes('gmail'));
    return accounts[0]?.email || '';
  } catch {
    return '';
  }
}

// ── Comms cache infrastructure ───────────────────────────────────────────────

const COMMS_CACHE_TTL_MS = 30 * 1000; // 30 seconds
const FROGGO_DB_PATH = FROGGO_DB_CLI;

const runMsgCmd = (cmd: string, timeout = 10000): Promise<string> => {
  return new Promise((resolve) => {
    const fullPath = `${SHELL_PATH}:${process.env.PATH || ''}`;
    exec(cmd, { timeout, env: { ...process.env, PATH: fullPath } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error(`[Messages] Command error: ${cmd.slice(0, 100)}...`, error.message);
        if (stderr) safeLog.error(`[Messages] stderr: ${stderr}`);
        resolve('');
      } else {
        resolve(stdout);
      }
    });
  });
};

const getCommsCacheAge = async (): Promise<number> => {
  try {
    const raw = await runMsgCmd(`sqlite3 "${FROGGO_DB}" "SELECT MAX(fetched_at) FROM comms_cache"`, 2000);
    if (raw && raw.trim()) {
      const lastFetch = new Date(raw.trim()).getTime();
      return Date.now() - lastFetch;
    }
  } catch (e) {
    safeLog.error('[Messages] Cache age check error:', e);
  }
  return Infinity;
};

const getCommsFromCache = async (limit: number): Promise<any[] | null> => {
  try {
    const raw = await runMsgCmd(`${FROGGO_DB_PATH} comms-recent --limit ${limit} --max-age-hours 2160`, 3000);
    if (raw && raw.trim().startsWith('[')) {
      const cached = JSON.parse(raw);
      return cached.map((m: any) => {
        let meta: any = {};
        if (m.metadata) {
          try {
            meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            if (typeof meta === 'string') meta = JSON.parse(meta);
          } catch { meta = {}; }
        }
        return {
          id: m.external_id,
          platform: m.platform,
          account: m.account || meta.account || undefined,
          name: m.sender_name || m.sender,
          from: m.sender,
          preview: m.preview,
          timestamp: m.timestamp,
          relativeTime: (() => {
            if (!m.timestamp) return '';
            const date = new Date(m.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          })(),
          hasReply: !!m.has_reply,
          has_reply: !!m.has_reply,
          isUrgent: !!m.is_urgent,
          is_read: !m.is_unread && !m.is_read ? false : !!m.is_read,
          is_starred: !!m.is_starred,
          has_attachment: !!m.has_attachment,
          thread_id: m.thread_id,
          message_count: m.thread_message_count || 1,
          unread_count: m.thread_message_count && !m.is_read ? m.thread_message_count : 0,
          unreplied_count: !m.has_reply ? 1 : 0,
        };
      });
    }
  } catch (e) {
    safeLog.error('[Messages] Cache read error:', e);
  }
  return null;
};

const writeCommsToCache = async (messages: any[]): Promise<void> => {
  try {
    const cacheData = messages.map(m => ({
      platform: m.platform,
      external_id: m.id,
      sender: m.from || m.name,
      sender_name: m.name,
      preview: m.preview,
      timestamp: m.timestamp,
      is_urgent: m.isUrgent || false,
      ...(m.account ? { metadata: JSON.stringify({ account: m.account }) } : {}),
    }));
    const tmpFile = path.join(os.tmpdir(), `comms-cache-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(cacheData));
    await runMsgCmd(`${FROGGO_DB_PATH} comms-bulk --file "${tmpFile}"`, 5000);
    fs.unlinkSync(tmpFile);
    safeLog.log(`[Messages] Cached ${messages.length} messages to froggo-db`);
  } catch (e) {
    safeLog.error('[Messages] Cache write error:', e);
  }
};

// ── Comms DB table init ──────────────────────────────────────────────────────

const initCommsDbTables = async () => {
  const dbFile = FROGGO_DB;
  const tables = [
    `CREATE TABLE IF NOT EXISTS comms_fetch_state (
      platform TEXT NOT NULL,
      account TEXT DEFAULT '',
      last_fetch_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_message_ts TEXT,
      PRIMARY KEY (platform, account)
    )`,
    `CREATE TABLE IF NOT EXISTS comms_ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      triage TEXT,
      summary TEXT,
      tasks TEXT,
      events TEXT,
      reply_draft TEXT,
      reply_needed INTEGER DEFAULT 1,
      analyzed_at TEXT DEFAULT (datetime('now')),
      tokens_used INTEGER DEFAULT 0,
      UNIQUE(external_id, platform)
    )`,
  ];
  for (const sql of tables) {
    try {
      await runMsgCmd(`sqlite3 "${dbFile}" "${sql.replace(/\n/g, ' ')}"`, 5000);
    } catch (e) {
      safeLog.error('[CommsDB] Table creation error:', e);
    }
  }
  safeLog.log('[CommsDB] Tables initialized');
};

setTimeout(initCommsDbTables, 2000);

// ── Background comms polling ─────────────────────────────────────────────────

let commsRefreshInProgress = false;

async function refreshCommsBackground() {
  if (commsRefreshInProgress) return;
  commsRefreshInProgress = true;
  safeLog.log('[CommsPolling] Background refresh starting...');

  const allMessages: any[] = [];
  const DISCORDCLI_PATH = DISCORDCLI;

  const relativeTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getFetchState = async (platform: string, account = ''): Promise<string | null> => {
    try {
      const row = prepare('SELECT last_message_ts FROM comms_fetch_state WHERE platform = ? AND account = ?').get(platform, account) as any;
      return row?.last_message_ts || null;
    } catch { return null; }
  };

  const updateFetchState = async (platform: string, account: string, lastTs: string) => {
    try {
      prepare("INSERT OR REPLACE INTO comms_fetch_state (platform, account, last_fetch_at, last_message_ts) VALUES (?, ?, datetime('now'), ?)").run(platform, account, lastTs);
    } catch (e) {
      safeLog.error(`[CommsPolling] Failed to update fetch state for ${platform}:${account}`, e);
    }
  };

  try {
    // ===== WHATSAPP =====
    const waLastTs = await getFetchState('whatsapp');
    const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
    const waFilter = waLastTs ? `AND m.ts > ${Math.floor(new Date(waLastTs).getTime() / 1000)}` : '';
    const waQuery = `
      SELECT m.chat_jid, m.chat_name, m.text, m.ts, COALESCE(c.push_name, c.full_name, c.business_name) as contact_name
      FROM messages m
      LEFT JOIN contacts c ON m.chat_jid = c.jid
      WHERE m.from_me = 0
        AND (m.chat_jid LIKE '%@s.whatsapp.net' OR m.chat_jid LIKE '%@g.us')
        AND m.text IS NOT NULL AND m.text != ''
        ${waFilter}
      GROUP BY m.chat_jid
      ORDER BY m.ts DESC
      LIMIT 50
    `;
    try {
      const waRaw = await runMsgCmd(`sqlite3 "${waDbPath}" "${waQuery.replace(/\n/g, ' ')}" -json`, 10000);
      if (waRaw && waRaw.length > 10) {
        const waMessages = JSON.parse(waRaw);
        let maxTs = '';
        for (const msg of waMessages) {
          let name = msg.contact_name || msg.chat_name || msg.chat_jid || 'Unknown';
          if (name.includes('@')) name = name.split('@')[0];
          if (/^\d+$/.test(name)) name = `+${name}`;
          const timestamp = new Date(msg.ts * 1000).toISOString();
          if (!maxTs || timestamp > maxTs) maxTs = timestamp;
          allMessages.push({
            id: `wa-${msg.chat_jid}`, platform: 'whatsapp', name,
            preview: (msg.text || '').slice(0, 100), timestamp,
            relativeTime: relativeTime(timestamp), fromMe: false,
          });
        }
        if (maxTs) await updateFetchState('whatsapp', '', maxTs);
      }
    } catch (e) { safeLog.error('[CommsPolling] WhatsApp error:', e); }

    // ===== TELEGRAM (from cache) =====
    const tgCachePath = path.join(DATA_DIR, 'telegram-cache.json');
    const TELEGRAM_SPAM_KEYWORDS = [
      'bc.game', 'casino', 'betting', 'airdrop', 'giveaway',
      'crypto wizard', 'alpha private', 'vip lounge', 'mystic dao',
      'slerf', 'pepe', 'zeus community', 'zeus army', 'ponke',
      'degen', 'memecoin', 'shitcoin', '$jug', '$sol',
    ];
    const TELEGRAM_SPAM_NAMES = new Set([
      'BC.GAME Official', 'Mystic Dao', 'Crypto Wizards Lounge',
      "Pepe's Dog Zeus Community #CC8", 'Alpha Private Vip Lounge 🐳 🌐',
      'SlerfTheSloth', 'ZEUS Army (COORDINATION GROUP)',
    ]);
    try {
      if (fs.existsSync(tgCachePath)) {
        const tgCache = JSON.parse(fs.readFileSync(tgCachePath, 'utf-8'));
        for (const chat of (tgCache.chats || []).slice(0, 50)) {
          if (!chat.lastMessage?.text || chat.lastMessage.text === '(no recent messages)') continue;
          const nameLower = (chat.name || '').toLowerCase();
          const previewLower = (chat.lastMessage.text || '').toLowerCase();
          if (TELEGRAM_SPAM_NAMES.has(chat.name)) continue;
          if (TELEGRAM_SPAM_KEYWORDS.some(kw => nameLower.includes(kw) || previewLower.includes(kw))) continue;
          let timestamp = chat.lastMessage.timestamp;
          if (timestamp && !timestamp.includes('Z')) timestamp += 'Z';
          allMessages.push({
            id: `tg-${chat.id}`, platform: 'telegram', name: chat.name || 'Unknown',
            preview: (chat.lastMessage.text || '').slice(0, 100), timestamp,
            relativeTime: relativeTime(timestamp), fromMe: false, chatType: chat.type,
          });
        }
      }
    } catch (e) { safeLog.error('[CommsPolling] Telegram error:', e); }

    // ===== DISCORD DMs =====
    try {
      const discordDmsRaw = await runMsgCmd(`${DISCORDCLI_PATH} dms`, 5000);
      if (discordDmsRaw && !discordDmsRaw.includes('Invalid token')) {
        const dmLines = discordDmsRaw.split('\n').filter((l: string) => l.trim() && !l.startsWith('ID') && !l.startsWith('---'));
        const dms = dmLines.slice(0, 15).map((line: string) => {
          const match = line.match(/^(\d+)\s+(.+)$/);
          if (match) return { id: match[1], name: match[2].trim() };
          return null;
        }).filter(Boolean) as { id: string; name: string }[];
        const dmResults = await Promise.allSettled(
          dms.map(async (dm) => {
            const msgRaw = await runMsgCmd(`${DISCORDCLI_PATH} messages ${dm.id} --limit 15`, 4000);
            if (!msgRaw) return null;
            const msgLines = msgRaw.split('\n').filter((l: string) => l.match(/^\[\d{4}-\d{2}-\d{2}/));
            for (const line of msgLines) {
              const msgMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
              if (msgMatch && msgMatch[2].trim() !== 'prof_froggo') {
                const timestamp = new Date(msgMatch[1].replace(' ', 'T') + ':00Z');
                return {
                  id: `discord-${dm.id}`, platform: 'discord',
                  name: dm.name.split(',')[0].trim(),
                  preview: msgMatch[3].trim().slice(0, 100),
                  timestamp: timestamp.toISOString(),
                  relativeTime: relativeTime(timestamp.toISOString()), fromMe: false,
                };
              }
            }
            return null;
          })
        );
        for (const result of dmResults) {
          if (result.status === 'fulfilled' && result.value) allMessages.push(result.value);
        }
      }
    } catch (e) { safeLog.error('[CommsPolling] Discord error:', e); }

    // ===== EMAIL =====
    let emailAccounts: string[] = [];
    try {
      const gogAuthRaw = await runMsgCmd('/opt/homebrew/bin/gog auth list --json', 10000);
      if (gogAuthRaw) {
        const gogData = JSON.parse(gogAuthRaw);
        const gmailAccts = (gogData.accounts || [])
          .filter((a: any) => a.services?.includes('gmail'))
          .map((a: any) => a.email);
        if (gmailAccts.length > 0) emailAccounts = gmailAccts;
      }
    } catch (err) { safeLog.debug('[Email] Failed to discover email accounts:', err); }
    for (const acct of emailAccounts) {
      try {
        const lastTs = await getFetchState('email', acct);
        const timeFilter = lastTs ? `newer_than:30m` : 'newer_than:30d';
        const emailRaw = await runMsgCmd(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "${timeFilter}" --json --limit 50`, 30000);
        if (emailRaw) {
          const emailData = JSON.parse(emailRaw);
          const emails = emailData.threads || emailData || [];
          for (const email of emails) {
            const ts = email.date || email.Date || new Date().toISOString();
            allMessages.push({
              id: `email-${email.id || email.ID}`, platform: 'email', account: acct,
              name: email.from?.split('<')[0]?.trim() || email.From?.split('<')[0]?.trim() || 'Unknown',
              preview: email.subject || email.Subject || email.snippet || '',
              timestamp: ts, relativeTime: relativeTime(ts), fromMe: false,
            });
          }
          await updateFetchState('email', acct, new Date().toISOString());
        }
      } catch (e) { safeLog.error(`[CommsPolling] Email ${acct} error:`, e); }
    }

    // Sort and cache
    allMessages.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    await writeCommsToCache(allMessages).catch(e => safeLog.error('[CommsPolling] Cache write failed:', e));
    safeLog.log(`[CommsPolling] Refreshed ${allMessages.length} messages`);
  } catch (e) {
    safeLog.error('[CommsPolling] Background refresh error:', e);
  } finally {
    commsRefreshInProgress = false;
  }
}

/**
 * Start comms polling timer. Call from main.ts app.on('ready').
 */
export function startCommsPolling(): void {
  setTimeout(() => {
    refreshCommsBackground().then(() => {
      sendToRenderer('comms-updated', { ts: Date.now() });
    });
  }, 10000);

  setInterval(async () => {
    await refreshCommsBackground();
    sendToRenderer('comms-updated', { ts: Date.now() });
  }, 60000);
  safeLog.log('[CommsPolling] Started (60s interval)');
}

// ── Email auto-check infrastructure ──────────────────────────────────────────

const processedEmailIds = new Set<string>();
const processedEmailsFile = path.join(DATA_DIR, 'processed-emails.json');

// Load processed emails on module import
try {
  if (fs.existsSync(processedEmailsFile)) {
    const data = JSON.parse(fs.readFileSync(processedEmailsFile, 'utf-8'));
    data.forEach((id: string) => processedEmailIds.add(id));
    safeLog.log(`[Email] Loaded ${processedEmailIds.size} processed email IDs`);
  }
} catch (e) {
  safeLog.error('[Email] Failed to load processed emails:', e);
}

function saveProcessedEmails() {
  try {
    const data = Array.from(processedEmailIds).slice(-500);
    fs.writeFileSync(processedEmailsFile, JSON.stringify(data, null, 2));
  } catch (e) {
    safeLog.error('[Email] Failed to save processed emails:', e);
  }
}

interface ImportantEmailResult {
  id: string;
  from: string;
  subject: string;
  reason: string;
  priority: 'urgent' | 'high' | 'medium';
  amount?: string;
}

function detectImportantEmail(email: any): ImportantEmailResult | null {
  const id = email.id || email.ID || email.threadId;
  const from = email.from || email.From || '';
  const subject = email.subject || email.Subject || '';
  const labels = email.labels || email.Labels || [];
  const snippet = email.snippet || '';

  const subjectLower = subject.toLowerCase();
  const combined = `${subjectLower} ${snippet.toLowerCase()}`;

  const amountMatch = combined.match(/[$\u20AC\u00A3]\s?[\d,]+(?:\.\d{2})?/);
  const amount = amountMatch ? amountMatch[0] : undefined;

  // Priority: Urgent
  const urgentPatterns = [
    /urgent/i, /immediate action/i, /action required/i,
    /expires? (today|soon|in \d)/i, /deadline/i, /asap/i,
  ];
  for (const pattern of urgentPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Urgent action required', priority: 'urgent', amount };
    }
  }

  // Priority: High - Financial
  const financialPatterns = [
    /invoice/i, /payment (due|received|failed|declined)/i, /billing/i,
    /receipt/i, /transaction/i, /wire transfer/i, /bank (statement|alert|notification)/i,
  ];
  const financialSenders = [
    /revolut/i, /stripe/i, /paypal/i, /wise\.com/i,
    /mercury/i, /brex/i, /@.*bank/i,
  ];
  for (const pattern of financialPatterns) {
    if (pattern.test(subject)) {
      return { id, from, subject, reason: 'Financial notification', priority: 'high', amount };
    }
  }
  for (const pattern of financialSenders) {
    if (pattern.test(from)) {
      return { id, from, subject, reason: `From ${from.split('<')[0].trim()}`, priority: 'high', amount };
    }
  }

  // Priority: High - Meeting/Calendar
  const meetingPatterns = [
    /meeting (request|invite|invitation)/i, /calendar invite/i,
    /event invitation/i, /interview scheduled/i, /you('ve| have) been invited/i,
  ];
  for (const pattern of meetingPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Meeting invitation', priority: 'high' };
    }
  }

  // Priority: Medium - Gmail IMPORTANT label
  if (labels.includes('IMPORTANT')) {
    return { id, from, subject, reason: 'Marked important by Gmail', priority: 'medium', amount };
  }

  // Priority: Medium - Large amounts (>$500)
  if (amount) {
    const numericAmount = parseFloat(amount.replace(/[$\u20AC\u00A3,]/g, ''));
    if (numericAmount >= 500) {
      return { id, from, subject, reason: `Contains amount: ${amount}`, priority: 'high', amount };
    }
  }

  return null;
}

async function runImportantEmailCheck() {
  safeLog.log('[Email] Checking for important emails...');
  const results: ImportantEmailResult[] = [];
  const newInboxItems: string[] = [];

  let emailAccounts: string[] = [];
  try {
    const gogAuthRaw = await new Promise<string>((resolve) => {
      exec('/opt/homebrew/bin/gog auth list --json', { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }, (error, stdout) => {
        resolve(error ? '' : stdout);
      });
    });
    if (gogAuthRaw) {
      const gogData = JSON.parse(gogAuthRaw);
      const gmailAccts = (gogData.accounts || [])
        .filter((a: any) => a.services?.includes('gmail'))
        .map((a: any) => a.email);
      if (gmailAccts.length > 0) emailAccounts = gmailAccts;
    }
  } catch (e) {
    safeLog.error('[Email] Failed to discover email accounts from gog, using defaults:', e);
  }

  for (const acct of emailAccounts) {
    try {
      const output = await new Promise<string>((resolve) => {
        exec(
          `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread newer_than:1d" --json --limit 20`,
          { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } },
          (error, stdout) => {
            if (error) resolve('[]');
            else resolve(stdout);
          }
        );
      });

      const emails = JSON.parse(output) || [];
      safeLog.log(`[Email] Checking ${emails.length} emails from ${acct}`);

      for (const email of emails) {
        const id = email.id || email.ID || email.threadId;
        if (!id || processedEmailIds.has(id)) continue;

        const important = detectImportantEmail(email);
        if (important) {
          results.push(important);
          processedEmailIds.add(id);

          const title = important.amount
            ? `${important.subject.slice(0, 50)} (${important.amount})`
            : important.subject.slice(0, 60);
          const content = `From: ${important.from}\nReason: ${important.reason}\nAccount: ${acct}`;

          try {
            prepare(
              "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES (?, ?, ?, ?, 'pending', 'email', datetime('now'))"
            ).run('email', title, content, `${important.priority} priority`);
            safeLog.log(`[Email] Created inbox item: ${title}`);
          } catch (err: any) {
            safeLog.error('[Email] Failed to create inbox item:', err);
          }

          newInboxItems.push(title);
        }
      }
    } catch (e) {
      safeLog.error(`[Email] Error checking ${acct}:`, e);
    }
  }

  saveProcessedEmails();

  if (newInboxItems.length > 0) {
    sendToRenderer('inbox-updated', { newItems: newInboxItems.length });
  }

  safeLog.log(`[Email] Found ${results.length} important emails, created ${newInboxItems.length} inbox items`);
  return { success: true, found: results.length, created: newInboxItems.length, items: results };
}

let emailCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start email auto-check timer. Call from main.ts app.on('ready').
 */
export function startEmailAutoCheck(): void {
  if (emailCheckInterval) clearInterval(emailCheckInterval);

  setTimeout(() => {
    safeLog.log('[Email] Running initial important email check...');
    runImportantEmailCheck();
  }, 30000);

  emailCheckInterval = setInterval(() => {
    safeLog.log('[Email] Running periodic important email check...');
    runImportantEmailCheck();
  }, 10 * 60 * 1000);
}

// ── Smart folder rule evaluator ──────────────────────────────────────────────

function evaluateRuleSimple(rule: any, data: any): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map((cond: any) => {
    let result = false;

    switch (cond.type) {
      case 'sender_matches':
        result = data.sender ? data.sender.includes(cond.value) : false;
        break;
      case 'sender_name_contains':
        result = data.senderName ? data.senderName.toLowerCase().includes(String(cond.value).toLowerCase()) : false;
        break;
      case 'content_contains':
        result = data.content ? data.content.toLowerCase().includes(String(cond.value).toLowerCase()) : false;
        break;
      case 'platform_is':
        result = data.platform ? data.platform.toLowerCase() === String(cond.value).toLowerCase() : false;
        break;
      case 'priority_above':
        result = data.priorityScore !== undefined ? data.priorityScore > Number(cond.value) : false;
        break;
      case 'priority_below':
        result = data.priorityScore !== undefined ? data.priorityScore < Number(cond.value) : false;
        break;
      case 'is_urgent':
        result = Boolean(data.isUrgent);
        break;
      case 'has_attachment':
        result = Boolean(data.hasAttachment);
        break;
      default:
        result = false;
    }

    return cond.negate ? !result : result;
  });

  return rule.operator === 'AND' ? results.every((r: boolean) => r) : results.some((r: boolean) => r);
}

// ── Register all comms handlers ──────────────────────────────────────────────

export function registerCommsHandlers(): void {

  // ── Inbox handlers (18) ──────────────────────────────────────────────────

  registerHandler('inbox:addWithMetadata', async (_, item: {
    type: string; title: string; content: string; context?: string; channel?: string; metadata?: string;
  }) => {
    safeLog.log('[Inbox:addWithMetadata] Adding item:', item.title);
    try {
      prepare(
        "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))"
      ).run(item.type, item.title, item.content, item.context || '', item.channel || 'system', item.metadata || '{}');
      safeLog.log('[Inbox:addWithMetadata] Added successfully');
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Inbox:addWithMetadata] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('inbox:list', async (_, status?: string) => {
    const effectiveStatus = status || 'pending';
    try {
      safeLog.log('[Inbox:list] Executing parameterized query for status:', effectiveStatus);
      const items = prepare('SELECT * FROM inbox WHERE status = ? ORDER BY created DESC LIMIT 50').all(effectiveStatus);
      safeLog.log('[Inbox:list] SUCCESS - Found', (items as any[]).length, 'items with status:', effectiveStatus);
      return { success: true, items };
    } catch (error: any) {
      safeLog.error('[Inbox:list] Error:', error);
      return { success: false, items: [], error: error.message };
    }
  });

  registerHandler('inbox:add', async (_, item: { type: string; title: string; content: string; context?: string; channel?: string }) => {
    const injectionScriptPath = path.join(SCRIPTS_DIR, 'injection-detect.sh');
    return new Promise((resolve) => {
      const contentBase64 = Buffer.from(item.content).toString('base64');
      const detectCmd = `echo "${contentBase64}" | base64 -d | ${injectionScriptPath}`;
      exec(detectCmd, { timeout: 5000 }, (detectError, detectStdout) => {
        let injectionResult = null;
        try {
          if (detectStdout) {
            injectionResult = JSON.parse(detectStdout.trim());
            safeLog.log('[Inbox] Injection detection result:', injectionResult);
          }
        } catch (e) {
          safeLog.error('[Inbox] Failed to parse injection detection result:', e);
        }
        const metadata: any = {};
        if (injectionResult && injectionResult.detected) {
          metadata.injectionWarning = {
            detected: true, type: injectionResult.type,
            pattern: injectionResult.pattern, risk: injectionResult.risk,
          };
          safeLog.log(`[Inbox] INJECTION DETECTED: ${injectionResult.type} (${injectionResult.risk}) - pattern: "${injectionResult.pattern}"`);
        }
        try {
          prepare(
            "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))"
          ).run(item.type, item.title, item.content, item.context || '', item.channel || 'unknown', JSON.stringify(metadata));
          resolve({ success: true, injectionWarning: injectionResult?.detected ? injectionResult : null });
        } catch (error: any) {
          safeLog.error('[Inbox] Add error:', error);
          resolve({ success: false, error: error.message });
        }
      });
    });
  });

  registerHandler('inbox:update', async (_, id: number | string, updates: { status?: string; feedback?: string }) => {
    safeLog.log('[Inbox:update] Called with id:', id, 'type:', typeof id, 'updates:', updates);
    if (typeof id === 'string' && id.startsWith('task-review-')) {
      safeLog.log('[Inbox:update] Skipping task-review item');
      return { success: true, skipped: true };
    }
    try {
      const setClauses: string[] = [];
      const params: any[] = [];
      if (updates.status) { setClauses.push('status = ?'); params.push(updates.status); }
      if (updates.feedback) { setClauses.push('feedback = ?'); params.push(updates.feedback); }
      if (updates.status) { setClauses.push("reviewed_at = datetime('now')"); }
      if (setClauses.length === 0) return { success: false };
      params.push(id);
      prepare(`UPDATE inbox SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Inbox:update] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('inbox:approveAll', async () => {
    try {
      const countRow = prepare("SELECT COUNT(*) as cnt FROM inbox WHERE status = 'pending'").get() as any;
      const count = countRow?.cnt || 0;
      prepare("UPDATE inbox SET status = 'approved', reviewed_at = datetime('now') WHERE status = 'pending'").run();
      return { success: true, count };
    } catch (error: any) {
      safeLog.error('[Inbox:approveAll] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('inbox:listRevisions', async () => {
    try {
      const items = prepare("SELECT * FROM inbox WHERE status = 'needs-revision' ORDER BY created DESC").all();
      return { success: true, items };
    } catch (error: any) {
      safeLog.error('[Inbox] List revisions error:', error);
      return { success: false, items: [] };
    }
  });

  registerHandler('inbox:submitRevision', async (_, originalId: number, revisedContent: string, revisedTitle?: string) => {
    safeLog.log(`[Inbox] Submit revision for item ${originalId}`);
    try {
      const original = prepare('SELECT * FROM inbox WHERE id = ?').get(originalId) as any;
      if (!original) return { success: false, error: 'Original item not found' };
      const newTitle = revisedTitle || `[Revised] ${original.title}`;
      const context = `Revision of inbox item #${originalId}. Original feedback: ${original.feedback || 'none'}`;
      prepare(
        "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))"
      ).run(original.type, newTitle, revisedContent, context, original.source_channel || 'revision');
      try {
        prepare("UPDATE inbox SET status = 'revised', reviewed_at = datetime('now') WHERE id = ?").run(originalId);
      } catch (updateErr: any) {
        safeLog.error('[Inbox] Update original error:', updateErr);
      }
      safeLog.log(`[Inbox] Revision submitted: original #${originalId} -> new pending item`);
      sendToRenderer('inbox-updated', { revision: true, originalId });
      return { success: true, message: 'Revision submitted for approval' };
    } catch (error: any) {
      safeLog.error('[Inbox] Revision error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('inbox:getRevisionContext', async (_, itemId: number) => {
    try {
      const item = prepare("SELECT * FROM inbox WHERE id = ? AND status = 'needs-revision'").get(itemId) as any;
      if (!item) return { success: false, error: 'Item not found or not in needs-revision status' };
      return {
        success: true,
        item: {
          id: item.id, type: item.type, title: item.title,
          originalContent: item.content, feedback: item.feedback,
          context: item.context, created: item.created, sourceChannel: item.source_channel,
        }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  registerHandler('inbox:toggleStar', async (_, messageId: string) => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh toggle-star "${messageId}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try { resolve(JSON.parse(stdout)); } catch { resolve({ success: false, error: 'Failed to parse response' }); }
      });
    });
  });

  registerHandler('inbox:markRead', async (_, messageId: string, isRead: boolean = true) => {
    try { prepare('UPDATE comms_cache SET is_read = ? WHERE external_id = ?').run(isRead ? 1 : 0, messageId); } catch { /* best-effort */ }
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh mark-read "${messageId}" "${isRead ? '1' : '0'}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try { resolve(JSON.parse(stdout)); } catch { resolve({ success: false, error: 'Failed to parse response' }); }
      });
    });
  });

  registerHandler('inbox:addTag', async (_, messageId: string, tag: string) => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh add-tag "${messageId}" "${tag}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try { resolve(JSON.parse(stdout)); } catch { resolve({ success: false, error: 'Failed to parse response' }); }
      });
    });
  });

  registerHandler('inbox:removeTag', async (_, messageId: string, tag: string) => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh remove-tag "${messageId}" "${tag}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try { resolve(JSON.parse(stdout)); } catch { resolve({ success: false, error: 'Failed to parse response' }); }
      });
    });
  });

  registerHandler('inbox:setProject', async (_, messageId: string, project: string) => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh set-project "${messageId}" "${project}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try { resolve(JSON.parse(stdout)); } catch { resolve({ success: false, error: 'Failed to parse response' }); }
      });
    });
  });

  registerHandler('inbox:search', async (_, query: string, limit: number = 50) => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh search "${query}" ${limit}`;
      exec(cmd, { timeout: 10000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try {
          const results = stdout.trim().split('\n').filter(Boolean);
          resolve({ success: true, results });
        } catch { resolve({ success: false, error: 'Failed to parse search results' }); }
      });
    });
  });

  registerHandler('inbox:filter', async (_, criteria: any) => {
    return new Promise((resolve) => {
      try {
        const result = execSync(
          `${path.join(SCRIPTS_DIR, 'inbox-filter.sh')} filter`,
          { input: JSON.stringify(criteria), encoding: 'utf-8', timeout: 10000 }
        );
        const results = result.trim().split('\n').filter(Boolean);
        resolve({ success: true, results });
      } catch (error: any) {
        resolve({ success: false, error: error.message || 'Filter failed' });
      }
    });
  });

  registerHandler('inbox:getSuggestions', async (_, type: 'senders' | 'projects' | 'tags' | 'platforms') => {
    return new Promise((resolve) => {
      const cmd = `${SCRIPTS_DIR}/inbox-filter.sh suggestions ${type}`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        try {
          const suggestions = stdout.trim().split('\n').filter(Boolean);
          resolve({ success: true, suggestions });
        } catch { resolve({ success: false, error: 'Failed to parse suggestions' }); }
      });
    });
  });

  registerHandler('inbox:check-history', async () => {
    try {
      const inboxLauncherPath = path.join(TOOLS_DIR, 'inbox-launcher.js');
      const result = await runMsgCmd(`node "${inboxLauncherPath}" check`, 5000);
      const status = JSON.parse(result);
      safeLog.log('[Inbox] Historical data check:', status);
      return { success: true, ...status };
    } catch (e: any) {
      safeLog.error('[Inbox] Historical data check failed:', e);
      return { success: false, error: e.message };
    }
  });

  registerHandler('inbox:trigger-backfill', async (_, days = 60) => {
    try {
      const inboxLauncherPath = path.join(TOOLS_DIR, 'inbox-launcher.js');
      safeLog.log('[Inbox] Triggering historical backfill:', days, 'days');
      exec(`node "${inboxLauncherPath}" ensure`, (error, stdout) => {
        if (error) { safeLog.error('[Inbox] Backfill trigger error:', error); }
        else { safeLog.log('[Inbox] Backfill triggered:', stdout); }
      });
      return { success: true, message: 'Backfill started in background' };
    } catch (e: any) {
      safeLog.error('[Inbox] Backfill trigger failed:', e);
      return { success: false, error: e.message };
    }
  });

  // ── Messages handlers (4) ────────────────────────────────────────────────

  registerHandler('messages:recent', async (_, limit?: number, includeArchived = false) => {
    safeLog.log('[Messages] Handler called, limit:', limit, 'includeArchived:', includeArchived);
    const lim = limit || 10;

    let archivedKeys: Set<string> = new Set();
    if (!includeArchived) {
      try {
        const archivedRaw = await runMsgCmd(`sqlite3 "${FROGGO_DB}" "SELECT session_key FROM conversation_folders WHERE folder_id = 4"`, 3000);
        if (archivedRaw) {
          const keys = archivedRaw.trim().split('\n').filter((k: string) => k.length > 0);
          archivedKeys = new Set<string>(keys);
          safeLog.log(`[Messages] Found ${archivedKeys.size} archived conversations to filter`);
        }
      } catch (e) {
        safeLog.error('[Messages] Error fetching archived conversations:', e);
      }
    }

    const getSessionKey = (m: any): string => `${m.platform}:${m.from || m.sender}`;

    const cacheAge = await getCommsCacheAge();
    safeLog.log(`[Messages] Cache age: ${Math.round(cacheAge / 1000)}s`);

    if (cacheAge < COMMS_CACHE_TTL_MS) {
      const cached = await getCommsFromCache(lim);
      if (cached && cached.length > 0) {
        const filtered = cached.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
        safeLog.log(`[Messages] Returning ${filtered.length} messages from cache (${cached.length - filtered.length} archived filtered)`);
        return { success: true, chats: filtered, fromCache: true, cacheAge: Math.round(cacheAge / 1000) };
      }
    }

    const staleCache = await getCommsFromCache(lim);
    if (staleCache && staleCache.length > 0) {
      const filtered = staleCache.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
      safeLog.log(`[Messages] Returning ${filtered.length} from stale cache, triggering background refresh`);
      refreshCommsBackground().catch(e => safeLog.error('[Messages] Background refresh failed:', e));
      return { success: true, chats: filtered, fromCache: true, refreshing: true };
    }

    safeLog.log('[Messages] No cache, doing synchronous fetch...');
    await refreshCommsBackground();
    const freshCache = await getCommsFromCache(lim);
    if (freshCache && freshCache.length > 0) {
      const filtered = freshCache.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
      return { success: true, chats: filtered, fromCache: false };
    }
    return { success: true, chats: [], fromCache: false };
  });

  registerHandler('messages:context', async (_, messageId: string, platform: string, limit?: number) => {
    const lim = limit || 5;
    const messages: any[] = [];

    const runCmd = (cmd: string, timeout = 10000): Promise<string> => {
      return new Promise((resolve) => {
        exec(cmd, { timeout, env: { ...process.env, PATH: `${SHELL_PATH}:${process.env.PATH || ''}` } }, (error, stdout) => {
          if (error) resolve('');
          else resolve(stdout);
        });
      });
    };

    try {
      if (platform === 'whatsapp') {
        const jid = messageId.replace('wa-', '');
        const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
        const nameQuery = `SELECT COALESCE(c.push_name, c.full_name, m.chat_name, 'Unknown') as name FROM messages m LEFT JOIN contacts c ON m.chat_jid = c.jid WHERE m.chat_jid='${jid}' LIMIT 1`;
        const nameRaw = await runCmd(`sqlite3 "${waDbPath}" "${nameQuery}"`, 3000);
        const contactName = nameRaw?.trim() || 'Unknown';
        const query = `SELECT text, from_me, datetime(ts, 'unixepoch', 'localtime') as time FROM messages WHERE chat_jid='${jid}' ORDER BY ts DESC LIMIT ${lim}`;
        const raw = await runCmd(`sqlite3 "${waDbPath}" "${query}" -json`, 5000);
        if (raw) {
          try {
            const rows = JSON.parse(raw);
            for (const row of rows.reverse()) {
              messages.push({ sender: row.from_me ? 'You' : contactName, text: row.text || '', timestamp: row.time || '', fromMe: !!row.from_me });
            }
          } catch (e) { safeLog.error('[History] Failed to parse WhatsApp messages:', e); }
        }
      } else if (platform === 'telegram') {
        const chatId = messageId.replace('tg-', '');
        const raw = await runCmd(`${TGCLI} messages ${chatId} --limit ${lim}`, 5000);
        if (raw) {
          const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
          for (const line of lines) {
            const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
            if (match) {
              messages.push({ sender: match[2].trim(), text: match[3].trim(), timestamp: match[1], fromMe: match[2].trim() === 'You' });
            }
          }
        }
      } else if (platform === 'discord') {
        const channelId = messageId.replace('discord-', '');
        const raw = await runCmd(`${DISCORDCLI} messages ${channelId} --limit ${lim}`, 5000);
        if (raw) {
          const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
          for (const line of lines) {
            const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
            if (match) {
              messages.push({ sender: match[2].trim(), text: match[3].trim(), timestamp: match[1], fromMe: match[2].trim() === 'prof_froggo' });
            }
          }
        }
      }
      return { success: true, messages };
    } catch (e: any) {
      safeLog.error('[Messages:Context] Error:', e);
      return { success: false, messages: [], error: e.message };
    }
  });

  registerHandler('messages:send', async (_, { platform, to, message }: { platform: string; to: string; message: string }) => {
    const PATHS = {
      wacli: '/opt/homebrew/bin/wacli',
      tgcli: '~/.local/bin/tgcli',
      gog: '/opt/homebrew/bin/gog'
    };
    const escapeShell = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
    try {
      let result: string;
      switch (platform) {
        case 'whatsapp':
          result = execSync(`${PATHS.wacli} send ${escapeShell(to)} ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
          break;
        case 'telegram':
          result = execSync(`${PATHS.tgcli} send ${escapeShell(to)} ${escapeShell(message)} --yes`, { encoding: 'utf-8', timeout: 30000 });
          break;
        case 'email':
          result = execSync(`${PATHS.gog} gmail send --to ${escapeShell(to)} --body ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
          break;
        case 'discord':
          result = execSync(`openclaw message send --channel discord --to ${escapeShell(to)} --message ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
          break;
        default:
          return { success: false, error: `Unknown platform: ${platform}` };
      }
      safeLog.log(`[Messages:Send] Sent to ${platform}:${to}:`, result);
      return { success: true, result };
    } catch (e: any) {
      safeLog.error('[Messages:Send] Error:', e);
      return { success: false, error: e.message };
    }
  });

  registerHandler('messages:unread', async () => {
    safeLog.log('[Messages:Unread] Handler called');
    try {
      const result = prepare(`
        SELECT
          COUNT(*) as total_unread,
          SUM(CASE WHEN platform = 'whatsapp' AND is_read = 0 THEN 1 ELSE 0 END) as whatsapp_unread,
          SUM(CASE WHEN platform = 'telegram' AND is_read = 0 THEN 1 ELSE 0 END) as telegram_unread,
          SUM(CASE WHEN platform = 'discord' AND is_read = 0 THEN 1 ELSE 0 END) as discord_unread,
          SUM(CASE WHEN platform = 'email' AND is_read = 0 THEN 1 ELSE 0 END) as email_unread
        FROM message_read_state
        WHERE is_read = 0
      `).get() as any;
      const byPlatform: { [key: string]: number } = {};
      if (result.whatsapp_unread > 0) byPlatform['whatsapp'] = result.whatsapp_unread;
      if (result.telegram_unread > 0) byPlatform['telegram'] = result.telegram_unread;
      if (result.discord_unread > 0) byPlatform['discord'] = result.discord_unread;
      if (result.email_unread > 0) byPlatform['email'] = result.email_unread;
      safeLog.log('[Messages:Unread] Total:', result.total_unread, 'By platform:', byPlatform);
      return { success: true, count: result.total_unread || 0, byPlatform };
    } catch (e: any) {
      safeLog.error('[Messages:Unread] Error:', e);
      return { success: false, count: 0, error: e.message };
    }
  });

  // ── Conversations handlers (6) ───────────────────────────────────────────

  registerHandler('conversations:archive', async (_, sessionKey: string) => {
    safeLog.log('[Conversations] Archive:', sessionKey);
    const ARCHIVE_FOLDER_ID = 4;
    try {
      prepare('INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, added_by) VALUES (?, ?, ?)').run(ARCHIVE_FOLDER_ID, sessionKey, 'user');
      safeLog.log('[Conversations] Archived:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Conversations] Archive error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('conversations:unarchive', async (_, sessionKey: string) => {
    safeLog.log('[Conversations] Unarchive:', sessionKey);
    const ARCHIVE_FOLDER_ID = 4;
    try {
      prepare('DELETE FROM conversation_folders WHERE folder_id = ? AND session_key = ?').run(ARCHIVE_FOLDER_ID, sessionKey);
      safeLog.log('[Conversations] Unarchived:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Conversations] Unarchive error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('conversations:archived', async () => {
    safeLog.log('[Conversations] Get archived list');
    const ARCHIVE_FOLDER_ID = 4;
    try {
      const conversations = prepare(
        `SELECT cf.session_key, cf.added_at, COUNT(c.id) as message_count, MAX(c.timestamp) as last_message
         FROM conversation_folders cf
         LEFT JOIN comms_cache c ON (c.platform || ':' || c.sender) = cf.session_key
         WHERE cf.folder_id = ?
         GROUP BY cf.session_key
         ORDER BY cf.added_at DESC`
      ).all(ARCHIVE_FOLDER_ID);
      safeLog.log(`[Conversations] Found ${conversations.length} archived conversations`);
      return { success: true, conversations };
    } catch (error: any) {
      safeLog.error('[Conversations] Archived list error:', error);
      return { success: false, conversations: [] };
    }
  });

  registerHandler('conversations:isArchived', async (_, sessionKey: string) => {
    const ARCHIVE_FOLDER_ID = 4;
    try {
      const row = prepare('SELECT COUNT(*) as count FROM conversation_folders WHERE folder_id = ? AND session_key = ?').get(ARCHIVE_FOLDER_ID, sessionKey) as any;
      return { isArchived: (row?.count || 0) > 0 };
    } catch {
      return { isArchived: false };
    }
  });

  registerHandler('conversations:markRead', async (_, sessionKey: string) => {
    safeLog.log('[Conversations] Mark as read:', sessionKey);
    try {
      prepare("UPDATE comms_cache SET is_read = 1 WHERE (platform || ':' || sender) = ? AND (is_read IS NULL OR is_read = 0)").run(sessionKey);
      safeLog.log('[Conversations] Marked as read:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Conversations] Mark read error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('conversations:delete', async (_, sessionKey: string) => {
    safeLog.log('[Conversations] Delete:', sessionKey);
    try {
      db.transaction(() => {
        prepare('DELETE FROM conversation_folders WHERE session_key = ?').run(sessionKey);
        prepare("DELETE FROM comms_cache WHERE (platform || ':' || sender) = ?").run(sessionKey);
        prepare('DELETE FROM conversation_snoozes WHERE session_id = ?').run(sessionKey);
        prepare('DELETE FROM conversation_pins WHERE session_key = ?').run(sessionKey);
        try { prepare('DELETE FROM notification_settings WHERE session_key = ?').run(sessionKey); } catch { /* table may not exist */ }
      })();
      safeLog.log('[Conversations] Deleted:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Conversations] Delete error:', error);
      return { success: false, error: error.message };
    }
  });

  // ── VIP handlers (5) ─────────────────────────────────────────────────────

  registerHandler('vip:list', async (_, category?: string) => {
    return new Promise((resolve) => {
      let cmd = `froggo-db vip-list --json`;
      if (category) cmd += ` --category "${category}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve([]); return; }
        try { resolve(JSON.parse(stdout || '[]')); } catch { resolve([]); }
      });
    });
  });

  registerHandler('vip:add', async (_, data: {
    identifier: string; label: string; type?: string; category?: string; boost?: number; notes?: string;
  }) => {
    return new Promise((resolve) => {
      const type = data.type || 'email';
      const boost = data.boost || 30;
      let cmd = `froggo-db vip-add "${data.identifier}" "${data.label}" --type "${type}" --boost ${boost}`;
      if (data.category) cmd += ` --category "${data.category}"`;
      if (data.notes) cmd += ` --notes "${data.notes}"`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        const idMatch = stdout.match(/ID: (\d+)/);
        const vipId = idMatch ? parseInt(idMatch[1]) : null;
        resolve({ success: true, id: vipId, message: 'VIP added successfully' });
      });
    });
  });

  registerHandler('vip:update', async (_, id: number, updates: {
    label?: string; boost?: number; category?: string; notes?: string;
  }) => {
    return new Promise((resolve) => {
      let cmd = `froggo-db vip-update ${id}`;
      if (updates.label) cmd += ` --label "${updates.label}"`;
      if (updates.boost !== undefined) cmd += ` --boost ${updates.boost}`;
      if (updates.category) cmd += ` --category "${updates.category}"`;
      if (updates.notes) cmd += ` --notes "${updates.notes}"`;
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        resolve({ success: true, message: 'VIP updated successfully' });
      });
    });
  });

  registerHandler('vip:remove', async (_, id: number) => {
    return new Promise((resolve) => {
      const cmd = `froggo-db vip-remove ${id}`;
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) { resolve({ success: false, error: error.message }); return; }
        resolve({ success: true, message: 'VIP removed successfully' });
      });
    });
  });

  registerHandler('vip:check', async (_, identifier: string) => {
    return new Promise((resolve) => {
      const cmd = `froggo-db vip-check "${identifier}" --json`;
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve(null); return; }
        try {
          const result = JSON.parse(stdout || '{"vip":false}');
          resolve(result.vip === false ? null : result);
        } catch { resolve(null); }
      });
    });
  });

  // ── Email handlers (7) ───────────────────────────────────────────────────

  registerHandler('email:send', async (_, options: { to: string; subject: string; body: string; account?: string }) => {
    safeLog.log('[Email:send] Sending email to:', options.to);
    if (!options.to || !options.to.trim()) {
      safeLog.error('[Email:send] Missing recipient');
      return { success: false, error: 'Missing email recipient' };
    }
    if (!options.account || !options.account.trim()) {
      safeLog.error('[Email:send] Missing account - cannot send without GOG_ACCOUNT');
      return { success: false, error: 'Missing account - please specify which email account to send from' };
    }
    return new Promise((resolve) => {
      const escapedTo = options.to.replace(/"/g, '\\"');
      const escapedSubject = (options.subject || 'No Subject').replace(/"/g, '\\"');
      const escapedBody = options.body.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      const cmd = `GOG_ACCOUNT="${options.account}" gog gmail send --to "${escapedTo}" --subject "${escapedSubject}" --body "${escapedBody}"`;
      safeLog.log('[Email:send] Command:', cmd.slice(0, 100) + '...');
      exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[Email:send] Error:', error.message, stderr);
          resolve({ success: false, error: error.message });
        } else {
          safeLog.log('[Email:send] Sent successfully:', stdout);
          resolve({ success: true, output: stdout });
        }
      });
    });
  });

  registerHandler('email:accounts', async () => {
    return new Promise((resolve) => {
      exec('/opt/homebrew/bin/gog auth list --json', { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error || !stdout) { resolve({ success: true, accounts: [] }); return; }
        try {
          const data = JSON.parse(stdout);
          const gmailAccounts = (data.accounts || [])
            .filter((a: any) => a.services?.includes('gmail'))
            .map((a: any) => ({ email: a.email, label: a.email.split('@')[0] }));
          resolve({ success: true, accounts: gmailAccounts });
        } catch { resolve({ success: true, accounts: [] }); }
      });
    });
  });

  registerHandler('email:unread', async (_, account?: string) => {
    if (!account) return { success: false, emails: [], error: 'No email account specified' };
    const acct = account;
    const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread" --json --limit 20`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) {
          safeLog.error('[Email] Unread error:', error);
          resolve({ success: false, emails: [], error: error.message });
          return;
        }
        try { resolve({ success: true, emails: JSON.parse(stdout), account: acct }); }
        catch { resolve({ success: true, emails: [], raw: stdout, account: acct }); }
      });
    });
  });

  registerHandler('email:body', async (_, emailId: string, account?: string) => {
    const envPath = `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`;
    let tryAccounts: string[] = account ? [account] : [];
    if (!account) {
      try {
        const gogList = execSync('/opt/homebrew/bin/gog auth list --json', { timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }).toString();
        const gogData = JSON.parse(gogList);
        tryAccounts = (gogData.accounts || []).filter((a: any) => a.services?.includes('gmail')).map((a: any) => a.email);
      } catch (err) { safeLog.debug('[Email] Failed to get accounts for email body:', err); }
    }
    for (const acct of tryAccounts) {
      for (const subcmd of [`gmail read ${emailId}`, `gmail thread get ${emailId}`]) {
        try {
          const stdout = await new Promise<string>((resolve, reject) => {
            exec(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog ${subcmd}`, { timeout: 30000, env: { ...process.env, PATH: envPath } }, (error, stdout) => {
              if (error) reject(error);
              else resolve(stdout);
            });
          });
          if (stdout && stdout.length > 10) {
            safeLog.log(`[Email] Body loaded for ${emailId} via ${subcmd} (${acct})`);
            return { success: true, body: stdout, emailId };
          }
        } catch (_e) { /* try next */ }
      }
    }
    safeLog.error(`[Email] Body failed for ${emailId}, tried ${tryAccounts.length} accounts`);
    return { success: false, body: '', error: 'Could not load email body from any account' };
  });

  registerHandler('email:search', async (_, query: string, account?: string) => {
    if (!account) return { success: false, emails: [], error: 'No email account specified' };
    const acct = account;
    const escapedQuery = query.replace(/"/g, '\\"');
    const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "${escapedQuery}" --json --limit 20`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) {
          safeLog.error('[Email] Search error:', error);
          resolve({ success: false, emails: [], error: error.message });
          return;
        }
        try { resolve({ success: true, emails: JSON.parse(stdout), account: acct }); }
        catch { resolve({ success: true, emails: [], raw: stdout, account: acct }); }
      });
    });
  });

  registerHandler('email:queue-send', async (_, to: string, subject: string, body: string, account?: string) => {
    const acct = account || getDefaultGogEmail();
    const title = `Email to ${to}: ${subject.slice(0, 30)}`;
    const content = `To: ${to}\nSubject: ${subject}\nAccount: ${acct}\n\n${body}`;
    const cmd = `/opt/homebrew/bin/froggo-db inbox-add --type email --title "${title.replace(/"/g, '\\"')}" --content "${content.replace(/"/g, '\\"')}" --channel dashboard`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error) => {
        if (error) {
          safeLog.error('[Email] Queue error:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        resolve({ success: true, message: 'Email queued for approval in Inbox' });
      });
    });
  });

  registerHandler('email:checkImportant', async () => {
    return runImportantEmailCheck();
  });

  // ── Search handlers (3) ──────────────────────────────────────────────────

  registerHandler('search:discord', async () => {
    return { success: false, messages: [], note: 'Discord search not available (CLI limitation)' };
  });

  registerHandler('search:telegram', async (_, query: string) => {
    return new Promise((resolve) => {
      const escapedQuery = query.replace(/"/g, '\\"');
      const cmd = `tgcli search "${escapedQuery}" --json 2>/dev/null || echo '{"chats":[]}'`;
      exec(cmd, { timeout: 15000 }, (error, stdout) => {
        if (error) { resolve({ success: false, chats: [], note: 'Telegram search failed' }); return; }
        try {
          const result = JSON.parse(stdout || '{"chats":[]}');
          const chats = result.chats || result || [];
          resolve({
            success: true,
            messages: Array.isArray(chats) ? chats.map((c: any) => ({
              id: c.id, type: 'chat', content: `Chat: ${c.name || c.title}`, from: c.name || c.title,
            })) : [],
            note: 'Searches chat names only'
          });
        } catch { resolve({ success: true, messages: [], raw: stdout }); }
      });
    });
  });

  registerHandler('search:whatsapp', async (_, query: string) => {
    return new Promise((resolve) => {
      const escapedQuery = query.replace(/"/g, '\\"');
      const cmd = `wacli messages search "${escapedQuery}" --json --limit 10`;
      exec(cmd, { timeout: 15000 }, (error, stdout) => {
        if (error) { resolve({ success: false, messages: [], error: error.message }); return; }
        try {
          const result = JSON.parse(stdout || '{}');
          const messages = result.data?.messages || [];
          resolve({
            success: true,
            messages: messages.map((m: any) => ({
              id: m.MsgID, content: m.Text || m.DisplayText, from: m.ChatName,
              timestamp: m.Timestamp, body: m.Text,
            }))
          });
        } catch { resolve({ success: true, messages: [], raw: stdout }); }
      });
    });
  });
}
