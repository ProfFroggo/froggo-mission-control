import { useState } from 'react';
import { Shield, Bot, Clock, AlertTriangle, Save } from 'lucide-react';

interface GuardrailSettings {
  maxSubAgents: number;
  allowedAgentTypes: string[];
  requireApprovalFor: string[];
  maxTaskDuration: number;
  autoEscalate: boolean;
  notifyFroggo: boolean;
}

export default function OxGuardrails() {
  const [settings, setSettings] = useState<GuardrailSettings>({
    maxSubAgents: 6,
    allowedAgentTypes: ['coder', 'writer', 'researcher'],
    requireApprovalFor: ['external', 'financial', 'api-keys'],
    maxTaskDuration: 480, // 8 hours in minutes
    autoEscalate: true,
    notifyFroggo: true,
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = <K extends keyof GuardrailSettings>(
    key: K, 
    value: GuardrailSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = () => {
    // Would save to local storage or database
    localStorage.setItem('ox-guardrails', JSON.stringify(settings));
    setHasChanges(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-amber-500" size={24} />
            <h1 className="text-xl font-semibold text-white">Guardrails & Settings</h1>
          </div>
          <button
            onClick={saveSettings}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-warning text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Sub-Agent Limits */}
        <section className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="flex items-center gap-2 text-lg font-medium text-white mb-4">
            <Bot size={20} className="text-amber-500" />
            Sub-Agent Limits
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="max-sub-agents" className="block text-sm text-clawd-text-dim mb-2">
                Maximum Active Sub-Agents
              </label>
              <input
                id="max-sub-agents"
                type="number"
                min={1}
                max={10}
                value={settings.maxSubAgents}
                onChange={e => updateSetting('maxSubAgents', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-amber-500 focus:outline-none"
              />
              <p className="text-xs text-clawd-text-dim mt-1">
                Kevin&apos;s limit: 6 concurrent agents
              </p>
            </div>
            
            <div>
              <span className="block text-sm text-clawd-text-dim mb-2">
                Allowed Agent Types
              </span>
              <div className="flex flex-wrap gap-2">
                {['coder', 'writer', 'researcher', 'chief'].map(type => (
                  <label
                    key={type}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      settings.allowedAgentTypes.includes(type)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-clawd-text-dim hover:bg-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowedAgentTypes.includes(type)}
                      onChange={e => {
                        const types = e.target.checked
                          ? [...settings.allowedAgentTypes, type]
                          : settings.allowedAgentTypes.filter(t => t !== type);
                        updateSetting('allowedAgentTypes', types);
                      }}
                      className="sr-only"
                    />
                    <span className="capitalize text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Safety Controls */}
        <section className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="flex items-center gap-2 text-lg font-medium text-white mb-4">
            <AlertTriangle size={20} className="text-amber-500" />
            Safety Controls
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">
                Require Approval For
              </label>
              <div className="flex flex-wrap gap-2">
                {['external', 'financial', 'api-keys', 'emails', 'deployments'].map(category => (
                  <label
                    key={category}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      settings.requireApprovalFor.includes(category)
                        ? 'bg-error-subtle text-error border border-red-600'
                        : 'bg-slate-700 text-clawd-text-dim hover:bg-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.requireApprovalFor.includes(category)}
                      onChange={e => {
                        const cats = e.target.checked
                          ? [...settings.requireApprovalFor, category]
                          : settings.requireApprovalFor.filter(c => c !== category);
                        updateSetting('requireApprovalFor', cats);
                      }}
                      className="sr-only"
                    />
                    <span className="capitalize text-sm">{category.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-clawd-text-dim">Auto-escalate stuck tasks</label>
                <p className="text-xs text-clawd-text-dim">Notify Froggo if task exceeds max duration</p>
              </div>
              <button
                onClick={() => updateSetting('autoEscalate', !settings.autoEscalate)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.autoEscalate ? 'bg-amber-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.autoEscalate ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-clawd-text-dim">Notify Froggo on completion</label>
                <p className="text-xs text-clawd-text-dim">Send TASK_COMPLETE via protocol</p>
              </div>
              <button
                onClick={() => updateSetting('notifyFroggo', !settings.notifyFroggo)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifyFroggo ? 'bg-amber-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.notifyFroggo ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* Time Limits */}
        <section className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="flex items-center gap-2 text-lg font-medium text-white mb-4">
            <Clock size={20} className="text-amber-500" />
            Time Limits
          </h2>
          
          <div>
            <label className="block text-sm text-clawd-text-dim mb-2">
              Max Task Duration (minutes)
            </label>
            <input
              type="number"
              min={30}
              max={1440}
              step={30}
              value={settings.maxTaskDuration}
              onChange={e => updateSetting('maxTaskDuration', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="text-xs text-clawd-text-dim mt-1">
              {Math.floor(settings.maxTaskDuration / 60)}h {settings.maxTaskDuration % 60}m
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
