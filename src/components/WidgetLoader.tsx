/**
 * WidgetLoader - Dynamic widget loading with error boundaries
 *
 * Loads agent-specific widgets from manifests at runtime.
 * Trust tier enforcement and graceful error handling.
 */

import { useState, useEffect, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { loadAgentWidgets, canLoadWidgets, type WidgetDefinition } from '../lib/widgetRegistry';
import ErrorBoundary from './ErrorBoundary';
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
    <div className="rounded-lg border border-clawd-border bg-clawd-bg0 p-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-clawd-accent border-t-transparent" />
        <span className="text-sm text-clawd-text-dim">Loading widget...</span>
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
      <h3 className="text-sm font-semibold text-clawd-text-dim uppercase tracking-wider">
        Agent Widgets
      </h3>
      <div className="space-y-3">
        {widgets
          .filter((w) => w.panelType === 'dashboard')
          .map((widget) => (
            <ErrorBoundary
              key={widget.id}
              fallback={<WidgetError widgetName={widget.name} />}
            >
              <Suspense fallback={<WidgetLoading />}>
                <WidgetPlaceholder widget={widget} agentId={agentId} />
              </Suspense>
            </ErrorBoundary>
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
    <div className="rounded-lg border border-clawd-border bg-clawd-bg0 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-clawd-accent/10 text-clawd-accent">
            {widget.icon || '📦'}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{widget.name}</h4>
          <p className="text-xs text-clawd-text-dim mt-1">{widget.description}</p>
          <div className="mt-3 text-xs text-clawd-text-dim">
            <span className="px-2 py-1 rounded bg-info-subtle text-info">
              Widget: {widget.id}
            </span>
            <span className="ml-2 px-2 py-1 rounded bg-review-subtle text-review">
              Agent: {agentId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
