import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Key, Download, X, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';

interface SkillEntry {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  installed?: boolean;
  eligible?: boolean;
  hasApiKey?: boolean;
  apiKey?: string;
  requiredBins?: string[];
  env?: Record<string, string>;
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [bins, setBins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'hub' | 'local'>('hub');
  const [hubSlug, setHubSlug] = useState('');
  const [localName, setLocalName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localBody, setLocalBody] = useState('');
  const [adding, setAdding] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, binsResult] = await Promise.all([
        gateway.getSkillsStatus().catch(() => null),
        gateway.getSkillsBins().catch(() => null),
      ]);

      if (binsResult?.bins) setBins(binsResult.bins);

      if (statusResult) {
        // Parse skills from status response - adapt to actual shape
        const parsed: SkillEntry[] = [];
        const data = statusResult as any;

        if (data.skills && typeof data.skills === 'object') {
          for (const [key, val] of Object.entries(data.skills)) {
            const s = val as any;
            parsed.push({
              key,
              name: s.name || s.displayName || key,
              description: s.description || s.summary || '',
              enabled: s.enabled !== false,
              installed: s.installed !== false,
              eligible: s.eligible !== false,
              hasApiKey: !!s.apiKey || !!s.hasApiKey,
              requiredBins: s.requiredBins || [],
              env: s.env,
            });
          }
        } else if (Array.isArray(data)) {
          for (const s of data) {
            parsed.push({
              key: s.key || s.name || s.id,
              name: s.name || s.displayName || s.key,
              description: s.description || '',
              enabled: s.enabled !== false,
              installed: s.installed !== false,
              eligible: s.eligible !== false,
              hasApiKey: !!s.apiKey || !!s.hasApiKey,
              requiredBins: s.requiredBins || [],
            });
          }
        }
        setSkills(parsed);
      }
    } catch (e) {
      console.error('Failed to load skills:', e);
      showToast('error', 'Failed to load skills', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const toggleSkill = async (skill: SkillEntry) => {
    try {
      await gateway.updateSkill(skill.key, { enabled: !skill.enabled });
      setSkills(prev => prev.map(s => s.key === skill.key ? { ...s, enabled: !s.enabled } : s));
      showToast('success', `${skill.name} ${skill.enabled ? 'disabled' : 'enabled'}`);
    } catch (e) {
      showToast('error', 'Failed to update skill', String(e));
    }
  };

  const saveApiKey = async (skillKey: string) => {
    const key = apiKeyInputs[skillKey];
    if (!key?.trim()) return;
    setSavingKey(skillKey);
    try {
      await gateway.updateSkill(skillKey, { apiKey: key.trim() });
      setSkills(prev => prev.map(s => s.key === skillKey ? { ...s, hasApiKey: true } : s));
      setApiKeyInputs(prev => ({ ...prev, [skillKey]: '' }));
      setExpandedSkill(null);
      showToast('success', 'API key saved');
    } catch (e) {
      showToast('error', 'Failed to save API key', String(e));
    } finally {
      setSavingKey(null);
    }
  };

  const installSkill = async (skill: SkillEntry) => {
    try {
      const installId = `install-${Date.now()}`;
      await gateway.installSkill(skill.name, installId);
      showToast('success', `${skill.name} installed`);
      loadSkills();
    } catch (e) {
      showToast('error', 'Installation failed', String(e));
    }
  };

  const addSkill = async () => {
    setAdding(true);
    try {
      if (addMode === 'hub') {
        if (!hubSlug.trim()) return;
        const installId = `install-${Date.now()}`;
        await gateway.installSkill(hubSlug.trim(), installId);
        showToast('success', `${hubSlug.trim()} installed from ClawdHub`);
      } else {
        if (!localName.trim()) return;
        const slug = localName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const skillMd = [
          '---',
          `name: ${slug}`,
          localDescription.trim() ? `description: ${localDescription.trim()}` : `description: ${slug}`,
          '---',
          '',
          localBody.trim() || `# ${localName.trim()}\n\nCustom skill instructions here.`,
          '',
        ].join('\n');
        // Write SKILL.md to ~/.clawdbot/skills/<slug>/
        await (window as any).clawdbot?.exec?.run(
          `mkdir -p ~/.clawdbot/skills/${slug} && cat > ~/.clawdbot/skills/${slug}/SKILL.md << 'EOFSKILL'\n${skillMd}\nEOFSKILL`
        );
        showToast('success', `${localName.trim()} created in ~/.clawdbot/skills/`);
      }
      setShowAddModal(false);
      setHubSlug('');
      setLocalName('');
      setLocalDescription('');
      setLocalBody('');
      loadSkills();
    } catch (e) {
      showToast('error', 'Failed to add skill', String(e));
    } finally {
      setAdding(false);
    }
  };

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2 bg-clawd-bg border border-clawd-border rounded-xl text-sm focus:outline-none focus:border-clawd-accent"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-clawd-accent text-white rounded-xl text-sm hover:bg-clawd-accent/80"
        >
          <Plus size={14} />
          Add Skill
        </button>
        <button
          onClick={loadSkills}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-clawd-border rounded-xl text-sm hover:bg-clawd-border/80"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="text-xs text-clawd-text-dim mb-4">
        {filtered.length} skill{filtered.length !== 1 ? 's' : ''} found
        {bins.length > 0 && <span className="ml-2">• {bins.length} required binaries</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-clawd-text-dim">
          <RefreshCw size={24} className="animate-spin mr-3" />
          Loading skills...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-clawd-text-dim">
          {searchQuery ? 'No skills match your search' : 'No skills found'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(skill => {
            const isExpanded = expandedSkill === skill.key;
            return (
              <div
                key={skill.key}
                className="bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{skill.name}</span>
                      {skill.hasApiKey && (
                        <Key size={14} className="text-clawd-accent" title="API key configured" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!skill.installed ? (
                        <button
                          onClick={() => installSkill(skill)}
                          className="flex items-center gap-1 px-2 py-1 bg-clawd-accent/20 text-clawd-accent rounded text-xs hover:bg-clawd-accent/30"
                        >
                          <Download size={14} />
                          Install
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleSkill(skill)}
                          className={`w-10 h-5 rounded-full transition-colors ${
                            skill.enabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            skill.enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-clawd-text-dim truncate mb-2">
                    {skill.description || skill.key}
                  </p>
                  <button
                    onClick={() => setExpandedSkill(isExpanded ? null : skill.key)}
                    className="text-xs text-clawd-text-dim hover:text-clawd-text flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {isExpanded ? 'Hide' : 'Configure'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-clawd-border pt-3 space-y-3">
                    <div>
                      <label className="block text-xs text-clawd-text-dim mb-1">API Key</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInputs[skill.key] || ''}
                          onChange={e => setApiKeyInputs(prev => ({ ...prev, [skill.key]: e.target.value }))}
                          placeholder={skill.hasApiKey ? '••••••••' : 'Enter API key'}
                          className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                        />
                        <button
                          onClick={() => saveApiKey(skill.key)}
                          disabled={!apiKeyInputs[skill.key]?.trim() || savingKey === skill.key}
                          className="px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          {savingKey === skill.key ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-clawd-text-dim">
                      <span className="font-medium">Key:</span> {skill.key}
                    </div>
                    {skill.requiredBins && skill.requiredBins.length > 0 && (
                      <div className="text-xs text-clawd-text-dim">
                        <span className="font-medium">Required:</span> {skill.requiredBins.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Skill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-clawd-surface border border-clawd-border rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-clawd-border flex items-center justify-between">
              <h3 className="font-semibold">Add Skill</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-clawd-border rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2">
                {(['hub', 'local'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setAddMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      addMode === mode ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                    }`}
                  >
                    {mode === 'hub' ? 'Install from ClawdHub' : 'Create Local Skill'}
                  </button>
                ))}
              </div>

              {addMode === 'hub' ? (
                <div>
                  <label className="block text-xs text-clawd-text-dim mb-1">Skill slug</label>
                  <input
                    type="text"
                    value={hubSlug}
                    onChange={e => setHubSlug(e.target.value)}
                    placeholder="e.g. nano-banana-pro"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                  />
                  <p className="text-xs text-clawd-text-dim mt-2">
                    Browse skills at <span className="text-clawd-accent">clawdhub.com</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-clawd-text-dim mb-1">Name</label>
                    <input
                      type="text"
                      value={localName}
                      onChange={e => setLocalName(e.target.value)}
                      placeholder="my-custom-skill"
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-clawd-text-dim mb-1">Description</label>
                    <input
                      type="text"
                      value={localDescription}
                      onChange={e => setLocalDescription(e.target.value)}
                      placeholder="What this skill does"
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-clawd-text-dim mb-1">Instructions (SKILL.md body)</label>
                    <textarea
                      value={localBody}
                      onChange={e => setLocalBody(e.target.value)}
                      placeholder="# My Skill&#10;&#10;Instructions for the agent..."
                      rows={6}
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-clawd-accent resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-clawd-border flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-clawd-text-dim hover:text-clawd-text"
              >
                Cancel
              </button>
              <button
                onClick={addSkill}
                disabled={adding || (addMode === 'hub' ? !hubSlug.trim() : !localName.trim())}
                className="px-4 py-2 bg-clawd-accent text-white rounded-lg text-sm disabled:opacity-50"
              >
                {adding ? 'Adding...' : addMode === 'hub' ? 'Install' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
