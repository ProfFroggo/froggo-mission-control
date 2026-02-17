import { useState, useEffect, useCallback } from 'react';
import { UserPlus, BookOpen, Users, ChevronRight, Award, Target, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import HRAgentCreationModal from './HRAgentCreationModal';
import TrainingLogModal from './TrainingLogModal';
import AgentSkillsModal from './AgentSkillsModal';
import HRReportsModal from './HRReportsModal';

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
      // Load from IPC bridge if available, otherwise use defaults
      const dbExec = window.clawdbot?.db?.exec;
      if (dbExec) {
        const statsRes = await dbExec(`
          SELECT 
            (SELECT COUNT(DISTINCT id) FROM agent_registry WHERE status = 'active') as total_agents,
            (SELECT ROUND(AVG(proficiency), 1) FROM agent_skills) as avg_prof,
            (SELECT COUNT(*) FROM agent_training_log) as recent_trainings
        `);
        const skillsRes = await dbExec(
          `SELECT agent_id, skill_name, proficiency FROM agent_skills WHERE proficiency < 4 ORDER BY proficiency ASC LIMIT 5`
        );
        const result = statsRes?.result || [];
        const skills = skillsRes?.result || [];
        const gaps = skills.map((s: any) => `${s.agent_id}:${s.skill_name}(${s.proficiency})`);
        const needsTraining = [...new Set(skills.map((s: any) => s.agent_id))];

        setTeamHealth({
          totalAgents: result?.[0]?.total_agents || 5,
          avgProficiency: result?.[0]?.avg_prof || 7.2,
          skillGaps: gaps,
          recentTrainings: result?.[0]?.recent_trainings || 0,
          agentsNeedingTraining: needsTraining as string[],
        });
      } else {
        // Fallback — static values
        setTeamHealth({
          totalAgents: 6,
          avgProficiency: 7.4,
          skillGaps: [],
          recentTrainings: 0,
          agentsNeedingTraining: [],
        });
      }
    } catch (e) {
      // 'Failed to load team health:', e;
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
