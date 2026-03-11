import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Cpu, Wrench, Key, FileText, Check, AlertCircle, Plus, Link, Upload, Shield, ChevronDown, ChevronRight, Server, Trash2, UserMinus, PowerOff, Power, BarChart2, MessageSquare, Send, BarChart } from 'lucide-react';
import { agentApi, catalogApi, settingsApi, libraryApi } from '../lib/api';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import ConfirmDialog from './ConfirmDialog';
import { isProtectedAgent } from '../lib/agentConfig';
import AgentMetricsCard from './AgentMetricsCard';
import { StreamingText } from './StreamingText';

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
      // Auth
      'auth_clear', 'auth_refreshToken',
      // Calendar
      'calendar_list', 'calendar_listEvents', 'calendar_getEvent',
      'calendar_createEvent', 'calendar_updateEvent', 'calendar_deleteEvent',
      'calendar_findFreeTime', 'calendar_respondToEvent',
      // Gmail
      'gmail_search', 'gmail_get', 'gmail_listLabels',
      'gmail_send', 'gmail_createDraft', 'gmail_sendDraft',
      'gmail_modify', 'gmail_downloadAttachment',
      // Drive
      'drive_search', 'drive_findFolder', 'drive_downloadFile',
      // Docs
      'docs_find', 'docs_create', 'docs_getText', 'docs_appendText',
      'docs_insertText', 'docs_replaceText', 'docs_move', 'docs_extractIdFromUrl',
      // Sheets
      'sheets_find', 'sheets_getMetadata', 'sheets_getRange', 'sheets_getText',
      // Slides
      'slides_find', 'slides_getMetadata', 'slides_getText',
      // Chat
      'chat_listSpaces', 'chat_findSpaceByName', 'chat_findDmByEmail',
      'chat_listThreads', 'chat_getMessages', 'chat_sendMessage',
      'chat_sendDm', 'chat_setUpSpace',
      // People
      'people_getMe', 'people_getUserProfile',
      // Time
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

// Approval tiers
const TRUST_TIERS = [
  { id: 'restricted', label: 'Restricted', desc: 'Read-only. No writes, no approvals granted.', color: 'text-error' },
  { id: 'apprentice',  label: 'Apprentice',  desc: 'Tier 1 auto-approved. Tier 2+ queued for review.', color: 'text-warning' },
  { id: 'worker',      label: 'Worker',      desc: 'Tier 1–2 auto-approved. Tier 3 queued.', color: 'text-info' },
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

// Preset permission overrides per trust tier.
// true = Allow, false = Deny, undefined = inherit tier default (reset).
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
const TIER_LABELS = ['Auto', 'Logged', 'Review', 'Explicit'];

type Tab = 'soul' | 'model' | 'skills' | 'tools' | 'api' | 'permissions' | 'performance';
type Section = 'metrics' | 'configure' | 'chat';

interface AgentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  initialSection?: Section;
}

interface APIKey { id: string; name: string; service: string; key: string; createdAt: string }
interface Skill { id: string; name: string; slug: string; description: string }

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

export default function AgentManagementModal({ isOpen, onClose, agentId, agentName, initialSection }: AgentManagementModalProps) {
  const fetchAgents = useStore(s => s.fetchAgents);
  const [section, setSection] = useState<Section>(initialSection ?? 'configure');
  const [tab, setTab] = useState<Tab>('soul');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Soul
  const [soul, setSoul] = useState('');
  const [soulDirty, setSoulDirty] = useState(false);
  const [showRestartBanner, setShowRestartBanner] = useState(false);

  // Model
  const [model, setModel] = useState('sonnet');
  const [modelDirty, setModelDirty] = useState(false);

  // Skills
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
  const [allApiKeys, setAllApiKeys] = useState<APIKey[]>([]);
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

  // HR actions
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [hrActionLoading, setHrActionLoading] = useState(false);

  // Tier diff preview
  const [prevTrustTier, setPrevTrustTier] = useState<string | null>(null);

  // Performance metrics
  const [metrics, setMetrics] = useState<{
    tasksCompleted: number;
    tasksInProgress: number;
    tasksTotal: number;
    reviewsApproved: number;
    reviewsRejected: number;
    approvalRate: number | null;
    memoryNotes: number;
    recentActivity: number;
    avgCompletionMs: number | null;
    lastActive: number | null;
  } | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
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
      if (soulR.status === 'fulfilled') setSoul(soulR.value?.content || '');
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
      setLoading(false);
    });
  }, [isOpen, agentId]);

  // Lazy-load performance metrics when metrics section or performance tab is activated
  useEffect(() => {
    if ((section !== 'metrics' && tab !== 'performance') || !isOpen || metrics) return;
    setMetricsLoading(true);
    fetch(`/api/agents/${agentId}/metrics`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setMetrics(data); })
      .catch(() => {})
      .finally(() => setMetricsLoading(false));
  }, [tab, section, isOpen, agentId, metrics]);

  // Chat section state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; streaming?: boolean }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (section === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, section]);

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
          } catch {}
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

  // ── Saves ─────────────────────────────────────────
  const saveSoul = async () => {
    setSaving(true);
    try {
      await agentApi.writeSoul(agentId, soul);
      setSoulDirty(false); setShowRestartBanner(true);
      showToast('SOUL.md saved', 'success');
    } catch { showToast('Failed to save SOUL.md', 'error'); }
    finally { setSaving(false); }
  };

  const saveModel = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { model });
      setModelDirty(false);
      showToast('Model updated', 'success');
    } catch { showToast('Failed to update model', 'error'); }
    finally { setSaving(false); }
  };

  const saveSkills = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { skills: activeSkills });
      setSkillsDirty(false);
      showToast('Skills saved', 'success');
    } catch { showToast('Failed to save skills', 'error'); }
    finally { setSaving(false); }
  };

  const saveTools = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { tools: activeTools });
      setToolsDirty(false);
      showToast('Tool access saved', 'success');
    } catch { showToast('Failed to save tools', 'error'); }
    finally { setSaving(false); }
  };

  const saveMcp = async () => {
    setSaving(true);
    try {
      await agentApi.patchConfig(agentId, { mcpServers });
      setMcpDirty(false);
      showToast('MCP servers saved', 'success');
    } catch { showToast('Failed to save MCP servers', 'error'); }
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
      showToast('API access saved', 'success');
    } catch { showToast('Failed to save API access', 'error'); }
    finally { setSaving(false); }
  };

  const handleCreateKey = async () => {
    if (!newKey.name.trim() || !newKey.service.trim() || !newKey.key.trim()) {
      showToast('All fields are required', 'error'); return;
    }
    setAddingKey(true);
    try {
      // Load current global key store, append new entry
      const result = await settingsApi.get('security.keys');
      const existing: APIKey[] = (() => {
        try { const v = (result as any)?.value; const p = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; }
      })();
      const entry: APIKey = { id: `key-${Date.now()}`, name: newKey.name.trim(), service: newKey.service.trim(), key: newKey.key.trim(), createdAt: new Date().toISOString() };
      await settingsApi.set('security.keys', [...existing, entry]);
      // Update local list and auto-assign to this agent
      setAllApiKeys(prev => [...prev, entry]);
      setActiveApiKeys(prev => [...prev, entry.id]);
      setApiKeysDirty(true);
      setNewKey({ name: '', service: '', key: '' });
      setShowAddKey(false);
      showToast(`"${entry.name}" added and assigned`, 'success');
    } catch { showToast('Failed to add key', 'error'); }
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
      showToast('Permissions saved', 'success');
    } catch { showToast('Failed to save permissions', 'error'); }
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

  // ── Add Skill ─────────────────────────────────────
  const handleAddSkill = async () => {
    if (!addSkillName.trim()) { showToast('Skill name is required', 'error'); return; }
    if (addSkillMode === 'url' && !addSkillUrl.trim()) { showToast('URL is required', 'error'); return; }
    if (addSkillMode === 'text' && !addSkillContent.trim()) { showToast('Content is required', 'error'); return; }

    setAddSkillWorking(true);
    try {
      const payload: { name: string; url?: string; content?: string } = { name: addSkillName.trim() };
      if (addSkillMode === 'url') payload.url = addSkillUrl.trim();
      else payload.content = addSkillContent.trim();

      const result = await (libraryApi as any).createSkill(payload);
      if (result?.error) { showToast(result.error, 'error'); return; }

      // Refresh skills list and auto-enable the new one
      const fresh = await (libraryApi as any).getSkills();
      setAllSkills(fresh?.skills || []);
      setActiveSkills(prev => [...prev, result.slug]);
      setSkillsDirty(true);
      setAddSkillMode(null);
      setAddSkillName(''); setAddSkillUrl(''); setAddSkillContent('');
      showToast(`Skill "${result.name}" created`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create skill', 'error');
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

  // ── Toggles ───────────────────────────────────────
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

  if (!isOpen) return null;

  const TABS: { id: Tab; label: string; dirty: boolean }[] = [
    { id: 'soul',        label: 'Soul',        dirty: soulDirty },
    { id: 'model',       label: 'Model',       dirty: modelDirty },
    { id: 'skills',      label: 'Skills',      dirty: skillsDirty },
    { id: 'tools',       label: 'Tools',       dirty: toolsDirty || mcpDirty },
    { id: 'api',         label: 'API Keys',    dirty: apiKeysDirty },
    { id: 'permissions', label: 'Permissions', dirty: permDirty },
    { id: 'performance', label: 'Performance', dirty: false },
  ];

  const inputBase = 'w-full bg-mission-control-bg0 border border-mission-control-border rounded px-3 py-2 text-mission-control-text-primary text-sm focus:outline-none focus:border-mission-control-accent';

  return (
    <div
      className="fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden="true"
    >
      <div
        className="glass-modal rounded-xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="presentation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-mission-control-border">
          <h2 className="text-sm font-bold">{agentName}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Section tabs — Metrics | Configure | Chat */}
        <div className="flex border-b border-mission-control-border px-5 pt-1">
          {([
            { id: 'metrics'   as Section, label: 'Metrics',   icon: BarChart },
            { id: 'configure' as Section, label: 'Configure', icon: Wrench },
            { id: 'chat'      as Section, label: 'Chat',      icon: MessageSquare },
          ]).map(s => (
            <button key={s.id} type="button" onClick={() => setSection(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                section === s.id
                  ? 'border-mission-control-accent text-mission-control-accent'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text-primary'
              }`}
            >
              <s.icon size={13} />{s.label}
            </button>
          ))}
        </div>

        {/* Configure sub-tabs */}
        {section === 'configure' && (
          <div className="flex gap-1 px-5 pt-2 border-b border-mission-control-border overflow-x-auto min-h-[38px]">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors relative whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-mission-control-bg0 text-mission-control-text-primary border border-b-0 border-mission-control-border -mb-px'
                    : 'text-mission-control-text-dim hover:text-mission-control-text-primary'
                }`}
              >
                {t.label}
                {t.dirty && <span className="w-1.5 h-1.5 rounded-full bg-warning absolute top-1 right-1" />}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── METRICS SECTION ── */}
          {section === 'metrics' && (
            <div className="space-y-4">
              {metricsLoading ? (
                <div className="flex items-center justify-center py-12 text-mission-control-text-dim text-sm">Loading metrics…</div>
              ) : metrics ? (
                <AgentMetricsCard agentId={agentId} agentName={agentName} metrics={{ ...(metrics as any), _role: ({ 'mission-control': 'orchestrator', 'hr': 'hr', 'clara': 'qc', 'inbox': 'inbox' } as Record<string, string>)[agentId] }} />
              ) : (
                <div className="flex items-center justify-center py-12 text-mission-control-text-dim text-sm">No metrics yet</div>
              )}
            </div>
          )}

          {/* ── CHAT SECTION ── */}
          {section === 'chat' && (
            <div className="flex flex-col h-full min-h-[300px]">
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-mission-control-text-dim text-center py-8">Start a conversation with {agentName}</p>
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
                  placeholder={`Message ${agentName}…`}
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

          {/* ── CONFIGURE SECTION ── */}
          {section === 'configure' && (
          loading ? (
            <div className="flex items-center justify-center py-12 text-mission-control-text-dim text-sm">Loading…</div>
          ) : (
            <>
              {/* ── SOUL ── */}
              {tab === 'soul' && (
                <div className="space-y-3">
                  <p className="text-xs text-mission-control-text-dim">Defines {agentName}'s personality, responsibilities, and behavior rules.</p>
                  {showRestartBanner && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded text-warning text-xs">
                      <AlertCircle size={12} />
                      Restart {agentName} for changes to take effect.
                      <button type="button" onClick={() => setShowRestartBanner(false)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
                    </div>
                  )}
                  <textarea
                    className={`${inputBase} h-72 font-mono resize-none`}
                    value={soul}
                    onChange={e => { setSoul(e.target.value); setSoulDirty(true); }}
                    placeholder="No SOUL.md found for this agent."
                  />
                  <button type="button" onClick={saveSoul} disabled={!soulDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save Soul'}
                  </button>
                </div>
              )}

              {/* ── MODEL ── */}
              {tab === 'model' && (
                <div className="space-y-4">
                  <p className="text-xs text-mission-control-text-dim">All agents run Claude directly via Anthropic's API. Select the model tier for this agent.</p>
                  <div className="space-y-2">
                    {CLAUDE_MODELS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setModel(m.id); setModelDirty(true); }}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                          model === m.id ? 'border-mission-control-accent bg-mission-control-accent/10' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/50'
                        }`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${model === m.id ? 'border-mission-control-accent' : 'border-mission-control-border'}`}>
                          {model === m.id && <div className="w-2 h-2 rounded-full bg-mission-control-accent" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-mission-control-text-primary">{m.label}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">{m.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={saveModel} disabled={!modelDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save Model'}
                  </button>
                </div>
              )}

              {/* ── SKILLS ── */}
              {tab === 'skills' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-mission-control-text-dim">
                      Skills auto-load into context before relevant tasks.
                      <span className="ml-1 text-mission-control-accent">{activeSkills.length}/{allSkills.length} active</span>
                    </p>
                    {addSkillMode === null && (
                      <div className="relative group">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors"
                          onClick={() => setAddSkillMode('url')}
                        >
                          <Plus size={11} /> Add Skill <ChevronDown size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Add skill form */}
                  {addSkillMode !== null && (
                    <div className="border border-mission-control-accent/30 rounded-lg p-3 space-y-2.5 bg-mission-control-accent/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-mission-control-text-primary">New Skill</span>
                        <button type="button" onClick={() => setAddSkillMode(null)} className="text-mission-control-text-dim hover:text-mission-control-text-primary text-xs">Cancel</button>
                      </div>

                      <input
                        className={`${inputBase} text-xs`}
                        placeholder="Skill name"
                        value={addSkillName}
                        onChange={e => setAddSkillName(e.target.value)}
                      />

                      {/* Source type toggle */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAddSkillMode('url')}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors ${addSkillMode === 'url' ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text-primary'}`}
                        >
                          <Link size={10} /> From URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddSkillMode('text')}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition-colors ${addSkillMode === 'text' ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text-primary'}`}
                        >
                          <FileText size={10} /> Write / Paste
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddSkillMode('text'); fileInputRef.current?.click(); }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors"
                        >
                          <Upload size={10} /> Upload .md
                        </button>
                        <input ref={fileInputRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={handleFileUpload} />
                      </div>

                      {addSkillMode === 'url' && (
                        <input
                          className={`${inputBase} text-xs`}
                          placeholder="https://example.com/skill.md"
                          value={addSkillUrl}
                          onChange={e => setAddSkillUrl(e.target.value)}
                        />
                      )}

                      {addSkillMode === 'text' && (
                        <textarea
                          className={`${inputBase} h-36 font-mono text-xs resize-none`}
                          placeholder={`# Skill Name\n\nDescribe what this skill does and when to use it...`}
                          value={addSkillContent}
                          onChange={e => setAddSkillContent(e.target.value)}
                        />
                      )}

                      <button
                        type="button"
                        onClick={handleAddSkill}
                        disabled={addSkillWorking}
                        className="btn-primary text-xs py-1.5 disabled:opacity-40"
                      >
                        {addSkillWorking ? 'Creating…' : 'Create Skill'}
                      </button>
                    </div>
                  )}

                  {/* Skill list */}
                  {allSkills.length === 0 ? (
                    <div className="text-center py-8 text-mission-control-text-dim text-sm">No skills in .claude/skills/</div>
                  ) : (
                    <div className="space-y-1">
                      {allSkills.map(skill => {
                        const on = activeSkills.includes(skill.slug);
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill.slug)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${on ? 'border-success/40 bg-success/5' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'}`}
                          >
                            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-success border-success' : 'border-mission-control-border'}`}>
                              {on && <Check size={10} className="text-white" />}
                            </div>
                            <span className="flex-1 text-sm text-mission-control-text-primary">{skill.name}</span>
                            <span className="text-xs text-mission-control-text-dim font-mono">{skill.slug}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button type="button" onClick={saveSkills} disabled={!skillsDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save Skills'}
                  </button>
                </div>
              )}

              {/* ── TOOLS ── */}
              {tab === 'tools' && (
                <div className="space-y-4">
                  <p className="text-xs text-mission-control-text-dim">Control which MCP tools {agentName} can call during task execution.</p>
                  {MCP_SERVERS.map(server => {
                    const allOn = server.tools.every(t => activeTools.includes(t));
                    const someOn = server.tools.some(t => activeTools.includes(t));
                    return (
                      <div key={server.id} className="border border-mission-control-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2.5 bg-mission-control-surface border-b border-mission-control-border">
                          <span className="text-sm font-medium text-mission-control-text-primary">{server.label}</span>
                          <button
                            type="button"
                            onClick={() => toggleServer(server.tools, !allOn)}
                            className={`text-xs px-2 py-0.5 rounded transition-colors ${allOn ? 'bg-success/20 text-success' : someOn ? 'bg-warning/20 text-warning' : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface'}`}
                          >
                            {allOn ? 'All on' : someOn ? 'Partial' : 'All off'} — toggle all
                          </button>
                        </div>
                        <div className="divide-y divide-mission-control-border">
                          {server.tools.map(tool => {
                            const on = activeTools.includes(tool);
                            return (
                              <button
                                key={tool}
                                type="button"
                                onClick={() => toggleTool(tool)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-mission-control-surface/50 transition-colors"
                              >
                                <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${on ? 'bg-mission-control-accent border-mission-control-accent' : 'border-mission-control-border'}`}>
                                  {on && <Check size={9} className="text-white" />}
                                </div>
                                <span className={`text-xs font-mono ${on ? 'text-mission-control-text-primary' : 'text-mission-control-text-dim'}`}>{tool}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={saveTools} disabled={!toolsDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save Tool Access'}
                  </button>

                  {/* ── Custom MCP Servers ── */}
                  <div className="border-t border-mission-control-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Server size={13} className="text-mission-control-text-dim" />
                        <span className="text-xs font-medium text-mission-control-text-primary">Custom MCP Servers</span>
                      </div>
                      {!showAddMcp && (
                        <button
                          type="button"
                          onClick={() => setShowAddMcp(true)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors"
                        >
                          <Plus size={11} /> Add Server
                        </button>
                      )}
                    </div>

                    {mcpServers.length > 0 && (
                      <div className="space-y-2">
                        {mcpServers.map(server => (
                          <div key={server.id} className="flex items-center justify-between border border-mission-control-border rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-mission-control-text-primary">{server.name}</span>
                              <p className="text-xs text-mission-control-text-dim font-mono mt-0.5 truncate">
                                {server.transport === 'stdio'
                                  ? `stdio: ${server.command} ${(server.args || []).join(' ')}`
                                  : `http: ${server.url}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMcpServer(server.id)}
                              className="flex-shrink-0 ml-3 text-mission-control-text-dim hover:text-error transition-colors"
                            >
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
                          <span className="text-xs font-medium text-mission-control-text-primary">New MCP Server</span>
                          <button type="button" onClick={() => { setShowAddMcp(false); setNewMcp({ name: '', transport: 'stdio', command: 'npx', args: '', url: '', env: '' }); }} className="text-mission-control-text-dim hover:text-mission-control-text-primary text-xs">Cancel</button>
                        </div>
                        <input
                          className={`${inputBase} text-xs`}
                          placeholder="Server name (e.g. Filesystem MCP)"
                          value={newMcp.name}
                          onChange={e => setNewMcp(m => ({ ...m, name: e.target.value }))}
                        />
                        <select
                          className={`${inputBase} text-xs`}
                          value={newMcp.transport}
                          onChange={e => setNewMcp(m => ({ ...m, transport: e.target.value as 'stdio' | 'http' }))}
                        >
                          <option value="stdio">stdio — local process</option>
                          <option value="http">HTTP / SSE — remote endpoint</option>
                        </select>
                        {newMcp.transport === 'stdio' ? (
                          <>
                            <input
                              className={`${inputBase} text-xs font-mono`}
                              placeholder="Command (e.g. npx, node, python)"
                              value={newMcp.command}
                              onChange={e => setNewMcp(m => ({ ...m, command: e.target.value }))}
                            />
                            <input
                              className={`${inputBase} text-xs font-mono`}
                              placeholder="Arguments (e.g. -y @modelcontextprotocol/server-filesystem /path)"
                              value={newMcp.args}
                              onChange={e => setNewMcp(m => ({ ...m, args: e.target.value }))}
                            />
                          </>
                        ) : (
                          <input
                            className={`${inputBase} text-xs font-mono`}
                            placeholder="URL (e.g. https://mcp.example.com)"
                            value={newMcp.url}
                            onChange={e => setNewMcp(m => ({ ...m, url: e.target.value }))}
                          />
                        )}
                        <textarea
                          className={`${inputBase} text-xs font-mono resize-none`}
                          placeholder={'Environment variables (optional):\nAPI_KEY=your-key\nBASE_URL=https://...'}
                          rows={3}
                          value={newMcp.env}
                          onChange={e => setNewMcp(m => ({ ...m, env: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={addMcpServer}
                          disabled={!newMcp.name.trim() || (newMcp.transport === 'stdio' ? !newMcp.command.trim() : !newMcp.url.trim())}
                          className="btn-primary text-xs disabled:opacity-40"
                        >
                          Add Server
                        </button>
                      </div>
                    )}

                    {mcpDirty && (
                      <button type="button" onClick={saveMcp} disabled={saving} className="btn-primary text-sm disabled:opacity-40">
                        {saving ? 'Saving…' : 'Save MCP Servers'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── API KEYS ── */}
              {tab === 'api' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-mission-control-text-dim">Grant {agentName} access to API keys and credentials.</p>
                    {!showAddKey && (
                      <button
                        type="button"
                        onClick={() => setShowAddKey(true)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded-lg hover:bg-mission-control-accent/20 transition-colors"
                      >
                        <Plus size={11} /> Add Credential
                      </button>
                    )}
                  </div>

                  {/* Inline add form */}
                  {showAddKey && (
                    <div className="border border-mission-control-accent/30 rounded-lg p-3 space-y-2.5 bg-mission-control-accent/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-mission-control-text-primary">New Credential</span>
                        <button type="button" onClick={() => { setShowAddKey(false); setNewKey({ name: '', service: '', key: '' }); }} className="text-mission-control-text-dim hover:text-mission-control-text-primary text-xs">Cancel</button>
                      </div>
                      <select
                        className={`${inputBase} text-xs`}
                        onChange={e => {
                          const preset = API_PRESETS.find(p => p.service === e.target.value);
                          if (preset) setNewKey(k => ({ ...k, service: preset.service, name: preset.service ? preset.label : k.name }));
                        }}
                      >
                        {API_PRESETS.map(p => (
                          <option key={p.label} value={p.service}>{p.label}</option>
                        ))}
                      </select>
                      <input
                        className={`${inputBase} text-xs`}
                        placeholder="Label (e.g. OpenAI Production)"
                        value={newKey.name}
                        onChange={e => setNewKey(k => ({ ...k, name: e.target.value }))}
                      />
                      <input
                        className={`${inputBase} text-xs`}
                        placeholder="Service"
                        value={newKey.service}
                        onChange={e => setNewKey(k => ({ ...k, service: e.target.value }))}
                      />
                      <input
                        type="password"
                        autoComplete="off"
                        className={`${inputBase} text-xs font-mono`}
                        placeholder={API_PRESETS.find(p => p.service === newKey.service)?.placeholder ?? 'Paste your key here'}
                        value={newKey.key}
                        onChange={e => setNewKey(k => ({ ...k, key: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                      />
                      <button
                        type="button"
                        onClick={handleCreateKey}
                        disabled={addingKey}
                        className="btn-primary text-xs py-1.5 disabled:opacity-40"
                      >
                        {addingKey ? 'Saving…' : 'Add & Assign to Agent'}
                      </button>
                    </div>
                  )}

                  {allApiKeys.length === 0 && !showAddKey ? (
                    <div className="text-center py-8 text-mission-control-text-dim text-sm">
                      No credentials yet.<br />
                      <span className="text-xs opacity-60">Click "Add Credential" to create one.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {allApiKeys.map(key => {
                        const on = activeApiKeys.includes(key.id);
                        return (
                          <button
                            key={key.id}
                            type="button"
                            onClick={() => toggleApiKey(key.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${on ? 'border-mission-control-accent/40 bg-mission-control-accent/5' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'}`}
                          >
                            <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-mission-control-accent border-mission-control-accent' : 'border-mission-control-border'}`}>
                              {on && <Check size={10} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-mission-control-text-primary">{key.name}</div>
                              <div className="text-xs text-mission-control-text-dim">{key.service}</div>
                            </div>
                            <Key size={12} className={on ? 'text-mission-control-accent' : 'text-mission-control-text-dim'} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button type="button" onClick={saveApiKeys} disabled={!apiKeysDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save API Access'}
                  </button>
                </div>
              )}

              {/* ── PERMISSIONS ── */}
              {tab === 'permissions' && (
                <div className="space-y-4">

                  {/* Trust tier — compact horizontal pills */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Trust Tier</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {TRUST_TIERS.map(tier => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => {
                            if (tier.id !== trustTier) setPrevTrustTier(trustTier);
                            setTrustTier(tier.id);
                            // Apply preset overrides for this tier
                            const preset = TIER_PRESETS[tier.id];
                            if (preset) {
                              setPermOverrides(preset);
                              // Expand all groups so the user can see what changed
                              const allOpen: Record<string, boolean> = {};
                              PERMISSION_GROUPS.forEach(g => { allOpen[g.label] = true; });
                              setExpandedGroups(allOpen);
                              setPresetApplied(tier.id);
                              setTimeout(() => setPresetApplied(null), 2000);
                            }
                            setPermDirty(true);
                          }}
                          className={`flex flex-col items-center px-2 py-2 rounded-lg border text-center transition-all ${trustTier === tier.id ? 'border-mission-control-accent bg-mission-control-accent/10' : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40'}`}
                        >
                          <span className={`text-xs font-semibold ${tier.color}`}>{tier.label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Description + preset flash */}
                    <div className="flex items-center justify-between mt-2 px-1">
                      <p className="text-xs text-mission-control-text-dim">
                        {TRUST_TIERS.find(t => t.id === trustTier)?.desc}
                      </p>
                      {presetApplied && (
                        <span className="text-xs text-mission-control-accent font-medium animate-pulse">
                          Presets applied
                        </span>
                      )}
                    </div>
                    {/* Tier diff preview */}
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
                          {gained.length > 0 && (
                            <div className="text-success">+ Granting: {gained.join(', ')}</div>
                          )}
                          {lost.length > 0 && (
                            <div className="text-error">- Removing: {lost.join(', ')}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Per-action overrides — collapsible groups */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Action Overrides</div>
                    <div className="space-y-1.5">
                      {PERMISSION_GROUPS.map(group => {
                        const isOpen = expandedGroups[group.label] ?? false;
                        const overrideCount = group.perms.filter(p => permOverrides[p.id] !== undefined).length;
                        return (
                          <div key={group.label} className="border border-mission-control-border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedGroups(prev => ({ ...prev, [group.label]: !isOpen }))}
                              className="w-full flex items-center justify-between px-3 py-2 bg-mission-control-surface hover:bg-mission-control-surface/80 transition-colors text-left"
                            >
                              <span className="flex items-center gap-2 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                                <Shield size={11} /> {group.label}
                              </span>
                              <span className="flex items-center gap-2">
                                {overrideCount > 0 && (
                                  <span className="text-xs text-mission-control-accent">{overrideCount} override{overrideCount > 1 ? 's' : ''}</span>
                                )}
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
                                        <span className="text-xs text-mission-control-text-primary">{perm.label}</span>
                                        <span className={`ml-1.5 text-xs ${TIER_COLORS[perm.tier]}`}>T{perm.tier}</span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {hasOverride && (
                                          <button
                                            type="button"
                                            onClick={() => { setPermOverrides(prev => { const n = { ...prev }; delete n[perm.id]; return n; }); setPermDirty(true); }}
                                            className="text-xs text-mission-control-text-dim hover:text-mission-control-text-primary px-1.5 py-0.5 rounded border border-mission-control-border transition-colors"
                                          >Reset</button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => { setPermOverrides(prev => ({ ...prev, [perm.id]: true })); setPermDirty(true); }}
                                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${overrideVal === true ? 'bg-success/20 text-success border-success/40' : 'border-mission-control-border text-mission-control-text-dim hover:text-success hover:border-success/40'}`}
                                        >Allow</button>
                                        <button
                                          type="button"
                                          onClick={() => { setPermOverrides(prev => ({ ...prev, [perm.id]: false })); setPermDirty(true); }}
                                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${overrideVal === false ? 'bg-error/20 text-error border-error/40' : 'border-mission-control-border text-mission-control-text-dim hover:text-error hover:border-error/40'}`}
                                        >Deny</button>
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

                  {/* Per-agent blocked commands */}
                  <div>
                    <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">Blocked Commands</div>
                    <p className="text-xs text-mission-control-text-dim mb-2">Agent-specific blocked tool patterns (global blocks in Settings → Security always apply).</p>
                    <div className="border border-mission-control-border rounded-lg overflow-hidden">
                      <div className="p-2 bg-mission-control-surface flex gap-2">
                        <input
                          type="text"
                          value={newDisallowed}
                          onChange={e => setNewDisallowed(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddAgentDisallowed()}
                          placeholder="e.g. Bash(git push *)"
                          className="flex-1 text-xs bg-mission-control-bg0 border border-mission-control-border rounded px-2 py-1.5 focus:outline-none focus:border-mission-control-accent font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddAgentDisallowed}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30 rounded hover:bg-mission-control-accent/20 transition-colors"
                        >
                          <Plus size={10} /> Block
                        </button>
                      </div>
                      {agentDisallowed.length > 0 && (
                        <div className="divide-y divide-mission-control-border border-t border-mission-control-border">
                          {agentDisallowed.map(tool => (
                            <div key={tool} className="flex items-center justify-between px-3 py-1.5">
                              <code className="text-xs font-mono text-mission-control-text-primary">{tool}</code>
                              <button type="button" onClick={() => handleRemoveAgentDisallowed(tool)} className="p-0.5 text-mission-control-text-dim hover:text-error transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={savePermissions} disabled={!permDirty || saving} className="btn-primary text-sm disabled:opacity-40">
                    {saving ? 'Saving…' : 'Save Permissions'}
                  </button>
                </div>
              )}

              {/* ── PERFORMANCE ── */}
              {tab === 'performance' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 size={14} className="text-mission-control-text-dim" />
                    <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">Agent Performance</span>
                  </div>

                  {metricsLoading ? (
                    <div className="flex items-center justify-center py-10 text-mission-control-text-dim text-sm">Loading metrics…</div>
                  ) : !metrics ? (
                    <div className="flex items-center justify-center py-10 text-mission-control-text-dim text-sm">No metrics available</div>
                  ) : (
                    <>
                      {/* Task stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border text-center">
                          <div className="text-2xl font-bold text-mission-control-text-primary">{metrics.tasksCompleted}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Tasks Done</div>
                        </div>
                        <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border text-center">
                          <div className="text-2xl font-bold text-mission-control-text-primary">{metrics.tasksInProgress}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">In Progress</div>
                        </div>
                        <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border text-center">
                          <div className="text-2xl font-bold text-mission-control-text-primary">{metrics.tasksTotal}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Total Tasks</div>
                        </div>
                      </div>

                      {/* Review stats */}
                      <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border space-y-2">
                        <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">Clara Review Score</div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-mission-control-bg0 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-success transition-all"
                              style={{ width: `${metrics.approvalRate ?? 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-mission-control-text-primary w-10 text-right">
                            {metrics.approvalRate !== null ? `${metrics.approvalRate}%` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-mission-control-text-dim">
                          <span className="text-success">{metrics.reviewsApproved} approved</span>
                          <span className="text-error">{metrics.reviewsRejected} rejected</span>
                        </div>
                      </div>

                      {/* Memory and activity */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <BookOpen size={12} className="text-mission-control-text-dim" />
                            <span className="text-xs text-mission-control-text-dim">Memory Notes</span>
                          </div>
                          <div className="text-lg font-bold text-mission-control-text-primary">{metrics.memoryNotes}</div>
                          <div className="text-xs text-mission-control-text-dim">notes in vault</div>
                        </div>
                        <div className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <BarChart2 size={12} className="text-mission-control-text-dim" />
                            <span className="text-xs text-mission-control-text-dim">Recent Activity</span>
                          </div>
                          <div className="text-lg font-bold text-mission-control-text-primary">{metrics.recentActivity}</div>
                          <div className="text-xs text-mission-control-text-dim">actions last 7d</div>
                        </div>
                      </div>

                      {/* Avg completion + last active */}
                      <div className="space-y-2 text-sm">
                        {metrics.avgCompletionMs !== null && (
                          <div className="flex justify-between px-1">
                            <span className="text-mission-control-text-dim text-xs">Avg. completion time</span>
                            <span className="text-mission-control-text-primary text-xs font-medium">
                              {metrics.avgCompletionMs < 3600000
                                ? `${Math.round(metrics.avgCompletionMs / 60000)}m`
                                : `${(metrics.avgCompletionMs / 3600000).toFixed(1)}h`}
                            </span>
                          </div>
                        )}
                        {metrics.lastActive !== null && (
                          <div className="flex justify-between px-1">
                            <span className="text-mission-control-text-dim text-xs">Last active</span>
                            <span className="text-mission-control-text-primary text-xs font-medium">
                              {new Date(metrics.lastActive).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => { setMetrics(null); }}
                        className="text-xs text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors"
                      >
                        Refresh metrics
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ))}
        </div>

        {/* HR Actions footer — only for configure section, non-protected agents */}
        {section === 'configure' && !loading && !isProtectedAgent(agentId) && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-mission-control-border bg-mission-control-bg/50">
            {agentStatus === 'disabled' ? (
              <button
                type="button"
                disabled={hrActionLoading}
                onClick={async () => {
                  setHrActionLoading(true);
                  try {
                    await agentApi.updateStatus(agentId, 'idle');
                    setAgentStatus('idle');
                    showToast('Agent enabled', 'success');
                  } catch { showToast('Failed to enable agent', 'error'); }
                  finally { setHrActionLoading(false); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-success border border-success-border rounded-lg hover:bg-success-subtle transition-colors disabled:opacity-40"
              >
                <Power size={14} /> Enable Agent
              </button>
            ) : (
              <button
                type="button"
                disabled={hrActionLoading}
                onClick={() => setShowDisableConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-warning border border-warning-border rounded-lg hover:bg-warning-subtle transition-colors disabled:opacity-40"
              >
                <PowerOff size={14} /> Disable Agent
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              disabled={hrActionLoading}
              onClick={() => setShowFireConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors disabled:opacity-40"
            >
              <UserMinus size={14} /> Fire Agent
            </button>
          </div>
        )}
      </div>

      {/* Fire confirm */}
      <ConfirmDialog
        open={showFireConfirm}
        onClose={() => setShowFireConfirm(false)}
        onConfirm={async () => {
          setShowFireConfirm(false);
          setHrActionLoading(true);
          try {
            await catalogApi.fireAgent(agentId);
            showToast('Agent fired', 'success');
            fetchAgents();
            onClose();
          } catch { showToast('Failed to fire agent', 'error'); }
          finally { setHrActionLoading(false); }
        }}
        title={`Fire ${agentName}?`}
        message={`Fire ${agentName}? Their workspace will be archived. Active tasks will be paused.`}
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
            showToast('Agent disabled', 'success');
          } catch { showToast('Failed to disable agent', 'error'); }
          finally { setHrActionLoading(false); }
        }}
        title={`Disable ${agentName}?`}
        message={`Disable ${agentName}? Active tasks will pause until re-enabled.`}
        confirmLabel="Disable"
        cancelLabel="Cancel"
        type="warning"
      />
    </div>
  );
}
