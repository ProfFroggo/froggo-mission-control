/**
 * CommsInbox3Pane - Proper 3-pane communications inbox
 *
 * LEFT: Account/folder selector (Gmail accounts, WhatsApp, Telegram, Discord, System)
 * CENTER: Message/conversation list for selected account
 * RIGHT: Message detail view with thread and reply
 */

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  Mail, MessageCircle, Send, Gamepad2,
  Inbox, Star, Archive, AlertTriangle,
  RefreshCw, ChevronRight, ChevronDown, Search,
  Reply, ReplyAll, Forward, MoreHorizontal,
  Sparkles, X, Paperclip, Eye, Check, MailOpen,
  Activity as ActivityIcon, ChevronUp, FileText, Code,
  CalendarPlus, ListPlus
} from 'lucide-react';
import { showToast } from './Toast';
import { gateway } from '../lib/gateway';
import { useStore, Activity } from '../store/store';
import MarkdownMessage from './MarkdownMessage';

// X logo
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  label: string;
  platform: 'email' | 'whatsapp' | 'telegram' | 'discord' | 'twitter' | 'system';
  address?: string; // email address or phone number
  icon: React.ReactNode;
  color: string;
}

interface Folder {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  filter: (msg: ConversationItem) => boolean;
}

interface ConversationItem {
  id: string;
  platform: string;
  account?: string; // email address for email messages
  from?: string;
  name?: string;
  subject?: string;
  preview: string;
  timestamp: string;
  relativeTime: string;
  is_read?: boolean;
  is_starred?: boolean;
  has_attachment?: boolean;
  priorityLevel?: string;
  priorityScore?: number;
  thread_id?: string;
  message_count?: number;
  unread_count?: number;
  unreplied_count?: number;
  has_reply?: boolean;
}

interface ThreadMessage {
  id: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  hasAttachment?: boolean;
}

interface EmailMetadata {
  from?: string;
  to?: string;
  cc?: string;
  date?: string;
  subject?: string;
}

interface AIAnalysis {
  triage: 'urgent' | 'action' | 'fyi' | 'no-reply';
  summary: string;
  tasks: Array<{title: string; description: string}>;
  events: Array<{title: string; date: string; time: string; duration?: string; location?: string}>;
  reply_draft: string | null;
  reply_needed: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Default email accounts (empty — populated dynamically from gateway or user settings)
const DEFAULT_EMAIL_ACCOUNTS: Account[] = [];

const PLATFORM_ICON_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  whatsapp: { icon: <MessageCircle size={16} />, color: 'text-success', label: 'WhatsApp' },
  telegram: { icon: <Send size={16} />, color: 'text-sky-400', label: 'Telegram' },
  discord: { icon: <Gamepad2 size={16} />, color: 'text-indigo-400', label: 'Discord' },
  twitter: { icon: <XIcon size={16} />, color: 'text-clawd-text-dim', label: 'X DMs' },
};

const SYSTEM_ACCOUNT: Account = {
  id: 'system',
  label: 'System',
  platform: 'system',
  icon: <ActivityIcon size={16} />,
  color: 'text-review',
};

const EMAIL_COLORS = ['text-warning', 'text-info', 'text-emerald-400', 'text-rose-400', 'text-amber-400'];

// Build accounts from gateway channels + discovered email accounts
function buildAccountsFromSources(
  channelAccounts: Record<string, Array<{ accountId: string; name?: string; connected?: boolean; enabled?: boolean; configured?: boolean; running?: boolean }>>,
  emailAccounts: Array<{ email: string; label: string }>,
): Account[] {
  const accounts: Account[] = [];

  // Email accounts from gog auth discovery (or fallback)
  emailAccounts.forEach((entry, i) => {
    accounts.push({
      id: `email-${entry.email}`,
      label: entry.label,
      platform: 'email',
      address: entry.email,
      icon: <Mail size={16} />,
      color: EMAIL_COLORS[i % EMAIL_COLORS.length],
    });
  });

  // Platform accounts from gateway — show if configured+running or connected or enabled
  for (const [platform, entries] of Object.entries(channelAccounts)) {
    if (platform === 'email') continue;
    const meta = PLATFORM_ICON_MAP[platform];
    if (!meta) continue;
    const visible = entries.some(e => e.connected || e.enabled || e.configured);
    if (visible) {
      accounts.push({
        id: platform,
        label: meta.label,
        platform: platform as Account['platform'],
        icon: meta.icon,
        color: meta.color,
      });
    }
  }

  // System always present
  accounts.push(SYSTEM_ACCOUNT);

  return accounts;
}

// Legacy fallback
function buildAccountsFallback(): Account[] {
  return [
    ...DEFAULT_EMAIL_ACCOUNTS,
    { id: 'whatsapp', label: 'WhatsApp', platform: 'whatsapp', icon: <MessageCircle size={16} />, color: 'text-success' },
    { id: 'telegram', label: 'Telegram', platform: 'telegram', icon: <Send size={16} />, color: 'text-sky-400' },
    { id: 'discord', label: 'Discord', platform: 'discord', icon: <Gamepad2 size={16} />, color: 'text-indigo-400' },
    { id: 'twitter', label: 'X DMs', platform: 'twitter', icon: <XIcon size={16} />, color: 'text-clawd-text-dim' },
    SYSTEM_ACCOUNT,
  ];
}

const FOLDERS: Folder[] = [
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} />, filter: () => true },
  { id: 'unread', label: 'Unread', icon: <Eye size={16} />, filter: (m) => !m.is_read },
  { id: 'unreplied', label: 'Unreplied', icon: <Reply size={16} />, filter: (m) => (m.unreplied_count && m.unreplied_count > 0) || (m.has_reply === false) },
  { id: 'starred', label: 'Starred', icon: <Star size={16} />, filter: (m) => !!m.is_starred },
  { id: 'urgent', label: 'Urgent', icon: <AlertTriangle size={16} />, filter: (m) => {
    const kw = ['urgent', 'asap', 'important', 'emergency', 'critical'];
    return kw.some(k => m.preview?.toLowerCase().includes(k) || m.subject?.toLowerCase().includes(k));
  }},
  { id: 'archived', label: 'Archived', icon: <Archive size={16} />, filter: () => false }, // loaded separately
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformColor(p: string): string {
  const map: Record<string, string> = {
    email: 'text-warning', whatsapp: 'text-success', telegram: 'text-sky-400',
    discord: 'text-indigo-400', twitter: 'text-clawd-text-dim', system: 'text-review'
  };
  return map[p] || 'text-clawd-text-dim';
}

function platformIcon(platform: string, size: number) {
  switch (platform) {
    case 'email': return <Mail size={size} />;
    case 'whatsapp': return <MessageCircle size={size} />;
    case 'telegram': return <Send size={size} />;
    case 'discord': return <Gamepad2 size={size} />;
    case 'twitter': return <XIcon size={size} />;
    case 'system': return <ActivityIcon size={size} />;
    default: return null;
  }
}

// Triage badge colors
const TRIAGE_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  action: 'bg-orange-500',
  fyi: 'bg-blue-500',
  'no-reply': 'bg-clawd-bg',
};

const TRIAGE_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  action: 'Action needed',
  fyi: 'FYI',
  'no-reply': 'No reply needed',
};

// Sanitize HTML email body for safe iframe rendering
function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
}

function isHtmlEmail(body: string): boolean {
  return /<html[\s>]|<body[\s>]|<!doctype/i.test(body);
}

// Detect if a message contains HTML tags (not full email, just inline HTML like <b>, <a>, <br>, etc.)
function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text) && !isHtmlEmail(text);
}

// Sanitize inline HTML for chat messages (strip dangerous tags, keep formatting)
// SECURITY: This is a defense-in-depth measure. Input should already be trusted
// or sanitized server-side. This prevents obvious XSS vectors.
function sanitizeInlineHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/data\s*:/gi, 'blocked:');
}

// Parse email headers from body output (gog gmail read returns headers + body)
function parseEmailBodyAndMeta(raw: string): { body: string; metadata: EmailMetadata } {
  const metadata: EmailMetadata = {};
  const lines = raw.split('\n');
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    if (/^From:\s/i.test(line)) { metadata.from = line.replace(/^From:\s*/i, '').trim(); bodyStart = i + 1; }
    else if (/^To:\s/i.test(line)) { metadata.to = line.replace(/^To:\s*/i, '').trim(); bodyStart = i + 1; }
    else if (/^Cc:\s/i.test(line)) { metadata.cc = line.replace(/^Cc:\s*/i, '').trim(); bodyStart = i + 1; }
    else if (/^Date:\s/i.test(line)) { metadata.date = line.replace(/^Date:\s*/i, '').trim(); bodyStart = i + 1; }
    else if (/^Subject:\s/i.test(line)) { metadata.subject = line.replace(/^Subject:\s*/i, '').trim(); bodyStart = i + 1; }
    else if (line.trim() === '' && bodyStart > 0) { bodyStart = i + 1; break; }
  }

  const body = bodyStart > 0 ? lines.slice(bodyStart).join('\n') : raw;
  return { body, metadata };
}

// ─── Email Body Renderer ──────────────────────────────────────────────────────

function EmailBodyRenderer({ body, metadata }: { body: string; metadata: EmailMetadata }) {
  const [showHtml, setShowHtml] = useState(true);
  const htmlMode = isHtmlEmail(body);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to content height
  useEffect(() => {
    if (!htmlMode || !showHtml || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          iframe.style.height = `${doc.body.scrollHeight + 20}px`;
        }
      } catch { /* cross-origin, ignore */ }
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [htmlMode, showHtml, body]);

  const hasMetadata = metadata.from || metadata.to || metadata.date;

  return (
    <div className="bg-clawd-surface rounded-lg border border-clawd-border overflow-hidden">
      {/* Email header bar */}
      {hasMetadata && (
        <div className="px-4 py-3 border-b border-clawd-border space-y-1">
          {metadata.from && (
            <div className="flex gap-2 text-sm">
              <span className="text-clawd-text-dim w-12 flex-shrink-0">From</span>
              <span className="font-medium">{metadata.from}</span>
            </div>
          )}
          {metadata.to && (
            <div className="flex gap-2 text-sm">
              <span className="text-clawd-text-dim w-12 flex-shrink-0">To</span>
              <span>{metadata.to}</span>
            </div>
          )}
          {metadata.cc && (
            <div className="flex gap-2 text-sm">
              <span className="text-clawd-text-dim w-12 flex-shrink-0">Cc</span>
              <span className="text-clawd-text-dim">{metadata.cc}</span>
            </div>
          )}
          {metadata.date && (
            <div className="flex gap-2 text-sm">
              <span className="text-clawd-text-dim w-12 flex-shrink-0">Date</span>
              <span className="text-clawd-text-dim">{metadata.date}</span>
            </div>
          )}
          {metadata.subject && (
            <div className="flex gap-2 text-sm">
              <span className="text-clawd-text-dim w-12 flex-shrink-0">Subj</span>
              <span className="font-semibold">{metadata.subject}</span>
            </div>
          )}
        </div>
      )}

      {/* HTML/Plain toggle for HTML emails */}
      {htmlMode && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-clawd-border bg-clawd-bg/50">
          <button
            onClick={() => setShowHtml(true)}
            className={`text-xs px-2 py-0.5 rounded ${showHtml ? 'bg-clawd-accent/20 text-clawd-accent' : 'text-clawd-text-dim hover:text-clawd-text'}`}
          >
            <Code size={10} className="inline mr-1" />HTML
          </button>
          <button
            onClick={() => setShowHtml(false)}
            className={`text-xs px-2 py-0.5 rounded ${!showHtml ? 'bg-clawd-accent/20 text-clawd-accent' : 'text-clawd-text-dim hover:text-clawd-text'}`}
          >
            <FileText size={10} className="inline mr-1" />Plain
          </button>
        </div>
      )}

      {/* Body content */}
      <div className="p-4">
        {htmlMode && showHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={sanitizeEmailHtml(body)}
            sandbox="allow-same-origin"
            className="w-full border-0 min-h-[200px] bg-white rounded"
            style={{ colorScheme: 'light' }}
            title="Email content"
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {htmlMode ? body.replace(/<[^>]+>/g, '') : body}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Left Pane: Account & Folder Selector ─────────────────────────────────────

function LeftPane({
  selectedAccount,
  selectedFolder,
  onSelectAccount,
  onSelectFolder,
  accountCounts,
  folderCounts,
  accounts,
  loadingAccounts,
}: {
  selectedAccount: string | null;
  selectedFolder: string;
  onSelectAccount: (id: string | null) => void;
  onSelectFolder: (id: string) => void;
  accountCounts: Record<string, number>;
  folderCounts: Record<string, number>;
  accounts: Account[];
  loadingAccounts: boolean;
}) {
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);

  return (
    <div className="w-56 flex-shrink-0 bg-clawd-surface border-r border-clawd-border flex flex-col overflow-y-auto">
      {/* All Messages */}
      <button
        onClick={() => { onSelectAccount(null); onSelectFolder('inbox'); }}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b border-clawd-border transition-colors ${
          selectedAccount === null ? 'bg-clawd-accent/10 text-clawd-accent' : 'hover:bg-clawd-border'
        }`}
      >
        <Inbox size={16} />
        All Messages
        {Object.values(accountCounts).reduce((a, b) => a + b, 0) > 0 && (
          <span className="ml-auto bg-clawd-accent/20 text-clawd-accent text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
            {Object.values(accountCounts).reduce((a, b) => a + b, 0)}
          </span>
        )}
      </button>

      {/* Accounts Section */}
      <div className="border-b border-clawd-border">
        <button
          onClick={() => setAccountsExpanded(!accountsExpanded)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-clawd-text-dim w-full hover:bg-clawd-border/50"
        >
          {accountsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Accounts
          {loadingAccounts && <RefreshCw size={10} className="animate-spin ml-auto" />}
        </button>
        {accountsExpanded && (
          <div className="pb-2">
            {accounts.map(account => (
              <button
                key={account.id}
                onClick={() => { onSelectAccount(account.id); onSelectFolder('inbox'); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm w-full transition-colors ${
                  selectedAccount === account.id
                    ? 'bg-clawd-accent/10 text-clawd-accent border-r-2 border-clawd-accent'
                    : 'hover:bg-clawd-border/50'
                }`}
              >
                <span className={account.color}>{account.icon}</span>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="truncate w-full text-left">{account.label}</span>
                  {account.address && (
                    <span className="text-[10px] text-clawd-text-dim truncate w-full text-left">{account.address}</span>
                  )}
                </div>
                {(accountCounts[account.id] || 0) > 0 && (
                  <span className="bg-clawd-accent/20 text-clawd-accent text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {accountCounts[account.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Folders Section */}
      <div>
        <button
          onClick={() => setFoldersExpanded(!foldersExpanded)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-clawd-text-dim w-full hover:bg-clawd-border/50"
        >
          {foldersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Folders
        </button>
        {foldersExpanded && (
          <div className="pb-2">
            {FOLDERS.map(folder => (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm w-full transition-colors ${
                  selectedFolder === folder.id
                    ? 'bg-clawd-accent/10 text-clawd-accent'
                    : 'hover:bg-clawd-border/50'
                }`}
              >
                <span className="text-clawd-text-dim">{folder.icon}</span>
                <span className="flex-1 text-left">{folder.label}</span>
                {(folderCounts[folder.id] || 0) > 0 && (
                  <span className="text-xs text-clawd-text-dim">{folderCounts[folder.id]}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Center Pane: Message/Conversation List ───────────────────────────────────

function CenterPane({
  conversations,
  selectedId,
  onSelect,
  onToggleStar,
  onArchive,
  onToggleRead,
  loading,
  searchQuery,
  onSearchChange,
  accountLabel,
  onRefresh,
  refreshing,
  selectedPlatform,
  hasMore,
  onLoadMore,
  onLoadAll,
  aiAnalyses,
}: {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (c: ConversationItem) => void;
  onToggleStar: (id: string) => void;
  onArchive: (c: ConversationItem) => void;
  onToggleRead: (c: ConversationItem) => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  accountLabel: string;
  onRefresh: () => void;
  refreshing: boolean;
  selectedPlatform?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  aiAnalyses?: Map<string, AIAnalysis>;
}) {
  // Platform-specific empty states
  const emptyState = () => {
    const p = selectedPlatform;
    if (p === 'system') return { icon: <ActivityIcon size={32} className="mx-auto mb-2 opacity-30" />, msg: 'No system activity' };
    if (p === 'telegram') return { icon: <Send size={32} className="mx-auto mb-2 opacity-30" />, msg: 'No Telegram messages' };
    if (p === 'whatsapp') return { icon: <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />, msg: 'No WhatsApp messages' };
    if (p === 'discord') return { icon: <Gamepad2 size={32} className="mx-auto mb-2 opacity-30" />, msg: 'No Discord messages' };
    if (p === 'twitter') return { icon: <XIcon size={32} />, msg: 'No X DMs' };
    return { icon: <Mail size={32} className="mx-auto mb-2 opacity-30" />, msg: 'No messages' };
  };

  return (
    <div className="w-[400px] flex-shrink-0 bg-clawd-bg border-r border-clawd-border flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-clawd-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">{accountLabel}</h2>
          <button
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="p-1.5 rounded-lg hover:bg-clawd-border transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-9 pr-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm focus:outline-none focus:border-clawd-accent"
          />
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="text-center text-clawd-text-dim py-12 text-sm">Loading messages...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-clawd-text-dim py-12">
            {emptyState().icon}
            <p className="text-sm">{emptyState().msg}</p>
          </div>
        ) : (
          <>
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`group w-full text-left px-3 py-2.5 border-b border-clawd-border/30 border-l-2 transition-colors ${
                  selectedId === conv.id
                    ? 'bg-clawd-accent/10 border-l-clawd-accent'
                    : 'border-l-transparent hover:bg-clawd-surface/50'
                } ${!conv.is_read ? 'bg-clawd-surface/30' : ''}`}
              >
                <div className="flex items-start gap-2 overflow-hidden w-full">
                  {/* Unread dot */}
                  <div className="mt-2 flex-shrink-0 w-2">
                    {!conv.is_read && <div className="w-2 h-2 bg-clawd-accent rounded-full" />}
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm truncate flex-1 min-w-0 ${!conv.is_read ? 'font-bold' : 'font-medium'}`}>
                        {conv.name || conv.from || 'Unknown'}
                      </span>
                      <span className="text-[11px] text-clawd-text-dim flex-shrink-0">{conv.relativeTime}</span>
                    </div>
                    {conv.subject && (
                      <div className={`text-sm truncate ${!conv.is_read ? 'font-semibold' : 'text-clawd-text/80'}`}>
                        {conv.subject}
                      </div>
                    )}
                    <p className="text-xs text-clawd-text-dim/70 truncate mt-0.5">{conv.preview}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`flex-shrink-0 ${platformColor(conv.platform)}`}>
                        {platformIcon(conv.platform, 10)}
                      </span>
                      {aiAnalyses?.get(conv.id) && (
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${TRIAGE_COLORS[aiAnalyses.get(conv.id)!.triage] || 'bg-clawd-bg'}`}
                          title={TRIAGE_LABELS[aiAnalyses.get(conv.id)!.triage] || ''}
                        />
                      )}
                      {conv.message_count && conv.message_count > 1 && (
                        <span className="text-[10px] text-clawd-text-dim bg-clawd-border/60 rounded px-1 py-0.5">
                          {conv.message_count}
                        </span>
                      )}
                      {conv.unread_count && conv.unread_count > 0 && (
                        <span className="text-[10px] text-info bg-blue-500/15 rounded px-1 py-0.5 font-medium" title="Unread messages">
                          {conv.unread_count} unread
                        </span>
                      )}
                      {((conv.unreplied_count && conv.unreplied_count > 0) || conv.has_reply === false) && (
                        <span className="text-[10px] text-warning bg-orange-500/15 rounded px-1 py-0.5 flex items-center gap-0.5 font-medium" title="Awaiting reply">
                          <Reply size={8} />
                          reply
                        </span>
                      )}
                      {conv.has_attachment && <Paperclip size={10} className="text-clawd-text-dim flex-shrink-0" />}
                      {conv.is_starred && (
                        <Star size={10} className="text-warning flex-shrink-0" fill="currentColor" />
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {conv.platform !== 'system' && (
                    <div className="flex flex-col gap-0.5 flex-shrink-0 ml-1">
                      <button
                        onClick={e => { e.stopPropagation(); onToggleStar(conv.id); }}
                        className={`p-1 rounded hover:bg-clawd-border transition-opacity ${
                          conv.is_starred ? 'text-warning' : 'text-clawd-text-dim opacity-0 group-hover:opacity-100'
                        }`}
                        title={conv.is_starred ? 'Unstar' : 'Star'}
                      >
                        <Star size={14} fill={conv.is_starred ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onArchive(conv); }}
                        className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Archive"
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onToggleRead(conv); }}
                        className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim opacity-0 group-hover:opacity-100 transition-opacity"
                        title={conv.is_read ? 'Mark unread' : 'Mark read'}
                      >
                        {conv.is_read ? <MailOpen size={14} /> : <Check size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              </button>
            ))}
            {hasMore && onLoadMore && (
              <div className="flex gap-2 px-2 py-2">
                <button
                  onClick={onLoadMore}
                  className="flex-1 py-2 text-sm text-clawd-accent hover:bg-clawd-surface/50 transition-colors flex items-center justify-center gap-1 rounded"
                >
                  <ChevronDown size={14} />
                  Load more (+50)
                </button>
                {onLoadAll && (
                  <button
                    onClick={onLoadAll}
                    className="flex-1 py-2 text-sm text-clawd-accent hover:bg-clawd-surface/50 transition-colors flex items-center justify-center gap-1 rounded"
                  >
                    Load All
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Inbox Dashboard (shown when no message selected) ─────────────────────────

function InboxDashboard({
  messages,
  aiAnalyses,
  onSelect,
  onCreateTask,
  analysisLoading,
}: {
  messages: ConversationItem[];
  aiAnalyses: Map<string, AIAnalysis>;
  onSelect: (c: ConversationItem) => void;
  onCreateTask: (task: { title: string; description: string }) => void;
  analysisLoading: boolean;
}) {
  // Stats
  const unreadCount = messages.filter(m => !m.is_read).length;
  const platformCounts: Record<string, number> = {};
  for (const m of messages) {
    platformCounts[m.platform] = (platformCounts[m.platform] || 0) + 1;
  }

  // Priority messages: urgent + action from AI analysis
  const priorityMessages = messages.filter(m => {
    const a = aiAnalyses.get(m.id);
    return a && (a.triage === 'urgent' || a.triage === 'action');
  }).slice(0, 5);

  // All detected tasks from all analyses
  const allTasks: Array<{task: {title: string; description: string}; from: string; platform: string}> = [];
  for (const [id, analysis] of aiAnalyses) {
    if (analysis.tasks.length > 0) {
      const msg = messages.find(m => m.id === id);
      for (const task of analysis.tasks) {
        allTasks.push({ task, from: msg?.name || msg?.from || 'Unknown', platform: msg?.platform || '' });
      }
    }
  }

  // Unread by platform
  const unreadByPlatform: Record<string, number> = {};
  for (const m of messages.filter(m => !m.is_read)) {
    unreadByPlatform[m.platform] = (unreadByPlatform[m.platform] || 0) + 1;
  }

  return (
    <div className="flex-1 flex flex-col bg-clawd-bg overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-clawd-accent" />
          <h2 className="font-bold text-base">Smart Inbox</h2>
          {analysisLoading && <RefreshCw size={12} className="animate-spin text-clawd-text-dim ml-auto" />}
        </div>
        <p className="text-xs text-clawd-text-dim">AI-powered overview of your communications</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-clawd-surface rounded-lg p-3 border border-clawd-border">
            <div className="text-2xl font-bold text-clawd-accent">{unreadCount}</div>
            <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider">Unread</div>
          </div>
          <div className="bg-clawd-surface rounded-lg p-3 border border-clawd-border">
            <div className="text-2xl font-bold text-error">{priorityMessages.filter(m => aiAnalyses.get(m.id)?.triage === 'urgent').length}</div>
            <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider">Urgent</div>
          </div>
          <div className="bg-clawd-surface rounded-lg p-3 border border-clawd-border">
            <div className="text-2xl font-bold text-warning">{priorityMessages.filter(m => aiAnalyses.get(m.id)?.triage === 'action').length}</div>
            <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider">Action</div>
          </div>
          <div className="bg-clawd-surface rounded-lg p-3 border border-clawd-border">
            <div className="text-2xl font-bold text-clawd-text">{messages.length}</div>
            <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider">Total</div>
          </div>
        </div>

        {/* Unread by Platform */}
        {Object.keys(unreadByPlatform).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(unreadByPlatform).map(([platform, count]) => (
              <div key={platform} className="flex items-center gap-1.5 text-xs bg-clawd-surface border border-clawd-border rounded-full px-3 py-1">
                <span className={platformColor(platform)}>{platformIcon(platform, 12)}</span>
                <span className="font-medium">{count}</span>
                <span className="text-clawd-text-dim">unread</span>
              </div>
            ))}
          </div>
        )}

        {/* Priority Messages */}
        {priorityMessages.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-clawd-text-dim mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Needs Your Attention
            </h3>
            <div className="space-y-1.5">
              {priorityMessages.map(msg => {
                const analysis = aiAnalyses.get(msg.id);
                return (
                  <button
                    key={msg.id}
                    onClick={() => onSelect(msg)}
                    className="w-full text-left bg-clawd-surface border border-clawd-border rounded-lg p-3 hover:border-clawd-accent/50 hover:bg-clawd-accent/5 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        analysis?.triage === 'urgent' ? 'bg-red-500' : 'bg-orange-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`${platformColor(msg.platform)}`}>{platformIcon(msg.platform, 11)}</span>
                          <span className="text-sm font-medium truncate">{msg.name || msg.from}</span>
                          <span className="text-[10px] text-clawd-text-dim ml-auto flex-shrink-0">{msg.relativeTime}</span>
                        </div>
                        {analysis?.summary && (
                          <p className="text-xs text-clawd-text/70 truncate">{analysis.summary}</p>
                        )}
                        {/* Quick action hint */}
                        {analysis?.reply_needed && (
                          <span className="text-[10px] text-clawd-accent mt-1 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Reply size={9} /> Click to reply
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggested Tasks from Comms */}
        {allTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-clawd-text-dim mb-2 flex items-center gap-1.5">
              <ListPlus size={12} />
              Suggested Tasks
            </h3>
            <div className="space-y-1.5">
              {allTasks.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-clawd-surface border border-clawd-border rounded-lg px-3 py-2">
                  <span className={`flex-shrink-0 ${platformColor(item.platform)}`}>{platformIcon(item.platform, 11)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.task.title}</p>
                    <p className="text-[10px] text-clawd-text-dim truncate">From {item.from}{item.task.description ? ` — ${item.task.description}` : ''}</p>
                  </div>
                  <button
                    onClick={() => onCreateTask(item.task)}
                    className="flex-shrink-0 text-[10px] px-2.5 py-1 bg-clawd-accent/10 text-clawd-accent border border-clawd-accent/20 rounded-md hover:bg-clawd-accent/20 transition-colors font-medium"
                  >
                    Create
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no AI data yet */}
        {aiAnalyses.size === 0 && !analysisLoading && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto mb-3 text-clawd-text-dim/30" />
            <p className="text-sm text-clawd-text-dim">AI is analyzing your messages...</p>
            <p className="text-[10px] text-clawd-text-dim/50 mt-1">Select a message or wait for batch analysis</p>
          </div>
        )}

        {analysisLoading && aiAnalyses.size === 0 && (
          <div className="text-center py-8">
            <Sparkles size={24} className="mx-auto mb-2 text-clawd-accent animate-pulse" />
            <p className="text-sm text-clawd-text-dim">Analyzing your inbox...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Right Pane: Message Detail ───────────────────────────────────────────────

function RightPane({
  conversation,
  thread,
  loadingThread,
  onSendReply,
  emailBody,
  emailMetadata,
  loadingBody,
  aiAnalysis,
  onCreateTask,
  onCreateEvent,
  allMessages,
  aiAnalyses,
  onSelectMessage,
  analysisLoading,
}: {
  conversation: ConversationItem | null;
  thread: ThreadMessage[];
  loadingThread: boolean;
  onSendReply: (text: string) => void;
  emailBody: string;
  emailMetadata: EmailMetadata;
  loadingBody: boolean;
  aiAnalysis?: AIAnalysis | null;
  onCreateTask?: (task: { title: string; description: string }) => void;
  onCreateEvent?: (event: { title: string; date: string; time?: string; duration?: string; location?: string }) => void;
  allMessages: ConversationItem[];
  aiAnalyses: Map<string, AIAnalysis>;
  onSelectMessage: (c: ConversationItem) => void;
  analysisLoading: boolean;
}) {
  const [replyText, setReplyText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
  const [generatingFromIntent, setGeneratingFromIntent] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Pre-populate reply with AI draft if available
    setReplyText(aiAnalysis?.reply_draft || '');
    setShowAIPanel(false);
    setSuggestedReplies([]);
    setAiIntent('');
  }, [conversation?.id, aiAnalysis?.reply_draft]);

  const threadScrollRef = useRef<HTMLDivElement>(null);
  // Pin scroll to bottom so newest message is visible on load
  useEffect(() => {
    if (!thread.length) return;
    // Use the anchor div at the bottom of the thread
    const anchor = threadEndRef.current;
    if (anchor) {
      // Immediate + delayed to catch layout settling
      anchor.scrollIntoView({ block: 'end' });
      requestAnimationFrame(() => anchor.scrollIntoView({ block: 'end' }));
      const t1 = setTimeout(() => anchor.scrollIntoView({ block: 'end' }), 50);
      const t2 = setTimeout(() => anchor.scrollIntoView({ block: 'end' }), 200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [thread, conversation?.id]);

  // Generate AI suggestions when AI panel opens
  useEffect(() => {
    if (showAIPanel && !loadingSuggestions && suggestedReplies.length === 0 && conversation) {
      generateSuggestions();
    }
  }, [showAIPanel, conversation]);

  const buildThreadContext = () => {
    const threadMessages: Array<{role: string, content: string}> = [];
    if (thread.length > 0) {
      for (const msg of thread.slice(-10)) {
        threadMessages.push({
          role: msg.senderName || msg.sender || 'them',
          content: msg.text || '',
        });
      }
    } else if (conversation) {
      threadMessages.push({
        role: conversation.name || conversation.from || 'them',
        content: conversation.preview || conversation.subject || '',
      });
    }
    return threadMessages;
  };

  const callAIReply = async (tone: 'formal' | 'casual' | 'auto' = 'auto', intentOverride?: string) => {
    const threadMessages = buildThreadContext();
    if (intentOverride) {
      threadMessages.push({ role: 'user-intent', content: `User wants to say: ${intentOverride}` });
    }
    const result = await (window as any).clawdbot?.ai?.generateReply({
      threadMessages,
      platform: conversation?.platform,
      recipientName: conversation?.name || conversation?.from,
      subject: conversation?.subject,
      tone,
    });
    return result;
  };

  const generateSuggestions = async () => {
    if (!conversation) return;
    setLoadingSuggestions(true);
    try {
      const suggestions: string[] = [];

      // Use AI analysis reply_draft first (already generated, zero cost)
      if (aiAnalysis?.reply_draft) {
        suggestions.push(aiAnalysis.reply_draft);
      }

      // Generate one fresh contextual reply (not three)
      const result = await callAIReply('auto');
      if (result?.success && result.draft) {
        // Don't add if it's basically the same as the AI draft
        if (!aiAnalysis?.reply_draft || result.draft !== aiAnalysis.reply_draft) {
          suggestions.push(result.draft);
        }
      }

      // Try one more with different tone if we have room
      if (suggestions.length < 2) {
        const alt = await callAIReply(conversation.platform === 'email' ? 'formal' : 'casual');
        if (alt?.success && alt.draft && !suggestions.includes(alt.draft)) {
          suggestions.push(alt.draft);
        }
      }

      // If API totally failed and no AI analysis draft, show honest empty state
      if (suggestions.length === 0) {
        suggestions.push('(AI reply generation failed — check API key)');
      }
      setSuggestedReplies(suggestions);
    } catch (e) {
      console.error('Failed to generate suggestions:', e);
      // Show the AI analysis draft if we have it, otherwise honest error
      if (aiAnalysis?.reply_draft) {
        setSuggestedReplies([aiAnalysis.reply_draft]);
      } else {
        setSuggestedReplies(['(AI reply generation failed — check API key)']);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generateFromIntent = async () => {
    if (!aiIntent.trim()) return;
    setGeneratingFromIntent(true);
    try {
      const result = await callAIReply('auto', aiIntent);
      if (result?.success && result.draft) {
        setReplyText(result.draft);
      } else {
        const name = (conversation?.name || conversation?.from || 'there').split(' ')[0];
        setReplyText(`Hi ${name},\n\n${aiIntent}\n\nBest regards`);
      }
      setAiIntent('');
    } catch (e) {
      console.error('Failed to generate from intent:', e);
      setReplyText(aiIntent);
    } finally {
      setGeneratingFromIntent(false);
    }
  };

  const applySuggestion = (text: string) => {
    setReplyText(text);
    setShowAIPanel(false);
  };

  const generateReply = async () => {
    if (!conversation) return;
    setGenerating(true);
    try {
      const result = await callAIReply('auto');
      if (result?.success && result.draft) {
        setReplyText(result.draft);
      } else {
        const name = (conversation.name || conversation.from || 'there').split(' ')[0];
        setReplyText(`Hi ${name}, thanks for your message. Let me look into this and get back to you shortly.`);
      }
    } catch (e) {
      console.error('Failed to generate reply:', e);
      const name = (conversation.name || conversation.from || 'there').split(' ')[0];
      setReplyText(`Hi ${name}, thanks for your message. Let me look into this and get back to you shortly.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(replyText);
    setReplyText('');
  };

  // Focus reply box externally via ref
  const focusReply = useCallback(() => {
    replyRef.current?.focus();
  }, []);

  // Expose focusReply on the component via a data attribute trick
  // (keyboard handler in parent will call this)
  useEffect(() => {
    (window as any).__commsInboxFocusReply = focusReply;
    return () => { delete (window as any).__commsInboxFocusReply; };
  }, [focusReply]);

  if (!conversation) {
    return (
      <InboxDashboard
        messages={allMessages}
        aiAnalyses={aiAnalyses}
        onSelect={onSelectMessage}
        onCreateTask={onCreateTask || (() => {})}
        analysisLoading={analysisLoading}
      />
    );
  }

  const isSystem = conversation.platform === 'system';

  return (
    <div className="flex-1 flex flex-col bg-clawd-bg min-w-0 text-left">
      {/* Header */}
      <div className="px-5 py-3 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between gap-3 mb-0.5">
          <h2 className="font-bold text-base truncate min-w-0 flex-1">
            {conversation.subject || conversation.name || conversation.from || 'Message'}
          </h2>
          {!isSystem && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button className="p-2 rounded-lg hover:bg-clawd-border" title="Reply">
                <Reply size={16} />
              </button>
              <button className="p-2 rounded-lg hover:bg-clawd-border" title="Reply All">
                <ReplyAll size={16} />
              </button>
              <button className="p-2 rounded-lg hover:bg-clawd-border" title="Forward">
                <Forward size={16} />
              </button>
              <button className="p-2 rounded-lg hover:bg-clawd-border" title="More">
                <MoreHorizontal size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-clawd-text-dim">
          <span className={platformColor(conversation.platform)}>
            {platformIcon(conversation.platform, 14)}
          </span>
          <span>{conversation.name || conversation.from}</span>
          <span>·</span>
          <span>{conversation.relativeTime}</span>
          {conversation.message_count && conversation.message_count > 1 && (
            <>
              <span>·</span>
              <span>{conversation.message_count} messages in thread</span>
            </>
          )}
        </div>
      </div>

      {/* AI Analysis Banner */}
      {!isSystem && aiAnalysis && (
        <div className="px-4 py-3 border-b border-clawd-border bg-gradient-to-r from-clawd-surface to-clawd-bg/50">
          {/* Summary + Triage */}
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={13} className="text-clawd-accent flex-shrink-0" />
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              aiAnalysis.triage === 'urgent' ? 'bg-error-subtle text-error' :
              aiAnalysis.triage === 'action' ? 'bg-orange-500/20 text-warning' :
              aiAnalysis.triage === 'fyi' ? 'bg-info-subtle text-info' :
              'bg-clawd-bg/20 text-clawd-text-dim'
            }`}>
              {TRIAGE_LABELS[aiAnalysis.triage]}
            </span>
            {!aiAnalysis.reply_needed && (
              <span className="text-[10px] text-success bg-green-500/15 px-1.5 py-0.5 rounded font-medium">
                No reply needed
              </span>
            )}
          </div>
          <p className="text-xs text-clawd-text/80 mb-2 leading-relaxed">{aiAnalysis.summary}</p>

          {/* Detected Tasks */}
          {aiAnalysis.tasks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {aiAnalysis.tasks.map((task, i) => (
                <button
                  key={i}
                  onClick={() => onCreateTask?.(task)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 bg-clawd-accent/10 text-clawd-accent border border-clawd-accent/20 rounded-md hover:bg-clawd-accent/20 transition-colors"
                  title={task.description}
                >
                  <ListPlus size={10} />
                  {task.title}
                </button>
              ))}
            </div>
          )}

          {/* Detected Events */}
          {aiAnalysis.events.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {aiAnalysis.events.map((event, i) => (
                <button
                  key={i}
                  onClick={() => onCreateEvent?.(event)}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 bg-purple-500/10 text-review border border-purple-500/20 rounded-md hover:bg-purple-500/20 transition-colors"
                  title={`${event.date} ${event.time || ''} ${event.location || ''}`}
                >
                  <CalendarPlus size={10} />
                  {event.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thread / Message Body */}
      <div ref={threadScrollRef} className="flex-1 overflow-y-auto px-5 py-3 text-left min-w-0">
        {loadingThread || loadingBody ? (
          <div className="text-center text-clawd-text-dim py-8 text-sm">Loading...</div>
        ) : isSystem ? (
          /* System activity detail */
          <div className="bg-clawd-surface rounded-lg p-4 border border-clawd-border">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-clawd-border">
              <ActivityIcon size={14} className="text-review" />
              <span className="font-semibold text-sm">{conversation.name || 'System'}</span>
              <span className="text-xs text-clawd-text-dim ml-auto">{conversation.relativeTime}</span>
            </div>
            <MarkdownMessage content={conversation.preview} />
          </div>
        ) : conversation.platform === 'email' && emailBody ? (
          /* Email body with proper rendering */
          <EmailBodyRenderer body={emailBody} metadata={emailMetadata} />
        ) : thread.length > 0 ? (
          /* Chat thread */
          <div className="space-y-4">
            {thread.map((msg, i) => (
              <div key={msg.id || i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                  msg.fromMe
                    ? 'bg-clawd-accent/20 border border-clawd-accent/30'
                    : 'bg-clawd-surface border border-clawd-border'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{msg.fromMe ? 'You' : msg.senderName || msg.sender}</span>
                    <span className="text-[10px] text-clawd-text-dim">{msg.timestamp}</span>
                  </div>
                  {isHtmlContent(msg.text)
                    ? <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(msg.text) }} />
                    : <MarkdownMessage content={msg.text} />
                  }
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>
        ) : conversation.platform === 'telegram' ? (
          /* Telegram empty state — show preview while thread loads */
          <div className="bg-clawd-surface rounded-lg p-4 border border-clawd-border">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-clawd-border text-sky-400">
              <Send size={14} />
              <span className="font-semibold text-sm text-clawd-text">{conversation.name || conversation.from}</span>
            </div>
            <div className="mb-3"><MarkdownMessage content={conversation.preview} /></div>
            <p className="text-xs text-clawd-text-dim italic">Thread history could not be loaded. Check tgcli connection.</p>
          </div>
        ) : (
          /* Fallback: just show preview */
          <div className="bg-clawd-surface rounded-lg p-4 border border-clawd-border">
            <MarkdownMessage content={conversation.preview} />
          </div>
        )}
      </div>

      {/* AI Assistant Panel — not for system messages */}
      {!isSystem && showAIPanel && (
        <div className="px-5 py-3 border-t border-clawd-border bg-clawd-surface/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-clawd-accent" />
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <button
              onClick={() => setShowAIPanel(false)}
              className="p-1 rounded hover:bg-clawd-border"
            >
              <X size={14} />
            </button>
          </div>

          {/* Suggested Replies */}
          <div className="mb-4">
            <span className="text-xs font-medium text-clawd-text-dim mb-2 block">Suggested Replies</span>
            {loadingSuggestions ? (
              <div className="text-center py-4 text-clawd-text-dim text-xs">
                <Sparkles size={16} className="animate-spin mx-auto mb-1" />
                Generating suggestions...
              </div>
            ) : (
              <div className="space-y-2">
                {suggestedReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => applySuggestion(reply)}
                    className="w-full text-left p-3 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent hover:bg-clawd-accent/5 transition-colors text-sm"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Response Planner */}
          <div>
            <span className="text-xs font-medium text-clawd-text-dim mb-2 block">Response Planner</span>
            <p className="text-[10px] text-clawd-text-dim mb-2">Tell AI what you want to say, and it&apos;ll draft the message for you</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiIntent}
                onChange={e => setAiIntent(e.target.value)}
                placeholder="E.g., 'Confirm I'll handle this by tomorrow'"
                className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    generateFromIntent();
                  }
                }}
              />
              <button
                onClick={generateFromIntent}
                disabled={!aiIntent.trim() || generatingFromIntent}
                className="bg-clawd-accent hover:bg-clawd-accent/80 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2"
              >
                {generatingFromIntent ? (
                  <>
                    <Sparkles size={14} className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Reply Chips — Gmail-style quick replies */}
      {!isSystem && !showAIPanel && !replyText && aiAnalysis?.reply_needed && (
        <div className="px-5 py-2 border-t border-clawd-border/50 bg-clawd-surface/50 flex items-center gap-2 overflow-x-auto">
          <Sparkles size={11} className="text-clawd-accent flex-shrink-0" />
          {aiAnalysis.reply_draft && (
            <button
              onClick={() => setReplyText(aiAnalysis.reply_draft!)}
              className="text-xs px-3 py-1.5 bg-clawd-accent/10 text-clawd-accent border border-clawd-accent/20 rounded-full hover:bg-clawd-accent/20 transition-colors whitespace-nowrap"
            >
              {aiAnalysis.reply_draft.length > 40 ? aiAnalysis.reply_draft.slice(0, 40) + '...' : aiAnalysis.reply_draft}
            </button>
          )}
          <button
            onClick={() => setReplyText('Thanks, got it!')}
            className="text-xs px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-full hover:border-clawd-accent/30 transition-colors whitespace-nowrap"
          >
            Thanks, got it!
          </button>
          <button
            onClick={() => setReplyText("I&apos;ll look into this and get back to you.")}
            className="text-xs px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-full hover:border-clawd-accent/30 transition-colors whitespace-nowrap"
          >
            I&apos;ll look into this
          </button>
          <button
            onClick={generateReply}
            disabled={generating}
            className="text-xs px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-full hover:border-clawd-accent/30 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <Sparkles size={10} className={generating ? 'animate-spin' : ''} />
            Custom AI reply
          </button>
        </div>
      )}

      {/* Reply Box — not for system messages */}
      {!isSystem && (
        <div className="px-5 py-3 border-t border-clawd-border bg-clawd-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-clawd-text-dim">Reply</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                  showAIPanel
                    ? 'bg-clawd-accent/20 text-clawd-accent'
                    : 'text-clawd-accent hover:bg-clawd-accent/10'
                }`}
              >
                <Sparkles size={14} />
                AI Assist
              </button>
              <button
                onClick={generateReply}
                disabled={generating}
                className="flex items-center gap-1 text-xs text-clawd-text-dim hover:text-clawd-accent disabled:opacity-50"
              >
                <Sparkles size={14} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generating...' : 'Quick Draft'}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <textarea
              ref={replyRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg p-2.5 text-sm resize-none h-20 focus:outline-none focus:border-clawd-accent"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-clawd-text-dim">⌘+Enter to send</span>
            <div className="flex gap-2">
              {replyText && (
                <button
                  onClick={() => setReplyText('')}
                  className="text-clawd-text-dim hover:text-clawd-text text-sm px-3 py-2"
                >
                  Discard
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!replyText.trim()}
                className="bg-clawd-accent hover:bg-clawd-accent/80 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2"
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommsInbox3Pane() {
  // Dynamic accounts from gateway
  const [accounts, setAccounts] = useState<Account[]>(buildAccountsFallback);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadAccounts = async () => {
      try {
        // Fetch email accounts (from gog auth) and gateway channels in parallel
        const [emailResult, channelsResult] = await Promise.all([
          (window as any).clawdbot?.email?.accounts?.()
            .catch(() => null),
          gateway.getChannelsStatus().catch(() => null),
        ]);

        if (cancelled) return;

        const emailAccounts = emailResult?.success && emailResult.accounts?.length > 0
          ? emailResult.accounts
          : DEFAULT_EMAIL_ACCOUNTS.map(a => ({ email: a.address!, label: a.label }));

        const channelAccounts = channelsResult?.channelAccounts || {};
        const detected = buildAccountsFromSources(channelAccounts, emailAccounts);
        if (detected.length > 1) {
          setAccounts(detected);
        }
      } catch (e) {
        console.error('[CommsInbox3Pane] Failed to load accounts:', e);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    };
    loadAccounts();
    return () => { cancelled = true; };
  }, []);

  // Zustand store for activities (system channel)
  const activities = useStore((s) => s.activities);

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [allMessages, setAllMessages] = useState<ConversationItem[]>([]);
  const [displayMessages, setDisplayMessages] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailMetadata, setEmailMetadata] = useState<EmailMetadata>({});
  const [loadingBody, setLoadingBody] = useState(false);
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({});
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [messageLimit, setMessageLimit] = useState(500); // Show more history by default
  const isMounted = useRef(true);
  const [aiAnalyses, setAiAnalyses] = useState<Map<string, AIAnalysis>>(new Map());
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const analysisBatchRef = useRef<Set<string>>(new Set());

  // Convert activities to ConversationItems for system channel
  const systemMessages: ConversationItem[] = activities.map((a: Activity) => {
    const diffMs = Date.now() - a.timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    let relativeTime = 'just now';
    if (diffMins >= 60) relativeTime = `${diffHours}h ago`;
    else if (diffMins >= 1) relativeTime = `${diffMins}m ago`;

    const typeLabels: Record<string, string> = {
      task: 'Task Update', chat: 'Chat', agent: 'Agent', system: 'System', error: 'Error'
    };

    return {
      id: `system-${a.id}`,
      platform: 'system',
      name: typeLabels[a.type] || 'System',
      subject: a.sessionKey ? `Session: ${a.sessionKey}` : undefined,
      preview: a.message,
      timestamp: new Date(a.timestamp).toISOString(),
      relativeTime,
      is_read: true,
    };
  });

  // Determine which account's platform we're filtering on
  const getAccountPlatform = (accountId: string | null): string | null => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account?.platform || null;
  };

  // Filter and sort messages for display
  const filterMessages = useCallback((
    msgs: ConversationItem[],
    accountId: string | null,
    folderId: string,
    search: string,
  ): ConversationItem[] => {
    let filtered = [...msgs];

    // Account filter
    if (accountId) {
      const platform = getAccountPlatform(accountId);
      const address = accounts.find(a => a.id === accountId)?.address;
      filtered = filtered.filter(m => {
        if (m.platform !== platform) return false;
        if (platform === 'email' && address && m.account) {
          return m.account === address;
        }
        return true;
      });
    }

    // Folder filter
    const folder = FOLDERS.find(f => f.id === folderId);
    if (folder && folderId !== 'inbox' && folderId !== 'archived') {
      filtered = filtered.filter(folder.filter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.from && m.from.toLowerCase().includes(q)) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        m.preview.toLowerCase().includes(q)
      );
    }

    // Sort: unread first, then by timestamp (newest first)
    filtered.sort((a, b) => {
      if (!a.is_read && b.is_read) return -1;
      if (a.is_read && !b.is_read) return 1;
      // Newest messages first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return filtered;
  }, [accounts]);

  // Compute counts
  const computeCounts = useCallback((msgs: ConversationItem[]) => {
    const aCounts: Record<string, number> = {};
    const fCounts: Record<string, number> = {};

    for (const account of accounts) {
      if (account.platform === 'system') {
        aCounts[account.id] = systemMessages.filter(m => !m.is_read).length;
        continue;
      }
      const platform = account.platform;
      aCounts[account.id] = msgs.filter(m => {
        if (m.platform !== platform || m.is_read) return false;
        if (platform === 'email' && account.address && m.account) {
          return m.account === account.address;
        }
        return platform !== 'email' || !account.address;
      }).length;
    }

    for (const folder of FOLDERS) {
      if (folder.id === 'inbox') {
        fCounts[folder.id] = msgs.filter(m => !m.is_read).length;
      } else if (folder.id !== 'archived') {
        fCounts[folder.id] = msgs.filter(folder.filter).length;
      }
    }

    setAccountCounts(aCounts);
    setFolderCounts(fCounts);
  }, [accounts, systemMessages.length]);

  // Load messages from backend
  const loadMessages = useCallback(async (forceRefresh = false) => {
    const showArchived = selectedFolder === 'archived';
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await (window as any).clawdbot?.messages?.recent(messageLimit, showArchived);
      if (result?.success && result.chats && isMounted.current) {
        const msgs = (result.chats as ConversationItem[]).map(m => {
          if (!m.timestamp) return m;
          const diffMs = Date.now() - new Date(m.timestamp).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          let relativeTime = m.relativeTime;
          if (diffMins < 1) relativeTime = 'just now';
          else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
          else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
          else if (diffDays < 7) relativeTime = `${diffDays}d ago`;
          else relativeTime = new Date(m.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return { ...m, relativeTime };
        });
        setAllMessages(msgs);
        computeCounts(msgs);
      }
    } catch (e) {
      console.error('[CommsInbox3Pane] Failed to load:', e);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedFolder, computeCounts, messageLimit]);

  // Determine the selected platform for empty state
  const selectedPlatform = selectedAccount
    ? accounts.find(a => a.id === selectedAccount)?.platform
    : undefined;

  // Update display when filters change
  useEffect(() => {
    // If system account is selected, show system messages
    if (selectedPlatform === 'system') {
      let filtered = [...systemMessages];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(m =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          m.preview.toLowerCase().includes(q)
        );
      }
      setDisplayMessages(filtered);
    } else {
      const filtered = filterMessages(allMessages, selectedAccount, selectedFolder, searchQuery);
      setDisplayMessages(filtered);
    }
  }, [allMessages, selectedAccount, selectedFolder, searchQuery, filterMessages, selectedPlatform, activities]);

  // Initial load + event-driven refresh with 60s fallback
  useEffect(() => {
    isMounted.current = true;
    loadMessages();

    // Listen for comms-updated events from background polling
    const cleanup = (window as any).clawdbot?.messages?.onUpdate?.((data: any) => {
      if (isMounted.current) {
        loadMessages(true);
      }
    });

    // 60s safety-net fallback
    const interval = setInterval(() => {
      if (isMounted.current) loadMessages(true);
    }, 60000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      cleanup?.();
    };
  }, [loadMessages]);

  // Load thread/body when conversation selected
  useEffect(() => {
    // Always clear old state on any selection change
    setThread([]);
    setEmailBody('');
    setEmailMetadata({});

    if (!selectedConversation) return;

    // System messages don't need thread loading
    if (selectedConversation.platform === 'system') return;

    const loadDetail = async () => {
      if (selectedConversation.platform === 'email') {
        setLoadingBody(true);
        try {
          const emailId = selectedConversation.id.replace('email-', '');
          const result = await (window as any).clawdbot?.email?.body(emailId, selectedConversation.account);
          if (result?.success && result.body) {
            const { body, metadata } = parseEmailBodyAndMeta(result.body);
            setEmailBody(body);
            setEmailMetadata(metadata);
          } else {
            setEmailBody('');
            setEmailMetadata({});
          }
        } catch (e) {
          console.error('Failed to load email body:', e);
          setEmailBody('');
          setEmailMetadata({});
        } finally {
          setLoadingBody(false);
        }
      } else {
        setLoadingThread(true);
        try {
          const result = await (window as any).clawdbot?.messages?.context(
            selectedConversation.id, selectedConversation.platform, 20
          );
          if (result?.success && result.messages) {
            // Backend returns oldest-first (chat-style) — use as-is
            setThread(result.messages);
          } else {
            setThread([]);
          }
        } catch (e) {
          console.error('Failed to load thread:', e);
          setThread([]);
        } finally {
          setLoadingThread(false);
        }
      }

      // Mark as read
      try {
        await (window as any).clawdbot?.inbox?.markRead?.(selectedConversation.id, true);
        setAllMessages(prev => prev.map(m =>
          m.id === selectedConversation.id ? { ...m, is_read: true } : m
        ));
      } catch (e) { /* ignore */ }

      // Trigger AI analysis
      if (selectedConversation.platform !== 'system') {
        try {
          const cached = await (window as any).clawdbot?.ai?.getAnalysis?.(selectedConversation.id, selectedConversation.platform);
          if (cached?.success && cached.analysis) {
            setAiAnalyses(prev => new Map(prev).set(selectedConversation.id, cached.analysis));
          } else {
            // Queue for batch analysis
            analysisBatchRef.current.add(selectedConversation.id);
            processBatchAnalysis();
          }
        } catch (e) {
          console.error('[AI] Analysis fetch error:', e);
        }
      }
    };

    loadDetail();
  }, [selectedConversation?.id]);

  // Batch AI analysis processor
  const processBatchAnalysis = useCallback(async () => {
    if (analysisLoading || analysisBatchRef.current.size === 0) return;
    setAnalysisLoading(true);
    try {
      const ids = Array.from(analysisBatchRef.current).slice(0, 10);
      analysisBatchRef.current.clear();
      const result = await (window as any).clawdbot?.ai?.analyzeMessages?.(ids);
      if (result?.success && result.analyses) {
        setAiAnalyses(prev => {
          const next = new Map(prev);
          for (const [id, analysis] of Object.entries(result.analyses)) {
            next.set(id, analysis as AIAnalysis);
          }
          return next;
        });
      }
    } catch (e) {
      console.error('[AI] Batch analysis error:', e);
    } finally {
      setAnalysisLoading(false);
    }
  }, [analysisLoading]);

  // Background batch: analyze top 10 unanalyzed messages after initial load
  useEffect(() => {
    if (allMessages.length === 0) return;
    const unanalyzed = allMessages
      .filter(m => m.platform !== 'system' && !aiAnalyses.has(m.id))
      .slice(0, 10);
    if (unanalyzed.length > 0) {
      for (const m of unanalyzed) analysisBatchRef.current.add(m.id);
      // Small delay to let UI settle
      const timer = setTimeout(processBatchAnalysis, 2000);
      return () => clearTimeout(timer);
    }
  }, [allMessages.length]); // Only on message count change

  // Create task/event handlers
  const handleCreateDetectedTask = async (task: { title: string; description: string }) => {
    try {
      const result = await (window as any).clawdbot?.ai?.createDetectedTask?.(task);
      if (result?.success) {
        showToast('success', 'Task Created', task.title);
      } else {
        showToast('error', 'Failed', result?.error || 'Could not create task');
      }
    } catch (e: any) {
      showToast('error', 'Error', e.message);
    }
  };

  const handleCreateDetectedEvent = async (event: { title: string; date: string; time?: string; duration?: string; location?: string }) => {
    try {
      const result = await (window as any).clawdbot?.ai?.createDetectedEvent?.(event);
      if (result?.success) {
        showToast('success', 'Event Created', event.title);
      } else {
        showToast('error', 'Failed', result?.error || 'Could not create event');
      }
    } catch (e: any) {
      showToast('error', 'Error', e.message);
    }
  };

  // Keyboard navigation: j/k for next/prev, r to focus reply
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const idx = displayMessages.findIndex(m => m.id === selectedConversation?.id);
        let next: number;
        if (e.key === 'j') {
          next = idx < displayMessages.length - 1 ? idx + 1 : idx;
        } else {
          next = idx > 0 ? idx - 1 : 0;
        }
        if (displayMessages[next]) {
          setSelectedConversation(displayMessages[next]);
        }
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        (window as any).__commsInboxFocusReply?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayMessages, selectedConversation?.id]);

  // Archive conversation
  const handleArchive = async (conv: ConversationItem) => {
    const sessionKey = `${conv.platform}:${conv.from || conv.name || ''}`;
    try {
      await (window as any).clawdbot?.conversations?.archive?.(sessionKey);
      setAllMessages(prev => prev.filter(m => m.id !== conv.id));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation(null);
      }
      showToast('success', 'Archived', `${conv.name || conv.from || 'Conversation'} archived`);
    } catch (e: any) {
      showToast('error', 'Archive failed', e.message);
    }
  };

  // Toggle read/unread
  const handleToggleRead = async (conv: ConversationItem) => {
    const newReadState = !conv.is_read;
    try {
      await (window as any).clawdbot?.inbox?.markRead?.(conv.id, newReadState);
      setAllMessages(prev => prev.map(m =>
        m.id === conv.id ? { ...m, is_read: newReadState } : m
      ));
    } catch (e) {
      console.error('Failed to toggle read:', e);
    }
  };

  // Toggle star
  const handleToggleStar = async (id: string) => {
    try {
      const result = await (window as any).clawdbot?.inbox?.toggleStar?.(id);
      if (result?.success) {
        setAllMessages(prev => prev.map(m =>
          m.id === id ? { ...m, is_starred: result.is_starred } : m
        ));
      }
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  };

  // Send reply
  const handleSendReply = async (text: string) => {
    if (!selectedConversation) return;
    const recipient = selectedConversation.from || selectedConversation.name || '';
    try {
      const result = await (window as any).clawdbot?.messages?.send?.(
        selectedConversation.platform, recipient, text
      );
      if (result?.success) {
        setThread(prev => [...prev, {
          id: `sent-${Date.now()}`,
          sender: 'You',
          text,
          timestamp: 'just now',
          fromMe: true,
        }]);
        showToast('success', 'Sent', `Reply sent to ${recipient}`);
      } else {
        showToast('error', 'Send failed', result?.error || 'Unknown error');
      }
    } catch (e: any) {
      showToast('error', 'Send failed', e.message);
    }
  };

  // Load more messages
  const handleLoadMore = () => {
    setMessageLimit(prev => prev + 50);
  };
  const handleLoadAll = () => {
    setMessageLimit(99999); // Load all messages
  };
  useEffect(() => {
    if (messageLimit > 50) loadMessages(true);
  }, [messageLimit]);

  // Get label for center pane header
  const getAccountLabel = (): string => {
    if (!selectedAccount) return 'All Messages';
    const account = accounts.find(a => a.id === selectedAccount);
    return account ? `${account.label}${account.address ? ` (${account.address})` : ''}` : 'Messages';
  };

  return (
    <div className="h-full flex overflow-hidden">
      <LeftPane
        selectedAccount={selectedAccount}
        selectedFolder={selectedFolder}
        onSelectAccount={setSelectedAccount}
        onSelectFolder={setSelectedFolder}
        accountCounts={accountCounts}
        folderCounts={folderCounts}
        accounts={accounts}
        loadingAccounts={loadingAccounts}
      />
      <CenterPane
        conversations={displayMessages}
        selectedId={selectedConversation?.id || null}
        onSelect={setSelectedConversation}
        onToggleStar={handleToggleStar}
        onArchive={handleArchive}
        onToggleRead={handleToggleRead}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        accountLabel={getAccountLabel()}
        onRefresh={() => loadMessages(true)}
        refreshing={refreshing}
        selectedPlatform={selectedPlatform}
        hasMore={displayMessages.length >= messageLimit}
        onLoadMore={handleLoadMore}
        onLoadAll={handleLoadAll}
        aiAnalyses={aiAnalyses}
      />
      <RightPane
        conversation={selectedConversation}
        thread={thread}
        loadingThread={loadingThread}
        onSendReply={handleSendReply}
        emailBody={emailBody}
        emailMetadata={emailMetadata}
        loadingBody={loadingBody}
        aiAnalysis={selectedConversation ? aiAnalyses.get(selectedConversation.id) || null : null}
        onCreateTask={handleCreateDetectedTask}
        onCreateEvent={handleCreateDetectedEvent}
        allMessages={allMessages}
        aiAnalyses={aiAnalyses}
        onSelectMessage={setSelectedConversation}
        analysisLoading={analysisLoading}
      />
    </div>
  );
}
