/**
 * IPC Handlers Index
 *
 * Central export for all IPC handler modules.
 * Import registerAllHandlers() in main.ts to register everything.
 */

export { registerAgentHandlers } from './agent-handlers';
export { registerNotificationHandlers } from './notification-handlers';
export { registerSettingsHandlers } from './settings-handlers';
export { registerToolbarHandlers } from './toolbar-handlers';
export { registerChatHandlers } from './chat-handlers';
export { registerSecurityHandlers } from './security-handlers';
export { registerExportHandlers } from './export-handlers';
export { registerAnalyticsHandlers } from './analytics-handlers';
export { registerAiHandlers } from './ai-handlers';
export { registerMediaHandlers } from './media-handlers';
export { registerFinanceAgentHandlers } from './finance-agent-handlers';
export { registerMiscHandlers } from './misc-handlers';
export { registerXTwitterHandlers } from './x-twitter-handlers';
export { registerTaskHandlers } from './task-handlers';
export { registerCommsHandlers, startCommsPolling, startEmailAutoCheck } from './comms-handlers';
export { registerCalendarHandlers } from './calendar-handlers';
export { registerScheduleHandlers } from './schedule-handlers';
export { registerModuleCredentialHandlers, registerModuleIntegrationHandlers } from './module-handlers';

import { registerAgentHandlers } from './agent-handlers';
import { registerNotificationHandlers } from './notification-handlers';
import { registerSettingsHandlers } from './settings-handlers';
import { registerToolbarHandlers } from './toolbar-handlers';
import { registerChatHandlers } from './chat-handlers';
import { registerSecurityHandlers } from './security-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerAnalyticsHandlers } from './analytics-handlers';
import { registerAiHandlers } from './ai-handlers';
import { registerMediaHandlers } from './media-handlers';
import { registerFinanceAgentHandlers } from './finance-agent-handlers';
import { registerMiscHandlers } from './misc-handlers';
import { registerXTwitterHandlers } from './x-twitter-handlers';
import { registerTaskHandlers } from './task-handlers';
import { registerCommsHandlers } from './comms-handlers';
import { registerCalendarHandlers } from './calendar-handlers';
import { registerScheduleHandlers } from './schedule-handlers';
import { registerModuleCredentialHandlers, registerModuleIntegrationHandlers } from './module-handlers';

/**
 * Register ALL IPC handlers from all handler modules.
 * Call once in app.whenReady().
 */
export function registerAllHandlers(): void {
  // Wave 1 handlers
  registerXTwitterHandlers();
  registerTaskHandlers();

  // Wave 2 handlers
  registerCommsHandlers();
  registerCalendarHandlers();
  registerScheduleHandlers();

  // Wave 3 handlers
  registerAgentHandlers();
  registerNotificationHandlers();
  registerSettingsHandlers();
  registerToolbarHandlers();
  registerChatHandlers();
  registerSecurityHandlers();
  registerExportHandlers();
  registerAnalyticsHandlers();
  registerAiHandlers();
  registerMediaHandlers();
  registerFinanceAgentHandlers();
  registerMiscHandlers();
  registerModuleCredentialHandlers();
  registerModuleIntegrationHandlers();
}
