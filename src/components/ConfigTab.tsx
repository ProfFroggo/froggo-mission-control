import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, AlertTriangle, RotateCcw, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, IconButton, TextField, TextArea, Flex } from '@radix-ui/themes';
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
            traverse(val as Record<string, unknown>, path, section);
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

    traverse(cfg as Record<string, unknown>, '', '');

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
      const resultTyped = result as { config?: Record<string, unknown> };
      if (resultTyped?.config) {
        setConfig(resultTyped.config);
        buildSections(resultTyped.config);
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
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" className="py-12 text-mission-control-text-dim">
        <RefreshCw size={24} className="animate-spin mr-3" /> Loading configuration...
      </Flex>
    );
  }

  return (
    <div className="space-y-6">
      {/* Issues Banner */}
      {issues.length > 0 && (
        <div className="p-4 bg-warning-subtle border border-warning-border rounded-lg">
          <Flex align="center" gap="2" className="mb-2">
            <AlertTriangle size={16} className="text-warning" />
            <span className="font-medium text-warning">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
          </Flex>
          {issues.map((issue, i) => (
            <div key={i} className="text-sm text-warning">{issue.path}: {issue.message}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <Flex align="center" gap="3">
        <Button onClick={() => handleSave(false)} disabled={saving || !dirty} variant="solid" size="2">
          <Save size={16} /> {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving || !dirty} variant="soft" size="2">
          <RotateCcw size={16} /> Save & Restart
        </Button>
        <Button onClick={loadConfig} variant="ghost" size="2">
          <RefreshCw size={16} /> Reload
        </Button>
        <div className="flex-1" />
        <Button
          onClick={() => setShowRaw(!showRaw)}
          variant={showRaw ? 'soft' : 'ghost'}
          size="2"
        >
          <Code size={16} /> Raw JSON
        </Button>
        {dirty && <span className="text-xs text-warning">• Unsaved changes</span>}
      </Flex>

      {showRaw ? (
        <TextArea
          value={rawJson}
          onChange={e => { setRawJson(e.target.value); setDirty(true); }}
          style={{ height: '24rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
          resize="none"
          spellCheck={false}
          aria-label="Raw configuration JSON"
          size="2"
        />
      ) : (
        <div className="space-y-4">
          {sections.map(section => {
            const isCollapsed = collapsedSections.has(section.key);
            return (
              <div key={section.key} className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="w-full p-4 flex items-center justify-between hover:bg-mission-control-bg/50 transition-colors"
                >
                  <h3 className="font-medium">{section.label}</h3>
                  <Flex align="center" gap="2">
                    <span className="text-xs text-mission-control-text-dim">{section.fields.length} fields</span>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </Flex>
                </button>
                {!isCollapsed && (
                  <div className="px-4 pb-4 space-y-3 border-t border-mission-control-border pt-3">
                    {section.fields.map(field => (
                      <div key={field.path}>
                        {field.type === 'boolean' ? (
                          <Flex align="center" justify="between">
                            <div>
                              <div className="text-sm font-medium">{field.label}</div>
                              <div className="text-xs text-mission-control-text-dim">{field.path}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateField(field.path, !field.value)}
                              style={{ background: field.value ? 'var(--mission-control-accent)' : 'var(--mission-control-border)' }}
                              className="w-10 h-5 rounded-full transition-colors"
                            >
                              <div className={`w-4 h-4 rounded-full bg-[var(--mission-control-text)] shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                          </Flex>
                        ) : field.type === 'number' ? (
                          <div>
                            <label htmlFor={`config-${field.path}`} className="block text-sm font-medium mb-1">{field.label}</label>
                            <TextField.Root
                              id={`config-${field.path}`}
                              type="number"
                              size="2"
                              value={String(typeof field.value === 'number' ? field.value : (typeof field.value === 'string' ? Number(field.value) : 0))}
                              onChange={e => updateField(field.path, e.target.valueAsNumber || 0)}
                              aria-label={field.label}
                              className="w-full"
                            />
                          </div>
                        ) : field.type === 'string' ? (
                          <div>
                            <label htmlFor={`config-${field.path}`} className="block text-sm font-medium mb-1">{field.label}</label>
                            <TextField.Root
                              id={`config-${field.path}`}
                              type={field.sensitive ? 'password' : 'text'}
                              size="2"
                              value={typeof field.value === 'string' ? field.value : ''}
                              onChange={e => updateField(field.path, e.target.value)}
                              aria-label={field.label}
                              className="w-full"
                            />
                          </div>
                        ) : field.type === 'object' ? (
                          <div>
                            <label className="block text-sm font-medium mb-1">{field.label}</label>
                            <pre className="p-3 bg-mission-control-bg rounded-lg text-xs font-mono max-h-32 overflow-auto text-mission-control-text-dim">{String(field.value)}</pre>
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
