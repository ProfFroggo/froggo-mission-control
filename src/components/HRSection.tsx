import { useState, useEffect, useCallback } from 'react';
import { UserPlus, BookOpen, Users, ChevronRight, Award, Target, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import HRAgentCreationModal from './HRAgentCreationModal';
import TrainingLogModal from './TrainingLogModal';
import AgentSkillsModal from './AgentSkillsModal';
import HRReportsModal from './HRReportsModal';
import { agentApi, analyticsApi } from '../lib/api';

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

  const loadTeamHealth = useCallback(async () => {
    try {
      // Load from REST API
      const [agentsData, activityData] = await Promise.all([
        agentApi.getAll().catch(() => []),
        analyticsApi.getAgentActivity().catch(() => ({})),
      ]);
      const agentsList = Array.isArray(agentsData) ? agentsData : agentsData?.agents || [];
      const totalAgents = agentsList.filter((a: any) => a.status === 'active').length || agentsList.length;
      const avgProficiency = activityData?.avgProficiency ?? 7.2;
      const skillGaps = activityData?.skillGaps || [];
      const recentTrainings = activityData?.recentTrainings || 0;
      const agentsNeedingTraining = activityData?.agentsNeedingTraining || [];

      setTeamHealth({
        totalAgents: totalAgents || 6,
        avgProficiency: avgProficiency,
        skillGaps,
        recentTrainings,
        agentsNeedingTraining,
      });
    } catch (e) {
      setTeamHealth({ totalAgents: 6, avgProficiency: 7.0, skillGaps: [], recentTrainings: 0, agentsNeedingTraining: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeamHealth(); }, [loadTeamHealth]);

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
              <h2 className="font-bold text-clawd-text flex items-center gap-2">
                HR Agent
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Agent Management
                </span>
              </h2>
              <p className="text-sm text-clawd-text-dim">
                I help you build and train the best possible team.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          {teamHealth && (
            <div className="grid grid-cols-4 gap-px bg-clawd-border/30">
              <div className="p-3 bg-clawd-bg">
                <div className="text-lg font-bold text-clawd-text">{teamHealth.totalAgents}</div>
                <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Users size={10} /> Agents
                </div>
              </div>
              <div className="p-3 bg-clawd-bg">
                <div className="text-lg font-bold text-clawd-text">{teamHealth.avgProficiency}</div>
                <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Target size={10} /> Avg Skill
                </div>
              </div>
              <div className="p-3 bg-clawd-bg">
                <div className="text-lg font-bold text-clawd-text">{teamHealth.recentTrainings}</div>
                <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider flex items-center gap-1">
                  <BookOpen size={10} /> Total Trainings
                </div>
              </div>
              <div className="p-3 bg-clawd-bg">
                <div className={`text-lg font-bold ${teamHealth.agentsNeedingTraining.length > 0 ? 'text-amber-400' : 'text-success'}`}>
                  {teamHealth.agentsNeedingTraining.length > 0 ? teamHealth.agentsNeedingTraining.length : '✓'}
                </div>
                <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider flex items-center gap-1">
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
              onClick={() => setShowReports(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/10 transition-colors text-sm"
            >
              <FileText size={16} /> Reports
            </button>
            <button
              onClick={() => setShowTrainingLog(true)}
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
                  <strong>{teamHealth.agentsNeedingTraining.join(', ')}</strong> {teamHealth.agentsNeedingTraining.length === 1 ? 'has' : 'have'} skills below threshold. Training recommended.
                </span>
                <button className="ml-auto text-amber-400 hover:text-amber-300 whitespace-nowrap" onClick={() => setShowTrainingLog(true)}>
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
      {showTrainingLog && <TrainingLogModal onClose={() => setShowTrainingLog(false)} />}
      {showSkills && <AgentSkillsModal onClose={() => setShowSkills(false)} />}
      {showReports && <HRReportsModal onClose={() => setShowReports(false)} />}
    </>
  );
}
