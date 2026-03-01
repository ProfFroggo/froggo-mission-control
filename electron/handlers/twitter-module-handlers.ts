/**
 * Twitter Module Handlers
 *
 * Module-specific handlers for credential auto-import and health check.
 * Uses registerModuleHandler for namespace enforcement (module-twitter: prefix).
 *
 * Channels:
 *   module-twitter:creds:import-env  — read ~/.openclaw/x-api.env and return values for wizard pre-fill
 *   module-twitter:health:check       — verify all 4 required keys are present in x-api.env
 *
 * Existing x:publish:* handlers in x-publishing-service.ts remain untouched.
 *
 * 2 registerModuleHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerModuleHandler } from '../ipc-registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('TwitterModule');

const X_API_ENV_PATH = path.join(os.homedir(), '.openclaw', 'x-api.env');

/**
 * Parse x-api.env file and extract credential values.
 * Supports two common formats:
 *   - export KEY="VALUE"  (sourced shell format)
 *   - KEY="VALUE"         (dotenv format)
 */
function parseXApiEnv(): Record<string, string> | null {
  try {
    if (!fs.existsSync(X_API_ENV_PATH)) return null;
    const content = fs.readFileSync(X_API_ENV_PATH, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Strip optional "export " prefix
      const withoutExport = trimmed.replace(/^export\s+/, '');
      const eqIdx = withoutExport.indexOf('=');
      if (eqIdx === -1) continue;
      const key = withoutExport.substring(0, eqIdx).trim();
      let value = withoutExport.substring(eqIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch (err: unknown) {
    logger.error('[TwitterModule] Failed to parse x-api.env:', err.message);
    return null;
  }
}

/**
 * Mapping from module credential IDs to x-api.env environment variable names.
 */
const CREDENTIAL_ENV_MAP: Record<string, string> = {
  api_key: 'X_CONSUMER_KEY',
  api_secret: 'X_CONSUMER_SECRET',
  access_token: 'X_ACCESS_TOKEN',
  access_token_secret: 'X_ACCESS_TOKEN_SECRET',
};

export function registerTwitterModuleHandlers(): void {
  // Auto-import credentials from ~/.openclaw/x-api.env
  // Called by IntegrationWizard on first open to pre-fill credential fields
  registerModuleHandler('twitter', 'module-twitter:creds:import-env', async () => {
    const env = parseXApiEnv();
    if (!env) {
      return {
        success: false,
        error: `Credentials file not found: ${X_API_ENV_PATH}`,
      };
    }

    const credentials: Record<string, string> = {};
    const missing: string[] = [];

    for (const [credId, envKey] of Object.entries(CREDENTIAL_ENV_MAP)) {
      const value = env[envKey];
      if (value) {
        credentials[credId] = value;
      } else {
        missing.push(envKey);
      }
    }

    if (missing.length > 0) {
      logger.warn(`[TwitterModule] Partial credentials in x-api.env; missing: ${missing.join(', ')}`);
      return {
        success: false,
        error: `Missing keys in x-api.env: ${missing.join(', ')}`,
        credentials, // Return partial results for pre-fill of available fields
      };
    }

    logger.debug('[TwitterModule] All 4 credentials found in x-api.env');
    return { success: true, credentials };
  });

  // Health check — verify x-api.env exists and contains all 4 required keys
  // Called by wizard on the test step; returns success/failure with message
  registerModuleHandler('twitter', 'module-twitter:health:check', async () => {
    const env = parseXApiEnv();
    if (!env) {
      return {
        success: false,
        error: `Credentials file not found: ${X_API_ENV_PATH}`,
      };
    }

    const requiredKeys = Object.values(CREDENTIAL_ENV_MAP);
    const missing = requiredKeys.filter(k => !env[k]);

    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required credentials: ${missing.join(', ')}`,
      };
    }

    return {
      success: true,
      message: 'X API credentials configured.',
    };
  });

  logger.debug('[TwitterModule] IPC handlers registered: module-twitter:creds:import-env, module-twitter:health:check');
}
