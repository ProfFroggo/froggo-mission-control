/**
 * Widget Registry - Secure dynamic widget loading system
 *
 * Scans agent directories for widget manifests and validates them before loading.
 * Trust tier enforcement ensures only qualified agents can load custom widgets.
 */

import { z } from 'zod';

// Widget manifest schema validation
export const WidgetManifestSchema = z.object({
  version: z.string(),
  widgets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    component: z.string(), // relative path from widgets directory
    permissions: z.array(z.string()),
    panelType: z.enum(['dashboard', 'sidebar', 'modal']),
    icon: z.string(),
    description: z.string(),
  })),
});

export type WidgetManifest = z.infer<typeof WidgetManifestSchema>;
export type WidgetDefinition = WidgetManifest['widgets'][0];

/**
 * Trust tier gate - determines if agent can load widgets
 * Apprentice agents cannot load widgets (security boundary)
 */
export function canLoadWidgets(trustTier: string | undefined): boolean {
  if (!trustTier) return false;
  return trustTier !== 'apprentice';
}

/**
 * Load widgets for a specific agent
 * Returns validated widget definitions or empty array on error
 */
export async function loadAgentWidgets(agentId: string): Promise<WidgetDefinition[]> {
  try {
    // Use Electron IPC to securely read manifest from filesystem
    const manifestData = await (window as any).clawdbot?.widgetAPI?.scanManifest(agentId);

    if (!manifestData || manifestData.error) {
      console.warn(`[WidgetRegistry] No manifest for ${agentId}:`, manifestData?.error);
      return [];
    }

    // Validate manifest schema
    const manifest = WidgetManifestSchema.parse(manifestData);

    console.debug(`[WidgetRegistry] Loaded ${manifest.widgets.length} widget(s) for ${agentId}`);
    return manifest.widgets;

  } catch (err) {
    console.warn(`[WidgetRegistry] Failed to load widgets for ${agentId}:`, err);
    return [];
  }
}

/**
 * Scan all agents for available widgets
 * Returns map of agentId -> widget definitions
 */
export async function scanAllWidgets(): Promise<Map<string, WidgetDefinition[]>> {
  const widgetMap = new Map<string, WidgetDefinition[]>();

  try {
    // Get list of all agents from registry
    const agents = await (window as any).clawdbot?.getAgentRegistry();
    if (!agents || !Array.isArray(agents)) {
      console.warn('[WidgetRegistry] Failed to fetch agent registry');
      return widgetMap;
    }

    // Load widgets for each agent in parallel
    await Promise.all(
      agents.map(async (agent) => {
        // Skip if agent doesn't meet trust tier requirement
        if (!canLoadWidgets(agent.trust_tier)) {
          return;
        }

        const widgets = await loadAgentWidgets(agent.id);
        if (widgets.length > 0) {
          widgetMap.set(agent.id, widgets);
        }
      })
    );

    console.debug(`[WidgetRegistry] Scanned ${agents.length} agents, found widgets for ${widgetMap.size}`);

  } catch (err) {
    console.error('[WidgetRegistry] Failed to scan widgets:', err);
  }

  return widgetMap;
}
