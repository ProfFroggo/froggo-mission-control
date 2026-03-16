// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef } from 'react';
import { X, Award, TrendingUp, Clock, CheckCircle, XCircle, FileText, Activity, Brain, RefreshCw, Wifi, WifiOff, MessageSquare, CalendarDays, Cpu, Edit, Tag, Power, BarChart2, Lightbulb, Check, AlertTriangle, Plus, Star, Wrench, Shield, ChevronDown, ChevronRight, Server, Trash2, UserMinus, PowerOff, Link, Upload, Send, Key } from 'lucide-react';
import { useStore } from '../store/store';
import AgentChatModal from './AgentChatModal';
import AgentActivityTimeline from './AgentActivityTimeline';
import AgentSoulEditor from './AgentSoulEditor';
import AgentCoachingCard from './AgentCoachingCard';
import { agentApi, catalogApi, settingsApi, libraryApi } from '../lib/api';
import { showToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { isProtectedAgent } from '../lib/agentConfig';
import { StreamingText } from './StreamingText';
import AgentConfigPanel from './AgentConfigPanel';

// Claude models only
const CLAUDE_MODELS = [
  { id: 'opus',   label: 'Claude Opus 4.6',  desc: 'Most capable — complex reasoning, long context' },
  { id: 'sonnet', label: 'Claude Sonnet 4.6', desc: 'Balanced — fast and highly capable' },
  { id: 'haiku',  label: 'Claude Haiku 4.5',  desc: 'Fastest — lightweight tasks, high throughput' },
];

const MCP_SERVERS = [
  {
    id: 'mission-control_db',
    label: 'Mission Control DB',
    tools: [
      'task_create', 'task_update', 'task_get', 'task_list',
      'task_activity_create', 'agent_sessions_create', 'agent_sessions_get',
      'chat_post', 'chat_read', 'approval_create', 'schedule_create', 'schedule_list',
      'image_generate',
    ],
  },
  {
    id: 'memory',
    label: 'Memory MCP',
    tools: ['memory_search', 'memory_recall', 'memory_write', 'memory_read'],
  },
  {
    id: 'google-workspace',
    label: 'Google Workspace',
    tools: [
      'auth_clear', 'auth_refreshToken',
      'calendar_list', 'calendar_listEvents', 'calendar_getEvent',
      'calendar_createEvent', 'calendar_updateEvent', 'calendar_deleteEvent',
      'calendar_findFreeTime', 'calendar_respondToEvent',
      'gmail_search', 'gmail_get', 'gmail_listLabels',
      'gmail_send', 'gmail_createDraft', 'gmail_sendDraft',
      'gmail_modify', 'gmail_downloadAttachment',
      'drive_search', 'drive_findFolder', 'drive_downloadFile',
      'docs_find', 'docs_create', 'docs_getText', 'docs_appendText',
      'docs_insertText', 'docs_replaceText', 'docs_move', 'docs_extractIdFromUrl',
      'sheets_find', 'sheets_getMetadata', 'sheets_getRange', 'sheets_getText',
      'slides_find', 'slides_getMetadata', 'slides_getText',
      'chat_listSpaces', 'chat_findSpaceByName', 'chat_findDmByEmail',
      'chat_listThreads', 'chat_getMessages', 'chat_sendMessage',
      'chat_sendDm', 'chat_setUpSpace',
      'people_getMe', 'people_getUserProfile',
      'time_getCurrentDate', 'time_getCurrentTime', 'time_getTimeZone',
    ],
  },
  {
    id: 'n8n-mcp',
    label: 'n8n Automation',
    tools: [
      'n8n_list_workflows', 'n8n_get_workflow', 'n8n_create_workflow',
      'n8n_update_full_workflow', 'n8n_update_partial_workflow', 'n8n_delete_workflow',
      'n8n_test_workflow', 'n8n_executions', 'n8n_workflow_versions',
      'n8n_validate_workflow', 'n8n_autofix_workflow', 'n8n_deploy_template',
      'n8n_health_check', 'get_node', 'get_template', 'search_nodes',
      'search_templates', 'tools_documentation', 'validate_node', 'validate_workflow',
    ],
  },
  {
    id: 'claude_ai_Vercel',
    label: 'Vercel',
    tools: [
      'list_projects', 'get_project', 'list_deployments', 'get_deployment',
      'get_deployment_build_logs', 'get_runtime_logs', 'deploy_to_vercel',
      'list_teams', 'get_access_to_vercel_url', 'web_fetch_vercel_url',
      'check_domain_availability_and_price', 'search_vercel_documentation',
    ],
  },
  {
    id: 'birdeye-api-mcp',
    label: 'Birdeye (DeFi/Tokens)',
    tools: [
      'get-defi-price', 'get-defi-multi_price', 'post-defi-multi_price',
      'get-defi-history_price', 'get-defi-historical_price_unix',
      'get-defi-ohlcv', 'get-defi-ohlcv-pair', 'get-defi-ohlcv-base_quote',
      'get-defi-v3-ohlcv', 'get-defi-v3-ohlcv-pair',
      'get-defi-token_overview', 'get-defi-token_security', 'get-defi-token_trending',
      'get-defi-token_creation_info', 'get-defi-tokenlist',
      'get-defi-v3-token-list', 'get-defi-v3-token-list-scroll',
      'get-defi-v3-token-meta-data-single', 'get-defi-v3-token-meta-data-multiple',
      'get-defi-v3-token-market-data', 'get-defi-v3-token-market-data-multiple',
      'get-defi-v3-token-trade-data-single', 'get-defi-v3-token-trade-data-multiple',
      'get-defi-v3-token-holder', 'get-defi-v3-token-txs',
      'get-defi-v3-token-mint-burn-txs',
      'get-defi-price_volume-single', 'post-defi-price_volume-multi',
      'get-defi-txs-token', 'get-defi-txs-token-seek_by_time',
      'get-defi-txs-pair', 'get-defi-txs-pair-seek_by_time',
      'get-defi-v3-txs', 'get-defi-v3-txs-latest-block',
      'get-defi-v3-all-time-trades-single', 'post-defi-v3-all-time-trades-multiple',
      'get-defi-v2-markets', 'get-defi-v2-tokens-new_listing', 'get-defi-v2-tokens-top_traders',
      'get-defi-v3-pair-overview-single', 'get-defi-v3-pair-overview-multiple',
      'get-defi-v3-search', 'get-defi-networks',
      'get-trader-gainers-losers', 'get-trader-txs-seek_by_time',
      'get-v1-wallet-token_balance', 'get-v1-wallet-token_list',
      'get-v1-wallet-tx_list', 'get-v1-wallet-list_supported_chain',
      'get-wallet-v2-balance-change',
    ],
  },
  {
    id: 'solana-mcp-server',
    label: 'Solana',
    tools: [
      'Solana_Documentation_Search', 'Solana_Expert__Ask_For_Help',
      'Ask_Solana_Anchor_Framework_Expert',
    ],
  },
  {
    id: 'supabase',
    label: 'Supabase',
    tools: [
      'list_projects', 'get_project', 'create_project', 'pause_project', 'restore_project',
      'list_organizations', 'get_organization',
      'execute_sql', 'apply_migration', 'list_migrations',
      'list_tables', 'list_extensions', 'generate_typescript_types',
      'create_branch', 'list_branches', 'delete_branch', 'merge_branch',
      'reset_branch', 'rebase_branch',
      'deploy_edge_function', 'get_edge_function', 'list_edge_functions',
      'get_logs', 'get_advisors',
      'get_project_url', 'get_publishable_keys',
      'get_cost', 'confirm_cost',
      'search_docs',
    ],
  },
];

const TRUST_TIERS = [
  { id: 'restricted', label: 'Restricted', desc: 'Read-only. No writes, no approvals granted.', color: 'text-error' },
  { id: 'apprentice',  label: 'Apprentice',  desc: 'Tier 1 auto-approved. Tier 2+ queued for review.', color: 'text-warning' },
  { id: 'worker',      label: 'Worker',      desc: 'Tier 1-2 auto-approved. Tier 3 queued.', color: 'text-info' },
  { id: 'trusted',     label: 'Trusted',     desc: 'All tiers auto-approved except Tier 3 external actions.', color: 'text-success' },
  { id: 'admin',       label: 'Admin',       desc: 'Full autonomy. All tiers auto-approved.', color: 'text-review' },
];

const PERMISSION_GROUPS = [
  {
    label: 'File System',
    perms: [
      { id: 'fs.read',   label: 'Read files', tier: 0 },
      { id: 'fs.write',  label: 'Write files', tier: 1 },
      { id: 'fs.delete', label: 'Delete files', tier: 2 },
    ],
  },
  {
    label: 'Git',
    perms: [
      { id: 'git.read',   label: 'Status / log / diff', tier: 0 },
      { id: 'git.commit', label: 'Commit to branch', tier: 1 },
      { id: 'git.push',   label: 'Push to remote', tier: 2 },
      { id: 'git.force',  label: 'Force push', tier: 3 },
    ],
  },
  {
    label: 'Tasks',
    perms: [
      { id: 'tasks.read',   label: 'Read tasks', tier: 0 },
      { id: 'tasks.update', label: 'Update status', tier: 1 },
      { id: 'tasks.done',   label: 'Mark as done', tier: 2 },
    ],
  },
  {
    label: 'External',
    perms: [
      { id: 'external.draft',  label: 'Draft emails / posts', tier: 2 },
      { id: 'external.send',   label: 'Send emails', tier: 3 },
      { id: 'external.social', label: 'Post to social media', tier: 3 },
      { id: 'external.deploy', label: 'Deploy to production', tier: 3 },
    ],
  },
];

const TIER_PRESETS: Record<string, Record<string, boolean>> = {
  restricted: {
    'fs.read': true,    'fs.write': false,   'fs.delete': false,
    'git.read': true,   'git.commit': false,  'git.push': false,   'git.force': false,
    'tasks.read': true, 'tasks.update': false,'tasks.done': false,
    'external.draft': false, 'external.send': false, 'external.social': false, 'external.deploy': false,
  },
  apprentice: {
    'fs.read': true,    'fs.write': true,    'fs.delete': false,
    'git.read': true,   'git.commit': true,   'git.push': false,   'git.force': false,
    'tasks.read': true, 'tasks.update': true, 'tasks.done': false,
    'external.draft': false, 'external.send': false, 'external.social': false, 'external.deploy': false,
  },
  worker: {
    'fs.read': true,    'fs.write': true,    'fs.delete': true,
    'git.read': true,   'git.commit': true,   'git.push': true,    'git.force': false,
    'tasks.read': true, 'tasks.update': true, 'tasks.done': true,
    'external.draft': true,  'external.send': false, 'external.social': false, 'external.deploy': false,
  },
  trusted: {
    'fs.read': true,    'fs.write': true,    'fs.delete': true,
    'git.read': true,   'git.commit': true,   'git.push': true,    'git.force': false,
    'tasks.read': true, 'tasks.update': true, 'tasks.done': true,
    'external.draft': true,  'external.send': true,  'external.social': false, 'external.deploy': false,
  },
  admin: {
    'fs.read': true,    'fs.write': true,    'fs.delete': true,
    'git.read': true,   'git.commit': true,   'git.push': true,    'git.force': true,
    'tasks.read': true, 'tasks.update': true, 'tasks.done': true,
    'external.draft': true,  'external.send': true,  'external.social': true,  'external.deploy': true,
  },
};

const TIER_COLORS = ['text-success', 'text-info', 'text-warning', 'text-error'];

const API_PRESETS = [
  { label: 'Custom',                service: '',               placeholder: 'Your API key or secret' },
  { label: 'Anthropic',             service: 'Anthropic',      placeholder: 'sk-ant-...' },
  { label: 'OpenAI',                service: 'OpenAI',         placeholder: 'sk-...' },
  { label: 'Google Gemini',         service: 'Google Gemini',  placeholder: 'AIza...' },
  { label: 'X / Twitter API Key',   service: 'Twitter',        placeholder: 'API key (Consumer key)' },
  { label: 'X / Twitter Bearer',    service: 'Twitter Bearer', placeholder: 'AAAA...' },
  { label: 'Discord Bot Token',     service: 'Discord',        placeholder: 'Bot token' },
  { label: 'Slack Bot Token',       service: 'Slack',          placeholder: 'xoxb-...' },
  { label: 'GitHub Token',          service: 'GitHub',         placeholder: 'ghp_...' },
  { label: 'Stripe',                service: 'Stripe',         placeholder: 'sk_live_... or sk_test_...' },
  { label: 'Twilio Auth Token',     service: 'Twilio',         placeholder: 'Auth token from console' },
  { label: 'SendGrid',              service: 'SendGrid',       placeholder: 'SG...' },
  { label: 'AWS Access Key',        service: 'AWS',            placeholder: 'AKIA...' },
  { label: 'Perplexity',            service: 'Perplexity',     placeholder: 'pplx-...' },
  { label: 'Replicate',             service: 'Replicate',      placeholder: 'r8_...' },
  { label: 'ElevenLabs',            service: 'ElevenLabs',     placeholder: 'API key from dashboard' },
  { label: 'Birdeye',               service: 'Birdeye',        placeholder: 'API key from dashboard' },
  { label: 'Helius',                service: 'Helius',         placeholder: 'API key from dashboard' },
];

interface Skill { id: string; name: string; slug: string; description: string }
interface APIKeyEntry { id: string; name: string; service: string; key: string; createdAt: string }
interface McpServerEntry {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}
type AddSkillMode = 'url' | 'text' | null;

type TabKey = 'performance' | 'skills' | 'tasks' | 'rules' | 'soul' | 'coaching' | 'tools' | 'permissions' | 'chat';

interface AgentDetailModalProps {
  agentId: string;
  onClose: () => void;
  initialTab?: TabKey;
}

interface AgentDetails {
  // Performance
  successRate: number;
  avgTime: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  // Skills from agent capabilities
  skills: Array<{
    name: string;
    proficiency: number;
    lastUsed: string;
    successCount: number;
    failureCount: number;
  }>;
  // Real tasks from store
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    outcome: string;
    completedAt: number;
    project?: string;
    tags?: string;
    planningNotes?: string;
  }>;
  // Active sessions
  activeSessions: Array<{
    key: string;
    model: string;
    tokens: number;
    isActive: boolean;
    updatedAt: number;
    label?: string;
  }>;
  // Agent identity/config
  agentRules: string;
  brainNotes: string[];
}

interface AgentStats {
  tasksCompleted: number;
  tasksRejected: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

const AGENT_STATUSES = [
  { value: 'active',      label: 'Online',      color: 'text-success' },
  { value: 'busy',        label: 'Busy',         color: 'text-warning' },
  { value: 'idle',        label: 'Offline',      color: 'text-mission-control-text-dim' },
  { value: 'disabled',    label: 'Maintenance',  color: 'text-error' },
] as const;

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export default function AgentDetailModal({ agentId, onClose, initialTab }: AgentDetailModalProps) {
  const { agents, tasks, gatewaySessions } = useStore();
  const fetchAgents = useStore(s => s.fetchAgents);
  const updateAgentStatus = useStore(s => s.updateAgentStatus);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'performance');
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const agent = agents.find(a => a.id === agentId);

  // ── Description edit state ───────────────────────
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Capability tags state ────────────────────────
  const [capTags, setCapTags] = useState<string[]>([]);
  const [capInput, setCapInput] = useState('');
  const [capSaving, setCapSaving] = useState(false);
  const [capDirty, setCapDirty] = useState(false);

  // ── Status override state ────────────────────────
  const [statusOverride, setStatusOverride] = useState<string>('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [showStatusOverride, setShowStatusOverride] = useState(false);

  // ── Performance stats ────────────────────────────
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Skill gap suggestions ────────────────────────
  const [skillGaps, setSkillGaps] = useState<string[]>([]);

  // ── Config state (from AgentManagementModal) ─────
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Soul editing
  const [soul, setSoul] = useState('');
  const [soulDirty, setSoulDirty] = useState(false);
  const [showRestartBanner, setShowRestartBanner] = useState(false);

  // Model
  const [model, setModel] = useState('sonnet');
  const [modelDirty, setModelDirty] = useState(false);

  // Skills (library)
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [skillsDirty, setSkillsDirty] = useState(false);
  const [addSkillMode, setAddSkillMode] = useState<AddSkillMode>(null);
  const [addSkillName, setAddSkillName] = useState('');
  const [addSkillUrl, setAddSkillUrl] = useState('');
  const [addSkillContent, setAddSkillContent] = useState('');
  const [addSkillWorking, setAddSkillWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tools
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [toolsDirty, setToolsDirty] = useState(false);

  // MCP Servers
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([]);
  const [mcpDirty, setMcpDirty] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [newMcp, setNewMcp] = useState({ name: '', transport: 'stdio' as 'stdio' | 'http', command: 'npx', args: '', url: '', env: '' });

  // API Keys
  const [allApiKeys, setAllApiKeys] = useState<APIKeyEntry[]>([]);
  const [activeApiKeys, setActiveApiKeys] = useState<string[]>([]);
  const [apiKeysDirty, setApiKeysDirty] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', service: '', key: '' });
  const [addingKey, setAddingKey] = useState(false);

  // Permissions
  const [trustTier, setTrustTier] = useState('apprentice');
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [agentDisallowed, setAgentDisallowed] = useState<string[]>([]);
  const [newDisallowed, setNewDisallowed] = useState('');
  const [permDirty, setPermDirty] = useState(false);
  const [presetApplied, setPresetApplied] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [prevTrustTier, setPrevTrustTier] = useState<string | null>(null);

  // HR actions
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [hrActionLoading, setHrActionLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; streaming?: boolean }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Rules editing
  const [rulesEditing, setRulesEditing] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);

  const inputBase = 'w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text text-sm focus:outline-none focus:border-mission-control-accent';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Sync caps from agent store into local state
  useEffect(() => {
    if (agent?.capabilities) {
      setCapTags([...agent.capabilities]);
    }
  }, [agent?.capabilities]);

  // Load stats when performance tab is active
  useEffect(() => {
    if (activeTab !== 'performance') return;
    if (agentStats) return;
    setStatsLoading(true);
    fetch(`/api/agents/${agentId}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgentStats(data); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [activeTab, agentId, agentStats]);

  const buildDetailsFromRealData = async () => {
    setLoading(true);

    // Try REST API first (reads from mission-control.db with real data)
    let ipcDetails: any = null;
    try {
      ipcDetails = await agentApi.getById(agentId);
    } catch (_e) {
      // API failed, will fall back to store data
    }

    // Get tasks from store as fallback/supplement
    const agentTasks = tasks.filter(t => t.assignedTo === agentId);
    const doneTasks = agentTasks.filter(t => t.status === 'done');
    const failedTasksList = agentTasks.filter(t => (t.status as string) === 'failed');
    const inProgressTasks = agentTasks.filter(t => t.status === 'in-progress');

    // Use IPC data if available, otherwise fall back to store data
    const totalTasks = ipcDetails?.totalTasks ?? agentTasks.length;
    const successfulCount = ipcDetails?.successfulTasks ?? doneTasks.length;
    const failedCount = ipcDetails?.failedTasks ?? failedTasksList.length;
    const successRate = ipcDetails?.successRate ?? (totalTasks > 0 ? successfulCount / totalTasks : 0);
    const avgTimeStr = ipcDetails?.avgTime || 'N/A';

    // Skills: prefer IPC data, fall back to agent capabilities
    let skills = ipcDetails?.skills || [];
    if (skills.length === 0 && agent?.capabilities?.length) {
      skills = agent.capabilities.map((cap: string) => ({
        name: cap,
        proficiency: 0.5,
        lastUsed: 'N/A',
        successCount: 0,
        failureCount: 0,
      }));
    }

    // Recent tasks: prefer IPC, supplement with store
    let recentTasks = ipcDetails?.recentTasks || [];
    if (recentTasks.length === 0 && agentTasks.length > 0) {
      recentTasks = agentTasks
        .sort((a, b) => ((b as any).updatedAt || 0) - ((a as any).updatedAt || 0))
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          outcome: t.status === 'done' ? 'success' : t.status === 'failed' ? 'failed' : 'pending',
          completedAt: (t as any).completedAt || (t as any).updatedAt || 0,
          project: t.project,
          tags: (t as any).tags,
          planningNotes: (t as any).planningNotes,
        }));
    }

    // Active gateway sessions for this agent
    const agentSessions = gatewaySessions.filter(s => {
      const key = s.key.toLowerCase();
      const id = agentId.toLowerCase();
      return key.includes(id) || (s.label && s.label.toLowerCase().includes(id));
    });

    const activeSessions = agentSessions.map(s => ({
      key: s.key,
      model: s.model || 'unknown',
      tokens: s.totalTokens || 0,
      isActive: s.isActive,
      updatedAt: s.updatedAt || 0,
      label: s.label || undefined,
    }));

    // Rules and brain notes from IPC or exec fallback
    let rulesContent = ipcDetails?.agentRules || '';
    let brainNotes: string[] = ipcDetails?.brainNotes || [];

    if (!rulesContent) {
      try {
        const soulData = await agentApi.readSoul(agentId);
        rulesContent = soulData?.content || `No AGENT.md found for ${agentId}`;
      } catch (_e) {
        rulesContent = `Could not load rules for ${agentId}`;
      }
    }

    if (brainNotes.length === 0) {
      // Brain notes / memory files — no REST equivalent
      console.warn('Not implemented: exec.run for memory listing', agentId);
    }

    // ── Skill gap computation ─────────────────────
    const agentCaps = new Set((agent?.capabilities || []).map(c => c.toLowerCase()));
    const recent5Tasks = recentTasks.slice(0, 5);
    const skillMentions: Record<string, number> = {};

    for (const t of recent5Tasks) {
      // Extract from tags JSON string
      const rawTags: string[] = [];
      if (t.tags) {
        try {
          const parsed = JSON.parse(t.tags);
          if (Array.isArray(parsed)) rawTags.push(...parsed);
        } catch {
          rawTags.push(...String(t.tags).split(','));
        }
      }
      // Also scan planningNotes for skill-like words (simple heuristic)
      if (t.planningNotes) {
        const words = t.planningNotes.match(/\b[a-z][a-z0-9-]{3,}\b/gi) || [];
        rawTags.push(...words.filter(w => w.length >= 4));
      }
      for (const tag of rawTags) {
        const norm = tag.trim().toLowerCase();
        if (norm && !agentCaps.has(norm)) {
          skillMentions[norm] = (skillMentions[norm] || 0) + 1;
        }
      }
    }
    // Gaps = things mentioned in ≥ 2 recent tasks not already in capabilities
    const gaps = Object.entries(skillMentions)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);
    setSkillGaps(gaps);

    setDetails({
      successRate,
      avgTime: avgTimeStr,
      totalTasks,
      successfulTasks: successfulCount,
      failedTasks: failedCount,
      inProgressTasks: ipcDetails ? (totalTasks - successfulCount - failedCount) : inProgressTasks.length,
      skills,
      recentTasks,
      activeSessions,
      agentRules: rulesContent,
      brainNotes,
    });

    setLoading(false);
  };

  useEffect(() => {
    buildDetailsFromRealData();
  }, [agentId, tasks, gatewaySessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key !== 'Escape') return;
      }
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); return; }
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === 'r') { e.preventDefault(); buildDetailsFromRealData(); return; }
      if (isCmdOrCtrl && /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, typeof activeTab> = { '1': 'performance', '2': 'coaching', '3': 'skills', '4': 'tasks', '5': 'tools', '6': 'permissions', '7': 'rules', '8': 'soul', '9': 'chat' };
        if (e.key in tabMap) setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeTab]);

  // ── Load config data for management tabs ──────────
  useEffect(() => {
    setConfigLoading(true);
    setSoulDirty(false); setModelDirty(false); setSkillsDirty(false);
    setToolsDirty(false); setApiKeysDirty(false); setPermDirty(false);
    setMcpDirty(false); setShowAddMcp(false);
    setShowRestartBanner(false); setAddSkillMode(null);

    Promise.allSettled([
      agentApi.readSoul(agentId),
      agentApi.getConfig(agentId),
      (libraryApi as any).getSkills(),
      settingsApi.get('security.keys'),
      settingsApi.get(`agent.${agentId}.permissions`),
      settingsApi.get(`agent.${agentId}.disallowedTools`),
      agentApi.getById(agentId),
    ]).then(([soulR, configR, skillsR, keysR, permR, disallowR, agentR]) => {
      if (soulR.status === 'fulfilled') setSoul((soulR.value as any)?.content || '');
      if (configR.status === 'fulfilled') {
        const c = configR.value as any;
        setModel(c?.model || 'sonnet');
        setActiveSkills(c?.skills || []);
        setActiveTools(c?.tools || []);
        setActiveApiKeys(c?.apiKeys || []);
        setTrustTier(c?.trustTier || 'apprentice');
        setMcpServers(c?.mcpServers || []);
      }
      if (skillsR.status === 'fulfilled') setAllSkills((skillsR.value as any)?.skills || []);
      if (keysR.status === 'fulfilled') {
        try {
          const val = (keysR.value as any)?.value;
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          setAllApiKeys(Array.isArray(parsed) ? parsed : []);
        } catch { setAllApiKeys([]); }
      }
      if (permR.status === 'fulfilled') {
        try {
          const val = (permR.value as any)?.value;
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          setPermOverrides(parsed && typeof parsed === 'object' ? parsed : {});
        } catch { setPermOverrides({}); }
      }
      if (disallowR.status === 'fulfilled') {
        try {
          const val = (disallowR.value as any)?.value;
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          setAgentDisallowed(Array.isArray(parsed) ? parsed : []);
        } catch { setAgentDisallowed([]); }
      }
      if (agentR.status === 'fulfilled') {
        setAgentStatus((agentR.value as any)?.status || 'idle');
      }
      setConfigLoading(false);
    });
  }, [agentId]);

  // Scroll chat
  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  // ── Chat handler ──────────────────────────────────
  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatInput('');
    setChatSending(true);
    const userMsg = { role: 'user' as const, content: text };
    setChatMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
    chatAbortRef.current = new AbortController();
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: chatAbortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'text_delta' && evt.text) {
              accumulated += evt.text;
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: accumulated } : m));
            } else if (evt.type === 'done') {
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
            } else if (evt.type === 'error') {
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: evt.error || 'Error', streaming: false } : m));
            }
          } catch { /* skip malformed SSE */ }
        }
      }
      setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setChatMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: 'Failed to connect.', streaming: false } : m));
      }
    } finally {
      setChatSending(false);
    }
  }

  // ── Config save handlers ──────────────────────────
  const saveSoul = async () => {
    setSaving(true);
    try {
      await agentApi.writeSoul(agentId, soul);
      setSoulDirty(false); setShowRestartBanner(true);
      showToast('success', 'SOUL.md saved');
    } catch { showToast('error', 'Failed to save SOUL.md'); }
    finally { setSaving(false); }
  };

  const saveModel = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { model });
      setModelDirty(false);
      showToast('success', 'Model updated');
    } catch { showToast('error', 'Failed to update model'); }
    finally { setSaving(false); }
  };

  const saveSkills = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { skills: activeSkills });
      setSkillsDirty(false);
      showToast('success', 'Skills saved');
    } catch { showToast('error', 'Failed to save skills'); }
    finally { setSaving(false); }
  };

  const saveTools = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { tools: activeTools });
      setToolsDirty(false);
      showToast('success', 'Tool access saved');
    } catch { showToast('error', 'Failed to save tools'); }
    finally { setSaving(false); }
  };

  const saveMcp = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { mcpServers });
      setMcpDirty(false);
      showToast('success', 'MCP servers saved');
    } catch { showToast('error', 'Failed to save MCP servers'); }
    finally { setSaving(false); }
  };

  const addMcpServer = () => {
    if (!newMcp.name.trim()) return;
    const envMap: Record<string, string> = {};
    newMcp.env.trim().split('\n').filter(l => l.includes('=')).forEach(l => {
      const idx = l.indexOf('=');
      envMap[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });
    const entry: McpServerEntry = {
      id: `mcp-${Date.now()}`,
      name: newMcp.name.trim(),
      transport: newMcp.transport,
      ...(newMcp.transport === 'stdio' ? {
        command: newMcp.command.trim() || 'npx',
        args: newMcp.args.trim() ? newMcp.args.trim().split(/\s+/) : [],
      } : {
        url: newMcp.url.trim(),
      }),
      ...(Object.keys(envMap).length > 0 ? { env: envMap } : {}),
    };
    setMcpServers(prev => [...prev, entry]);
    setMcpDirty(true);
    setShowAddMcp(false);
    setNewMcp({ name: '', transport: 'stdio', command: 'npx', args: '', url: '', env: '' });
  };

  const removeMcpServer = (id: string) => {
    setMcpServers(prev => prev.filter(s => s.id !== id));
    setMcpDirty(true);
  };

  const saveApiKeys = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { apiKeys: activeApiKeys });
      setApiKeysDirty(false);
      showToast('success', 'API access saved');
    } catch { showToast('error', 'Failed to save API access'); }
    finally { setSaving(false); }
  };

  const handleCreateKey = async () => {
    if (!newKey.name.trim() || !newKey.service.trim() || !newKey.key.trim()) {
      showToast('error', 'All fields are required'); return;
    }
    setAddingKey(true);
    try {
      const result = await settingsApi.get('security.keys');
      const existing: APIKeyEntry[] = (() => {
        try { const v = (result as any)?.value; const p = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; }
      })();
      const entry: APIKeyEntry = { id: `key-${Date.now()}`, name: newKey.name.trim(), service: newKey.service.trim(), key: newKey.key.trim(), createdAt: new Date().toISOString() };
      await settingsApi.set('security.keys', [...existing, entry]);
      setAllApiKeys(prev => [...prev, entry]);
      setActiveApiKeys(prev => [...prev, entry.id]);
      setApiKeysDirty(true);
      setNewKey({ name: '', service: '', key: '' });
      setShowAddKey(false);
      showToast('success', `"${entry.name}" added and assigned`);
    } catch { showToast('error', 'Failed to add key'); }
    finally { setAddingKey(false); }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { trustTier });
      await settingsApi.set(`agent.${agentId}.permissions`, permOverrides);
      await settingsApi.set(`agent.${agentId}.disallowedTools`, agentDisallowed);
      setPermDirty(false);
      fetchAgents();
      showToast('success', 'Permissions saved');
    } catch { showToast('error', 'Failed to save permissions'); }
    finally { setSaving(false); }
  };

  const handleAddAgentDisallowed = () => {
    const val = newDisallowed.trim();
    if (!val || agentDisallowed.includes(val)) return;
    setAgentDisallowed(prev => [...prev, val]);
    setNewDisallowed('');
    setPermDirty(true);
  };

  const handleRemoveAgentDisallowed = (tool: string) => {
    setAgentDisallowed(prev => prev.filter(t => t !== tool));
    setPermDirty(true);
  };

  const handleAddSkill = async () => {
    if (!addSkillName.trim()) { showToast('error', 'Skill name is required'); return; }
    if (addSkillMode === 'url' && !addSkillUrl.trim()) { showToast('error', 'URL is required'); return; }
    if (addSkillMode === 'text' && !addSkillContent.trim()) { showToast('error', 'Content is required'); return; }
    setAddSkillWorking(true);
    try {
      const payload: { name: string; url?: string; content?: string } = { name: addSkillName.trim() };
      if (addSkillMode === 'url') payload.url = addSkillUrl.trim();
      else payload.content = addSkillContent.trim();
      const result = await (libraryApi as any).createSkill(payload);
      if (result?.error) { showToast('error', result.error); return; }
      const fresh = await (libraryApi as any).getSkills();
      setAllSkills(fresh?.skills || []);
      setActiveSkills(prev => [...prev, result.slug]);
      setSkillsDirty(true);
      setAddSkillMode(null);
      setAddSkillName(''); setAddSkillUrl(''); setAddSkillContent('');
      showToast('success', `Skill "${result.name}" created`);
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Failed to create skill');
    } finally { setAddSkillWorking(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!addSkillName.trim()) setAddSkillName(file.name.replace(/\.md$/i, ''));
    const reader = new FileReader();
    reader.onload = ev => { setAddSkillContent(ev.target?.result as string || ''); };
    reader.readAsText(file);
    e.target.value = '';
  };

  function toggleSkill(slug: string) {
    setActiveSkills(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
    setSkillsDirty(true);
  }
  function toggleTool(tool: string) {
    setActiveTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
    setToolsDirty(true);
  }
  function toggleServer(serverTools: string[], enable: boolean) {
    setActiveTools(prev => { const w = prev.filter(t => !serverTools.includes(t)); return enable ? [...w, ...serverTools] : w; });
    setToolsDirty(true);
  }
  function toggleApiKey(keyId: string) {
    setActiveApiKeys(prev => prev.includes(keyId) ? prev.filter(k => k !== keyId) : [...prev, keyId]);
    setApiKeysDirty(true);
  }

  const saveRules = async () => {
    setRulesSaving(true);
    try {
      await agentApi.writeSoul(agentId, rulesDraft);
      if (details) {
        setDetails({ ...details, agentRules: rulesDraft });
      }
      setRulesEditing(false);
      showToast('success', 'Rules saved');
    } catch { showToast('error', 'Failed to save rules'); }
    finally { setRulesSaving(false); }
  };

  if (!agent) return null;

  // ── Description handlers ─────────────────────────
  const startEditDesc = () => {
    setDescDraft(agent.description || '');
    setEditingDesc(true);
    setTimeout(() => descInputRef.current?.focus(), 50);
  };

  const cancelEditDesc = () => {
    setEditingDesc(false);
    setDescDraft('');
  };

  const saveDesc = async () => {
    if (descSaving) return;
    setDescSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descDraft.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingDesc(false);
      showToast('success', 'Description updated');
      fetchAgents();
    } catch (err) {
      showToast('error', 'Failed to save description', (err as Error).message);
    } finally {
      setDescSaving(false);
    }
  };

  // ── Capability handlers ──────────────────────────
  const addCapTag = () => {
    const val = capInput.trim();
    if (!val || capTags.includes(val)) { setCapInput(''); return; }
    setCapTags(prev => [...prev, val]);
    setCapInput('');
    setCapDirty(true);
  };

  const removeCapTag = (tag: string) => {
    setCapTags(prev => prev.filter(t => t !== tag));
    setCapDirty(true);
  };

  const saveCaps = async () => {
    if (capSaving) return;
    setCapSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: capTags }),
      });
      if (!res.ok) throw new Error('Save failed');
      setCapDirty(false);
      showToast('success', 'Capabilities updated');
      fetchAgents();
    } catch (err) {
      showToast('error', 'Failed to save capabilities', (err as Error).message);
    } finally {
      setCapSaving(false);
    }
  };

  // ── Status override handler ──────────────────────
  const applyStatusOverride = async () => {
    if (!statusOverride || statusSaving) return;
    setStatusSaving(true);
    // Optimistic update via store
    updateAgentStatus(agentId, statusOverride as any);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusOverride }),
      });
      if (!res.ok) throw new Error('Override failed');
      showToast('success', `Status overridden to ${statusOverride}`);
      setShowStatusOverride(false);
      fetchAgents();
    } catch (err) {
      // Rollback by refetching
      fetchAgents();
      showToast('error', 'Failed to override status', (err as Error).message);
    } finally {
      setStatusSaving(false);
    }
  };

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  // Handle inner click with keyboard support
  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <>
    <div
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <div
        className={`glass-modal rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-mission-control-bg">
              <img
                src={`/api/agents/${agent.id}/avatar`}
                alt={agent.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const sibling = target.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.classList.remove('hidden');
                }}
              />
              <span className="hidden absolute inset-0 flex items-center justify-center text-4xl">{agent.avatar}</span>
              {/* Status dot */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-mission-control-bg ${
                agent.status === 'busy' || agent.status === 'active' ? 'bg-success animate-pulse' : 'bg-mission-control-text-dim/40'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-mission-control-text">{agent.name}</h2>
                {(agent as any).model && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim border border-mission-control-border/60">
                    <Cpu size={10} />
                    {(agent as any).model}
                  </span>
                )}
              </div>

              {/* Editable description */}
              {editingDesc ? (
                <div className="mt-1.5 flex items-start gap-1.5">
                  <textarea
                    ref={descInputRef}
                    value={descDraft}
                    onChange={e => setDescDraft(e.target.value)}
                    rows={2}
                    className="flex-1 text-sm px-2 py-1 rounded border border-mission-control-accent/60 bg-mission-control-bg text-mission-control-text resize-none focus:outline-none focus:border-mission-control-accent"
                    placeholder="Add a description for this agent…"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDesc(); } if (e.key === 'Escape') cancelEditDesc(); }}
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button type="button" onClick={saveDesc} disabled={descSaving} className="p-1 rounded text-success hover:bg-success-subtle transition-colors disabled:opacity-50" title="Save">
                      {descSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button type="button" onClick={cancelEditDesc} className="p-1 rounded text-error hover:bg-error-subtle transition-colors" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditDesc}
                  className="group flex items-center gap-1.5 mt-0.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors text-left"
                  title="Click to edit description"
                >
                  <span className={agent.description ? '' : 'italic opacity-60'}>
                    {agent.description || 'Add a description…'}
                  </span>
                  <Edit size={12} className="opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
                </button>
              )}

            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={buildDetailsFromRealData}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              title="Refresh (⌘R)"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mission-control-border px-6 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {([
            { key: 'performance' as const, icon: TrendingUp, label: 'Performance' },
            { key: 'coaching' as const, icon: Star, label: 'Review' },
            { key: 'skills' as const, icon: Award, label: 'Skills' },
            { key: 'tasks' as const, icon: Activity, label: `Tasks${details ? ` (${details.totalTasks})` : ''}` },
            { key: 'tools' as const, icon: Wrench, label: 'Tools' },
            { key: 'permissions' as const, icon: Shield, label: 'Permissions' },
            { key: 'rules' as const, icon: FileText, label: 'Rules' },
            { key: 'soul' as const, icon: CalendarDays, label: 'Soul' },
            { key: 'chat' as const, icon: MessageSquare, label: 'Chat' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-mission-control-accent text-mission-control-accent'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <tab.icon size={14} className="inline mr-1" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-mission-control-text-dim">
                <RefreshCw size={16} className="animate-spin" />
                Loading real data...
              </div>
            </div>
          ) : details ? (
            <>
              {/* ── Performance Tab ── */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  {/* Current task — prominent banner */}
                  {(() => {
                    const currentTask = details.recentTasks.find(t => t.status === 'in-progress');
                    if (!currentTask) return null;
                    return (
                      <div className="rounded-lg border border-warning-border bg-warning-subtle p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity size={14} className="text-warning flex-shrink-0" />
                          <span className="text-xs font-semibold text-warning uppercase tracking-wider">Currently working on</span>
                        </div>
                        <p className="text-sm font-medium text-mission-control-text">{currentTask.title}</p>
                        <div className="mt-2 h-1.5 bg-warning/20 rounded-full overflow-hidden">
                          <div className="h-full bg-warning rounded-full animate-pulse w-2/3" />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-success" />
                        <span className="text-sm text-mission-control-text-dim">Success Rate</span>
                      </div>
                      <div className="text-3xl font-bold text-success">
                        {details.totalTasks > 0 ? `${Math.round(details.successRate * 100)}%` : '—'}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">
                        {details.successfulTasks} / {details.totalTasks} tasks
                      </div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-info" />
                        <span className="text-sm text-mission-control-text-dim">Avg Time</span>
                      </div>
                      <div className="text-3xl font-bold text-info">
                        {details.avgTime}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">per task completion</div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-amber-400" />
                        <span className="text-sm text-mission-control-text-dim">In Progress</span>
                      </div>
                      <div className="text-3xl font-bold text-amber-400">
                        {details.inProgressTasks}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">active tasks</div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi size={16} className="text-review" />
                        <span className="text-sm text-mission-control-text-dim">Sessions</span>
                      </div>
                      <div className="text-3xl font-bold text-review">
                        {details.activeSessions.filter(s => s.isActive).length}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">
                        {details.activeSessions.length} total
                      </div>
                    </div>
                  </div>

                  {/* Performance summary from /stats endpoint */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 size={15} className="text-info flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-mission-control-text">Performance Summary</h3>
                      {statsLoading && <RefreshCw size={12} className="animate-spin text-mission-control-text-dim ml-auto" />}
                    </div>
                    {agentStats ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-success tabular-nums">{agentStats.tasksCompleted}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Tasks completed</div>
                        </div>
                        <div>
                          <div className={`text-2xl font-bold tabular-nums ${agentStats.successRate !== null && agentStats.successRate >= 80 ? 'text-success' : agentStats.successRate !== null && agentStats.successRate >= 50 ? 'text-warning' : 'text-error'}`}>
                            {agentStats.successRate !== null ? `${agentStats.successRate}%` : '—'}
                          </div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">
                            Success rate ({agentStats.tasksRejected} failed)
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-info tabular-nums">
                            {agentStats.avgDurationMs ? formatDuration(agentStats.avgDurationMs) : '—'}
                          </div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Avg task duration</div>
                        </div>
                      </div>
                    ) : statsLoading ? null : (
                      <p className="text-sm text-mission-control-text-dim">No stats available yet.</p>
                    )}
                  </div>

                  {/* Status manual override */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Power size={15} className="text-warning flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-mission-control-text">Force Status</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStatusOverride(v => !v)}
                        className="text-xs px-3 py-1.5 border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors text-mission-control-text-dim"
                      >
                        {showStatusOverride ? 'Cancel' : 'Override'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-mission-control-text-dim">Current:</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        agent.status === 'active' || agent.status === 'busy' ? 'bg-success-subtle text-success' :
                        agent.status === 'disabled' ? 'bg-error-subtle text-error' :
                        'bg-mission-control-border text-mission-control-text-dim'
                      }`}>{agent.status}</span>
                    </div>

                    {showStatusOverride && (
                      <div className="space-y-3 pt-2 border-t border-mission-control-border">
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-warning-subtle border border-warning-border">
                          <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-warning">
                            Manual override. The agent&apos;s next task dispatch will reset this status automatically.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {AGENT_STATUSES.map(s => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setStatusOverride(s.value)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                                statusOverride === s.value
                                  ? 'border-mission-control-accent bg-mission-control-accent/10'
                                  : 'border-mission-control-border hover:border-mission-control-accent/40'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                s.value === 'active' ? 'bg-success' :
                                s.value === 'busy' ? 'bg-warning' :
                                s.value === 'disabled' ? 'bg-error' : 'bg-mission-control-text-dim'
                              }`} />
                              <span className={s.color}>{s.label}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={applyStatusOverride}
                          disabled={!statusOverride || statusSaving}
                          className="w-full py-2 text-sm bg-warning text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-40 font-medium"
                        >
                          {statusSaving ? <RefreshCw size={14} className="inline animate-spin mr-1" /> : <Power size={14} className="inline mr-1" />}
                          {statusSaving ? 'Applying…' : `Force ${statusOverride || 'status'}`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Task breakdown */}
                  <div className="bg-mission-control-bg rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-4">Task Breakdown</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Completed', count: details.successfulTasks, color: 'bg-green-500', pct: details.totalTasks > 0 ? (details.successfulTasks / details.totalTasks) * 100 : 0 },
                        { label: 'In Progress', count: details.inProgressTasks, color: 'bg-warning', pct: details.totalTasks > 0 ? (details.inProgressTasks / details.totalTasks) * 100 : 0 },
                        { label: 'Failed/Blocked', count: details.failedTasks, color: 'bg-red-500', pct: details.totalTasks > 0 ? (details.failedTasks / details.totalTasks) * 100 : 0 },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>{item.label}</span>
                            <span className="text-mission-control-text-dim">{item.count} ({Math.round(item.pct)}%)</span>
                          </div>
                          <div className="h-2 bg-mission-control-surface rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent 5 tasks */}
                  {details.recentTasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-3">Recent Tasks</h3>
                      <div className="space-y-2">
                        {details.recentTasks.slice(0, 5).map(task => (
                          <div key={task.id} className="flex items-center justify-between bg-mission-control-bg rounded-lg px-4 py-2.5 gap-3">
                            <span className="text-sm text-mission-control-text flex-1 min-w-0 truncate">{task.title}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                                task.status === 'done' ? 'bg-success-subtle text-success' :
                                task.status === 'in-progress' ? 'bg-info-subtle text-info' :
                                task.status === 'failed' ? 'bg-error-subtle text-error' :
                                'bg-mission-control-border text-mission-control-text-dim'
                              }`}>
                                {task.status}
                              </span>
                              {task.completedAt > 0 && (
                                <span className="text-[11px] text-mission-control-text-dim">
                                  {new Date(task.completedAt).toLocaleDateString()}
                                </span>
                              )}
                              {task.outcome === 'success' ? (
                                <CheckCircle size={13} className="text-success" />
                              ) : task.outcome === 'failed' ? (
                                <XCircle size={13} className="text-error" />
                              ) : (
                                <Clock size={13} className="text-mission-control-text-dim" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Skills Tab ── */}
              {activeTab === 'skills' && (
                <div className="space-y-6">
                  {/* Editable capability tags */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag size={15} className="text-info flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-mission-control-text">Capabilities</h3>
                    </div>

                    {/* Tag pills */}
                    <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                      {capTags.length === 0 && (
                        <span className="text-xs text-mission-control-text-dim italic">No capabilities defined</span>
                      )}
                      {capTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-info-subtle text-info border border-info-border">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeCapTag(tag)}
                            className="ml-0.5 hover:text-error transition-colors rounded-full"
                            title={`Remove ${tag}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={capInput}
                        onChange={e => setCapInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCapTag(); } }}
                        placeholder="Add capability (press Enter)"
                        className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent transition-colors"
                      />
                      <button
                        type="button"
                        onClick={addCapTag}
                        disabled={!capInput.trim()}
                        className="p-1.5 rounded-lg border border-mission-control-border hover:bg-mission-control-surface disabled:opacity-40 transition-colors"
                        title="Add capability"
                      >
                        <Plus size={14} />
                      </button>
                      {capDirty && (
                        <button
                          type="button"
                          onClick={saveCaps}
                          disabled={capSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim disabled:opacity-50 transition-colors"
                        >
                          {capSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                          {capSaving ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Skill gap indicator */}
                  {skillGaps.length > 0 && (
                    <div className="rounded-lg border border-info-border bg-info-subtle p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={15} className="text-info flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-info">Consider adding</h3>
                      </div>
                      <p className="text-xs text-mission-control-text-dim mb-3">
                        These skills appear in {agent.name}&apos;s recent tasks but are not listed in capabilities:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {skillGaps.map(gap => (
                          <button
                            key={gap}
                            type="button"
                            onClick={() => { if (!capTags.includes(gap)) { setCapTags(prev => [...prev, gap]); setCapDirty(true); } }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-info-border text-info hover:bg-info/10 transition-colors"
                            title={`Add "${gap}" to capabilities`}
                          >
                            <Plus size={10} />
                            {gap}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Library skill management */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Award size={15} className="text-warning flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-mission-control-text">
                          Skill Library
                          <span className="ml-2 text-xs font-normal text-mission-control-accent">{activeSkills.length}/{allSkills.length} active</span>
                        </h3>
                      </div>
                      {addSkillMode === null && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors"
                          onClick={() => setAddSkillMode('url')}
                        >
                          <Plus size={11} /> Add Skill
                        </button>
                      )}
                    </div>

                    {/* Add skill form */}
                    {addSkillMode !== null && (
                      <div className="border border-mission-control-accent/30 rounded-lg p-3 space-y-2.5 bg-mission-control-accent/5 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-mission-control-text">New Skill</span>
                          <button type="button" onClick={() => setAddSkillMode(null)} className="text-mission-control-text-dim hover:text-mission-control-text text-xs">Cancel</button>
                        </div>
                        <input
                          className={`${inputBase} text-xs`}
                          placeholder="Skill name"
                          value={addSkillName}
                          onChange={e => setAddSkillName(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAddSkillMode('url')}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${addSkillMode === 'url' ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'}`}>
                            <Link size={10} /> From URL
                          </button>
                          <button type="button" onClick={() => setAddSkillMode('text')}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${addSkillMode === 'text' ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'}`}>
                            <FileText size={10} /> Write / Paste
                          </button>
                          <button type="button" onClick={() => { setAddSkillMode('text'); fileInputRef.current?.click(); }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors">
                            <Upload size={10} /> Upload .md
                          </button>
                          <input ref={fileInputRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={handleFileUpload} />
                        </div>
                        {addSkillMode === 'url' && (
                          <input className={`${inputBase} text-xs`} placeholder="https://example.com/skill.md" value={addSkillUrl} onChange={e => setAddSkillUrl(e.target.value)} />
                        )}
                        {addSkillMode === 'text' && (
                          <textarea className={`${inputBase} h-36 font-mono text-xs resize-none`} placeholder={'# Skill Name\n\nDescribe what this skill does...'} value={addSkillContent} onChange={e => setAddSkillContent(e.target.value)} />
                        )}
                        <button type="button" onClick={handleAddSkill} disabled={addSkillWorking}
                          className="px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                          {addSkillWorking ? 'Creating...' : 'Create Skill'}
                        </button>
                      </div>
                    )}

                    {/* Skill toggles */}
                    {allSkills.length === 0 ? (
                      <div className="text-center py-6 text-mission-control-text-dim text-sm">No skills in .claude/skills/</div>
                    ) : (
                      <div className="space-y-1">
                        {allSkills.map(skill => {
                          const on = activeSkills.includes(skill.slug);
                          return (
                            <button key={skill.id} type="button" onClick={() => toggleSkill(skill.slug)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${on ? 'border-success/40 bg-success/5' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'}`}>
                              <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-success border-success' : 'border-mission-control-border'}`}>
                                {on && <Check size={10} className="text-white" />}
                              </div>
                              <span className="flex-1 text-sm text-mission-control-text">{skill.name}</span>
                              <span className="text-xs text-mission-control-text-dim font-mono">{skill.slug}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {skillsDirty && (
                      <button type="button" onClick={saveSkills} disabled={saving}
                        className="mt-3 px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                        {saving ? 'Saving...' : 'Save Skills'}
                      </button>
                    )}
                  </div>

                  {/* Skills proficiency list */}
                  <div>
                    <p className="text-sm text-mission-control-text-dim mb-3">
                      Capabilities configured for {agent.name}:
                    </p>
                    {details.skills.length > 0 ? (
                      <div className="space-y-2">
                        {details.skills.map((skill) => (
                          <div key={skill.name} className="bg-mission-control-bg rounded-lg p-4 hover:bg-mission-control-border/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Award size={16} className="text-warning" />
                                <span className="font-medium">{skill.name}</span>
                              </div>
                              <span className="text-xs text-mission-control-text-dim">{skill.lastUsed}</span>
                            </div>
                            <div className="mb-1">
                              <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
                                <span>Proficiency</span>
                                <span>{Math.round(skill.proficiency * 100)}%</span>
                              </div>
                              <div className="h-2 bg-mission-control-surface rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                  style={{ width: `${skill.proficiency * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-mission-control-text-dim">
                        <Award size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No skills configured</p>
                        <p className="text-xs">Add capabilities above to configure this agent&apos;s skills</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tasks Tab ── */}
              {activeTab === 'tasks' && (
                <div className="space-y-6">
                  {/* Tasks section */}
                  <div className="space-y-2">
                  {details.recentTasks.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-3">
                        Tasks ({details.recentTasks.length})
                      </h3>
                      {details.recentTasks.map((task) => (
                        <div key={task.id} className="bg-mission-control-bg rounded-lg p-3 hover:bg-mission-control-border/50 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="font-medium mb-1">{task.title}</div>
                              <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
                                <span className={`px-2 py-0.5 rounded ${
                                  task.status === 'done' ? 'bg-success-subtle text-success' :
                                  task.status === 'in-progress' ? 'bg-info-subtle text-info' :
                                  task.status === 'failed' ? 'bg-error-subtle text-error' :
                                  task.status === 'human-review' ? 'bg-warning-subtle text-warning' :
                                  'bg-mission-control-bg0/20 text-mission-control-text-dim'
                                }`}>
                                  {task.status}
                                </span>
                                {task.project && (
                                  <span className="px-2 py-0.5 bg-info-subtle text-info rounded">
                                    {task.project}
                                  </span>
                                )}
                                {task.completedAt > 0 && (
                                  <span>{new Date(task.completedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            {task.outcome === 'success' ? (
                              <CheckCircle size={16} className="text-success flex-shrink-0" />
                            ) : task.outcome === 'failed' ? (
                              <XCircle size={16} className="text-error flex-shrink-0" />
                            ) : (
                              <Clock size={16} className="text-mission-control-text-dim flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12 text-mission-control-text-dim">
                      <Activity size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No tasks assigned to {agent.name}</p>
                      <p className="text-xs">Assign tasks from the Kanban board</p>
                    </div>
                  )}
                  </div>

                  {/* Sessions section */}
                  <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-3">
                    Sessions ({details.activeSessions.length})
                  </h3>
                  {details.activeSessions.length > 0 ? (
                    <div className="space-y-2">
                      {details.activeSessions.map((session) => (
                        <div key={session.key} className={`bg-mission-control-bg rounded-lg p-4 border ${
                          session.isActive ? 'border-success-border' : 'border-mission-control-border'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {session.isActive ? (
                                <Wifi size={16} className="text-success" />
                              ) : (
                                <WifiOff size={16} className="text-mission-control-text-dim" />
                              )}
                              <span className="font-medium text-sm">
                                {session.label || session.key.slice(0, 40)}
                              </span>
                              {session.isActive && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-success-subtle text-success rounded">Active</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs text-mission-control-text-dim">
                            <div>
                              <span className="block text-mission-control-text-dim/60">Model</span>
                              <span>{session.model.split('/').pop() || 'unknown'}</span>
                            </div>
                            <div>
                              <span className="block text-mission-control-text-dim/60">Tokens</span>
                              <span>{(session.tokens / 1000).toFixed(1)}k</span>
                            </div>
                            <div>
                              <span className="block text-mission-control-text-dim/60">Last Active</span>
                              <span>{session.updatedAt > 0 ? new Date(session.updatedAt).toLocaleString() : '—'}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-mission-control-border flex items-center justify-between">
                            <div className="text-[11px] text-mission-control-text-dim/60 truncate flex-1" title={session.key}>
                              {session.key}
                            </div>
                            <button
                              onClick={() => setViewingSessionKey(session.key)}
                              className="ml-2 px-3 py-1.5 text-xs bg-mission-control-accent/10 hover:bg-mission-control-accent/20 text-mission-control-accent rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                              <MessageSquare size={12} />
                              View Chat
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-mission-control-text-dim">
                      <WifiOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No active sessions</p>
                    </div>
                  )}
                  </div>
                </div>
              )}

              {/* ── Rules Tab ── */}
              {activeTab === 'rules' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Agent Configuration
                  </h3>

                  {/* Model selection */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Cpu size={15} className="text-info flex-shrink-0" />
                      <h4 className="text-sm font-semibold text-mission-control-text">Model</h4>
                    </div>
                    <p className="text-xs text-mission-control-text-dim mb-3">Select the Claude model tier for this agent.</p>
                    <div className="space-y-2">
                      {CLAUDE_MODELS.map(m => (
                        <button key={m.id} type="button" onClick={() => { setModel(m.id); setModelDirty(true); }}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                            model === m.id ? 'border-mission-control-accent bg-mission-control-accent/10' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/50'
                          }`}>
                          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${model === m.id ? 'border-mission-control-accent' : 'border-mission-control-border'}`}>
                            {model === m.id && <div className="w-2 h-2 rounded-full bg-mission-control-accent" />}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-mission-control-text">{m.label}</div>
                            <div className="text-xs text-mission-control-text-dim mt-0.5">{m.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {modelDirty && (
                      <button type="button" onClick={saveModel} disabled={saving}
                        className="mt-3 px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                        {saving ? 'Saving...' : 'Save Model'}
                      </button>
                    )}
                  </div>

                  {/* Brain notes */}
                  {details.brainNotes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase mb-2 flex items-center gap-1">
                        <Brain size={14} /> Memory Files
                      </h4>
                      <div className="space-y-2">
                        {details.brainNotes.map((note, i) => (
                          <div key={`${note}-${i}`} className="bg-mission-control-bg rounded-lg p-3 text-sm">
                            <pre className="whitespace-pre-wrap font-mono text-xs">{note}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editable AGENTS.md */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase">AGENTS.md</h4>
                      {!rulesEditing && (
                        <button type="button" onClick={() => { setRulesDraft(details.agentRules || ''); setRulesEditing(true); }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 border border-mission-control-border rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <Edit size={11} /> Edit
                        </button>
                      )}
                    </div>
                    {rulesEditing ? (
                      <div className="space-y-3">
                        <textarea
                          className={`${inputBase} h-72 font-mono resize-none`}
                          value={rulesDraft}
                          onChange={e => setRulesDraft(e.target.value)}
                          placeholder="No AGENT.md file found"
                        />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={saveRules} disabled={rulesSaving}
                            className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                            {rulesSaving ? 'Saving...' : 'Save Rules'}
                          </button>
                          <button type="button" onClick={() => setRulesEditing(false)}
                            className="px-4 py-2 text-sm border border-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-surface transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-mission-control-bg rounded-lg p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                          {details.agentRules || 'No AGENT.md file found'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Soul Tab ── */}
              {activeTab === 'soul' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-1 flex items-center gap-2">
                      <CalendarDays size={16} />
                      Soul File Editor
                    </h3>
                    <p className="text-xs text-mission-control-text-dim">
                      Defines {agent.name}&apos;s personality, responsibilities, and behavior rules.
                    </p>
                  </div>
                  {showRestartBanner && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-warning text-xs">
                      <AlertTriangle size={12} />
                      Restart {agent.name} for changes to take effect.
                      <button type="button" onClick={() => setShowRestartBanner(false)} className="ml-auto opacity-60 hover:opacity-100"><X size={12} /></button>
                    </div>
                  )}
                  <textarea
                    className={`${inputBase} h-72 font-mono resize-none`}
                    value={soul}
                    onChange={e => { setSoul(e.target.value); setSoulDirty(true); }}
                    placeholder="No SOUL.md found for this agent."
                  />
                  <button type="button" onClick={saveSoul} disabled={!soulDirty || saving}
                    className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                    {saving ? 'Saving...' : 'Save Soul'}
                  </button>
                  {/* Also keep the full editor for advanced editing */}
                  <div className="border-t border-mission-control-border pt-4 mt-4">
                    <AgentSoulEditor agentId={agent.id} agentName={agent.name} />
                  </div>
                </div>
              )}

              {/* ── Performance Review / Coaching Tab ── */}
              {activeTab === 'coaching' && (
                <AgentCoachingCard agentId={agentId} agentName={agent.name} />
              )}

              {/* ── Tools Tab ── */}
              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <p className="text-xs text-mission-control-text-dim">Control which MCP tools {agent.name} can call during task execution.</p>
                  <div className="space-y-1.5">
                  {MCP_SERVERS.map(server => {
                    const allOn = server.tools.every(t => activeTools.includes(t));
                    const someOn = server.tools.some(t => activeTools.includes(t));
                    const enabledCount = server.tools.filter(t => activeTools.includes(t)).length;
                    const isOpen = expandedGroups[`tools-${server.id}`] ?? false;
                    return (
                      <div key={server.id} className="border border-mission-control-border rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setExpandedGroups(prev => ({ ...prev, [`tools-${server.id}`]: !isOpen }))}
                          className="w-full flex items-center justify-between px-3 py-2 bg-mission-control-surface hover:bg-mission-control-surface/80 transition-colors text-left">
                          <span className="flex items-center gap-2 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                            <Server size={11} /> {server.label}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`text-xs ${allOn ? 'text-success' : someOn ? 'text-warning' : 'text-mission-control-text-dim'}`}>
                              {enabledCount}/{server.tools.length}
                            </span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleServer(server.tools, !allOn); }}
                              className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${allOn ? 'bg-success/20 text-success' : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'}`}>
                              {allOn ? 'Disable all' : 'Enable all'}
                            </button>
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-mission-control-border border-t border-mission-control-border">
                            {server.tools.map(tool => {
                              const on = activeTools.includes(tool);
                              return (
                                <button key={tool} type="button" onClick={() => toggleTool(tool)}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-mission-control-surface/50 transition-colors">
                                  <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${on ? 'bg-mission-control-accent border-mission-control-accent' : 'border-mission-control-border'}`}>
                                    {on && <Check size={9} className="text-white" />}
                                  </div>
                                  <span className={`text-xs font-mono ${on ? 'text-mission-control-text' : 'text-mission-control-text-dim'}`}>{tool}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                  {toolsDirty && (
                    <button type="button" onClick={saveTools} disabled={saving}
                      className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                      {saving ? 'Saving...' : 'Save Tool Access'}
                    </button>
                  )}

                  {/* Custom MCP Servers */}
                  <div className="border-t border-mission-control-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Server size={13} className="text-mission-control-text-dim" />
                        <span className="text-xs font-medium text-mission-control-text">Custom MCP Servers</span>
                      </div>
                      {!showAddMcp && (
                        <button type="button" onClick={() => setShowAddMcp(true)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors">
                          <Plus size={11} /> Add Server
                        </button>
                      )}
                    </div>
                    {mcpServers.length > 0 && (
                      <div className="space-y-2">
                        {mcpServers.map(server => (
                          <div key={server.id} className="flex items-center justify-between border border-mission-control-border rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-mission-control-text">{server.name}</span>
                              <p className="text-xs text-mission-control-text-dim font-mono mt-0.5 truncate">
                                {server.transport === 'stdio' ? `stdio: ${server.command} ${(server.args || []).join(' ')}` : `http: ${server.url}`}
                              </p>
                            </div>
                            <button type="button" onClick={() => removeMcpServer(server.id)}
                              className="flex-shrink-0 ml-3 text-mission-control-text-dim hover:text-error transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {mcpServers.length === 0 && !showAddMcp && (
                      <p className="text-xs text-mission-control-text-dim">No custom MCP servers configured.</p>
                    )}
                    {showAddMcp && (
                      <div className="border border-mission-control-accent/30 rounded-lg p-3 space-y-2.5 bg-mission-control-accent/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-mission-control-text">New MCP Server</span>
                          <button type="button" onClick={() => { setShowAddMcp(false); setNewMcp({ name: '', transport: 'stdio', command: 'npx', args: '', url: '', env: '' }); }} className="text-mission-control-text-dim hover:text-mission-control-text text-xs">Cancel</button>
                        </div>
                        <input className={`${inputBase} text-xs`} placeholder="Server name (e.g. Filesystem MCP)" value={newMcp.name} onChange={e => setNewMcp(m => ({ ...m, name: e.target.value }))} />
                        <select className={`${inputBase} text-xs`} value={newMcp.transport} onChange={e => setNewMcp(m => ({ ...m, transport: e.target.value as 'stdio' | 'http' }))}>
                          <option value="stdio">stdio -- local process</option>
                          <option value="http">HTTP / SSE -- remote endpoint</option>
                        </select>
                        {newMcp.transport === 'stdio' ? (
                          <>
                            <input className={`${inputBase} text-xs font-mono`} placeholder="Command (e.g. npx, node, python)" value={newMcp.command} onChange={e => setNewMcp(m => ({ ...m, command: e.target.value }))} />
                            <input className={`${inputBase} text-xs font-mono`} placeholder="Arguments (e.g. -y @modelcontextprotocol/server-filesystem /path)" value={newMcp.args} onChange={e => setNewMcp(m => ({ ...m, args: e.target.value }))} />
                          </>
                        ) : (
                          <input className={`${inputBase} text-xs font-mono`} placeholder="URL (e.g. https://mcp.example.com)" value={newMcp.url} onChange={e => setNewMcp(m => ({ ...m, url: e.target.value }))} />
                        )}
                        <textarea className={`${inputBase} text-xs font-mono resize-none`} placeholder={'Environment variables (optional):\nAPI_KEY=your-key\nBASE_URL=https://...'} rows={3} value={newMcp.env} onChange={e => setNewMcp(m => ({ ...m, env: e.target.value }))} />
                        <button type="button" onClick={addMcpServer}
                          disabled={!newMcp.name.trim() || (newMcp.transport === 'stdio' ? !newMcp.command.trim() : !newMcp.url.trim())}
                          className="px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                          Add Server
                        </button>
                      </div>
                    )}
                    {mcpDirty && (
                      <button type="button" onClick={saveMcp} disabled={saving}
                        className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                        {saving ? 'Saving...' : 'Save MCP Servers'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Permissions Tab ── */}
              {activeTab === 'permissions' && (
                <div className="space-y-4">
                  {/* Trust tier */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Trust Tier</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {TRUST_TIERS.map(tier => (
                        <button key={tier.id} type="button"
                          onClick={() => {
                            if (tier.id !== trustTier) setPrevTrustTier(trustTier);
                            setTrustTier(tier.id);
                            const preset = TIER_PRESETS[tier.id];
                            if (preset) {
                              setPermOverrides(preset);
                              const allOpen: Record<string, boolean> = {};
                              PERMISSION_GROUPS.forEach(g => { allOpen[g.label] = true; });
                              setExpandedGroups(allOpen);
                              setPresetApplied(tier.id);
                              setTimeout(() => setPresetApplied(null), 2000);
                            }
                            setPermDirty(true);
                          }}
                          className={`flex flex-col items-center px-2 py-2 rounded-lg border text-center transition-all ${trustTier === tier.id ? 'border-mission-control-accent bg-mission-control-accent/10' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40'}`}>
                          <span className={`text-xs font-semibold ${tier.color}`}>{tier.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <p className="text-xs text-mission-control-text-dim">{TRUST_TIERS.find(t => t.id === trustTier)?.desc}</p>
                      {presetApplied && <span className="text-xs text-mission-control-accent font-medium animate-pulse">Presets applied</span>}
                    </div>
                    {prevTrustTier && prevTrustTier !== trustTier && (() => {
                      const prevPreset = TIER_PRESETS[prevTrustTier] || {};
                      const newPreset = TIER_PRESETS[trustTier] || {};
                      const gained = Object.keys(newPreset).filter(k => newPreset[k] && !prevPreset[k]);
                      const lost = Object.keys(prevPreset).filter(k => prevPreset[k] && !newPreset[k]);
                      if (gained.length === 0 && lost.length === 0) return null;
                      return (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-mission-control-surface border border-mission-control-border text-xs space-y-1">
                          <div className="font-medium text-mission-control-text-dim">
                            Tier change: {TRUST_TIERS.find(t => t.id === prevTrustTier)?.label} → {TRUST_TIERS.find(t => t.id === trustTier)?.label}
                          </div>
                          {gained.length > 0 && <div className="text-success">+ Granting: {gained.join(', ')}</div>}
                          {lost.length > 0 && <div className="text-error">- Removing: {lost.join(', ')}</div>}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Per-action overrides */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Action Overrides</div>
                    <div className="space-y-1.5">
                      {PERMISSION_GROUPS.map(group => {
                        const isOpen = expandedGroups[group.label] ?? false;
                        const overrideCount = group.perms.filter(p => permOverrides[p.id] !== undefined).length;
                        return (
                          <div key={group.label} className="border border-mission-control-border rounded-lg overflow-hidden">
                            <button type="button" onClick={() => setExpandedGroups(prev => ({ ...prev, [group.label]: !isOpen }))}
                              className="w-full flex items-center justify-between px-3 py-2 bg-mission-control-surface hover:bg-mission-control-surface/80 transition-colors text-left">
                              <span className="flex items-center gap-2 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                                <Shield size={11} /> {group.label}
                              </span>
                              <span className="flex items-center gap-2">
                                {overrideCount > 0 && <span className="text-xs text-mission-control-accent">{overrideCount} override{overrideCount > 1 ? 's' : ''}</span>}
                                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="divide-y divide-mission-control-border border-t border-mission-control-border">
                                {group.perms.map(perm => {
                                  const overrideVal = permOverrides[perm.id];
                                  const hasOverride = overrideVal !== undefined;
                                  return (
                                    <div key={perm.id} className="flex items-center justify-between px-3 py-2">
                                      <div className="min-w-0 mr-2">
                                        <span className="text-xs text-mission-control-text">{perm.label}</span>
                                        <span className={`ml-1.5 text-xs ${TIER_COLORS[perm.tier]}`}>T{perm.tier}</span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {hasOverride && (
                                          <button type="button" onClick={() => { setPermOverrides(prev => { const n = { ...prev }; delete n[perm.id]; return n; }); setPermDirty(true); }}
                                            className="text-xs text-mission-control-text-dim hover:text-mission-control-text px-1.5 py-0.5 rounded-lg border border-mission-control-border transition-colors">Reset</button>
                                        )}
                                        <button type="button" onClick={() => { setPermOverrides(prev => ({ ...prev, [perm.id]: true })); setPermDirty(true); }}
                                          className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${overrideVal === true ? 'bg-success/20 text-success border-success/40' : 'border-mission-control-border text-mission-control-text-dim hover:text-success hover:border-success/40'}`}>Allow</button>
                                        <button type="button" onClick={() => { setPermOverrides(prev => ({ ...prev, [perm.id]: false })); setPermDirty(true); }}
                                          className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${overrideVal === false ? 'bg-error/20 text-error border-error/40' : 'border-mission-control-border text-mission-control-text-dim hover:text-error hover:border-error/40'}`}>Deny</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Blocked commands */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">Blocked Commands</div>
                    <p className="text-xs text-mission-control-text-dim mb-2">Agent-specific blocked tool patterns.</p>
                    <div className="border border-mission-control-border rounded-lg overflow-hidden">
                      <div className="p-2 bg-mission-control-surface flex gap-2">
                        <input type="text" value={newDisallowed} onChange={e => setNewDisallowed(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddAgentDisallowed()}
                          placeholder="e.g. Bash(git push *)"
                          className="flex-1 text-xs bg-mission-control-bg border border-mission-control-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-mission-control-accent font-mono" />
                        <button type="button" onClick={handleAddAgentDisallowed}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors">
                          <Plus size={10} /> Block
                        </button>
                      </div>
                      {agentDisallowed.length > 0 && (
                        <div className="divide-y divide-mission-control-border border-t border-mission-control-border">
                          {agentDisallowed.map(tool => (
                            <div key={tool} className="flex items-center justify-between px-3 py-1.5">
                              <code className="text-xs font-mono text-mission-control-text">{tool}</code>
                              <button type="button" onClick={() => handleRemoveAgentDisallowed(tool)} className="p-0.5 text-mission-control-text-dim hover:text-error transition-colors"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {permDirty && (
                    <button type="button" onClick={savePermissions} disabled={saving}
                      className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                      {saving ? 'Saving...' : 'Save Permissions'}
                    </button>
                  )}
                </div>
              )}

              {/* ── Chat Tab ── */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full min-h-[400px]">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-mission-control-text-dim text-center py-8">Start a conversation with {agent.name}</p>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          m.role === 'user'
                            ? 'bg-mission-control-accent text-white rounded-br-sm'
                            : 'bg-mission-control-surface border border-mission-control-border rounded-bl-sm'
                        }`}>
                          {m.role === 'assistant'
                            ? <StreamingText content={m.content} streaming={!!m.streaming} />
                            : <span>{m.content}</span>
                          }
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-mission-control-border">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                      placeholder={`Message ${agent.name}...`}
                      className="flex-1 bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
                      disabled={chatSending}
                    />
                    <button type="button" onClick={sendChatMessage} disabled={chatSending || !chatInput.trim()}
                      className="p-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 disabled:opacity-40 transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}

            </>
          ) : (
            <div className="text-center py-12 text-mission-control-text-dim">
              <XCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>Failed to load agent details</p>
              <button type="button" onClick={buildDetailsFromRealData} className="mt-2 text-mission-control-accent hover:underline text-sm">
                Retry
              </button>
            </div>
          )}
        </div>

        {/* HR Actions footer — non-protected agents only */}
        {!isProtectedAgent(agentId) && (
          <div className="flex items-center gap-2 px-6 py-3 border-t border-mission-control-border bg-mission-control-surface/50">
            {agentStatus === 'disabled' ? (
              <button type="button" disabled={hrActionLoading}
                onClick={async () => {
                  setHrActionLoading(true);
                  try {
                    await agentApi.updateStatus(agentId, 'idle');
                    setAgentStatus('idle');
                    showToast('success', 'Agent enabled');
                    fetchAgents();
                  } catch { showToast('error', 'Failed to enable agent'); }
                  finally { setHrActionLoading(false); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-success border border-success-border rounded-lg hover:bg-success-subtle transition-colors disabled:opacity-40">
                <Power size={14} /> Enable Agent
              </button>
            ) : (
              <button type="button" disabled={hrActionLoading} onClick={() => setShowDisableConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-warning border border-warning-border rounded-lg hover:bg-warning-subtle transition-colors disabled:opacity-40">
                <PowerOff size={14} /> Disable Agent
              </button>
            )}
            <div className="flex-1" />
            <button type="button" disabled={hrActionLoading} onClick={() => setShowFireConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors disabled:opacity-40">
              <UserMinus size={14} /> Fire Agent
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Agent Chat Modal for viewing existing session */}
    {viewingSessionKey && (
      <AgentChatModal
        agentId={agentId}
        existingSessionKey={viewingSessionKey}
        onClose={() => setViewingSessionKey(null)}
      />
    )}

    {/* Fire confirm */}
    <ConfirmDialog
      open={showFireConfirm}
      onClose={() => setShowFireConfirm(false)}
      onConfirm={async () => {
        setShowFireConfirm(false);
        setHrActionLoading(true);
        try {
          await catalogApi.fireAgent(agentId);
          showToast('success', 'Agent fired');
          fetchAgents();
          onClose();
        } catch { showToast('error', 'Failed to fire agent'); }
        finally { setHrActionLoading(false); }
      }}
      title={`Fire ${agent.name}?`}
      message={`Fire ${agent.name}? Their workspace will be archived. Active tasks will be paused.`}
      confirmLabel="Fire Agent"
      cancelLabel="Cancel"
      type="danger"
    />

    {/* Disable confirm */}
    <ConfirmDialog
      open={showDisableConfirm}
      onClose={() => setShowDisableConfirm(false)}
      onConfirm={async () => {
        setShowDisableConfirm(false);
        setHrActionLoading(true);
        try {
          await agentApi.updateStatus(agentId, 'disabled');
          setAgentStatus('disabled');
          showToast('success', 'Agent disabled');
        } catch { showToast('error', 'Failed to disable agent'); }
        finally { setHrActionLoading(false); }
      }}
      title={`Disable ${agent.name}?`}
      message={`Disable ${agent.name}? Active tasks will pause until re-enabled.`}
      confirmLabel="Disable"
      cancelLabel="Cancel"
      type="warning"
    />
  </>
  );
}
