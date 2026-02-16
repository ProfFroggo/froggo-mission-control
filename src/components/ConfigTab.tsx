import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, AlertTriangle, RotateCcw, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';

interface ConfigSection {
  key: string;
  label: string;
  fields: ConfigField[];
}

type ConfigValue = string | number | boolean | null | Record<string, unknown>;

interface ConfigField {
  path: string;
  key: string;
  label: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'object';
  value: ConfigValue;
  options?: string[];
  help?: string;
  sensitive?: boolean;
}

export default function ConfigTab() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [hash, setHash] = useState('');
  const [issues, setIssues] = useState<Array<{ message?: string; path?: string; severity?: string }>>([]);
  const [sections, setSections] = useState<ConfigSection[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawJson, setRawJson] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gateway.getConfig();
      if (result) {
        setConfig(result.config || {});
        setHash(result.hash || '');
        setIssues(result.issues || []);
        setRawJson(result.raw || JSON.stringify(result.config, null, 2));
        buildSections(result.config || {});
        setDirty(false);
      }
    } catch (e) {
      showToast('error', 'Failed to load config', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const buildSections = (cfg: Record<string, unknown>) => {
    const sectionMap: Record<string, ConfigField[]> = {};

    const traverse = (obj: Record<string, unknown>, prefix: string, sectionKey: string) => {
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const section = sectionKey || key;

        if (!sectionMap[section]) sectionMap[section] = [];

        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          // For nested objects, recurse but keep the top-level section
          if (prefix) {
            // Show as collapsed sub-object
            sectionMap[section].push({
              path, key, label: key,
              type: 'object', value: JSON.stringify(val, null, 2),
            });
          } else {
            traverse(val, path, section);
          }
        } else if (typeof val === 'boolean') {
          sectionMap[section].push({ path, key, label: key, type: 'boolean', value: val });
        } else if (typeof val === 'number') {
          sectionMap[section].push({ path, key, label: key, type: 'number', value: val });
        } else if (typeof val === 'string') {
          const isSensitive = /token|key|secret|password/i.test(key);
          sectionMap[section].push({ path, key, label: key, type: 'string', value: val, sensitive: isSensitive });
        } else if (Array.isArray(val)) {
          sectionMap[section].push({ path, key, label: key, type: 'object', value: JSON.stringify(val, null, 2) });
        }
      }
    };

    traverse(cfg, '', '');

    const built: ConfigSection[] = Object.entries(sectionMap).map(([key, fields]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      fields,
    }));

    setSections(built);
  };

  const updateField = (path: string, newValue: ConfigValue) => {
    setDirty(true);
    setConfig((prev: Record<string, unknown> | null) => {
      const updated = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let obj = updated;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = newValue;
      setRawJson(JSON.stringify(updated, null, 2));
      buildSections(updated);
      return updated;
    });
  };

  const handleSave = async (restart = false) => {
    setSaving(true);
    try {
      const raw = showRaw ? rawJson : JSON.stringify(config, null, 2);
      const result = await gateway.applyConfig(raw, hash, restart ? 2000 : 0);
      showToast('success', restart ? 'Config saved & restarting...' : 'Config saved');
      setDirty(false);
      if (result?.config) {
        setConfig(result.config);
        buildSections(result.config);
      }
    } catch (e) {
      showToast('error', 'Failed to save config', String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-clawd-text-dim">
        <RefreshCw size={24} className="animate-spin mr-3" /> Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Issues Banner */}
      {issues.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warning" />
            <span className="font-medium text-warning">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
          </div>
          {issues.map((issue, i) => (
            <div key={i} className="text-sm text-yellow-300">{issue.path}: {issue.message}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => handleSave(false)} disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg text-sm disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving || !dirty}
          className="flex items-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text rounded-lg text-sm disabled:opacity-50">
          <RotateCcw size={16} /> Save & Restart
        </button>
        <button onClick={loadConfig} className="flex items-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:bg-clawd-border/80">
          <RefreshCw size={16} /> Reload
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowRaw(!showRaw)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showRaw ? 'bg-clawd-accent/20 text-clawd-accent' : 'bg-clawd-border text-clawd-text-dim'}`}>
          <Code size={16} /> Raw JSON
        </button>
        {dirty && <span className="text-xs text-warning">• Unsaved changes</span>}
      </div>

      {showRaw ? (
        <textarea
          value={rawJson}
          onChange={e => { setRawJson(e.target.value); setDirty(true); }}
          className="w-full h-96 bg-clawd-bg border border-clawd-border rounded-xl p-4 font-mono text-sm resize-none focus:outline-none focus:border-clawd-accent"
          spellCheck={false}
        />
      ) : (
        <div className="space-y-4">
          {sections.map(section => {
            const isCollapsed = collapsedSections.has(section.key);
            return (
              <div key={section.key} className="bg-clawd-surface border border-clawd-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full p-4 flex items-center justify-between hover:bg-clawd-bg/50 transition-colors"
                >
                  <h3 className="font-medium">{section.label}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-clawd-text-dim">{section.fields.length} fields</span>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="px-4 pb-4 space-y-3 border-t border-clawd-border pt-3">
                    {section.fields.map(field => (
                      <div key={field.path}>
                        {field.type === 'boolean' ? (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">{field.label}</div>
                              <div className="text-xs text-clawd-text-dim">{field.path}</div>
                            </div>
                            <button
                              onClick={() => updateField(field.path, !field.value)}
                              className={`w-10 h-5 rounded-full transition-colors ${field.value ? 'bg-clawd-accent' : 'bg-clawd-border'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        ) : field.type === 'number' ? (
                          <div>
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <input type="number" value={field.value}
                              onChange={e => updateField(field.path, Number(e.target.value))}
                              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent" />
                          </div>
                        ) : field.type === 'string' ? (
                          <div>
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <input type={field.sensitive ? 'password' : 'text'} value={field.value}
                              onChange={e => updateField(field.path, e.target.value)}
                              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent" />
                          </div>
                        ) : field.type === 'object' ? (
                          <div>
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <pre className="p-3 bg-clawd-bg rounded-lg text-xs font-mono max-h-32 overflow-auto text-clawd-text-dim">{field.value}</pre>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
