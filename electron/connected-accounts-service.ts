/**
 * Connected Accounts Service
 * 
 * Comprehensive account management system supporting:
 * - Google Workspace (Gmail, Calendar, Drive, Contacts)
 * - iCloud (Calendar, Contacts)
 * - Microsoft/Outlook (Email, Calendar)
 * 
 * Features:
 * - OAuth token management (encrypted storage)
 * - Multi-account support
 * - Skill integration (gog CLI, etc.)
 * - Permission/scope tracking
 * - Sync status monitoring
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { safeStorage } from 'electron';
import { FROGGO_DB } from './paths';

const execAsync = promisify(exec);

// Database path
const DB_PATH = FROGGO_DB;

export interface ConnectedAccount {
  id: string;
  accountType: 'google' | 'icloud' | 'microsoft' | 'outlook';
  email: string;
  displayName?: string;
  authMethod: 'oauth' | 'api_key' | 'system';
  authStatus: 'connected' | 'expired' | 'error' | 'revoked';
  grantedScopes?: string[];
  dataTypes: Array<'email' | 'calendar' | 'drive' | 'contacts' | 'tasks'>;
  lastSyncTime?: number;
  lastSyncStatus?: 'success' | 'error' | 'partial';
  profilePictureUrl?: string;
  skillName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AccountPermission {
  id: number;
  accountId: string;
  permissionType: string;
  permissionScope: string;
  grantedAt: number;
  lastUsedAt?: number;
}

export interface AccountTypeInfo {
  type: string;
  name: string;
  icon: string;
  supportedDataTypes: string[];
  requiresSkill: boolean;
  skillName?: string;
  available: boolean;
}

// Encryption utilities — uses Electron safeStorage (OS keychain)
function encrypt(text: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available');
  }
  const encrypted = safeStorage.encryptString(text);
  return encrypted.toString('base64');
}

function decrypt(text: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available');
  }
  const buffer = Buffer.from(text, 'base64');
  return safeStorage.decryptString(buffer);
}

// SQLite helpers
async function dbQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(DB_PATH);
    
    db.all(query, params, (err: Error | null, rows: T[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function dbRun(query: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(query, params, function(err: Error | null) {
      db.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

class ConnectedAccountsService {
  // Google accounts — populated dynamically from connected_accounts DB table
  // Previously hardcoded; now empty default so new installs don't assume specific accounts
  private readonly GOG_ACCOUNTS: string[] = [];

  /**
   * Get all connected accounts
   */
  async listAccounts(): Promise<ConnectedAccount[]> {
    try {
      const rows = await dbQuery<any>(
        `SELECT 
          id, account_type, email, display_name, auth_method, auth_status,
          granted_scopes, data_types, last_sync_time, last_sync_status,
          profile_picture_url, skill_name, created_at, updated_at
        FROM connected_accounts
        ORDER BY created_at DESC`
      );

      return rows.map(row => ({
        id: row.id,
        accountType: row.account_type,
        email: row.email,
        displayName: row.display_name,
        authMethod: row.auth_method,
        authStatus: row.auth_status,
        grantedScopes: row.granted_scopes ? JSON.parse(row.granted_scopes) : [],
        dataTypes: JSON.parse(row.data_types),
        lastSyncTime: row.last_sync_time,
        lastSyncStatus: row.last_sync_status,
        profilePictureUrl: row.profile_picture_url,
        skillName: row.skill_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (err) {
      console.error('[ConnectedAccountsService] Failed to list accounts:', err);
      return [];
    }
  }

  /**
   * Get account by ID
   */
  async getAccount(id: string): Promise<ConnectedAccount | null> {
    const accounts = await this.listAccounts();
    return accounts.find(acc => acc.id === id) || null;
  }

  /**
   * Get account permissions (detailed OAuth scopes)
   */
  async getAccountPermissions(accountId: string): Promise<AccountPermission[]> {
    try {
      return await dbQuery<AccountPermission>(
        `SELECT * FROM account_permissions WHERE account_id = ? ORDER BY granted_at DESC`,
        [accountId]
      );
    } catch (err) {
      console.error('[ConnectedAccountsService] Failed to get permissions:', err);
      return [];
    }
  }

  /**
   * Check available account types and their skill status
   */
  async getAvailableAccountTypes(): Promise<AccountTypeInfo[]> {
    const types: AccountTypeInfo[] = [
      {
        type: 'google',
        name: 'Google Workspace',
        icon: '📧',
        supportedDataTypes: ['email', 'calendar', 'drive', 'contacts', 'tasks'],
        requiresSkill: true,
        skillName: 'gog',
        available: false
      },
      {
        type: 'icloud',
        name: 'iCloud',
        icon: '🍎',
        supportedDataTypes: ['calendar', 'contacts'],
        requiresSkill: false,
        available: true  // macOS system integration
      },
      {
        type: 'microsoft',
        name: 'Microsoft 365',
        icon: '📨',
        supportedDataTypes: ['email', 'calendar', 'drive'],
        requiresSkill: true,
        skillName: 'msgraph',
        available: false
      },
      {
        type: 'outlook',
        name: 'Outlook.com',
        icon: '📨',
        supportedDataTypes: ['email', 'calendar'],
        requiresSkill: true,
        skillName: 'msgraph',
        available: false
      }
    ];

    // Check if gog CLI is available
    try {
      await execAsync('which gog', { timeout: 5000 });
      const gogType = types.find(t => t.type === 'google');
      if (gogType) gogType.available = true;
    } catch {
      console.log('[ConnectedAccountsService] gog CLI not found');
    }

    return types;
  }

  /**
   * Import existing Google accounts from gog CLI
   */
  async importGoogleAccounts(): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const email of this.GOG_ACCOUNTS) {
      try {
        // Test if account is authenticated
        const { stdout } = await execAsync(
          `GOG_ACCOUNT=${email} gog calendar calendars --json`,
          { env: { ...process.env, GOG_ACCOUNT: email }, timeout: 10000 }
        );

        const data = JSON.parse(stdout);
        if (data.calendars && data.calendars.length > 0) {
          // Account is authenticated, add to DB
          const accountId = `google-${email.replace(/[^a-z0-9]/gi, '-')}`;
          
          await dbRun(
            `INSERT OR REPLACE INTO connected_accounts 
            (id, account_type, email, display_name, auth_method, auth_status, 
             granted_scopes, data_types, last_sync_time, skill_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              accountId,
              'google',
              email,
              email.split('@')[0],
              'oauth',
              'connected',
              JSON.stringify(['calendar', 'email']),
              JSON.stringify(['calendar', 'email']),
              Date.now(),
              'gog',
              Date.now(),
              Date.now()
            ]
          );

          imported++;
          console.log(`[ConnectedAccountsService] Imported Google account: ${email}`);
        }
      } catch (err: any) {
        console.error(`[ConnectedAccountsService] Failed to import ${email}:`, err.message);
        errors.push(`${email}: ${err.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Add a new account (interactive OAuth flow)
   */
  async addAccount(accountType: string, options: {
    conversational?: boolean;
  } = {}): Promise<{ success: boolean; accountId?: string; error?: string; steps?: string[] }> {
    const accountTypes = await this.getAvailableAccountTypes();
    const typeInfo = accountTypes.find(t => t.type === accountType);

    if (!typeInfo) {
      return { success: false, error: `Unknown account type: ${accountType}` };
    }

    if (!typeInfo.available) {
      return { 
        success: false, 
        error: `${typeInfo.name} requires the '${typeInfo.skillName}' skill which is not installed`
      };
    }

    // Handle different account types
    switch (accountType) {
      case 'google':
        return this.addGoogleAccount(options);
      
      case 'icloud':
        return this.addICloudAccount(options);
      
      default:
        return { success: false, error: 'Account type not yet implemented' };
    }
  }

  /**
   * Add Google account via gog CLI
   */
  private async addGoogleAccount(options: any): Promise<any> {
    try {
      // Use gog CLI to authenticate
      const { stdout, stderr } = await execAsync('gog auth login', { timeout: 120000 });
      
      if (stderr && stderr.includes('error')) {
        return { success: false, error: stderr };
      }

      // Get the newly authenticated account email
      const { stdout: profileOut } = await execAsync('gog auth profile --json', { timeout: 10000 });
      const profile = JSON.parse(profileOut);
      const email = profile.email;

      // Add to database
      const accountId = `google-${email.replace(/[^a-z0-9]/gi, '-')}`;
      await dbRun(
        `INSERT OR REPLACE INTO connected_accounts 
        (id, account_type, email, display_name, auth_method, auth_status, 
         granted_scopes, data_types, last_sync_time, skill_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          'google',
          email,
          profile.name || email.split('@')[0],
          'oauth',
          'connected',
          JSON.stringify(['calendar', 'email', 'drive']),
          JSON.stringify(['calendar', 'email', 'drive']),
          Date.now(),
          'gog',
          Date.now(),
          Date.now()
        ]
      );

      return { 
        success: true, 
        accountId,
        steps: [
          '✅ OAuth authentication completed',
          '✅ Account profile retrieved',
          '✅ Account saved to database'
        ]
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Add iCloud account (macOS system integration)
   */
  private async addICloudAccount(options: any): Promise<any> {
    return { 
      success: false, 
      error: 'iCloud integration not yet implemented. Use macOS Calendar app for now.'
    };
  }

  /**
   * Remove an account
   */
  async removeAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.getAccount(accountId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Remove from database
      await dbRun('DELETE FROM connected_accounts WHERE id = ?', [accountId]);
      
      // TODO: Revoke OAuth tokens if applicable
      
      console.log(`[ConnectedAccountsService] Removed account: ${account.email}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Refresh account connection
   */
  async refreshAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.getAccount(accountId);
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      // Test connection based on account type
      if (account.accountType === 'google' && account.skillName === 'gog') {
        const { stdout } = await execAsync(
          `GOG_ACCOUNT=${account.email} gog calendar calendars --json`,
          { env: { ...process.env, GOG_ACCOUNT: account.email }, timeout: 10000 }
        );

        const data = JSON.parse(stdout);
        const status = data.calendars && data.calendars.length > 0 ? 'connected' : 'error';

        // Update sync status
        await dbRun(
          `UPDATE connected_accounts 
          SET auth_status = ?, last_sync_time = ?, last_sync_status = ?
          WHERE id = ?`,
          [status, Date.now(), 'success', accountId]
        );

        return { success: true };
      }

      return { success: false, error: 'Account refresh not implemented for this type' };
    } catch (err: any) {
      await dbRun(
        `UPDATE connected_accounts 
        SET auth_status = 'error', last_sync_status = 'error'
        WHERE id = ?`,
        [accountId]
      );
      return { success: false, error: err.message };
    }
  }

  /**
   * Get sync history for an account
   */
  async getSyncHistory(accountId: string, limit: number = 10): Promise<any[]> {
    try {
      return await dbQuery(
        `SELECT * FROM account_sync_log 
        WHERE account_id = ? 
        ORDER BY sync_time DESC 
        LIMIT ?`,
        [accountId, limit]
      );
    } catch (err) {
      console.error('[ConnectedAccountsService] Failed to get sync history:', err);
      return [];
    }
  }
}

// Singleton instance
export const connectedAccountsService = new ConnectedAccountsService();
