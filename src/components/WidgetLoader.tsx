/**
 * WidgetLoader - Dynamic widget loading with error boundaries
 *
 * Loads agent-specific widgets from manifests at runtime.
 * Trust tier enforcement and graceful error handling.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Package } from 'lucide-react';
import { loadAgentWidgets, canLoadWidgets, type WidgetDefinition } from '../lib/widgetRegistry';
import { AsyncBoundary } from './AsyncBoundary';
import { createLogger } from '../utils/logger';

const logger = createLogger('WidgetLoader');

interface WidgetLoaderProps {
  agentId: string;
  trustTier?: string;
}

/**
 * Fallback UI for failed widget loads
 */
function WidgetError({ widgetName }: { widgetName: string }) {
  return (
    <div className="rounded-lg border border-error-border bg-error-subtle p-4 text-sm">
      <div className="flex items-center gap-2 text-error">
        <AlertCircle size={16} />
        <span className="font-medium">Widget failed to load: {widgetName}</span>
      </div>
      <p className="mt-1 text-xs text-error/70">
        The widget encountered an error during initialization.
      </p>
    </div>
  );
}

/**
 * Loading state for lazy-loaded widgets
 */
function WidgetLoading() {
  return (
    <div className="rounded-lg border border-mission-control-border bg-mission-control-bg0 p-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-mission-control-accent border-t-transparent" />
        <span className="text-sm text-mission-control-text-dim">Loading widget...</span>
      </div>
    </div>
  );
}

/**
 * WidgetLoader component
 * Scans for widgets and renders them with error boundaries
 */
export default function WidgetLoader({ agentId, trustTier }: WidgetLoaderProps) {
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check trust tier before attempting to load
    if (!canLoadWidgets(trustTier)) {
      setLoading(false);
      return;
    }

    loadAgentWidgets(agentId)
      .then((widgetDefs) => {
        setWidgets(widgetDefs);
        setLoading(false);
      })
      .catch((err) => {
        logger.error('Failed to load widgets:', err);
        setError(err.message || 'Unknown error');
        setLoading(false);
      });
  }, [agentId, trustTier]);

  // Don't render anything during load or if trust tier blocks
  if (loading) return null;
  if (!canLoadWidgets(trustTier)) return null;
  if (error) {
    return null;
  }
  if (widgets.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase tracking-wider">
        Agent Widgets
      </h3>
      <div className="space-y-3">
        {widgets
          .filter((w) => w.panelType === 'dashboard')
          .map((widget) => (
            <AsyncBoundary
              key={widget.id}
              fallback={<WidgetLoading />}
              errorFallback={<WidgetError widgetName={widget.name} />}
              componentName={widget.name}
            >
              <WidgetPlaceholder widget={widget} agentId={agentId} />
            </AsyncBoundary>
          ))}
      </div>
    </div>
  );
}

/**
 * Placeholder that displays widget info
 * In a full implementation, this would dynamically import the widget component
 * For now, we render placeholder content showing the widget would load here
 */
function WidgetPlaceholder({
  widget,
  agentId,
}: {
  widget: WidgetDefinition;
  agentId: string;
}) {
  return (
    <div className="rounded-lg border border-mission-control-border bg-mission-control-bg0 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mission-control-accent/10 text-mission-control-accent">
            {widget.icon || <Package size={20} />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{widget.name}</h4>
          <p className="text-xs text-mission-control-text-dim mt-1">{widget.description}</p>
          <div className="mt-3 text-xs text-mission-control-text-dim">
            <span className="px-2 py-1 rounded-lg bg-info-subtle text-info">
              Widget: {widget.id}
            </span>
            <span className="ml-2 px-2 py-1 rounded-lg bg-review-subtle text-review">
              Agent: {agentId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
