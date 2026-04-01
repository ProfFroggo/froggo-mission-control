'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot, MessageSquare, FileText, Activity, CheckCircle, ArrowRightLeft,
  Loader2, ArrowRight,
} from 'lucide-react';
import { wsClient, type TemplateMeta } from '@/lib/workflow-studio-client';
import { useCanvasStore, type WorkflowMeta, type SerializedWorkflow } from './store';

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, MessageSquare, FileText, Activity, CheckCircle, ArrowRightLeft,
};

const CATEGORY_COLORS: Record<string, string> = {
  ai: '#a78bfa',
  notification: '#e879f9',
  reporting: '#60a5fa',
  automation: '#f97316',
  data: '#06b6d4',
  'mc-actions': '#22c55e',
  social: '#000000',
  integration: '#6b7280',
};

interface TemplatesTabProps {
  onSwitchToCanvas: () => void;
}

export default function TemplatesTab({ onSwitchToCanvas }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    wsClient.listTemplates()
      .then((t) => { if (!cancelled) setTemplates(t); })
      .catch(() => { if (!cancelled) setTemplates([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleUseTemplate = useCallback(async (tmpl: TemplateMeta) => {
    setApplying(tmpl.id);
    try {
      // Use the real workflow from the template, or empty if not available
      const state: SerializedWorkflow = tmpl.workflow
        ? (tmpl.workflow as SerializedWorkflow)
        : { version: '1', blocks: [], connections: [], loops: {} };
      const result = await wsClient.createWorkflow({
        name: tmpl.name,
        state,
      });
      const meta: WorkflowMeta = {
        id: result.id,
        name: tmpl.name,
        description: tmpl.description,
        color: CATEGORY_COLORS[tmpl.category] ?? '#7c3aed',
        is_deployed: false,
        run_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWorkflow(result.id, meta, state);
      onSwitchToCanvas();
    } catch (err) {
      console.error('Failed to apply template:', err);
    } finally {
      setApplying(null);
    }
  }, [setWorkflow, onSwitchToCanvas]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-mission-control-text-dim" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div>
        <p className="text-sm text-mission-control-text-dim mb-4">
          Start from a pre-built template to save time. Templates provide a working workflow structure that you can customize.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tmpl) => {
            const Icon = ICON_MAP[tmpl.icon] ?? Bot;
            const color = CATEGORY_COLORS[tmpl.category] ?? '#7c3aed';
            return (
              <div
                key={tmpl.id}
                className="rounded-xl p-4 flex flex-col gap-3 transition-colors hover:bg-mission-control-bg"
                style={{
                  background: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-mission-control-text">{tmpl.name}</h3>
                    <p className="text-xs text-mission-control-text-dim mt-0.5">{tmpl.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {tmpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--mission-control-bg)', color: 'var(--mission-control-text-dim)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(tmpl)}
                    disabled={applying === tmpl.id}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    style={{
                      background: `${color}15`,
                      color,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {applying === tmpl.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ArrowRight size={12} />
                    )}
                    Use
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {templates.length === 0 && (
          <p className="text-sm text-mission-control-text-dim text-center py-8">No templates available.</p>
        )}
      </div>
    </div>
  );
}
