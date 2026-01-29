/**
 * CommsInbox3Pane - Proper 3-pane communications inbox
 * 
 * LEFT: Account/folder selector (Gmail accounts, WhatsApp, Telegram, Discord)
 * CENTER: Message/conversation list for selected account
 * RIGHT: Message detail view with thread and reply
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, MessageCircle, Send, Gamepad2, MessageSquare,
  Inbox, Star, Archive, Trash2, Clock, AlertTriangle,
  RefreshCw, ChevronRight, ChevronDown, Search,
  Reply, ReplyAll, Forward, MoreHorizontal,
  Sparkles, X, Paperclip, Check, Eye
} from 'lucide-react';
import DOMPurify from 'dompurify';

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
  platform: 'email' | 'whatsapp' | 'telegram' | 'discord' | 'twitter';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNTS: Account[] = [
  { id: 'gmail-bitso', label: 'Bitso', platform: 'email', address: 'kevin.macarthur@bitso.com', icon: <Mail size={16} />, color: 'text-orange-400' },
  { id: 'gmail-carbium', label: 'Carbium', platform: 'email', address: 'kevin@carbium.io', icon: <Mail size={16} />, color: 'text-blue-400' },
  { id: 'whatsapp', label: 'WhatsApp', platform: 'whatsapp', icon: <MessageCircle size={16} />, color: 'text-green-400' },
  { id: 'telegram', label: 'Telegram', platform: 'telegram', icon: <Send size={16} />, color: 'text-sky-400' },
  { id: 'discord', label: 'Discord', platform: 'discord', icon: <Gamepad2 size={16} />, color: 'text-indigo-400' },
  { id: 'twitter', label: 'X DMs', platform: 'twitter', icon: <XIcon size={16} />, color: 'text-gray-300' },
];

const FOLDERS: Folder[] = [
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} />, filter: (m) => !m.is_starred },
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

function formatRelativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function platformColor(p: string): string {
  const map: Record<string, string> = {
    email: 'text-orange-400', whatsapp: 'text-green-400', telegram: 'text-sky-400',
    discord: 'text-indigo-400', twitter: 'text-gray-300'
  };
  return map[p] || 'text-clawd-text-dim';
}

// Detect if content is HTML
function isHTML(content: string): boolean {
  const htmlTags = /<[^>]+>/;
  return htmlTags.test(content);
}

// Sanitize HTML content
function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'div', 'span', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target'],
    ALLOW_DATA_ATTR: false,
  });
}

// ─── Left Pane: Account & Folder Selector ─────────────────────────────────────

function LeftPane({
  selectedAccount,
  selectedFolder,
  onSelectAccount,
  onSelectFolder,
  accountCounts,
  folderCounts,
}: {
  selectedAccount: string | null;
  selectedFolder: string;
  onSelectAccount: (id: string | null) => void;
  onSelectFolder: (id: string) => void;
  accountCounts: Record<string, number>;
  folderCounts: Record<string, number>;
}) {
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);

  return (
    <div className="w-60 flex-shrink-0 bg-clawd-surface border-r border-clawd-border flex flex-col overflow-y-auto">
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
        </button>
        {accountsExpanded && (
          <div className="pb-2">
            {ACCOUNTS.map(account => (
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
  loading,
  searchQuery,
  onSearchChange,
  accountLabel,
  onRefresh,
  refreshing,
}: {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (c: ConversationItem) => void;
  onToggleStar: (id: string) => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  accountLabel: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex-1 min-w-[320px] max-w-[480px] bg-clawd-bg border-r border-clawd-border flex flex-col">
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
            <Mail size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No messages</p>
          </div>
        ) : (
          conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full text-left px-4 py-3 border-b border-clawd-border/50 transition-all duration-150 group ${
                selectedId === conv.id
                  ? 'bg-clawd-accent/10 border-l-2 border-l-clawd-accent'
                  : 'hover:bg-clawd-surface/80'
              } ${!conv.is_read ? 'bg-clawd-surface/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar/Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-clawd-border/50 flex items-center justify-center relative mt-0.5">
                  {!conv.is_read && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-clawd-accent rounded-full border-2 border-clawd-bg" />
                  )}
                  {conv.platform === 'email' && <Mail size={16} className="text-orange-400" />}
                  {conv.platform === 'whatsapp' && <MessageCircle size={16} className="text-green-400" />}
                  {conv.platform === 'telegram' && <Send size={16} className="text-sky-400" />}
                  {conv.platform === 'discord' && <Gamepad2 size={16} className="text-indigo-400" />}
                  {conv.platform === 'twitter' && <XIcon size={16} className="text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {/* Header: Sender + Timestamp */}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm truncate ${!conv.is_read ? 'font-bold' : 'font-semibold'} text-clawd-text`}>
                      {(() => {
                        // Clean up redundant sender names like "Name from Name"
                        const name = conv.name || conv.from || 'Unknown';
                        const parts = name.split(' from ');
                        return parts.length > 1 && parts[0] === parts[1] ? parts[0] : name;
                      })()}
                    </span>
                    <span className="text-xs text-clawd-text-dim flex-shrink-0 font-medium tabular-nums">{conv.relativeTime}</span>
                  </div>

                  {/* Subject (if exists) - Allow 2 lines with ellipsis */}
                  {conv.subject && (
                    <div className={`text-sm leading-snug ${!conv.is_read ? 'font-semibold' : 'font-medium'} text-clawd-text line-clamp-2`}>
                      {conv.subject}
                    </div>
                  )}

                  {/* Preview - Allow 2 lines with ellipsis */}
                  <p className="text-xs text-clawd-text-dim leading-relaxed line-clamp-2">
                    {conv.preview}
                  </p>

                  {/* Metadata badges */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {conv.message_count && conv.message_count > 1 && (
                      <span className="text-[10px] text-clawd-text-dim bg-clawd-border rounded px-1.5 py-0.5 font-medium">
                        {conv.message_count}
                      </span>
                    )}
                    {conv.unread_count && conv.unread_count > 0 && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/20 rounded px-1.5 py-0.5 font-semibold" title="Unread messages">
                        {conv.unread_count} unread
                      </span>
                    )}
                    {(conv.unreplied_count && conv.unreplied_count > 0) || (conv.has_reply === false) && (
                      <span className="text-[10px] text-orange-400 bg-orange-500/20 rounded px-1.5 py-0.5 flex items-center gap-0.5 font-semibold" title="Awaiting reply">
                        <Reply size={8} />
                        reply
                      </span>
                    )}
                    {conv.has_attachment && <Paperclip size={10} className="text-clawd-text-dim" />}
                    {conv.is_starred && (
                      <Star size={10} className="text-yellow-400" fill="currentColor" />
                    )}
                  </div>
                </div>

                {/* Star toggle button */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleStar(conv.id); }}
                  className={`p-1.5 rounded-lg hover:bg-clawd-border flex-shrink-0 transition-all duration-150 mt-0.5 ${
                    conv.is_starred ? 'text-yellow-400 opacity-100' : 'text-clawd-text-dim opacity-0 group-hover:opacity-100'
                  }`}
                  title={conv.is_starred ? 'Unstar' : 'Star'}
                >
                  <Star size={14} fill={conv.is_starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            </button>
          ))
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
  loadingBody,
}: {
  conversation: ConversationItem | null;
  thread: ThreadMessage[];
  loadingThread: boolean;
  onSendReply: (text: string) => void;
  emailBody: string;
  loadingBody: boolean;
}) {
  const [replyText, setReplyText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
  const [generatingFromIntent, setGeneratingFromIntent] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReplyText('');
    setShowAIPanel(false);
    setSuggestedReplies([]);
    setAiIntent('');
  }, [conversation?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  // Generate AI suggestions when AI panel opens
  useEffect(() => {
    if (showAIPanel && !loadingSuggestions && suggestedReplies.length === 0 && conversation) {
      generateSuggestions();
    }
  }, [showAIPanel, conversation]);

  const generateSuggestions = async () => {
    if (!conversation) return;
    setLoadingSuggestions(true);
    try {
      // Simulate AI suggestions based on context
      await new Promise(r => setTimeout(r, 1200));
      const name = (conversation.name || conversation.from || 'there').split(' ')[0];
      const suggestions = [
        `Hi ${name}, thanks for reaching out! I'll look into this and get back to you shortly.`,
        `Thanks for the message. Let me check on that for you.`,
        `Got it, ${name}. I'll take care of this today.`,
        `Appreciate you following up. I'm on it!`,
        `Thanks ${name}! I'll review and respond with details soon.`
      ];
      setSuggestedReplies(suggestions);
    } catch (e) {
      console.error('Failed to generate suggestions:', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generateFromIntent = async () => {
    if (!aiIntent.trim()) return;
    setGeneratingFromIntent(true);
    try {
      // Simulate AI generation from intent
      await new Promise(r => setTimeout(r, 1000));
      const name = (conversation?.name || conversation?.from || 'there').split(' ')[0];
      // Mock response based on intent
      const generated = `Hi ${name},\n\n${aiIntent}\n\nLet me know if you need anything else!\n\nBest regards`;
      setReplyText(generated);
      setAiIntent('');
    } catch (e) {
      console.error('Failed to generate from intent:', e);
    } finally {
      setGeneratingFromIntent(false);
    }
  };

  const useSuggestion = (text: string) => {
    setReplyText(text);
    setShowAIPanel(false);
  };

  const generateReply = async () => {
    if (!conversation) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 800));
    const name = (conversation.name || conversation.from || 'there').split(' ')[0];
    setReplyText(`Hi ${name}, thanks for your message. Let me look into this and get back to you shortly.`);
    setGenerating(false);
  };

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(replyText);
    setReplyText('');
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-clawd-bg">
        <div className="text-center text-clawd-text-dim">
          <Mail size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Select a message to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-clawd-bg min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-lg truncate">
            {conversation.subject || conversation.name || conversation.from || 'Message'}
          </h2>
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
        </div>
        <div className="flex items-center gap-2 text-sm text-clawd-text-dim">
          <span className={platformColor(conversation.platform)}>
            {conversation.platform === 'email' && <Mail size={14} />}
            {conversation.platform === 'whatsapp' && <MessageCircle size={14} />}
            {conversation.platform === 'telegram' && <Send size={14} />}
            {conversation.platform === 'discord' && <Gamepad2 size={14} />}
            {conversation.platform === 'twitter' && <XIcon size={14} />}
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

      {/* Thread / Message Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loadingThread || loadingBody ? (
          <div className="text-center text-clawd-text-dim py-8 text-sm">Loading...</div>
        ) : conversation.platform === 'email' ? (
          /* Email view */
          <div className="bg-clawd-surface rounded-lg p-4 border border-clawd-border">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-clawd-border">
              <span className="font-semibold text-sm">{conversation.name || conversation.from}</span>
              <span className="text-xs text-clawd-text-dim">{conversation.relativeTime}</span>
            </div>
            {emailBody ? (
              isHTML(emailBody) ? (
                /* Render HTML email */
                <div 
                  className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-clawd-text prose-p:text-clawd-text prose-a:text-clawd-accent prose-strong:text-clawd-text prose-ul:text-clawd-text prose-ol:text-clawd-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(emailBody) }}
                />
              ) : (
                /* Render plain text email */
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{emailBody}</pre>
              )
            ) : (
              /* Fallback to preview if body not available */
              <div className="text-sm text-clawd-text-dim italic">
                <p className="mb-2">Email body not available. Preview:</p>
                <p className="text-clawd-text">{conversation.preview}</p>
              </div>
            )}
          </div>
        ) : thread.length > 0 ? (
          /* Chat thread */
          <div className="space-y-3">
            {thread.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-3 ${msg.fromMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-clawd-border/50 flex items-center justify-center text-xs font-semibold text-clawd-text-dim">
                  {msg.fromMe ? 'K' : (msg.senderName || msg.sender || '?')[0].toUpperCase()}
                </div>
                
                {/* Message bubble */}
                <div className={`max-w-[70%] flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-semibold">{msg.fromMe ? 'You' : msg.senderName || msg.sender}</span>
                    <span className="text-xs text-clawd-text-dim font-medium">{msg.timestamp}</span>
                  </div>
                  <div className={`rounded-xl px-4 py-2.5 ${
                    msg.fromMe
                      ? 'bg-clawd-accent/20 border border-clawd-accent/30'
                      : 'bg-clawd-surface border border-clawd-border'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>
        ) : (
          /* Fallback: just show preview */
          <div className="bg-clawd-surface rounded-lg p-4 border border-clawd-border">
            <p className="text-sm leading-relaxed">{conversation.preview}</p>
          </div>
        )}
      </div>

      {/* AI Assistant Panel */}
      {showAIPanel && (
        <div className="px-6 py-4 border-t border-clawd-border bg-clawd-surface/50">
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
                    onClick={() => useSuggestion(reply)}
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
            <p className="text-[10px] text-clawd-text-dim mb-2">Tell AI what you want to say, and it'll draft the message for you</p>
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

      {/* Reply Box */}
      <div className="px-6 py-4 border-t border-clawd-border bg-clawd-surface">
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
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write your reply..."
            className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:border-clawd-accent"
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
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommsInbox3Pane() {
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
  const [loadingBody, setLoadingBody] = useState(false);
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({});
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const isMounted = useRef(true);

  // Determine which account's platform we're filtering on
  const getAccountPlatform = (accountId: string | null): string | null => {
    if (!accountId) return null;
    const account = ACCOUNTS.find(a => a.id === accountId);
    return account?.platform || null;
  };

  const getAccountAddress = (accountId: string | null): string | undefined => {
    if (!accountId) return undefined;
    return ACCOUNTS.find(a => a.id === accountId)?.address;
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
      const address = getAccountAddress(accountId);
      filtered = filtered.filter(m => {
        if (m.platform !== platform) return false;
        // For email, further filter by account address if possible
        // (backend may tag messages with account info)
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

    // Sort: unread first, then by timestamp
    filtered.sort((a, b) => {
      if (!a.is_read && b.is_read) return -1;
      if (a.is_read && !b.is_read) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return filtered;
  }, []);

  // Compute counts
  const computeCounts = useCallback((msgs: ConversationItem[]) => {
    const aCounts: Record<string, number> = {};
    const fCounts: Record<string, number> = {};

    for (const account of ACCOUNTS) {
      const platform = account.platform;
      aCounts[account.id] = msgs.filter(m => m.platform === platform && !m.is_read).length;
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
  }, []);

  // Load messages from backend
  const loadMessages = useCallback(async (forceRefresh = false) => {
    const showArchived = selectedFolder === 'archived';
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // FIXED: Increased limit from 50 to 500 to show more messages
      const result = await (window as any).clawdbot?.messages?.recent(500, showArchived);
      if (result?.success && result.chats && isMounted.current) {
        const msgs = result.chats as ConversationItem[];
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
  }, [selectedFolder, computeCounts]);

  // Update display when filters change
  useEffect(() => {
    const filtered = filterMessages(allMessages, selectedAccount, selectedFolder, searchQuery);
    setDisplayMessages(filtered);
  }, [allMessages, selectedAccount, selectedFolder, searchQuery, filterMessages]);

  // Initial load + polling
  useEffect(() => {
    isMounted.current = true;
    loadMessages();
    const interval = setInterval(() => {
      if (isMounted.current) loadMessages(true);
    }, 30000);
    return () => { isMounted.current = false; clearInterval(interval); };
  }, [loadMessages]);

  // Load thread/body when conversation selected
  useEffect(() => {
    if (!selectedConversation) {
      setThread([]);
      setEmailBody('');
      return;
    }

    const loadDetail = async () => {
      if (selectedConversation.platform === 'email') {
        setLoadingBody(true);
        try {
          // Extract email ID - handle various formats
          let emailId = selectedConversation.id;
          if (emailId.startsWith('email-')) {
            emailId = emailId.replace('email-', '');
          }
          
          console.log('[CommsInbox3Pane] Fetching email body for ID:', emailId);
          const result = await (window as any).clawdbot?.email?.body(emailId);
          console.log('[CommsInbox3Pane] Email body result:', result?.success, 'body length:', result?.body?.length);
          
          if (result?.success && result.body) {
            setEmailBody(result.body);
          } else {
            console.warn('[CommsInbox3Pane] No email body returned:', result?.error);
            // Fall back to preview if body not available
            setEmailBody('');
          }
        } catch (e) {
          console.error('[CommsInbox3Pane] Failed to load email body:', e);
          setEmailBody('');
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
    };

    loadDetail();
  }, [selectedConversation?.id]);

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
        // Add to thread
        setThread(prev => [...prev, {
          id: `sent-${Date.now()}`,
          sender: 'You',
          text,
          timestamp: 'just now',
          fromMe: true,
        }]);
      } else {
        alert(`❌ Failed to send: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`❌ Error: ${e.message}`);
    }
  };

  // Get label for center pane header
  const getAccountLabel = (): string => {
    if (!selectedAccount) return 'All Messages';
    const account = ACCOUNTS.find(a => a.id === selectedAccount);
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
      />
      <CenterPane
        conversations={displayMessages}
        selectedId={selectedConversation?.id || null}
        onSelect={setSelectedConversation}
        onToggleStar={handleToggleStar}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        accountLabel={getAccountLabel()}
        onRefresh={() => loadMessages(true)}
        refreshing={refreshing}
      />
      <RightPane
        conversation={selectedConversation}
        thread={thread}
        loadingThread={loadingThread}
        onSendReply={handleSendReply}
        emailBody={emailBody}
        loadingBody={loadingBody}
      />
    </div>
  );
}
