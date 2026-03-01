/**
 * Marketplace Handlers
 *
 * Channels:
 *   marketplace:registry:fetch  — fetch + cache registry.json from froggo.pro
 *   marketplace:module:install  — mark module as installed (enable compiled-in module)
 *   marketplace:module:uninstall — disable + purge credentials + remove DB record
 *   marketplace:module:status   — check if a module is installed
 *   marketplace:registry:compare — detect available updates via semver
 *
 * 5 registerHandler calls total.
 */

import { dialog } from 'electron';
import crypto from 'node:crypto';
import semver from 'semver';
import { registerHandler } from '../ipc-registry';
import { getDb } from '../database';
import { deleteModuleBridgeDir } from '../cred-store-bridge';
import { ModuleRegistrySchema, type ModuleRegistry } from '../marketplace-schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('Marketplace');

// ── Registry cache ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REGISTRY_URL = 'https://froggo.pro/registry.json';

let cachedRegistry: ModuleRegistry | null = null;
let cacheExpiresAt = 0;

async function fetchRegistry(): Promise<{ success: true; registry: ModuleRegistry } | { success: false; error: string }> {
  const now = Date.now();
  if (cachedRegistry && now < cacheExpiresAt) {
    return { success: true, registry: cachedRegistry };
  }

  try {
    const response = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const raw = await response.json();
    const parsed = ModuleRegistrySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: `Invalid registry format: ${parsed.error.message}` };
    }

    cachedRegistry = parsed.data;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return { success: true, registry: parsed.data };
  } catch (err: any) {
    return { success: false, error: err.message ?? String(err) };
  }
}

// ── SHA-256 verification stub ─────────────────────────────────────────────────

/**
 * Verify data against an expected SHA-256 hex digest.
 * Returns true if expected is empty/falsy (skip verification).
 * Scaffolding for future download integrity checks.
 * Currently all registry entries have sha256: "" so this always returns true.
 */
function verifySha256(data: Buffer, expected: string): boolean {
  if (!expected) return true;
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  return actual === expected;
}

// ── Handler registration ──────────────────────────────────────────────────────

export function registerMarketplaceHandlers(): void {
  // Handler 1: marketplace:registry:fetch
  // Fetch registry.json from froggo.pro with 5-min cache + Zod validation
  registerHandler('marketplace:registry:fetch', async (_event) => {
    try {
      return await fetchRegistry();
    } catch (err: any) {
      logger.error('[Marketplace] registry:fetch error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Handler 2: marketplace:module:install
  // INSERT OR REPLACE into installed_modules; always signals restartRequired: true
  // (compiled-in modules are already loaded — restart notice is cosmetic for UX)
  registerHandler(
    'marketplace:module:install',
    async (_event, moduleId: string, name: string, version: string) => {
      try {
        const now = Date.now();
        getDb().prepare(
          `INSERT OR REPLACE INTO installed_modules
           (id, name, installed_version, enabled, installed_at, updated_at, source, sha256, registry_url)
           VALUES (?, ?, ?, 1, ?, ?, 'marketplace', '', ?)`,
        ).run(moduleId, name, version, now, now, REGISTRY_URL);
        logger.info(`[Marketplace] Installed module "${moduleId}" v${version}`);
        return { success: true, restartRequired: true };
      } catch (err: any) {
        logger.error('[Marketplace] module:install error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  // Handler 3: marketplace:module:uninstall
  // Show confirmation dialog → purge credentials → delete DB records
  registerHandler('marketplace:module:uninstall', async (_event, moduleId: string) => {
    try {
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Uninstall Module',
        message: `Uninstall "${moduleId}"?`,
        detail: 'This will remove the module record and purge all associated credentials. This cannot be undone.',
        buttons: ['Cancel', 'Uninstall'],
        defaultId: 0,
        cancelId: 0,
      });

      if (response !== 1) {
        return { success: true, uninstalled: false };
      }

      // Purge credential bridge directory
      deleteModuleBridgeDir(moduleId);

      // Delete from installed_modules
      getDb().prepare('DELETE FROM installed_modules WHERE id = ?').run(moduleId);

      // Delete integration record — DELETE instead of status UPDATE because
      // module_integrations.status CHECK constraint only allows 'pending','active','failed'
      getDb().prepare('DELETE FROM module_integrations WHERE module_id = ?').run(moduleId);

      logger.info(`[Marketplace] Uninstalled module "${moduleId}"`);
      return { success: true, uninstalled: true };
    } catch (err: any) {
      logger.error('[Marketplace] module:uninstall error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Handler 4: marketplace:module:status
  // Check if a module is installed by ID
  registerHandler('marketplace:module:status', async (_event, moduleId: string) => {
    try {
      const row = getDb().prepare('SELECT * FROM installed_modules WHERE id = ?').get(moduleId) as Record<string, unknown> | undefined;
      return {
        success: true,
        installed: !!row,
        module: row ?? null,
      };
    } catch (err: any) {
      logger.error('[Marketplace] module:status error:', err.message);
      return { success: false, installed: false, module: null, error: err.message };
    }
  });

  // Handler 5: marketplace:registry:compare
  // Compare installed module versions against the registry to detect available updates
  registerHandler('marketplace:registry:compare', async (_event) => {
    try {
      const result = await fetchRegistry();
      if (!result.success) {
        return { success: false as const, error: (result as { success: false; error: string }).error };
      }
      const { registry } = result as { success: true; registry: ModuleRegistry };

      const installed = getDb().prepare('SELECT id, installed_version FROM installed_modules WHERE enabled = 1').all() as Array<{
        id: string;
        installed_version: string;
      }>;

      const updates: Array<{ moduleId: string; installedVersion: string; latestVersion: string }> = [];

      for (const mod of installed) {
        const entry = registry.modules.find(m => m.id === mod.id);
        if (!entry) continue;
        if (semver.gt(entry.version, mod.installed_version)) {
          updates.push({
            moduleId: mod.id,
            installedVersion: mod.installed_version,
            latestVersion: entry.version,
          });
        }
      }

      return { success: true, updates };
    } catch (err: any) {
      logger.error('[Marketplace] registry:compare error:', err.message);
      return { success: false, error: err.message };
    }
  });
}

// Export verifySha256 for future use (download integrity checks)
export { verifySha256 };
