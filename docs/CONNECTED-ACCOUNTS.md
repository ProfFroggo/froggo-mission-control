# Connected Accounts System

## Overview

The Connected Accounts system transforms the simple "Calendar Accounts" section into a comprehensive hub for managing all external integrations. It provides a unified interface for connecting and managing Gmail, iCloud, Calendar, Drive, Contacts, and more.

## Features

### ✨ Core Capabilities

- **Multi-Provider Support**: Google, iCloud, Microsoft, Apple
- **Multiple Data Types**: Email, Calendar, Drive, Contacts, Tasks
- **Smart Status Monitoring**: Real-time connection testing and health checks
- **Interactive Add Account Wizard**: Step-by-step guided account setup
- **Detailed Permissions View**: See exactly what Froggo can access and why
- **OAuth & App-Password Auth**: Secure authentication methods
- **Encrypted Token Storage**: System keychain integration

### 🎯 User Experience

- **Data Type Badges**: Each account shows which services are connected (Email | Calendar | Drive)
- **Account Detail Modal**: Click any account to see permissions, scopes, and connection status
- **Interactive Wizard**: Guided flow for adding new accounts with permission explanations
- **Provider Filtering**: Filter by Google, iCloud, Microsoft, or Apple
- **Service Filtering**: Show only accounts with specific data types
- **Quick Actions**: Test connection, refresh, or remove accounts with one click

## Architecture

### Frontend Components

```
src/components/
├── ConnectedAccountsPanel.tsx    # Main panel with account list
├── AccountDetailModal.tsx        # Detail view showing permissions
└── AddAccountWizard.tsx          # Interactive account addition wizard

src/types/
└── accounts.ts                   # TypeScript interfaces
```

### Backend Services

```
electron/
├── accounts-service.ts           # Core account management service
├── main.ts                       # IPC handlers (accounts:*)
└── preload.ts                    # Renderer API exposure
```

### Key Files

- **Type Definitions**: `src/types/accounts.ts`
- **Service Logic**: `electron/accounts-service.ts`
- **IPC Handlers**: `electron/main.ts` (accounts:list, accounts:add, accounts:test, accounts:remove)
- **Preload API**: `electron/preload.ts` (window.clawdbot.accounts)

## Usage

### Keyboard Shortcut

Press **⌘0** (Command+0) to open Connected Accounts panel

### Adding an Account

1. Click "Add Account" button
2. **Step 1: Provider** - Choose Google, iCloud, Microsoft, or Apple
3. **Step 2: Email** - Enter account email or select from known accounts
4. **Step 3: Services** - Select which data types to connect (Email, Calendar, Drive, etc.)
5. **Step 4: Auth** - Complete OAuth flow or enter app-specific password
6. **Done!** - Account is connected and tested

### Managing Accounts

- **View Details**: Click any account card to see full permissions and connection info
- **Test Connection**: Click refresh icon to verify account is working
- **Remove Account**: Click trash icon to revoke access and delete credentials

### Security Tab

Each account detail modal has a Security tab showing:
- Token storage (encrypted)
- OAuth protocol status
- Token refresh status
- Links to provider security settings

## Data Model

### ConnectedAccount Interface

```typescript
interface ConnectedAccount {
  id: string;                    // Unique identifier
  provider: AccountProvider;     // google | icloud | microsoft | apple
  email: string;                 // Account email
  displayName?: string;          // Optional display name
  
  // Connection status
  status: 'connected' | 'error' | 'checking' | 'needs-reauth';
  lastChecked?: number;
  errorMessage?: string;
  
  // Data types enabled
  dataTypes: DataType[];         // email, calendar, drive, contacts, tasks
  scopes: AccountScope[];        // Detailed permissions
  
  // Provider-specific data
  metadata?: {
    calendarsCount?: number;
    labelsCount?: number;
    devices?: string[];
  };
  
  // Auth data
  authType: 'oauth' | 'app-password' | 'manual';
  tokenPath?: string;           // Path to encrypted token
  
  createdAt: number;
  updatedAt: number;
}
```

### Data Types

- **email**: Read and send emails, manage inbox
- **calendar**: View and create events, set reminders
- **drive**: Access files, create documents, sync data
- **contacts**: Read contact information
- **tasks**: Sync tasks, create reminders, track progress

### Providers

- **Google**: Gmail, Calendar, Drive, Contacts (via gog CLI)
- **iCloud**: Mail, Calendar, Contacts (app-specific password)
- **Microsoft**: Outlook, Calendar, OneDrive, Contacts, Tasks (future)
- **Apple**: iCloud Mail, Calendar, Contacts (future)

## Backend Integration

### IPC Handlers

```typescript
// List all accounts with stats
window.clawdbot.accounts.list()
  → { success: true, accounts: ConnectedAccount[], stats: AccountStats }

// Add new account
window.clawdbot.accounts.add({
  provider: 'google',
  email: 'kevin@example.com',
  dataTypes: ['email', 'calendar'],
  authType: 'oauth'
})
  → { success: true, account: ConnectedAccount }

// Test account connection
window.clawdbot.accounts.test('google-kevin@example.com')
  → { success: true, metadata: {...} }

// Remove account
window.clawdbot.accounts.remove('google-kevin@example.com')
  → { success: true, message: '...' }
```

### Service Methods

The `AccountsService` class provides:

- **listAccounts()**: Get all accounts with stats
- **addAccount(request)**: Add and authenticate new account
- **testAccount(accountId)**: Verify connection works
- **removeAccount(accountId)**: Revoke access and cleanup
- **getAccount(email)**: Find account by email
- **getAccountsByProvider(provider)**: Filter by provider
- **getAccountsByDataType(type)**: Filter by data type

### Storage

- **Accounts**: `~/clawd/data/connected-accounts.json`
- **Tokens**: `~/clawd/data/tokens/` (encrypted)
- **Encryption Key**: `~/clawd/data/.account-key` (32-byte key, mode 0600)

## Google Integration (gog CLI)

The Google provider integrates with the existing `gog` CLI:

### OAuth Flow

1. User selects Google provider
2. System calls `gog` OAuth flow
3. gog handles browser authentication
4. Tokens stored in `~/Library/Application Support/gogcli/`
5. Service verifies connection by listing calendars

### Testing

```bash
# Test calendar access
GOG_ACCOUNT=kevin@example.com gog calendar calendars --json

# Result: { calendars: [...] }
```

### Known Accounts

Pre-configured Google accounts (auto-detected):
- kevin.macarthur@bitso.com
- kevin@carbium.io
- kmacarthur.gpt@gmail.com

## Migration

### Legacy Calendar Accounts

The service automatically migrates existing calendar accounts on first load:

1. Checks known Google accounts
2. Tests each with gog CLI
3. Converts working accounts to ConnectedAccount format
4. Saves to new accounts file

### Backward Compatibility

Old calendar IPC handlers still work:
- `calendar:listAccounts`
- `calendar:addAccount`
- `calendar:removeAccount`
- `calendar:testConnection`

## UI Components

### ConnectedAccountsPanel

Main panel showing:
- Stats cards (Total, Connected, Providers, Data Types)
- Filter dropdowns (Provider, Data Type)
- Account cards with badges
- Status indicators
- Quick action buttons

### AccountDetailModal

Three tabs:
1. **Overview**: Services, connection details, metadata
2. **Permissions**: Granted scopes with explanations
3. **Security**: Token storage, OAuth status, provider links

### AddAccountWizard

Progressive steps:
1. **Provider Selection**: Choose provider with logo
2. **Email Entry**: Type or select known account
3. **Data Type Selection**: Choose services with icons
4. **Authentication**: OAuth browser flow or app password
5. **Connecting**: Progress indicator
6. **Success**: Confirmation with account details

## Security

### Encryption

- OAuth tokens encrypted using system keychain
- Encryption key stored with 0600 permissions
- Tokens never stored in plain text

### OAuth Security

- Browser-based authentication (credentials never pass through app)
- Automatic token refresh
- Secure HTTPS connections
- No third-party data sharing

### Token Management

- Tokens auto-refresh when expired
- Removing account immediately revokes access
- Token files deleted on account removal

## Error Handling

### Connection Errors

- Accounts marked as 'error' status
- Error message displayed in UI
- User can test connection to diagnose
- Suggestions provided for common issues

### OAuth Failures

- Clear error messages
- Retry option
- Link to provider help docs

### App Password Issues

- Validation before submission
- Format guidance
- Link to generate new password

## Future Enhancements

### Phase 2: iCloud Integration

- App-specific password support
- iCloud Mail, Calendar, Contacts
- Device sync status

### Phase 3: Microsoft Integration

- Microsoft OAuth
- Outlook, Calendar, OneDrive
- Teams integration

### Phase 4: Advanced Features

- Sync history timeline
- Data usage stats
- Selective sync controls
- Multi-account merge view

## Testing

### Manual Tests

1. **Add Google Account**
   - OAuth flow completes
   - Account appears in list
   - Status shows "connected"
   - Calendars count accurate

2. **Test Connection**
   - Click refresh on account
   - Status updates correctly
   - Metadata refreshes

3. **View Details**
   - All tabs load correctly
   - Permissions displayed
   - Security info accurate

4. **Remove Account**
   - Confirmation dialog shown
   - Account removed from list
   - Credentials deleted

### Automated Tests (future)

```bash
# Test account service
npm test accounts-service

# Test IPC handlers
npm test ipc-accounts

# Test UI components
npm test ConnectedAccountsPanel
```

## Troubleshooting

### "Account not authenticated"

1. Click "Test Connection"
2. If fails, try removing and re-adding
3. Check gog CLI works: `gog calendar calendars`

### "OAuth failed"

1. Ensure default browser is set
2. Check internet connection
3. Try incognito/private window
4. Clear browser cookies for Google

### "Token expired"

1. Should auto-refresh
2. If stuck, remove and re-add account
3. Check system time is correct

## Development

### Adding a New Provider

1. **Update Types** (`src/types/accounts.ts`):
   ```typescript
   type AccountProvider = 'google' | 'icloud' | 'microsoft' | 'newprovider';
   ```

2. **Add Provider Info** (`ConnectedAccountsPanel.tsx`):
   ```typescript
   const PROVIDER_INFO = {
     newprovider: {
       name: 'NewProvider',
       color: '#123456',
       logo: '🆕',
       supportedTypes: ['email', 'calendar'],
     },
   };
   ```

3. **Implement Auth** (`accounts-service.ts`):
   ```typescript
   private async authenticateNewProvider(request: any) {
     // Implement OAuth or app-password flow
   }
   ```

4. **Add Test Method**:
   ```typescript
   private async testNewProviderAccount(email: string) {
     // Verify connection works
   }
   ```

### Adding a New Data Type

1. **Update Type**:
   ```typescript
   type DataType = 'email' | 'calendar' | 'drive' | 'contacts' | 'tasks' | 'newtype';
   ```

2. **Add Icon & Label**:
   ```typescript
   const DATA_TYPE_ICONS = {
     newtype: NewIcon,
   };
   ```

3. **Update Scopes**:
   ```typescript
   const scopeMap = {
     newtype: {
       type: 'newtype',
       permission: 'read-write',
       description: 'Description of what this grants',
     },
   };
   ```

## Support

For issues or questions:
- Check TROUBLESHOOTING.md
- Review froggo-db logs
- Test gog CLI directly
- Check Dashboard console logs

---

**Status**: ✅ Complete (task-1769595949000)
**Priority**: P1
**Keyboard Shortcut**: ⌘0
