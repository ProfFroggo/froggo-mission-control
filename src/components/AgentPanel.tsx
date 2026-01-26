import { useState } from 'react';
import { Bot, Play, Square, RefreshCw, Plus, MessageSquare, Zap, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore, Agent } from '../store/store';
import { gateway } from '../lib/gateway';

export default function AgentPanel() {
  const { agents, tasks, spawnAgentForTask, createWorkerAgent, updateAgentStatus, addActivity } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerTask, setNewWorkerTask] = useState('');
  const [creating, setCreating] = useState(false);

  const statusColors: Record<Agent['status'], string> = {
    active: 'bg-green-500',
    busy: 'bg-yellow-500 animate-pulse',
    idle: 'bg-gray-500',
    offline: 'bg-red-500',
  };

  const statusLabels: Record<Agent['status'], string> = {
    active: 'Active',
    busy: 'Working...',
    idle: 'Idle',
    offline: 'Offline',
  };

  // Get tasks assigned to each agent
  const getAgentTasks = (agentId: string) => {
    return tasks.filter(t => t.assignedTo === agentId && t.status !== 'done');
  };

  // Send message to agent
  const messageAgent = async (agent: Agent, message: string) => {
    if (!agent.sessionKey) return;
    
    try {
      await gateway.request('sessions.send', {
        sessionKey: agent.sessionKey,
        message,
      });
      addActivity({ type: 'agent', message: `Messaged ${agent.name}: ${message.slice(0, 50)}...`, timestamp: Date.now() });
    } catch (e) {
      console.error('Failed to message agent:', e);
    }
  };

  // Create new worker
  const handleCreateWorker = async () => {
    if (!newWorkerName.trim() || !newWorkerTask.trim()) return;
    
    setCreating(true);
    try {
      await createWorkerAgent(newWorkerName, newWorkerTask);
      setShowCreateModal(false);
      setNewWorkerName('');
      setNewWorkerTask('');
    } catch (e) {
      console.error('Failed to create worker:', e);
    } finally {
      setCreating(false);
    }
  };

  // Main agents vs workers
  const mainAgents = agents.filter(a => ['main', 'coder', 'researcher', 'writer', 'chief'].includes(a.id));
  const workerAgents = agents.filter(a => a.id.startsWith('worker-'));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
              <Bot size={24} /> Agents
            </h1>
            <p className="text-clawd-text-dim">
              {agents.filter(a => a.status === 'busy').length} working • {agents.filter(a => a.status === 'idle').length} idle
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
          >
            <Plus size={16} />
            New Worker
          </button>
        </div>

        {/* Main Agents */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
            Core Agents
          </h2>
          <div className="grid gap-4">
            {mainAgents.map((agent) => {
              const agentTasks = getAgentTasks(agent.id);
              const currentTask = tasks.find(t => t.id === agent.currentTaskId);
              
              return (
                <div
                  key={agent.id}
                  className="bg-clawd-surface rounded-xl border border-clawd-border p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="text-4xl">{agent.avatar}</div>
                    
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{agent.name}</h3>
                        <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                        <span className="text-sm text-clawd-text-dim">{statusLabels[agent.status]}</span>
                      </div>
                      <p className="text-sm text-clawd-text-dim mb-2">{agent.description}</p>
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.capabilities?.map((cap, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-clawd-border rounded-full">
                            {cap}
                          </span>
                        ))}
                      </div>

                      {/* Current Task */}
                      {currentTask && (
                        <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                          <Zap size={14} className="text-yellow-500" />
                          <span className="font-medium">Working on:</span>
                          <span className="truncate">{currentTask.title}</span>
                        </div>
                      )}

                      {/* Queued Tasks */}
                      {agentTasks.length > 0 && !currentTask && (
                        <div className="text-sm text-clawd-text-dim">
                          <Clock size={12} className="inline mr-1" />
                          {agentTasks.length} task{agentTasks.length > 1 ? 's' : ''} queued
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {agent.status === 'idle' && agentTasks.length > 0 && (
                        <button
                          onClick={() => spawnAgentForTask(agentTasks[0].id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                        >
                          <Play size={14} /> Start
                        </button>
                      )}
                      {agent.status === 'busy' && agent.sessionKey && (
                        <button
                          onClick={() => updateAgentStatus(agent.id, 'idle')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30"
                        >
                          <Square size={14} /> Stop
                        </button>
                      )}
                      {agent.sessionKey && (
                        <button
                          onClick={() => {
                            const msg = prompt('Message to agent:');
                            if (msg) messageAgent(agent, msg);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-clawd-border text-sm rounded-lg hover:bg-clawd-border/80"
                        >
                          <MessageSquare size={14} /> Chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Worker Agents */}
        {workerAgents.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
              Worker Agents ({workerAgents.length})
            </h2>
            <div className="space-y-2">
              {workerAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-clawd-surface rounded-lg border border-clawd-border p-3 flex items-center gap-3"
                >
                  <span className="text-xl">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                    </div>
                    <p className="text-xs text-clawd-text-dim truncate">{agent.description}</p>
                  </div>
                  {agent.status === 'busy' ? (
                    <button
                      onClick={() => updateAgentStatus(agent.id, 'idle')}
                      className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Stop
                    </button>
                  ) : (
                    <span className="text-xs text-green-400">
                      <CheckCircle size={14} className="inline mr-1" />
                      Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Worker Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-clawd-surface rounded-2xl border border-clawd-border p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Create Worker Agent</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Worker Name</label>
                  <input
                    type="text"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    placeholder="e.g., Data Processor"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Task Description</label>
                  <textarea
                    value={newWorkerTask}
                    onChange={(e) => setNewWorkerTask(e.target.value)}
                    placeholder="Describe what this worker should do..."
                    rows={4}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateWorker}
                  disabled={!newWorkerName.trim() || !newWorkerTask.trim() || creating}
                  className="flex-1 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Start'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
