/**
 * IPC Handlers Index
 * 
 * Central export for all IPC handler modules.
 * Import this in main.ts to register all handlers.
 */

export { registerAgentHandlers } from './agent-handlers';
export { registerXTwitterHandlers } from './x-twitter-handlers';
export { registerTaskHandlers } from './task-handlers';
export { registerFinanceHandlers } from '../finance-service';
// export { registerSecurityHandlers } from './security-handlers';
// export { registerChatHandlers } from './chat-handlers';
// export { registerExportHandlers } from './export-handlers';
// export { registerNotificationHandlers } from './notification-handlers';
// export { registerSettingsHandlers } from './settings-handlers';
// export { registerVoiceHandlers } from './voice-handlers';
// export { registerMediaHandlers } from './media-handlers';
export { registerToolbarHandlers } from './toolbar-handlers';
// pins-handlers.ts superseded by schedule-handlers.ts (pins included there)
export { registerCommsHandlers, startCommsPolling, startEmailAutoCheck } from './comms-handlers';
export { registerCalendarHandlers } from './calendar-handlers';
export { registerScheduleHandlers } from './schedule-handlers';
