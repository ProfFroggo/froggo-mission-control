'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, FolderKanban, Bot, Target, Loader2 } from 'lucide-react';
import { projectsApi, agentApi } from '../../lib/api';
import type { Project } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';

const EMOJI_OPTIONS = ['📁', '🚀', '⚡', '🎯', '💡', '🔥', '🛠️', '📊', '🌟', '🎨', '🔬', '🏗️'];
const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#f43f5e',
];

type Step = 'details' | 'agents' | 'creating' | 'done';

interface Agent { id: string; name: string; emoji?: string; status: string; role?: string }

interface ProjectCreationWizardProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export default function ProjectCreationWizard({ onClose, onCreated }: ProjectCreationWizardProps) {
  const [step, setStep] = useState<Step>('details');

  // Details step
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal]               = useState('');
  const [emoji, setEmoji]             = useState('📁');
  const [color, setColor]             = useState('#6366f1');

  // Agents step
  const [agents, setAgents]           = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Create step
  const [error, setError]             = useState<string | null>(null);
  const [created, setCreated]         = useState<Project | null>(null);

  useEffect(() => {
    if (step === 'agents' && agents.length === 0) {
      setLoadingAgents(true);
      agentApi.getAll()
        .then((data: Agent[]) => setAgents(data.filter((a: Agent) => a.status !== 'archived')))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [step]);

  const canAdvanceDetails = name.trim().length >= 2;

  const handleCreate = async () => {
    setStep('creating');
    setError(null);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        goal: goal.trim() || undefined,
        emoji,
        color,
        memberAgentIds: selectedAgents,
      });
      setCreated(project);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setStep('agents');
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const STEPS = ['details', 'agents', 'creating'] as const;
  const stepIndex = ['details', 'agents', 'creating', 'done'].indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-mission-control-accent" />
            <span className="font-semibold text-mission-control-text-primary">New Project</span>
          </div>
          {step !== 'creating' && (
            <button
              onClick={onClose}
              className="p-1 text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1 rounded transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Step dots */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 py-3 border-b border-mission-control-border">
            {['details', 'agents', 'creating'].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < stepIndex ? 'w-6 bg-mission-control-accent' :
                  i === stepIndex ? 'w-8 bg-mission-control-accent' :
                  'w-6 bg-mission-control-border'
                }`}
              />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Details */}
          {step === 'details' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-mission-control-text-primary mb-1">Project details</h2>
                <p className="text-xs text-mission-control-text-dim">Give your project an identity and a clear goal.</p>
              </div>

              {/* Emoji + Color + Name row */}
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl cursor-pointer border-2 transition-colors"
                  style={{ backgroundColor: `${color}20`, borderColor: color }}
                >
                  {emoji}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Project name *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 bg-mission-control-bg1 border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim text-sm focus:outline-none focus:border-mission-control-accent/50"
                  />
                </div>
              </div>

              {/* Emoji picker */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                        emoji === e
                          ? 'ring-2 ring-mission-control-accent bg-mission-control-accent/20'
                          : 'bg-mission-control-bg1 hover:bg-mission-control-surface'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-mission-control-bg ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1.5 block">Description <span className="opacity-50">(optional)</span></label>
                <input
                  type="text"
                  placeholder="A short description..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-mission-control-bg1 border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim text-sm focus:outline-none focus:border-mission-control-accent/50"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1.5 flex items-center gap-1">
                  <Target size={11} /> Project Goal <span className="opacity-50">(shared with agents)</span>
                </label>
                <textarea
                  placeholder="What does success look like for this project?"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-mission-control-bg1 border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim text-sm focus:outline-none focus:border-mission-control-accent/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Assign Agents */}
          {step === 'agents' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-mission-control-text-primary mb-1">Assign agents</h2>
                <p className="text-xs text-mission-control-text-dim">Select agents that will work on this project. You can change this later.</p>
              </div>

              {error && (
                <div className="px-3 py-2 bg-error-subtle border border-error/30 rounded-lg text-error text-xs">{error}</div>
              )}

              {loadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-mission-control-text-dim" />
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        selectedAgents.includes(agent.id)
                          ? 'border-mission-control-accent/50 bg-mission-control-accent/10'
                          : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'
                      }`}
                    >
                      <AgentAvatar agentId={agent.id} size="sm" fallbackEmoji={agent.emoji} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-mission-control-text-primary">{agent.name}</div>
                        {agent.role && <div className="text-xs text-mission-control-text-dim truncate">{agent.role}</div>}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedAgents.includes(agent.id)
                          ? 'border-mission-control-accent bg-mission-control-accent'
                          : 'border-mission-control-border'
                      }`}>
                        {selectedAgents.includes(agent.id) && <Check size={10} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAgents.length > 0 && (
                <p className="text-xs text-mission-control-text-dim">{selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          {/* Step 3: Creating */}
          {step === 'creating' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 size={32} className="animate-spin text-mission-control-accent" />
              <div className="text-center">
                <p className="text-sm font-medium text-mission-control-text-primary">Creating project...</p>
                <p className="text-xs text-mission-control-text-dim mt-1">Setting up workspace and chat room</p>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && created && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: `${created.color}20`, border: `2px solid ${created.color}60` }}
              >
                {created.emoji}
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-mission-control-text-primary">{created.name} is ready!</p>
                <p className="text-xs text-mission-control-text-dim mt-1">
                  {selectedAgents.length > 0
                    ? `${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''} assigned. Project workspace is open.`
                    : 'Your project workspace is ready to go.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'creating' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-mission-control-border">
            {step === 'done' ? (
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => created && onCreated(created)}
                  className="flex-1 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
                >
                  Open Project
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-mission-control-border text-mission-control-text-dim rounded-lg hover:text-mission-control-text-primary hover:bg-mission-control-bg1 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={step === 'details' ? onClose : () => setStep('details')}
                  className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors"
                >
                  {step === 'agents' && <ChevronLeft size={14} />}
                  {step === 'details' ? 'Cancel' : 'Back'}
                </button>
                {step === 'details' && (
                  <button
                    onClick={() => setStep('agents')}
                    disabled={!canAdvanceDetails}
                    className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                )}
                {step === 'agents' && (
                  <button
                    onClick={handleCreate}
                    className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
                  >
                    Create Project
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
