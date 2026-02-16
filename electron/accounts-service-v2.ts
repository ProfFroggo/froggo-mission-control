/**
 * Connected Accounts Service V2
 * 
 * Improved account management with OAuth status detection and renewal
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger';

const execAsync = promisify(exec);
const logger = createLogger('AccountsServiceV2');

export interface ConnectedAccount {
  id: string;
  accountType: 'google' | 'icloud' | 'microsoft' | 'outlook';
  email: string;
  authStatus: 'connected' | 'expired' | 'error';
  dataTypes: string[];
  grantedScopes: string[];
  skillName?: string;
  createdAt: number;
  updatedAt: number;
  lastChecked?: number;
  lastSyncTime?: number;
  errorMessage?: string;
}

class AccountsServiceV2 {
  /**
   * List all Google accounts from gog CLI with OAuth status
   */
  async listAccounts(): Promise<{ success: boolean; accounts?: ConnectedAccount[]; error?: string }> {
    try {
      logger.info('[AccountsV2] Fetching accounts from gog CLI...');
      
      // Get accounts from gog auth list
      const { stdout: listOutput } = await execAsync('gog auth list --json', {
        timeout: 10000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` },
      });

      const listData = JSON.parse(listOutput || '{}');
      const gogAccounts = listData.accounts || [];

      if (gogAccounts.length === 0) {
        logger.info('[AccountsV2] No accounts found in gog');
        return { success: true, accounts: [] };
      }

      // Test each account's OAuth status
      interface GogAccount {
        email: string;
        created_at?: string;
        services?: string[];
        scopes?: string[];
      }
      const accountPromises = gogAccounts.map(async (gogAccount: GogAccount) => {
        const email = gogAccount.email;
        const createdAt = gogAccount.created_at ? new Date(gogAccount.created_at).getTime() : Date.now();

        // Test OAuth validity by making a simple API call
        const authStatus = await this.testAccountOAuth(email);

        const account: ConnectedAccount = {
          id: `google-${email}`,
          accountType: 'google',
          email,
          authStatus,
          dataTypes: this.mapServicesToDataTypes(gogAccount.services || []),
          grantedScopes: gogAccount.scopes || [],
          skillName: 'gog',
          createdAt,
          updatedAt: Date.now(),
          lastChecked: Date.now(),
          lastSyncTime: Date.now(),
        };

        return account;
      });

      const accounts = await Promise.all(accountPromises);
      
      logger.info(`[AccountsV2] Loaded ${accounts.length} accounts with OAuth status`);
      return { success: true, accounts };
    } catch (error) {
      logger.error('[AccountsV2] Error listing accounts:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list accounts',
        accounts: []
      };
    }
  }

  /**
   * Test account OAuth validity by making a simple API call
   */
  private async testAccountOAuth(email: string): Promise<'connected' | 'expired' | 'error'> {
    try {
      // Try a simple Gmail labels call to test OAuth
      const { stdout } = await execAsync(`gog gmail labels --account "${email}" --json`, {
        timeout: 5000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` },
      });

      const data = JSON.parse(stdout || '{}');
      
      // If we got labels back, OAuth is valid
      if (data.labels || Array.isArray(data)) {
        return 'connected';
      }

      return 'error';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check for OAuth-specific errors
      if (errorMsg.includes('invalid_grant') || 
          errorMsg.includes('Token has been expired') ||
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('401')) {
        logger.info(`[AccountsV2] OAuth expired for ${email}`);
        return 'expired';
      }

      logger.error(`[AccountsV2] OAuth test error for ${email}:`, errorMsg);
      return 'error';
    }
  }

  /**
   * Refresh/renew OAuth for an account
   */
  async refreshAccount(accountId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Extract email from accountId (format: google-email@example.com)
      const email = accountId.replace('google-', '');
      
      logger.info(`[AccountsV2] Refreshing OAuth for ${email}...`);
      
      // Run gog auth add to renew OAuth (will open browser)
      await execAsync(`gog auth add "${email}"`, {
        timeout: 120000, // 2 minute timeout for user to complete OAuth in browser
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` },
      });

      logger.info(`[AccountsV2] OAuth renewal complete for ${email}`);
      
      // Test if renewal was successful
      const authStatus = await this.testAccountOAuth(email);
      
      if (authStatus === 'connected') {
        return {
          success: true,
          message: `OAuth renewed successfully for ${email}`,
        };
      } else {
        return {
          success: false,
          error: `OAuth renewal completed but account still shows as ${authStatus}`,
        };
      }
    } catch (error) {
      logger.error('[AccountsV2] Error refreshing account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh account',
      };
    }
  }

  /**
   * Remove an account (revoke OAuth)
   */
  async removeAccount(accountId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const email = accountId.replace('google-', '');
      
      logger.info(`[AccountsV2] Removing account ${email}...`);
      
      await execAsync(`gog auth remove "${email}"`, {
        timeout: 10000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` },
      });

      return {
        success: true,
        message: `Account ${email} removed successfully`,
      };
    } catch (error) {
      logger.error('[AccountsV2] Error removing account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove account',
      };
    }
  }

  /**
   * Add a new account (trigger OAuth flow)
   */
  async addAccount(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info(`[AccountsV2] Adding account ${email}...`);
      
      await execAsync(`gog auth add "${email}"`, {
        timeout: 120000, // 2 minutes for OAuth flow
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` },
      });

      // Test if account was added successfully
      const authStatus = await this.testAccountOAuth(email);
      
      if (authStatus === 'connected') {
        return {
          success: true,
          message: `Account ${email} added successfully`,
        };
      } else {
        return {
          success: false,
          error: `Account added but showing status: ${authStatus}`,
        };
      }
    } catch (error) {
      logger.error('[AccountsV2] Error adding account:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add account',
      };
    }
  }

  /**
   * Map gog services to data types for UI
   */
  private mapServicesToDataTypes(services: string[]): string[] {
    const dataTypes: string[] = [];
    
    if (services.includes('gmail')) dataTypes.push('email');
    if (services.includes('calendar')) dataTypes.push('calendar');
    if (services.includes('drive')) dataTypes.push('drive');
    if (services.includes('contacts')) dataTypes.push('contacts');
    if (services.includes('tasks')) dataTypes.push('tasks');
    
    return dataTypes;
  }
}

// Singleton instance
export const accountsServiceV2 = new AccountsServiceV2();
