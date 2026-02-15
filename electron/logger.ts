/**
 * Safe Logger Module
 * 
 * EPIPE-proof logging that doesn't crash on stream errors
 */

export const safeLog = {
  log: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.log(...args);
      }
    } catch (e: any) {
      // Silently ignore EPIPE and other stream errors
    }
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch (e: any) {
      // Silently ignore stream errors
    }
  },
  warn: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.warn(...args);
      }
    } catch (e: any) {
      // Silently ignore stream errors
    }
  }
};
