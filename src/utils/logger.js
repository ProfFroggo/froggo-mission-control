"use strict";
/**
 * Centralized Logger Service
 * Provides consistent logging with context prefixes and log level control
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.setLogLevel = setLogLevel;
exports.getLogLevel = getLogLevel;
const config = {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.NODE_ENV !== 'production',
};
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class Logger {
    constructor(context) {
        this.context = context;
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
    }
    formatMessage(level, message) {
        return `[${this.context}] ${message}`;
    }
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message), ...args);
        }
    }
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message), ...args);
        }
    }
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message), ...args);
        }
    }
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message), ...args);
        }
    }
}
/**
 * Create a logger instance for a specific context
 */
function createLogger(context) {
    return new Logger(context);
}
/**
 * Set global log level
 */
function setLogLevel(level) {
    config.level = level;
}
/**
 * Get current log level
 */
function getLogLevel() {
    return config.level;
}
exports.default = Logger;
