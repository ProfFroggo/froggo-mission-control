/**
 * Connected Accounts Type Definitions
 * 
 * Unified account system for all external integrations
 */

export type AccountProvider = 'google' | 'icloud' | 'microsoft' | 'apple';

export type DataType = 'email' | 'calendar' | 'drive' | 'contacts' | 'tasks';

export interface AccountScope {
  type: DataType;
  permission: 'read' | 'write' | 'read-write';
  description: string;
}

export interface ConnectedAccount {
  id: string;
  provider: AccountProvider;
  email: string;
  displayName?: string;
  profilePicture?: string;
  
  // Connection status
  status: 'connected' | 'error' | 'checking' | 'needs-reauth';
  lastChecked?: number;
  errorMessage?: string;
  
  // Data types enabled
  dataTypes: DataType[];
  scopes: AccountScope[];
  
  // Provider-specific data
  metadata?: {
    // Google
    calendarsCount?: number;
    labelsCount?: number;
    emailQuota?: string | number;
    emailUsed?: number;
    calendarQuota?: string | number;
    calendarUsed?: number;
    driveUsed?: string | number;
    driveQuota?: string | number;
    emailsCount?: number;
    taskssCount?: number;
    contactssCount?: number;
    drivesCount?: number;
    
    // iCloud
    devices?: string[];
    
    // Microsoft
    tenantId?: string;
    
    [key: string]: any;
  };
  
  // Auth data (stored securely)
  authType: 'oauth' | 'app-password' | 'manual';
  tokenPath?: string; // Path to encrypted token file
  
  createdAt: number;
  updatedAt: number;
}

export interface AccountStats {
  totalAccounts: number;
  connectedAccounts: number;
  accountsByProvider: Record<AccountProvider, number>;
  accountsByDataType: Record<DataType, number>;
}

export interface AddAccountRequest {
  provider: AccountProvider;
  email: string;
  dataTypes: DataType[];
  authType: 'oauth' | 'app-password' | 'manual';
  
  // For OAuth flow
  redirectUri?: string;
  
  // For manual/app-password
  password?: string;
  appPassword?: string;
}

export interface AccountTestResult {
  success: boolean;
  account: string;
  dataTypes: {
    [key in DataType]?: {
      available: boolean;
      count?: number;
      error?: string;
    };
  };
  suggestions?: string[];
}
