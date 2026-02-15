import { useState, useEffect } from 'react';
import { X, Award, TrendingUp, Clock, CheckCircle, XCircle, FileText, Activity, Brain, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useStore } from '../store/store';

interface AgentDetailModalProps {
  agentId: string;
  onClose: () => void;
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

export default function AgentDetailModal({ agentId, onClose }: AgentDetailModalProps) {
  const { agents, tasks, gatewaySessions } = useStore();
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'performance' | 'skills' | 'tasks' | 'sessions' | 'rules'>('performance');
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const agent = agents.find(a => a.id === agentId);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const buildDetailsFromRealData = async () => {
    setLoading(true);

    // Try IPC first (reads from froggo.db with real data)
    let ipcDetails: any = null;
    try {
      const ipc = (window as any).clawdbot?.agents;
      if (ipc?.getDetails) {
        ipcDetails = await ipc.getDetails(agentId);
      }
    } catch (e: any) {
      console.error('[AgentDetail] IPC getDetails failed:', e?.message || e);
    }

    // Get tasks from store as fallback/supplement
    const agentTasks = tasks.filter(t => t.assignedTo === agentId);
    const doneTasks = agentTasks.filter(t => t.status === 'done');
    const failedTasksList = agentTasks.filter(t => (t.status as string) === 'failed' || (t.status as string) === 'blocked');
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
        const result = await (window as any).clawdbot?.exec?.run(
          `cat ~/clawd/agents/${agentId}/AGENT.md 2>/dev/null || cat ~/clawd-${agentId}/AGENTS.md 2>/dev/null || echo "No AGENT.md found for ${agentId}"`
        );
        if (result?.stdout) {
          rulesContent = result.stdout;
        }
      } catch (e) {
        rulesContent = `Could not load rules for ${agentId}`;
      }
    }

    if (brainNotes.length === 0) {
      try {
        const memResult = await (window as any).clawdbot?.exec?.run(
          `ls -1 ~/clawd/clawd-${agentId}/memory/ 2>/dev/null | tail -5`
        );
        if (memResult?.stdout?.trim()) {
          const files = memResult.stdout.trim().split('\n');
          brainNotes = files.map((f: string) => `📝 ${f}`);
        }
      } catch (e) {
        // OK
      }
    }

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
      if (isCmdOrCtrl && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, typeof activeTab> = { '1': 'performance', '2': 'skills', '3': 'tasks', '4': 'sessions', '5': 'rules' };
        if (e.key in tabMap) setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeTab]);

  if (!agent) return null;

  return (
    <div 
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`} 
      onClick={handleClose}
    >
      <div 
        className={`glass-modal rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-clawd-bg">
              {(() => { const themes: Record<string, string> = { main: 'froggo.png', froggo: 'froggo.png', coder: 'coder.png', researcher: 'researcher.png', writer: 'writer.png', chief: 'chief.png', hr: 'hr.png', ox: 'ox.png' }; const pic = themes[agent.id.toLowerCase()]; return pic ? <img src={`./agent-profiles/${pic}`} alt={agent.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); }} /> : null; })()}
              <span className={`${['main','froggo','coder','researcher','writer','chief','hr','ox'].includes(agent.id.toLowerCase()) ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-4xl`}>{agent.avatar}</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{agent.name}</h2>
              <p className="text-sm text-clawd-text-dim">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={buildDetailsFromRealData}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              title="Refresh (⌘R)"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-clawd-border px-6">
          {([
            { key: 'performance' as const, icon: TrendingUp, label: 'Performance' },
            { key: 'skills' as const, icon: Award, label: 'Skills' },
            { key: 'tasks' as const, icon: Activity, label: `Tasks${details ? ` (${details.totalTasks})` : ''}` },
            { key: 'sessions' as const, icon: Wifi, label: `Sessions${details ? ` (${details.activeSessions.length})` : ''}` },
            { key: 'rules' as const, icon: FileText, label: 'Rules' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-clawd-accent text-clawd-accent'
                  : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
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
              <div className="flex items-center gap-2 text-clawd-text-dim">
                <RefreshCw size={16} className="animate-spin" />
                Loading real data...
              </div>
            </div>
          ) : details ? (
            <>
              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-clawd-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-success" />
                        <span className="text-sm text-clawd-text-dim">Success Rate</span>
                      </div>
                      <div className="text-3xl font-bold text-success">
                        {details.totalTasks > 0 ? `${Math.round(details.successRate * 100)}%` : '—'}
                      </div>
                      <div className="text-xs text-clawd-text-dim mt-1">
                        {details.successfulTasks} / {details.totalTasks} tasks
                      </div>
                    </div>

                    <div className="bg-clawd-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-info" />
                        <span className="text-sm text-clawd-text-dim">Avg Time</span>
                      </div>
                      <div className="text-3xl font-bold text-info">
                        {details.avgTime}
                      </div>
                      <div className="text-xs text-clawd-text-dim mt-1">per task completion</div>
                    </div>

                    <div className="bg-clawd-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-amber-400" />
                        <span className="text-sm text-clawd-text-dim">In Progress</span>
                      </div>
                      <div className="text-3xl font-bold text-amber-400">
                        {details.inProgressTasks}
                      </div>
                      <div className="text-xs text-clawd-text-dim mt-1">active tasks</div>
                    </div>

                    <div className="bg-clawd-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi size={16} className="text-review" />
                        <span className="text-sm text-clawd-text-dim">Sessions</span>
                      </div>
                      <div className="text-3xl font-bold text-review">
                        {details.activeSessions.filter(s => s.isActive).length}
                      </div>
                      <div className="text-xs text-clawd-text-dim mt-1">
                        {details.activeSessions.length} total
                      </div>
                    </div>
                  </div>

                  {/* Task breakdown */}
                  <div className="bg-clawd-bg rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-4">Task Breakdown</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Completed', count: details.successfulTasks, color: 'bg-green-500', pct: details.totalTasks > 0 ? (details.successfulTasks / details.totalTasks) * 100 : 0 },
                        { label: 'In Progress', count: details.inProgressTasks, color: 'bg-warning', pct: details.totalTasks > 0 ? (details.inProgressTasks / details.totalTasks) * 100 : 0 },
                        { label: 'Failed/Blocked', count: details.failedTasks, color: 'bg-red-500', pct: details.totalTasks > 0 ? (details.failedTasks / details.totalTasks) * 100 : 0 },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>{item.label}</span>
                            <span className="text-clawd-text-dim">{item.count} ({Math.round(item.pct)}%)</span>
                          </div>
                          <div className="h-2 bg-clawd-surface rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Skills Tab */}
              {activeTab === 'skills' && (
                <div className="space-y-4">
                  <p className="text-sm text-clawd-text-dim">
                    Capabilities configured for {agent.name}:
                  </p>
                  {details.skills.length > 0 ? (
                    <div className="space-y-2">
                      {details.skills.map((skill) => (
                        <div key={skill.name} className="bg-clawd-bg rounded-lg p-4 hover:bg-clawd-border/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Award size={16} className="text-warning" />
                              <span className="font-medium">{skill.name}</span>
                            </div>
                            <span className="text-xs text-clawd-text-dim">{skill.lastUsed}</span>
                          </div>
                          <div className="mb-1">
                            <div className="flex items-center justify-between text-xs text-clawd-text-dim mb-1">
                              <span>Proficiency</span>
                              <span>{Math.round(skill.proficiency * 100)}%</span>
                            </div>
                            <div className="h-2 bg-clawd-surface rounded-full overflow-hidden">
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
                    <div className="text-center py-12 text-clawd-text-dim">
                      <Award size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No skills configured</p>
                      <p className="text-xs">Add capabilities to this agent in the config</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  {details.recentTasks.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3">
                        Tasks ({details.recentTasks.length})
                      </h3>
                      {details.recentTasks.map((task) => (
                        <div key={task.id} className="bg-clawd-bg rounded-lg p-3 hover:bg-clawd-border/50 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="font-medium mb-1">{task.title}</div>
                              <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
                                <span className={`px-2 py-0.5 rounded ${
                                  task.status === 'done' ? 'bg-success-subtle text-success' :
                                  task.status === 'in-progress' ? 'bg-warning-subtle text-warning' :
                                  task.status === 'failed' ? 'bg-error-subtle text-error' :
                                  task.status === 'blocked' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-clawd-bg0/20 text-clawd-text-dim'
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
                              <Clock size={16} className="text-clawd-text-dim flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12 text-clawd-text-dim">
                      <Activity size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No tasks assigned to {agent.name}</p>
                      <p className="text-xs">Assign tasks from the Kanban board</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <p className="text-sm text-clawd-text-dim">
                    Gateway sessions associated with {agent.name}:
                  </p>
                  {details.activeSessions.length > 0 ? (
                    <div className="space-y-2">
                      {details.activeSessions.map((session) => (
                        <div key={session.key} className={`bg-clawd-bg rounded-lg p-4 border ${
                          session.isActive ? 'border-success-border' : 'border-clawd-border'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {session.isActive ? (
                                <Wifi size={16} className="text-success" />
                              ) : (
                                <WifiOff size={16} className="text-clawd-text-dim" />
                              )}
                              <span className="font-medium text-sm">
                                {session.label || session.key.slice(0, 40)}
                              </span>
                              {session.isActive && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-success-subtle text-success rounded">Active</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs text-clawd-text-dim">
                            <div>
                              <span className="block text-clawd-text-dim/60">Model</span>
                              <span>{session.model.split('/').pop() || 'unknown'}</span>
                            </div>
                            <div>
                              <span className="block text-clawd-text-dim/60">Tokens</span>
                              <span>{(session.tokens / 1000).toFixed(1)}k</span>
                            </div>
                            <div>
                              <span className="block text-clawd-text-dim/60">Last Active</span>
                              <span>{session.updatedAt > 0 ? new Date(session.updatedAt).toLocaleString() : '—'}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] text-clawd-text-dim/60 truncate" title={session.key}>
                            {session.key}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-clawd-text-dim">
                      <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No active sessions</p>
                      <p className="text-xs">Sessions appear when the agent is working on tasks</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rules Tab */}
              {activeTab === 'rules' && (
                <div>
                  <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Agent Configuration
                  </h3>

                  {/* Brain notes */}
                  {details.brainNotes.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-clawd-text-dim uppercase mb-2 flex items-center gap-1">
                        <Brain size={14} /> Memory Files
                      </h4>
                      <div className="space-y-2">
                        {details.brainNotes.map((note, i) => (
                          <div key={i} className="bg-clawd-bg rounded-lg p-3 text-sm">
                            <pre className="whitespace-pre-wrap font-mono text-xs">{note}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-xs font-semibold text-clawd-text-dim uppercase mb-2">AGENTS.md</h4>
                  <div className="bg-clawd-bg rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                      {details.agentRules || 'No AGENT.md file found'}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-clawd-text-dim">
              <XCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>Failed to load agent details</p>
              <button onClick={buildDetailsFromRealData} className="mt-2 text-clawd-accent hover:underline text-sm">
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
