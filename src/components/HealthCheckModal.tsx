import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Loader2, AlertTriangle, Sparkles, Flag, ArrowRight, Check, AlertCircle } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { useStore } from '../store/store';
import { taskApi } from '../lib/api';
import { showToast } from './Toast';
import { createLogger } from '../utils/logger';

const logger = createLogger('HealthCheck');

interface HealthCheckModalProps {
  onClose: () => void;
  stats: {
    totalTasks: number;
    inProgress: number;
    urgent: number;
    overdue: number;
    unassigned: number;
  };
}

interface Issue {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  taskIds: string[];
  action: string;
  actionVerb: string;
}

type Phase = 'scanning' | 'proposing' | 'executing' | 'done';

export default function HealthCheckModal({ onClose }: HealthCheckModalProps) {
  const agents = useStore(s => s.agents);
  const [phase, setPhase] = useState<Phase>('scanning');
  const [scanProgress, setScanProgress] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);
  const didExecute = useRef(false);

  // Dynamic valid agents from store (exclude mission-control, main - orchestrators only)
  // Clara and other agents CAN be assigned tasks
  const VALID_AGENTS = agents.filter(a => !['mission-control', 'main'].includes(a.id)).map(a => a.id);

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // exec not available in web mode - task updates go through REST API
  const execCmd = async (_cmd: string): Promise<{ ok: boolean; stdout: string; error?: string }> => {
    // Shell exec not available in web mode
    return { ok: false, stdout: '', error: 'Shell exec not available in web mode' };
  };

  const cancelTask = async (taskId: string): Promise<boolean> => {
    try {
      await taskApi.update(taskId, { status: 'cancelled' });
      return true;
    } catch { return false; }
  };

  const updateTaskField = async (taskId: string, field: string, value: string): Promise<boolean> => {
    try {
      await taskApi.update(taskId, { [field]: value });
      return true;
    } catch { return false; }
  };

  const fetchTasks = async (): Promise<any[]> => {
    try {
      const result = await taskApi.getAll();
      const allTasks = Array.isArray(result) ? result : (result?.tasks || []);
      return allTasks.filter((t: any) => !['done', 'failed', 'cancelled'].includes(t.status));
    } catch {
      // fetchTasks failed — return empty array
    }
    return [];
  };

  useEffect(() => { runScan(); }, []);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [executionLog, phase]);

  const runScan = async () => {
    const foundIssues: Issue[] = [];
    
    setScanProgress(10);
    const allTasks = await fetchTasks();
    setTasks(allTasks);
    
    setScanProgress(20);

    // === CRITICAL: Workflow Violations ===

    // 1. STALE HUMAN-REVIEW (tasks waiting for human > 24h)
    const staleHumanReview = allTasks.filter(t => t.status === 'human-review' && (Date.now() - (t.updatedAt || 0)) > 86400000);
    if (staleHumanReview.length > 0) {
      foundIssues.push({
        id: 'stale-human-review',
        type: 'workflow',
        severity: 'critical',
        title: `${staleHumanReview.length} task(s) waiting for human review > 24h`,
        description: staleHumanReview.map(t => `"${t.title?.slice(0, 30)}..."`).slice(0, 3).join(', '),
        taskIds: staleHumanReview.map(t => t.id),
        action: `Review ${staleHumanReview.length} task(s) in human-review — approve, reject, or move back`,
        actionVerb: 'Identifying stale human-review tasks'
      });
    }
    setScanProgress(25);

    // 2. STALLED IN-PROGRESS (no activity in last 30 minutes)
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const stalledTasks = allTasks.filter(t => 
      t.status === 'in-progress' && 
      (!t.updated_at || t.updated_at < thirtyMinAgo) &&
      (!t.last_activity_at || t.last_activity_at < thirtyMinAgo)
    );
    if (stalledTasks.length > 0) {
      foundIssues.push({
        id: 'stalled-tasks',
        type: 'workflow',
        severity: 'critical',
        title: `${stalledTasks.length} stalled in-progress task(s)`,
        description: `No progress in 30+ minutes: ${stalledTasks.map(t => `"${t.title?.slice(0, 25)}..."`).slice(0, 2).join(', ')}`,
        taskIds: stalledTasks.map(t => t.id),
        action: `Review ${stalledTasks.length} stalled task(s) - check if agent is stuck`,
        actionVerb: 'Detecting stalled work'
      });
    }
    
    // 3. In-progress without agent
    const inProgressNoAgent = allTasks.filter(t => 
      t.status === 'in-progress' && (!t.assigned_to || t.assigned_to === '')
    );
    if (inProgressNoAgent.length > 0) {
      foundIssues.push({
        id: 'no-agent-inprogress',
        type: 'workflow',
        severity: 'critical',
        title: `${inProgressNoAgent.length} in-progress task(s) with no agent`,
        description: inProgressNoAgent.map(t => `"${t.title?.slice(0, 30)}..."`).slice(0, 2).join(', '),
        taskIds: inProgressNoAgent.map(t => t.id),
        action: `Move ${inProgressNoAgent.length} back to todo`,
        actionVerb: 'Fixing unassigned in-progress'
      });
    }
    setScanProgress(30);

    // 2. In-progress without subtasks (work not planned)
    // Note: We may not have subtasks loaded, so let's check another way
    // const inProgressNoSubtasks = allTasks.filter(t => t.status === 'in-progress' && (!t.subtasks || t.subtasks.length === 0));
    
    setScanProgress(40);

    // 3. Invalid agent assignments
    const invalidAgents = allTasks.filter(t => 
      t.assigned_to && t.assigned_to !== '' && !VALID_AGENTS.includes(t.assigned_to.toLowerCase())
    );
    if (invalidAgents.length > 0) {
      const badAgents = [...new Set(invalidAgents.map(t => t.assigned_to))];
      foundIssues.push({
        id: 'invalid-agents',
        type: 'workflow',
        severity: 'critical',
        title: `${invalidAgents.length} task(s) assigned to unknown agent(s)`,
        description: `Invalid: ${badAgents.join(', ')}`,
        taskIds: invalidAgents.map(t => t.id),
        action: `Unassign ${invalidAgents.length} task(s)`,
        actionVerb: 'Clearing invalid assignments'
      });
    }
    setScanProgress(50);

    // === WARNING: Data Quality Issues ===

    // 4. Junk/test tasks
    const junkPatterns = [/^--\w+$/, /^test$/i, /^another-test$/i, /^asdf/i, /^\w{1,2}$/];
    const junkTasks = allTasks.filter(t => 
      junkPatterns.some(p => p.test(t.title)) || (t.title?.length || 0) < 3
    );
    if (junkTasks.length > 0) {
      foundIssues.push({
        id: 'junk',
        type: 'cleanup',
        severity: 'warning',
        title: `${junkTasks.length} junk/test task(s)`,
        description: junkTasks.map(t => `"${t.title}"`).slice(0, 3).join(', '),
        taskIds: junkTasks.map(t => t.id),
        action: `Delete ${junkTasks.length} junk task(s)`,
        actionVerb: 'Removing junk'
      });
    }
    setScanProgress(60);

    // 5. Duplicates
    const titleGroups = new Map<string, any[]>();
    allTasks.forEach(t => {
      const normalized = t.title?.toLowerCase()
        .replace(/^degendome\s+/i, '')
        .replace(/\s+--description.*$/i, '')
        .trim();
      if (normalized && normalized.length > 5) {
        if (!titleGroups.has(normalized)) titleGroups.set(normalized, []);
        titleGroups.get(normalized)!.push(t);
      }
    });
    const duplicates = Array.from(titleGroups.entries()).filter(([_, t]) => t.length > 1);
    if (duplicates.length > 0) {
      const dupeCount = duplicates.reduce((sum, [_, t]) => sum + t.length - 1, 0);
      foundIssues.push({
        id: 'duplicates',
        type: 'cleanup',
        severity: 'warning',
        title: `${dupeCount} duplicate task(s) in ${duplicates.length} groups`,
        description: duplicates.slice(0, 2).map(([n, t]) => `"${n.slice(0, 20)}..." (${t.length}x)`).join(', '),
        taskIds: duplicates.flatMap(([_, t]) => t.slice(1).map(x => x.id)),
        action: `Remove ${dupeCount} duplicate(s)`,
        actionVerb: 'Merging duplicates'
      });
    }
    setScanProgress(70);

    // 6. Malformed titles
    const malformed = allTasks.filter(t => 
      t.title?.includes('--description') || t.title?.includes('--assign')
    );
    if (malformed.length > 0) {
      foundIssues.push({
        id: 'malformed',
        type: 'cleanup',
        severity: 'warning',
        title: `${malformed.length} malformed title(s)`,
        description: 'CLI flags in task titles',
        taskIds: malformed.map(t => t.id),
        action: `Clean ${malformed.length} title(s)`,
        actionVerb: 'Cleaning titles'
      });
    }
    setScanProgress(80);

    // 7. Orphan references (lead-engineer)
    const orphans = allTasks.filter(t => 
      t.title?.toLowerCase().includes('lead-engineer') || 
      t.title?.toLowerCase().includes('lead engineer') ||
      t.assigned_to?.toLowerCase() === 'lead-engineer'
    );
    if (orphans.length > 0) {
      foundIssues.push({
        id: 'orphans',
        type: 'cleanup',
        severity: 'info',
        title: `${orphans.length} task(s) reference removed agent`,
        description: 'Lead-Engineer no longer exists',
        taskIds: orphans.map(t => t.id),
        action: `Delete ${orphans.length} orphaned task(s)`,
        actionVerb: 'Removing orphans'
      });
    }
    setScanProgress(90);

    // 8. Priority inconsistency
    const priorities = allTasks.map(t => t.priority).filter(Boolean);
    const hasOld = priorities.some(p => ['high', 'medium', 'low'].includes(p));
    const hasNew = priorities.some(p => ['p0', 'p1', 'p2', 'p3'].includes(p));
    if (hasOld && hasNew) {
      const oldTasks = allTasks.filter(t => ['high', 'medium', 'low'].includes(t.priority));
      foundIssues.push({
        id: 'priority-mix',
        type: 'cleanup',
        severity: 'info',
        title: 'Mixed priority systems',
        description: `${oldTasks.length} task(s) use old (high/medium/low) vs new (p0-p3)`,
        taskIds: oldTasks.map(t => t.id),
        action: `Convert ${oldTasks.length} to new system`,
        actionVerb: 'Standardizing priorities'
      });
    }

    setScanProgress(100);
    setIssues(foundIssues);
    await delay(300);
    setPhase(foundIssues.length > 0 ? 'proposing' : 'done');
  };

  const executePlan = async (feedback?: string) => {
    setPhase('executing');
    abortControllerRef.current = new AbortController();
    const skipTypes: string[] = [];
    
    if (feedback) {
      const lower = feedback.toLowerCase();
      if (lower.includes('skip') || lower.includes("don't") || lower.includes('except')) {
        if (lower.includes('junk')) skipTypes.push('junk');
        if (lower.includes('duplicate') || lower.includes('dupe')) skipTypes.push('duplicates');
        if (lower.includes('workflow')) skipTypes.push('workflow');
        if (lower.includes('orphan')) skipTypes.push('orphans');
        if (lower.includes('priorit')) skipTypes.push('priority-mix');
        if (lower.includes('title')) skipTypes.push('malformed');
        if (lower.includes('agent')) skipTypes.push('invalid-agents');
      }
    }

    const toExecute = issues.filter(i => !skipTypes.includes(i.type) && !skipTypes.includes(i.id));
    
    for (const issue of toExecute) {
      if (abortControllerRef.current?.signal.aborted) break;
      
      setExecutionLog(prev => [...prev, `${issue.actionVerb}...`]);
      await delay(500); // Longer delay so user sees progress

      try {
        if (issue.id === 'blocked-tasks') {
          // For blocked tasks, just log them - manual review needed
          setExecutionLog(prev => [...prev, `Found ${issue.taskIds.length} blocked task(s):`]);
          for (const id of issue.taskIds) {
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            setExecutionLog(prev => [...prev, `  ⚠️ "${task?.title?.slice(0, 40)}..." (${id.slice(-8)})`]);
            await delay(200);
          }
          setExecutionLog(prev => [...prev, `→ Manual review recommended - these need investigation`]);
        }
        else if (issue.id === 'stalled-tasks') {
          // For stalled tasks, log them - agents may need to be respawned
          setExecutionLog(prev => [...prev, `Found ${issue.taskIds.length} stalled task(s):`]);
          for (const id of issue.taskIds) {
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            const ageMin = task?.updated_at ? Math.round((Date.now() - task.updated_at) / 60000) : '??';
            setExecutionLog(prev => [...prev, `  ⚠️ "${task?.title?.slice(0, 35)}..." (${ageMin}min ago)`]);
            await delay(200);
          }
          setExecutionLog(prev => [...prev, `→ Check if agents need respawning or tasks need unblocking`]);
        }
        else if (issue.id === 'no-agent-inprogress') {
          let fixed = 0;
          for (const id of issue.taskIds) {
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            setExecutionLog(prev => [...prev, `  → Moving "${task?.title?.slice(0, 25)}..." to todo`]);
            await delay(300);
            if (await updateTaskField(id, 'status', 'todo')) fixed++;
          }
          setExecutionLog(prev => [...prev, `✓ Moved ${fixed} task(s) back to todo`]);
        }
        else if (issue.id === 'invalid-agents') {
          let fixed = 0;
          for (const id of issue.taskIds) {
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            setExecutionLog(prev => [...prev, `  → Clearing agent from "${task?.title?.slice(0, 25)}..."`]);
            await delay(300);
            if (await updateTaskField(id, 'assigned_to', '')) fixed++;
          }
          setExecutionLog(prev => [...prev, `✓ Cleared ${fixed} invalid assignment(s)`]);
        }
        else if (issue.id === 'junk' || issue.id === 'orphans') {
          let done = 0;
          for (const id of issue.taskIds) { 
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            setExecutionLog(prev => [...prev, `  → Deleting "${task?.title?.slice(0, 30)}..."`]);
            await delay(300);
            if (await cancelTask(id)) done++;
          }
          setExecutionLog(prev => [...prev, `✓ Deleted ${done} task(s)`]);
        }
        else if (issue.id === 'duplicates') {
          let done = 0;
          for (const id of issue.taskIds) { 
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            setExecutionLog(prev => [...prev, `  → Removing dupe "${task?.title?.slice(0, 25)}..."`]);
            await delay(300);
            if (await cancelTask(id)) done++;
          }
          setExecutionLog(prev => [...prev, `✓ Removed ${done} duplicate(s)`]);
        }
        else if (issue.id === 'malformed') {
          let fixed = 0;
          for (const id of issue.taskIds) {
            if (abortControllerRef.current?.signal.aborted) break;
            const task = tasks.find(t => t.id === id);
            if (task) {
              const clean = task.title.replace(/\s*--\w+.*$/i, '').slice(0, 80);
              setExecutionLog(prev => [...prev, `  → Cleaning "${task.title.slice(0, 20)}..." → "${clean.slice(0, 20)}..."`]);
              await delay(300);
              if (await updateTaskField(id, 'title', clean)) fixed++;
            }
          }
          setExecutionLog(prev => [...prev, `✓ Cleaned ${fixed} title(s)`]);
        }
        else if (issue.id === 'priority-mix') {
          const map: Record<string, string> = { high: 'p1', medium: 'p2', low: 'p3' };
          let fixed = 0;
          for (const id of issue.taskIds) {
            const task = tasks.find(t => t.id === id);
            if (task && map[task.priority]) {
              setExecutionLog(prev => [...prev, `  → ${task.priority} → ${map[task.priority]}`]);
              await delay(300);
              if (await updateTaskField(id, 'priority', map[task.priority])) fixed++;
            }
          }
          setExecutionLog(prev => [...prev, `✓ Converted ${fixed} priorit${fixed === 1 ? 'y' : 'ies'}`]);
        }
      } catch (e) {
        setExecutionLog(prev => [...prev, `✗ Error: ${String(e)}`]);
      }
      await delay(400);
    }

    if (skipTypes.length > 0) {
      setExecutionLog(prev => [...prev, `Skipped: ${skipTypes.join(', ')}`]);
    }

    setExecutionLog(prev => [...prev, '', '📊 Refreshing Kanban...']);
    await delay(500);
    
    try {
      await loadTasksFromDB();
      setExecutionLog(prev => [...prev, '✓ Board refreshed']);
    } catch (e) {
      setExecutionLog(prev => [...prev, `✗ Refresh failed: ${e}`]);
    }

    didExecute.current = true;
    await delay(300);
    setPhase('done');
  };

  const handleConfirm = () => {
    const feedback = input.trim();
    setInput('');
    executePlan(feedback || undefined);
  };

  const handleClose = () => {
    if (didExecute.current) loadTasksFromDB();
    onClose();
  };

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  // const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-start gap-3">
            <AgentAvatar agentId="mission-control" size="lg" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Board Health Check</h2>
                <button onClick={handleClose} className="p-1.5 hover:bg-mission-control-bg rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-mission-control-text-dim mt-0.5">
                {phase === 'scanning' && 'Scanning...'}
                {phase === 'proposing' && `Found ${criticalCount} critical, ${warningCount} warnings`}
                {phase === 'executing' && 'Working...'}
                {phase === 'done' && issues.length === 0 && 'Board is healthy! ✨'}
                {phase === 'done' && executionLog.length > 0 && 'Cleanup complete'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Scanning */}
          {phase === 'scanning' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="text-success animate-spin" />
                <span className="text-sm">Checking {tasks.length} active tasks</span>
              </div>
              <div className="h-1.5 bg-mission-control-bg rounded-full overflow-hidden">
                <div className="h-full bg-success transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
            </div>
          )}

          {/* Proposing */}
          {phase === 'proposing' && (
            <div className="space-y-3">
              <div className="text-xs text-mission-control-text-dim mb-2">
                Found {issues.length} issue{issues.length !== 1 ? 's' : ''}:
              </div>
              
              {/* Critical */}
              {issues.filter(i => i.severity === 'critical').map(issue => (
                <div key={issue.id} className="bg-error-subtle border border-error-border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-error mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-error text-sm">{issue.title}</div>
                      <div className="text-xs text-error/70 mt-0.5">{issue.description}</div>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-success">
                        <ArrowRight size={12} /> {issue.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Warnings */}
              {issues.filter(i => i.severity === 'warning').map(issue => (
                <div key={issue.id} className="bg-warning-subtle border border-warning-border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-warning mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-warning text-sm">{issue.title}</div>
                      <div className="text-xs text-warning/70 mt-0.5">{issue.description}</div>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-success">
                        <ArrowRight size={12} /> {issue.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Info */}
              {issues.filter(i => i.severity === 'info').map(issue => (
                <div key={issue.id} className="bg-info-subtle border border-info-border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Flag size={16} className="text-info mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-info text-sm">{issue.title}</div>
                      <div className="text-xs text-info/70 mt-0.5">{issue.description}</div>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-success">
                        <ArrowRight size={12} /> {issue.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Executing */}
          {phase === 'executing' && (
            <div className="space-y-2">
              {executionLog.map((log, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {log.startsWith('✓') ? <CheckCircle size={14} className="text-success" /> :
                   log.startsWith('✗') ? <X size={14} className="text-error" /> :
                   log.startsWith('Skipped') ? <AlertTriangle size={14} className="text-warning" /> :
                   <Loader2 size={14} className="text-info animate-spin" />}
                  <span>{log.replace(/^[✓✗]\s*/, '')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Done - healthy */}
          {phase === 'done' && issues.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={32} className="text-success mx-auto mb-3" />
              <div className="font-medium text-success">Board is healthy!</div>
              <div className="text-sm text-mission-control-text-dim mt-1">No issues found</div>
            </div>
          )}

          {/* Done - after cleanup */}
          {phase === 'done' && executionLog.length > 0 && (
            <div className="space-y-3">
              <div className="text-center py-4">
                <CheckCircle size={32} className="text-success mx-auto mb-2" />
                <div className="font-medium text-success">Cleanup complete!</div>
              </div>
              <div className="bg-mission-control-bg rounded-lg p-3 space-y-1">
                {executionLog.filter(l => l.startsWith('✓') || l.startsWith('Skipped')).map((log, idx) => (
                  <div key={idx} className="text-sm text-mission-control-text-dim">{log}</div>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Footer */}
        {phase === 'proposing' && (
          <div className="border-t border-mission-control-border p-4 flex-shrink-0 space-y-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Feedback? (e.g., 'skip duplicates') or just proceed..."
              className="w-full px-3 py-2 bg-mission-control-bg rounded-lg border border-mission-control-border text-sm focus:outline-none focus:border-mission-control-accent"
            />
            <div className="flex gap-2">
              <button onClick={handleClose} className="flex-1 px-4 py-2 bg-mission-control-bg border border-mission-control-border text-sm rounded-lg hover:border-mission-control-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
                Cancel
              </button>
              <button onClick={handleConfirm} className="flex-1 px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
                <Check size={16} /> Proceed
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="border-t border-mission-control-border p-4 flex-shrink-0">
            <button onClick={handleClose} className="w-full px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
