/**
 * Twitter OAuth 1.0a Service
 * 
 * Handles three-legged OAuth flow for X/Twitter API access
 * Enables tweet posting, liking, retweeting via x-api CLI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as https from 'https';
import * as querystring from 'querystring';
import * as fs from 'fs';
import { createLogger } from './utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('TwitterOAuth');

// Twitter API endpoints
const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

// OAuth credentials (loaded from environment or config)
const CONSUMER_KEY = process.env.X_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.X_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET || '';

// Callback URL for OAuth flow
const CALLBACK_URL = 'http://localhost:3000/oauth/twitter/callback';

interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
  screenName: string;
}

class TwitterOAuthService {
  private pendingOAuth: Map<string, { token: string; secret: string }> = new Map();

  /**
   * Check if Twitter OAuth credentials are configured
   */
  isConfigured(): boolean {
    return !!(CONSUMER_KEY && CONSUMER_SECRET);
  }

  /**
   * Generate OAuth signature (HMAC-SHA1)
   */
  private generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string = ''
  ): string {
    // 1. Sort parameters
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
      .join('&');

    // 2. Create signature base string
    const baseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams),
    ].join('&');

    // 3. Create signing key
    const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;

    // 4. Generate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    return signature;
  }

  /**
   * Percent-encode a string (RFC 3986)
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  /**
   * Generate OAuth authorization header
   */
  private generateAuthHeader(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string = ''
  ): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: crypto.randomBytes(32).toString('base64').replace(/\W/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
      ...params,
    };

    const signature = this.generateSignature(method, url, oauthParams, consumerSecret, tokenSecret);
    oauthParams.oauth_signature = signature;

    const headerParts = Object.keys(oauthParams)
      .filter(key => key.startsWith('oauth_'))
      .sort()
      .map(key => `${this.percentEncode(key)}="${this.percentEncode(oauthParams[key])}"`)
      .join(', ');

    return `OAuth ${headerParts}`;
  }

  /**
   * Make OAuth HTTP request
   */
  private async makeOAuthRequest(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string = ''
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const authHeader = this.generateAuthHeader(method, url, params, consumerSecret, tokenSecret);

      const options = {
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(querystring.parse(data));
          } else {
            reject(new Error(`OAuth request failed: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Step 1: Get request token
   */
  async getRequestToken(): Promise<{ token: string; secret: string; authUrl: string }> {
    if (!this.isConfigured()) {
      throw new Error('Twitter OAuth not configured. Set X_CONSUMER_KEY and X_CONSUMER_SECRET environment variables.');
    }

    const params = {
      oauth_callback: CALLBACK_URL,
    };

    try {
      const response = await this.makeOAuthRequest(
        'POST',
        REQUEST_TOKEN_URL,
        params,
        CONSUMER_SECRET
      );

      const token = response.oauth_token as string;
      const secret = response.oauth_token_secret as string;

      // Store for later use in step 3
      this.pendingOAuth.set(token, { token, secret });

      const authUrl = `${AUTHORIZE_URL}?oauth_token=${token}`;

      return { token, secret, authUrl };
    } catch (error: any) {
      throw new Error(`Failed to get request token: ${error.message}`);
    }
  }

  /**
   * Step 3: Exchange request token + verifier for access token
   */
  async getAccessToken(oauthToken: string, oauthVerifier: string): Promise<OAuthCredentials> {
    const pending = this.pendingOAuth.get(oauthToken);
    if (!pending) {
      throw new Error('Invalid OAuth token or session expired');
    }

    const params = {
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
    };

    try {
      const response = await this.makeOAuthRequest(
        'POST',
        ACCESS_TOKEN_URL,
        params,
        CONSUMER_SECRET,
        pending.secret
      );

      // Clean up pending
      this.pendingOAuth.delete(oauthToken);

      return {
        consumerKey: CONSUMER_KEY,
        consumerSecret: CONSUMER_SECRET,
        accessToken: response.oauth_token as string,
        accessTokenSecret: response.oauth_token_secret as string,
        userId: response.user_id as string,
        screenName: response.screen_name as string,
      };
    } catch (error: any) {
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Store credentials for x-api CLI usage
   */
  async storeCredentials(credentials: OAuthCredentials): Promise<void> {
    // Store as environment variables that x-api can read
    const credFile = `${process.env.HOME}/.x-api-credentials`;
    const content = [
      `# X/Twitter OAuth Credentials for x-api`,
      `# Generated: ${new Date().toISOString()}`,
      `# Account: @${credentials.screenName}`,
      `export X_CONSUMER_KEY="${credentials.consumerKey}"`,
      `export X_CONSUMER_SECRET="${credentials.consumerSecret}"`,
      `export X_ACCESS_TOKEN="${credentials.accessToken}"`,
      `export X_ACCESS_TOKEN_SECRET="${credentials.accessTokenSecret}"`,
      `export X_USER_ID="${credentials.userId}"`,
      `export X_SCREEN_NAME="${credentials.screenName}"`,
    ].join('\n');

    fs.writeFileSync(credFile, content, { mode: 0o600 });
    logger.info(`[TwitterOAuth] Credentials stored in ${credFile}`);
  }

  /**
   * Load stored credentials
   */
  async loadCredentials(): Promise<OAuthCredentials | null> {
    const credFile = `${process.env.HOME}/.x-api-credentials`;
    if (!fs.existsSync(credFile)) {
      return null;
    }

    try {
      const content = fs.readFileSync(credFile, 'utf-8');
      const lines = content.split('\n');
      const creds: any = {};

      lines.forEach((line: string) => {
        const match = line.match(/export (\w+)="(.+)"/);
        if (match) {
          creds[match[1]] = match[2];
        }
      });

      return {
        consumerKey: creds.X_CONSUMER_KEY,
        consumerSecret: creds.X_CONSUMER_SECRET,
        accessToken: creds.X_ACCESS_TOKEN,
        accessTokenSecret: creds.X_ACCESS_TOKEN_SECRET,
        userId: creds.X_USER_ID,
        screenName: creds.X_SCREEN_NAME,
      };
    } catch (error) {
      logger.error('[TwitterOAuth] Failed to load credentials:', error);
      return null;
    }
  }
}

export const twitterOAuthService = new TwitterOAuthService();
export type { OAuthCredentials };
