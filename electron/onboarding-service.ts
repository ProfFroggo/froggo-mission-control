/**
 * Onboarding Service
 *
 * IPC handlers for the first-run onboarding wizard:
 * - Dependency checks (CLI, gateway, config, database)
 * - macOS permission status and requests
 * - Gateway connectivity testing
 * - Sample data population
 */

import { systemPreferences } from 'electron';
import { existsSync, readFileSync } from 'fs';
import * as http from 'http';
import Database from 'better-sqlite3';
import { registerHandler } from './ipc-registry';
import { FROGGO_DB, OPENCLAW_CONFIG } from './paths';
import { createLogger } from './utils/logger';

const logger = createLogger('Onboarding');

const OPENCLAW_CLI = '/opt/homebrew/bin/openclaw';
const GATEWAY_PORT = 18789;

// ── Helpers ──

function httpGet(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400, status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

// ── IPC Handlers ──

export function registerOnboardingHandlers(): void {
  // 1. Check dependencies
  registerHandler<[], { cli: boolean; gateway: boolean; config: boolean; database: boolean }>(
    'onboarding:checkDependencies',
    async () => {
      const cli = existsSync(OPENCLAW_CLI);
      const config = existsSync(OPENCLAW_CONFIG);
      const database = existsSync(FROGGO_DB);

      let gateway = false;
      try {
        const result = await httpGet(`http://localhost:${GATEWAY_PORT}/health`, 5000);
        gateway = result.ok;
      } catch {
        gateway = false;
      }

      logger.debug(`[Onboarding] Dependencies: cli=${cli} gateway=${gateway} config=${config} db=${database}`);
      return { cli, gateway, config, database };
    }
  );

  // 2. Check macOS permissions
  registerHandler<[], { camera: string; microphone: string; screen: string; notifications: string }>(
    'onboarding:checkPermissions',
    async () => {
      const camera = systemPreferences.getMediaAccessStatus('camera');
      const microphone = systemPreferences.getMediaAccessStatus('microphone');
      const screen = systemPreferences.getMediaAccessStatus('screen');
      // Electron apps get notification permission by default on macOS
      const notifications = 'granted';

      return { camera, microphone, screen, notifications };
    }
  );

  // 3. Request a specific permission
  registerHandler<['camera' | 'microphone'], { granted: boolean }>(
    'onboarding:requestPermission',
    async (_event, mediaType) => {
      const granted = await systemPreferences.askForMediaAccess(mediaType);
      return { granted };
    }
  );

  // 4. Test gateway connectivity
  registerHandler<[], { reachable: boolean; hasToken: boolean; error?: string }>(
    'onboarding:testGatewayConnection',
    async () => {
      let hasToken = false;
      try {
        if (existsSync(OPENCLAW_CONFIG)) {
          const raw = readFileSync(OPENCLAW_CONFIG, 'utf-8');
          const cfg = JSON.parse(raw);
          hasToken = !!(cfg?.gateway?.token || cfg?.token);
        }
      } catch (e) {
        logger.warn('[Onboarding] Failed to read gateway token from config:', (e as Error).message);
      }

      try {
        const result = await httpGet(`http://localhost:${GATEWAY_PORT}/health`, 5000);
        return { reachable: result.ok, hasToken };
      } catch (e) {
        return { reachable: false, hasToken, error: (e as Error).message };
      }
    }
  );

  // 5. Populate sample data
  registerHandler<[], { inserted: number; skipped: number }>(
    'onboarding:populateSampleData',
    async () => {
      if (!existsSync(FROGGO_DB)) {
        logger.warn('[Onboarding] Database not found, cannot populate sample data');
        return { inserted: 0, skipped: 0 };
      }

      const sampleDb = new Database(FROGGO_DB);
      try {
        // Check tasks table exists (graceful degradation per standing decisions)
        const tableCheck = sampleDb.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
        ).get();
        if (!tableCheck) {
          logger.warn('[Onboarding] tasks table does not exist, skipping sample data');
          return { inserted: 0, skipped: 0 };
        }

        const now = Date.now();
        const samples = [
          { id: `demo-${now}-1`, title: '[Demo] Set up project README',         status: 'todo',        assigned_to: 'writer' },
          { id: `demo-${now}-2`, title: '[Demo] Research competitor features',   status: 'todo',        assigned_to: 'researcher' },
          { id: `demo-${now}-3`, title: '[Demo] Fix login page styling',         status: 'in-progress', assigned_to: 'coder' },
          { id: `demo-${now}-4`, title: '[Demo] Write API documentation',        status: 'review',      assigned_to: 'writer',     reviewerId: 'clara' },
          { id: `demo-${now}-5`, title: '[Demo] Review security audit findings', status: 'done',        assigned_to: 'researcher' },
        ];

        const insert = sampleDb.prepare(
          `INSERT OR IGNORE INTO tasks (id, title, status, assigned_to, reviewerId, description, created_at, updated_at)
           VALUES (@id, @title, @status, @assigned_to, @reviewerId, 'Sample task created during onboarding', @created_at, @created_at)`
        );

        let inserted = 0;
        const insertAll = sampleDb.transaction(() => {
          for (const s of samples) {
            const result = insert.run({
              id: s.id,
              title: s.title,
              status: s.status,
              assigned_to: s.assigned_to,
              reviewerId: (s as Record<string, unknown>).reviewerId ?? null,
              created_at: now,
            });
            if (result.changes > 0) inserted++;
          }
        });
        insertAll();

        const skipped = samples.length - inserted;
        logger.debug(`[Onboarding] Sample data: ${inserted} inserted, ${skipped} skipped`);
        return { inserted, skipped };
      } finally {
        sampleDb.close();
      }
    }
  );

  logger.debug('[Onboarding] All onboarding IPC handlers registered');
}
