import { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentManagementModal');

const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-haiku-3-5', label: 'Claude Haiku 3.5' },
  { id: 'anthropic-direct/claude-opus-4-5', label: 'Claude Opus 4.5 (Direct)' },
  { id: 'anthropic-direct/claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Direct)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'kimi-coding/k2p5', label: 'Kimi K2.5' },
  { id: 'minimax/MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 Highspeed' },
];

interface AgentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

export default function AgentManagementModal({ isOpen, onClose, agentId, agentName }: AgentManagementModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'soul' | 'models'>('soul');

  // SOUL tab state
  const [soulContent, setSoulContent] = useState('');
  const [soulDirty, setSoulDirty] = useState(false);
  const [soulSaving, setSoulSaving] = useState(false);
  const [soulError, setSoulError] = useState<string | null>(null);
  const [showRestartBanner, setShowRestartBanner] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Models tab state
  const [primaryModel, setPrimaryModel] = useState('');
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [modelDirty, setModelDirty] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setSoulError(null);
    setModelError(null);
    setShowRestartBanner(false);
    setSoulDirty(false);
    setModelDirty(false);

    const loadData = async () => {
      const results = await Promise.allSettled([
        window.clawdbot?.agentManagement?.soul?.read(agentId),
        window.clawdbot?.agentManagement?.models?.read(agentId),
      ]);

      // SOUL result
      const soulResult = results[0];
      if (soulResult.status === 'fulfilled' && soulResult.value?.success) {
        setSoulContent(soulResult.value.content || '');
      } else if (soulResult.status === 'fulfilled' && soulResult.value?.error) {
        setSoulError(soulResult.value.error);
      } else if (soulResult.status === 'rejected') {
        setSoulError('Failed to load SOUL.md');
        logger.error('Failed to load SOUL.md:', soulResult.reason);
      }

      // Models result
      const modelsResult = results[1];
      if (modelsResult.status === 'fulfilled' && modelsResult.value?.success) {
        setPrimaryModel(modelsResult.value.primary || '');
        setFallbacks(modelsResult.value.fallbacks || []);
      } else if (modelsResult.status === 'fulfilled' && modelsResult.value?.error) {
        setModelError(modelsResult.value.error);
      } else if (modelsResult.status === 'rejected') {
        setModelError('Failed to load model config');
        logger.error('Failed to load model config:', modelsResult.reason);
      }

      setLoading(false);
    };

    loadData();
  }, [isOpen, agentId]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleSaveSoul = async () => {
    setShowSaveConfirm(false);
    setSoulSaving(true);
    try {
      const result = await window.clawdbot?.agentManagement?.soul?.write(agentId, soulContent);
      if (result?.success) {
        setSoulDirty(false);
        setShowRestartBanner(true);
      } else {
        setSoulError(result?.error || 'Failed to save SOUL.md');
      }
    } catch (e) {
      setSoulError('Failed to save SOUL.md');
      logger.error('Failed to save SOUL.md:', e);
    } finally {
      setSoulSaving(false);
    }
  };

  const handleSaveModel = async () => {
    setModelSaving(true);
    try {
      const result = await window.clawdbot?.agentManagement?.models?.write(agentId, { primary: primaryModel, fallbacks });
      if (result?.success) {
        setModelDirty(false);
      } else {
        setModelError(result?.error || 'Failed to save model config');
      }
    } catch (e) {
      setModelError('Failed to save model config');
      logger.error('Failed to save model config:', e);
    } finally {
      setModelSaving(false);
    }
  };

  const removeFallback = (index: number) => {
    setFallbacks(prev => prev.filter((_, i) => i !== index));
    setModelDirty(true);
  };

  const moveFallback = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fallbacks.length) return;
    const updated = [...fallbacks];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFallbacks(updated);
    setModelDirty(true);
  };

  const addFallback = (modelId: string) => {
    if (!modelId || fallbacks.includes(modelId)) return;
    setFallbacks(prev => [...prev, modelId]);
    setModelDirty(true);
  };

  const getModelLabel = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId)?.label || modelId;
  };

  const availableFallbackModels = AVAILABLE_MODELS.filter(m => !fallbacks.includes(m.id));

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      <div
        className={`glass-modal rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Header with tabs */}
        <div className="p-5 border-b border-clawd-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Manage: {agentName}</h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-clawd-muted hover:text-clawd-text hover:bg-clawd-surface transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('soul')}
              className={`pb-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'soul'
                  ? 'border-clawd-accent text-clawd-text'
                  : 'border-transparent text-clawd-muted hover:text-clawd-text'
              }`}
            >
              SOUL.md
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={`pb-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'models'
                  ? 'border-clawd-accent text-clawd-text'
                  : 'border-transparent text-clawd-muted hover:text-clawd-text'
              }`}
            >
              Models
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="text-clawd-muted py-8 text-center">Loading...</div>
          ) : activeTab === 'soul' ? (
            /* SOUL tab */
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold">SOUL.md &mdash; {agentName}</h3>
                <p className="text-xs text-clawd-muted mt-0.5">Defines personality, rules, and behavior.</p>
              </div>

              <textarea
                className="w-full h-64 font-mono text-sm bg-clawd-bg0 border border-clawd-border rounded p-3 text-clawd-text resize-none focus:outline-none focus:border-clawd-accent"
                value={soulContent}
                onChange={(e) => {
                  setSoulContent(e.target.value);
                  setSoulDirty(true);
                }}
                placeholder="No SOUL.md content found for this agent."
              />

              {soulError && (
                <div className="text-error text-sm mt-2">{soulError}</div>
              )}

              <button
                type="button"
                onClick={() => setShowSaveConfirm(true)}
                disabled={!soulDirty || soulSaving}
                className="btn-primary mt-3"
              >
                {soulSaving ? 'Saving...' : 'Save'}
              </button>

              {/* Restart banner */}
              {showRestartBanner && (
                <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm flex items-center gap-2">
                  <span>
                    Restart agent <strong>{agentName}</strong> for changes to take effect.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRestartBanner(false)}
                    className="ml-auto text-clawd-muted hover:text-clawd-text"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Models tab */
            <div>
              <h3 className="text-sm font-semibold mb-4">Model Configuration &mdash; {agentName}</h3>

              {/* Primary model */}
              <div className="mb-6">
                <label className="text-xs font-medium text-clawd-muted uppercase tracking-wider">
                  Primary Model
                </label>
                <select
                  className="mt-1 w-full bg-clawd-bg0 border border-clawd-border rounded px-3 py-2 text-clawd-text focus:outline-none focus:border-clawd-accent"
                  value={primaryModel}
                  onChange={(e) => {
                    setPrimaryModel(e.target.value);
                    setModelDirty(true);
                  }}
                >
                  <option value="" disabled>Select a model</option>
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Fallback chain */}
              <div className="mb-4">
                <label className="text-xs font-medium text-clawd-muted uppercase tracking-wider">
                  Fallback Chain
                </label>
                <p className="text-xs text-clawd-muted mt-0.5 mb-2">(tried in order when primary fails)</p>

                {fallbacks.length === 0 ? (
                  <p className="text-xs text-clawd-muted italic py-2">No fallbacks configured.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {fallbacks.map((fb, index) => (
                      <li
                        key={`${fb}-${index}`}
                        className="flex items-center gap-2 px-3 py-2 bg-clawd-bg0 border border-clawd-border rounded text-sm"
                      >
                        <span className="text-xs text-clawd-muted font-mono w-4">{index + 1}.</span>
                        <span className="flex-1">{getModelLabel(fb)}</span>
                        <button
                          type="button"
                          onClick={() => moveFallback(index, 'up')}
                          disabled={index === 0}
                          className="p-0.5 text-clawd-muted hover:text-clawd-text disabled:opacity-30 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFallback(index, 'down')}
                          disabled={index === fallbacks.length - 1}
                          className="p-0.5 text-clawd-muted hover:text-clawd-text disabled:opacity-30 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFallback(index)}
                          className="p-0.5 text-clawd-muted hover:text-error transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Add fallback select */}
                {availableFallbackModels.length > 0 && (
                  <select
                    className="mt-2 w-full bg-clawd-bg0 border border-clawd-border rounded px-3 py-2 text-clawd-text text-sm focus:outline-none focus:border-clawd-accent"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addFallback(e.target.value);
                    }}
                  >
                    <option value="">Add fallback...</option>
                    {availableFallbackModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {modelError && (
                <div className="text-error text-sm mt-2">{modelError}</div>
              )}

              <button
                type="button"
                onClick={handleSaveModel}
                disabled={!modelDirty || modelSaving}
                className="btn-primary mt-4"
              >
                {modelSaving ? 'Saving...' : 'Save Model'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog for SOUL save */}
      {showSaveConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60]"
          onClick={() => setShowSaveConfirm(false)}
          aria-hidden="true"
        >
          <div
            className="glass-modal rounded-xl max-w-sm w-full p-5 mx-4"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h3 className="text-base font-semibold mb-2">Save SOUL.md?</h3>
            <p className="text-sm text-clawd-muted mb-4">
              Changes take effect after restarting the agent.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="px-3 py-1.5 text-sm text-clawd-muted border border-clawd-border rounded hover:bg-clawd-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSoul}
                className="btn-primary text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
