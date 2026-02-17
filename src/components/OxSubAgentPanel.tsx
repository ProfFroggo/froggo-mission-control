import { useState, useEffect } from 'react';
import { Bot, Play, Pause, CheckCircle, AlertCircle, Plus, RefreshCw, Activity } from 'lucide-react';

interface SubAgent {
  id: string;
  name: string;
  type: 'coder' | 'writer' | 'researcher';
  status: 'idle' | 'working' | 'completed' | 'error';
  currentTask?: string;
  startedAt?: number;
  completedTasks: number;
}

export default function OxSubAgentPanel() {
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [maxAgents] = useState(6); // Kevin's limit
  
  // Simulated sub-agents (would connect to real data)
  useEffect(() => {
    // In production, this would fetch from the spawned sessions
    setSubAgents([
      // Initially empty - Ox spawns sub-agents as needed
    ]);
  }, []);

  const getStatusIcon = (status: SubAgent['status']) => {
    switch (status) {
      case 'idle': return <Pause className="text-clawd-text-dim" size={16} />;
      case 'working': return <Play className="text-amber-500 animate-pulse" size={16} />;
      case 'completed': return <CheckCircle className="text-success" size={16} />;
      case 'error': return <AlertCircle className="text-error" size={16} />;
    }
  };

  const getTypeColor = (type: SubAgent['type']) => {
    switch (type) {
      case 'coder': return 'bg-blue-500';
      case 'writer': return 'bg-purple-500';
      case 'researcher': return 'bg-green-500';
    }
  };

  const activeCount = subAgents.filter(a => a.status === 'working').length;

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="text-amber-500" size={24} />
            <h1 className="text-xl font-semibold text-white">Sub-Agents</h1>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600 text-white">
              {activeCount}/{maxAgents}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg hover:bg-slate-800 text-clawd-text-dim hover:text-white">
              <RefreshCw size={18} />
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-warning text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={activeCount >= maxAgents}
            >
              <Plus size={16} />
              Spawn Agent
            </button>
          </div>
        </div>
        
        {/* Capacity Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-clawd-text-dim mb-1">
            <span>Capacity</span>
            <span>{activeCount}/{maxAgents} active</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-orange-500 transition-all"
              style={{ width: `${(activeCount / maxAgents) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4">
        {subAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-clawd-text-dim">
            <Bot size={48} className="mb-4 opacity-50" />
            <p>No sub-agents running</p>
            <p className="text-sm">Spawn agents to help with Bitso tasks</p>
            <button className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-warning text-white text-sm">
              <Plus size={16} />
              Spawn First Agent
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {subAgents.map(agent => (
              <div
                key={agent.id}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-amber-600/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(agent.status)}
                  <span className={`w-2 h-2 rounded-full ${getTypeColor(agent.type)}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white">{agent.name}</h3>
                    <p className="text-sm text-clawd-text-dim">
                      {agent.currentTask || 'Idle'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-clawd-text-dim capitalize">{agent.type}</span>
                    <div className="text-xs text-clawd-text-dim">
                      {agent.completedTasks} completed
                    </div>
                  </div>
                </div>
                {agent.status === 'working' && agent.startedAt && (
                  <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-2 text-xs text-clawd-text-dim">
                    <Activity size={12} />
                    Running for {Math.floor((Date.now() - agent.startedAt) / 60000)} min
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Guardrails */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-clawd-text-dim">
          <span>Max agents: {maxAgents}</span>
          <span>Types: Coder, Writer, Researcher</span>
        </div>
      </div>
    </div>
  );
}
