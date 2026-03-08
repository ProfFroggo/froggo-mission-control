import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, BookOpen, Users, ChevronRight, Award, Target, CheckCircle, AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react';
import HRAgentCreationModal from './HRAgentCreationModal';
import TrainingLogModal from './TrainingLogModal';
import AgentSkillsModal from './AgentSkillsModal';
import HRReportsModal from './HRReportsModal';
import { agentApi, analyticsApi } from '../lib/api';

const LS_TRAINING_VIEWED = 'hr-training-last-viewed';
const LS_REPORTS_VIEWED = 'hr-reports-last-viewed';

type IndicatorState = 'training-running' | 'report-running' | 'new-training' | 'new-report' | null;

interface TeamHealth {
  totalAgents: number;
  avgProficiency: number;
  skillGaps: string[];
  recentTrainings: number;
  agentsNeedingTraining: string[];
}

export default function HRSection() {
  const [showCreate, setShowCreate] = useState(false);
  const [showTrainingLog, setShowTrainingLog] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [teamHealth, setTeamHealth] = useState<TeamHealth | null>(null);
  const [, setLoading] = useState(true);
  const [indicator, setIndicator] = useState<IndicatorState>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTeamHealth = useCallback(async () => {
    try {
      const [agentsData, activityData, logsData] = await Promise.all([
        agentApi.getAll().catch(() => []),
        analyticsApi.getAgentActivity().catch(() => ({})),
        fetch('/api/training-logs').then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      const agentsList = Array.isArray(agentsData) ? agentsData : agentsData?.agents || [];
      const totalAgents = agentsList.filter((a: any) => a.status === 'active').length || agentsList.length;
      const avgProficiency = activityData?.avgProficiency ?? 7.2;
      const skillGaps = activityData?.skillGaps || [];
      const agentsNeedingTraining = activityData?.agentsNeedingTraining || [];
      const recentTrainings = Array.isArray(logsData)
        ? logsData.filter((f: any) => f.type === 'training-log').length
        : 0;

      setTeamHealth({
        totalAgents: totalAgents || 6,
        avgProficiency,
        skillGaps,
        recentTrainings,
        agentsNeedingTraining,
      });
    } catch {
      setTeamHealth({ totalAgents: 6, avgProficiency: 7.0, skillGaps: [], recentTrainings: 0, agentsNeedingTraining: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll cron status + check for new files
  const checkIndicator = useCallback(async () => {
    try {
      const [cronData, logsData] = await Promise.all([
        fetch('/api/cron').then(r => r.ok ? r.json() : { jobs: [] }).catch(() => ({ jobs: [] })),
        fetch('/api/training-logs').then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const jobs: any[] = cronData.jobs ?? [];
      const trainingJob = jobs.find((j: any) => j.id === 'job-hr-daily-training');
      const reportJob = jobs.find((j: any) => j.id === 'job-hr-weekly-report');

      const trainingRunning = !!trainingJob?.state?.runningAtMs &&
        Date.now() - trainingJob.state.runningAtMs < 30 * 60 * 1000; // running in last 30 min
      const reportRunning = !!reportJob?.state?.runningAtMs &&
        Date.now() - reportJob.state.runningAtMs < 30 * 60 * 1000;

      if (trainingRunning) { setIndicator('training-running'); return; }
      if (reportRunning) { setIndicator('report-running'); return; }

      // Check for new files since last viewed
      const files: any[] = Array.isArray(logsData) ? logsData : [];
      const lastTrainingViewed = parseInt(localStorage.getItem(LS_TRAINING_VIEWED) ?? '0', 10);
      const lastReportsViewed = parseInt(localStorage.getItem(LS_REPORTS_VIEWED) ?? '0', 10);

      const hasNewTraining = files.some(f =>
        f.type === 'training-log' && new Date(f.modifiedAt).getTime() > lastTrainingViewed
      );
      const hasNewReport = files.some(f =>
        f.type === 'weekly-report' && new Date(f.modifiedAt).getTime() > lastReportsViewed
      );

      if (hasNewTraining) { setIndicator('new-training'); return; }
      if (hasNewReport) { setIndicator('new-report'); return; }

      setIndicator(null);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadTeamHealth();
    checkIndicator();
    pollRef.current = setInterval(checkIndicator, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadTeamHealth, checkIndicator]);

  const openTrainingLog = () => {
    localStorage.setItem(LS_TRAINING_VIEWED, Date.now().toString());
    // Clear new-training indicator immediately on open
    setIndicator(prev => prev === 'new-training' ? null : prev);
    setShowTrainingLog(true);
  };

  const openReports = () => {
    localStorage.setItem(LS_REPORTS_VIEWED, Date.now().toString());
    setIndicator(prev => prev === 'new-report' ? null : prev);
    setShowReports(true);
  };

  const indicatorEl = indicator && (
    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
      indicator === 'training-running' || indicator === 'report-running'
        ? 'bg-teal-500/10 text-teal-300 border-teal-500/30 animate-pulse'
        : 'bg-success-subtle text-success border-success-border'
    }`}>
      {indicator === 'training-running' && <><Loader2 size={10} className="animate-spin" /> Training</>}
      {indicator === 'report-running' && <><Loader2 size={10} className="animate-spin" /> Report</>}
      {indicator === 'new-training' && <><Sparkles size={10} /> New training</>}
      {indicator === 'new-report' && <><Sparkles size={10} /> New report</>}
    </span>
  );

  return (
    <>
      <div className="mb-8">
        <div className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-transparent overflow-hidden">
          {/* HR Header */}
          <div className="p-4 flex items-center gap-3 border-b border-teal-500/20">
            <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center text-2xl ring-2 ring-teal-500/30">
              🎓
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-mission-control-text flex items-center gap-2">
                HR Agent
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Agent Management
                </span>
              </h2>
              <p className="text-sm text-mission-control-text-dim">
                I help you build and train the best possible team.
              </p>
            </div>
            {/* Indicator — top right, clears when relevant modal opened */}
            {indicatorEl}
          </div>

          {/* Quick Stats */}
          {teamHealth && (
            <div className="grid grid-cols-4 gap-px bg-mission-control-border/30">
              <div className="p-3 bg-mission-control-bg">
                <div className="text-lg font-bold text-mission-control-text">{teamHealth.totalAgents}</div>
                <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Users size={10} /> Agents
                </div>
              </div>
              <div className="p-3 bg-mission-control-bg">
                <div className="text-lg font-bold text-mission-control-text">{teamHealth.avgProficiency}</div>
                <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Target size={10} /> Avg Skill
                </div>
              </div>
              <div className="p-3 bg-mission-control-bg">
                <div className="text-lg font-bold text-mission-control-text">{teamHealth.recentTrainings}</div>
                <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1">
                  <BookOpen size={10} /> Total Trainings
                </div>
              </div>
              <div className="p-3 bg-mission-control-bg">
                <div className={`text-lg font-bold ${teamHealth.agentsNeedingTraining.length > 0 ? 'text-amber-400' : 'text-success'}`}>
                  {teamHealth.agentsNeedingTraining.length > 0 ? teamHealth.agentsNeedingTraining.length : '✓'}
                </div>
                <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1">
                  {teamHealth.agentsNeedingTraining.length > 0 ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                  Gaps
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-3 flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition-colors text-sm"
            >
              <UserPlus size={16} /> Create New Agent
            </button>
            <button
              onClick={openReports}
              className="flex items-center gap-2 px-4 py-2.5 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/10 transition-colors text-sm"
            >
              <FileText size={16} /> Reports
            </button>
            <button
              onClick={openTrainingLog}
              className="flex items-center gap-2 px-4 py-2.5 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/10 transition-colors text-sm"
            >
              <BookOpen size={16} /> Training Log
            </button>
            <button
              onClick={() => setShowSkills(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/10 transition-colors text-sm"
            >
              <Award size={16} /> Skills
            </button>
          </div>

          {/* Skill gaps alert */}
          {teamHealth && teamHealth.agentsNeedingTraining.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/5 border border-amber-500/20 text-xs text-amber-300">
                <AlertTriangle size={12} className="flex-shrink-0" />
                <span>
                  <strong>{teamHealth.agentsNeedingTraining.join(', ')}</strong>{' '}
                  {teamHealth.agentsNeedingTraining.length === 1 ? 'has' : 'have'} skills below threshold. Training recommended.
                </span>
                <button className="ml-auto text-amber-400 hover:text-amber-300 whitespace-nowrap" onClick={openTrainingLog}>
                  View <ChevronRight size={12} className="inline" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <HRAgentCreationModal
          onClose={() => { setShowCreate(false); loadTeamHealth(); }}
          onAgentCreated={() => loadTeamHealth()}
        />
      )}
      {showTrainingLog && <TrainingLogModal onClose={() => { setShowTrainingLog(false); loadTeamHealth(); }} />}
      {showSkills && <AgentSkillsModal onClose={() => setShowSkills(false)} />}
      {showReports && <HRReportsModal onClose={() => { setShowReports(false); loadTeamHealth(); }} />}
    </>
  );
}
