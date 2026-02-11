/**
 * Connected Accounts Service
 * 
 * Unified system for managing external account integrations
 * - Google (via gog CLI)
 * - iCloud (via manual config)
 * - Microsoft (future)
 * - Apple (future)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export type AccountProvider = 'google' | 'icloud' | 'microsoft' | 'apple';
export type DataType = 'email' | 'calendar' | 'drive' | 'contacts' | 'tasks';

export interface ConnectedAccount {
  id: string;
  provider: AccountProvider;
  email: string;
  displayName?: string;
  status: 'connected' | 'error' | 'checking' | 'needs-reauth';
  lastChecked?: number;
  errorMessage?: string;
  dataTypes: DataType[];
  scopes: Array<{
    type: DataType;
    permission: 'read' | 'write' | 'read-write';
    description: string;
  }>;
  metadata?: any;
  authType: 'oauth' | 'app-password' | 'manual';
  tokenPath?: string;
  createdAt: number;
  updatedAt: number;
}

const ACCOUNTS_FILE = path.join(os.homedir(), 'clawd', 'data', 'connected-accounts.json');
const TOKENS_DIR = path.join(os.homedir(), 'clawd', 'data', 'tokens');

class AccountsService {
  private accounts: ConnectedAccount[] = [];
  private encryptionKey: Buffer;

  constructor() {
    // Generate or load encryption key
    const keyPath = path.join(os.homedir(), 'clawd', 'data', '.account-key');
    if (fs.existsSync(keyPath)) {
      this.encryptionKey = fs.readFileSync(keyPath);
    } else {
      this.encryptionKey = crypto.randomBytes(32);
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      fs.writeFileSync(keyPath, this.encryptionKey, { mode: 0o600 });
    }

    this.loadAccounts();
  }

  /**
   * Load accounts from disk
   */
  private loadAccounts() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
        this.accounts = JSON.parse(data);
        console.log(`[AccountsService] Loaded ${this.accounts.length} accounts`);
      } else {
        // Migrate from legacy calendar accounts
        this.migrateLegacyAccounts();
      }
    } catch (err) {
      console.error('[AccountsService] Failed to load accounts:', err);
      this.accounts = [];
    }
  }

  /**
   * Migrate legacy calendar accounts to new system
   */
  private async migrateLegacyAccounts() {
    console.log('[AccountsService] Migrating legacy calendar accounts...');
    
    // Dynamically discover accounts from gog CLI instead of hardcoding
    let knownAccounts: string[] = [];
    try {
      const gogList = await execAsync('/opt/homebrew/bin/gog auth list --json', {
        timeout: 5000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
      });
      const gogData = JSON.parse(gogList.stdout);
      knownAccounts = (gogData.accounts || []).map((a: any) => a.email).filter(Boolean);
    } catch {
      console.log('[AccountsService] Failed to discover gog accounts for migration');
    }

    for (const email of knownAccounts) {
      // Test if account works with gog CLI
      try {
        const result = await this.testGoogleAccount(email);
        if (result.success) {
          const account: ConnectedAccount = {
            id: `google-${email}`,
            provider: 'google',
            email,
            status: 'connected',
            dataTypes: ['calendar'],
            scopes: [{
              type: 'calendar',
              permission: 'read-write',
              description: 'Access Google Calendar events',
            }],
            authType: 'oauth',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: result.metadata,
          };
          this.accounts.push(account);
          console.log(`[AccountsService] Migrated ${email}`);
        }
      } catch (err) {
        console.error(`[AccountsService] Failed to migrate ${email}:`, err);
      }
    }

    if (this.accounts.length > 0) {
      this.saveAccounts();
    }
  }

  /**
   * Save accounts to disk
   */
  private saveAccounts() {
    try {
      fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2));
      console.log(`[AccountsService] Saved ${this.accounts.length} accounts`);
    } catch (err) {
      console.error('[AccountsService] Failed to save accounts:', err);
    }
  }

  /**
   * List all accounts
   */
  async listAccounts() {
    // Compute stats
    const stats = {
      totalAccounts: this.accounts.length,
      connectedAccounts: this.accounts.filter(a => a.status === 'connected').length,
      accountsByProvider: {} as Record<AccountProvider, number>,
      accountsByDataType: {} as Record<DataType, number>,
    };

    this.accounts.forEach(account => {
      stats.accountsByProvider[account.provider] = (stats.accountsByProvider[account.provider] || 0) + 1;
      account.dataTypes.forEach(type => {
        stats.accountsByDataType[type] = (stats.accountsByDataType[type] || 0) + 1;
      });
    });

    return {
      success: true,
      accounts: this.accounts,
      stats,
    };
  }

  /**
   * Add a new account
   */
  async addAccount(request: {
    provider: AccountProvider;
    email: string;
    dataTypes: DataType[];
    authType: 'oauth' | 'app-password';
    appPassword?: string;
  }) {
    try {
      console.log(`[AccountsService] Adding ${request.provider} account: ${request.email}`);

      // Check if account already exists
      const existing = this.accounts.find(a => a.email === request.email && a.provider === request.provider);
      if (existing) {
        return {
          success: false,
          error: 'Account already exists',
        };
      }

      // Provider-specific authentication
      let authResult;
      if (request.provider === 'google') {
        authResult = await this.authenticateGoogle(request);
      } else if (request.provider === 'icloud') {
        authResult = await this.authenticateICloud(request);
      } else {
        return {
          success: false,
          error: `Provider ${request.provider} not yet implemented`,
        };
      }

      if (!authResult.success) {
        return authResult;
      }

      // Create account object
      const account: ConnectedAccount = {
        id: `${request.provider}-${request.email}`,
        provider: request.provider,
        email: request.email,
        status: 'connected',
        dataTypes: request.dataTypes,
        scopes: this.generateScopes(request.dataTypes),
        authType: request.authType,
        tokenPath: 'tokenPath' in authResult ? authResult.tokenPath : undefined,
        metadata: 'metadata' in authResult ? authResult.metadata : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.accounts.push(account);
      this.saveAccounts();

      console.log(`[AccountsService] Added account: ${account.id}`);

      return {
        success: true,
        account,
      };
    } catch (err: any) {
      console.error('[AccountsService] Add account error:', err);
      return {
        success: false,
        error: err.message || 'Failed to add account',
      };
    }
  }

  /**
   * Authenticate Google account via gog CLI
   */
  private async authenticateGoogle(request: any) {
    try {
      // For Google, we rely on gog CLI OAuth flow
      // gog automatically handles OAuth and stores tokens
      
      // Test the account works
      const testResult = await this.testGoogleAccount(request.email);
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error || 'Failed to authenticate with Google',
        };
      }

      return {
        success: true,
        tokenPath: undefined,  // gog CLI manages tokens internally
        metadata: testResult.metadata,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Google authentication failed',
      };
    }
  }

  /**
   * Test Google account connection
   */
  private async testGoogleAccount(email: string) {
    try {
      // Test calendar access
      const calCmd = `GOG_ACCOUNT=${email} gog calendar calendars --json`;
      const { stdout } = await execAsync(calCmd, {
        env: { ...process.env, GOG_ACCOUNT: email },
        timeout: 10000,
      });

      const data = JSON.parse(stdout || '{}');
      const calendarsCount = data.calendars?.length || 0;

      return {
        success: true,
        metadata: {
          calendarsCount,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to connect to Google',
      };
    }
  }

  /**
   * Authenticate iCloud account (app-specific password)
   */
  private async authenticateICloud(request: any) {
    // TODO: Implement iCloud authentication
    // This would involve storing app-specific password securely
    // and testing connection to iCloud services
    return {
      success: false,
      error: 'iCloud authentication not yet implemented',
    };
  }

  /**
   * Test account connection
   */
  async testAccount(accountId: string) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    try {
      if (account.provider === 'google') {
        const result = await this.testGoogleAccount(account.email);
        
        // Update account status
        account.status = result.success ? 'connected' : 'error';
        account.lastChecked = Date.now();
        account.errorMessage = result.error;
        account.metadata = result.success ? result.metadata : account.metadata;
        account.updatedAt = Date.now();
        
        this.saveAccounts();

        return {
          success: result.success,
          account: account.email,
          metadata: result.metadata,
          error: result.error,
        };
      }

      return { success: false, error: 'Provider not supported' };
    } catch (err: any) {
      account.status = 'error';
      account.lastChecked = Date.now();
      account.errorMessage = err.message;
      this.saveAccounts();

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Remove account
   */
  async removeAccount(accountId: string) {
    const index = this.accounts.findIndex(a => a.id === accountId);
    if (index === -1) {
      return { success: false, error: 'Account not found' };
    }

    const account = this.accounts[index];
    console.log(`[AccountsService] Removing account: ${accountId}`);

    // Delete token file if exists
    if (account.tokenPath && fs.existsSync(account.tokenPath)) {
      try {
        fs.unlinkSync(account.tokenPath);
      } catch (err) {
        console.error('[AccountsService] Failed to delete token file:', err);
      }
    }

    // Remove from list
    this.accounts.splice(index, 1);
    this.saveAccounts();

    return {
      success: true,
      message: `Account ${account.email} removed`,
    };
  }

  /**
   * Generate scopes based on data types
   */
  private generateScopes(dataTypes: DataType[]) {
    const scopeMap: Record<DataType, any> = {
      email: {
        type: 'email',
        permission: 'read-write',
        description: 'Read and send emails, manage inbox',
      },
      calendar: {
        type: 'calendar',
        permission: 'read-write',
        description: 'View and create calendar events',
      },
      drive: {
        type: 'drive',
        permission: 'read-write',
        description: 'Access files and documents',
      },
      contacts: {
        type: 'contacts',
        permission: 'read',
        description: 'Read contact information',
      },
      tasks: {
        type: 'tasks',
        permission: 'read-write',
        description: 'Manage tasks and to-dos',
      },
    };

    return dataTypes.map(type => scopeMap[type]);
  }

  /**
   * Get account by email
   */
  getAccount(email: string) {
    return this.accounts.find(a => a.email === email);
  }

  /**
   * Get accounts by provider
   */
  getAccountsByProvider(provider: AccountProvider) {
    return this.accounts.filter(a => a.provider === provider);
  }

  /**
   * Get accounts by data type
   */
  getAccountsByDataType(dataType: DataType) {
    return this.accounts.filter(a => a.dataTypes.includes(dataType));
  }
}

// Singleton instance
export const accountsService = new AccountsService();
