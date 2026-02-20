/**
 * IPC Handlers Index
 * 
 * Central export for all IPC handler modules.
 * Import this in main.ts to register all handlers.
 */

export { registerAgentHandlers } from './agent-handlers';
// x-twitter-handlers.ts removed (dead code — all handlers are in main.ts)
export { registerFinanceHandlers } from '../finance-service';
// Future handlers to be added:
// export { registerTaskHandlers } from './task-handlers';
// export { registerSecurityHandlers } from './security-handlers';
// export { registerChatHandlers } from './chat-handlers';
// export { registerExportHandlers } from './export-handlers';
// export { registerNotificationHandlers } from './notification-handlers';
// export { registerSettingsHandlers } from './settings-handlers';
// export { registerVoiceHandlers } from './voice-handlers';
// export { registerMediaHandlers } from './media-handlers';
export { registerToolbarHandlers } from './toolbar-handlers';
export { registerPinsHandlers } from './pins-handlers';
