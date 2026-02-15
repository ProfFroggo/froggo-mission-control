/**
 * Calendar Aggregation Service
 * 
 * Unified calendar system that aggregates events from:
 * - Multiple Google Calendar accounts (via gog CLI)
 * - Mission Control schedule panel
 * - Future: Other calendar sources
 * 
 * Features:
 * - Caching to reduce API calls
 * - Unified event format
 * - Error handling per source
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
    organizer?: boolean;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      uri: string;
      entryPointType: string;
    }>;
  };
  htmlLink?: string;
  account?: string;
  source: 'google' | 'mission-control' | 'other';
  sourceAccount?: string;
}

interface CacheEntry {
  timestamp: number;
  events: CalendarEvent[];
}

interface CalendarCache {
  [key: string]: CacheEntry;
}

/**
 * Dynamically discover authenticated Google accounts from gog CLI.
 * Returns empty array if gog is unavailable (no hardcoded fallback).
 */
import { execSync } from 'child_process';

function getGoogleAccounts(): string[] {
  try {
    const gogList = execSync('/opt/homebrew/bin/gog auth list --json', {
      timeout: 5000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    }).toString();
    const gogData = JSON.parse(gogList);
    return (gogData.accounts || []).map((a: any) => a.email).filter(Boolean);
  } catch {
    return [];
  }
}

// Discovered at startup, refreshed when needed
const GOOGLE_ACCOUNTS: string[] = getGoogleAccounts();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_FILE_PATH = path.join(os.homedir(), 'clawd', 'data', 'calendar-cache.json');

class CalendarService {
  private cache: CalendarCache = {};
  private pendingFetches: Map<string, Promise<CalendarEvent[]>> = new Map();

  constructor() {
    this.loadCache();
  }

  /**
   * Load cache from disk
   */
  private loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        this.cache = JSON.parse(data);
        console.log('[CalendarService] Cache loaded from disk');
      }
    } catch (err) {
      console.error('[CalendarService] Failed to load cache:', err);
      this.cache = {};
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache() {
    try {
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
    } catch (err) {
      console.error('[CalendarService] Failed to save cache:', err);
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(key: string): boolean {
    const entry = this.cache[key];
    if (!entry) return false;
    
    const age = Date.now() - entry.timestamp;
    return age < CACHE_TTL_MS;
  }

  /**
   * Get cached events for a key
   */
  private getCached(key: string): CalendarEvent[] | null {
    if (this.isCacheValid(key)) {
      console.log(`[CalendarService] Cache hit for ${key}`);
      return this.cache[key].events;
    }
    return null;
  }

  /**
   * Set cache for a key
   */
  private setCache(key: string, events: CalendarEvent[]) {
    this.cache[key] = {
      timestamp: Date.now(),
      events
    };
    this.saveCache();
  }

  /**
   * Fetch events from a single Google account
   */
  private async fetchGoogleAccount(account: string, days: number = 30): Promise<CalendarEvent[]> {
    const cacheKey = `google:${account}:${days}`;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Check if fetch is already in progress
    if (this.pendingFetches.has(cacheKey)) {
      console.log(`[CalendarService] Waiting for pending fetch: ${cacheKey}`);
      return this.pendingFetches.get(cacheKey)!;
    }

    // Start new fetch
    const fetchPromise = (async () => {
      try {
        console.log(`[CalendarService] Fetching from ${account} (${days} days)`);
        
        const command = `GOG_ACCOUNT=${account} gog calendar events --days ${days} --json`;
        const { stdout, stderr } = await execAsync(command, {
          env: { ...process.env, GOG_ACCOUNT: account },
          timeout: 30000 // 30s timeout
        });

        if (stderr) {
          console.warn(`[CalendarService] Warning from ${account}:`, stderr);
        }

        if (!stdout || stdout.trim() === '') {
          console.log(`[CalendarService] No events from ${account}`);
          this.setCache(cacheKey, []);
          return [];
        }

        const data = JSON.parse(stdout);
        const events: CalendarEvent[] = (data.events || []).map((event: any) => ({
          ...event,
          account,
          source: 'google' as const,
          sourceAccount: account
        }));

        console.log(`[CalendarService] Fetched ${events.length} events from ${account}`);
        this.setCache(cacheKey, events);
        return events;
      } catch (err: any) {
        console.error(`[CalendarService] Failed to fetch from ${account}:`, err.message);
        // Return empty array on error (don't break entire aggregation)
        return [];
      } finally {
        this.pendingFetches.delete(cacheKey);
      }
    })();

    this.pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetch events from Mission Control schedule
   * TODO: Implement when Mission Control schedule format is defined
   */
  private async fetchMissionControl(): Promise<CalendarEvent[]> {
    const cacheKey = 'mission-control';
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // TODO: Implement Mission Control schedule fetching
    // For now, return empty array
    console.log('[CalendarService] Mission Control integration pending');
    return [];
  }

  /**
   * Aggregate events from all sources
   */
  async aggregateEvents(options: {
    days?: number;
    includeGoogle?: boolean;
    includeMissionControl?: boolean;
    accounts?: string[];
  } = {}): Promise<{
    events: CalendarEvent[];
    sources: {
      google: { [account: string]: number };
      missionControl: number;
    };
    errors: string[];
  }> {
    const {
      days = 30,
      includeGoogle = true,
      includeMissionControl = true,
      accounts = GOOGLE_ACCOUNTS
    } = options;

    const allEvents: CalendarEvent[] = [];
    const sources = {
      google: {} as { [account: string]: number },
      missionControl: 0
    };
    const errors: string[] = [];

    // Fetch from Google accounts
    if (includeGoogle) {
      const googlePromises = accounts.map(async (account) => {
        try {
          const events = await this.fetchGoogleAccount(account, days);
          sources.google[account] = events.length;
          return events;
        } catch (err: any) {
          errors.push(`Google (${account}): ${err.message}`);
          return [];
        }
      });

      const googleResults = await Promise.all(googlePromises);
      allEvents.push(...googleResults.flat());
    }

    // Fetch from Mission Control
    if (includeMissionControl) {
      try {
        const mcEvents = await this.fetchMissionControl();
        sources.missionControl = mcEvents.length;
        allEvents.push(...mcEvents);
      } catch (err: any) {
        errors.push(`Mission Control: ${err.message}`);
      }
    }

    // Sort events by start time
    allEvents.sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date!);
      const bStart = new Date(b.start.dateTime || b.start.date!);
      return aStart.getTime() - bStart.getTime();
    });

    console.log(`[CalendarService] Aggregated ${allEvents.length} events from ${Object.keys(sources.google).length} Google accounts`);

    return {
      events: allEvents,
      sources,
      errors
    };
  }

  /**
   * Clear cache for specific source or all
   */
  clearCache(source?: 'google' | 'mission-control' | 'all') {
    if (!source || source === 'all') {
      this.cache = {};
      console.log('[CalendarService] Cleared all cache');
    } else if (source === 'google') {
      Object.keys(this.cache).forEach(key => {
        if (key.startsWith('google:')) {
          delete this.cache[key];
        }
      });
      console.log('[CalendarService] Cleared Google cache');
    } else if (source === 'mission-control') {
      delete this.cache['mission-control'];
      console.log('[CalendarService] Cleared Mission Control cache');
    }
    this.saveCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Object.entries(this.cache);
    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([key]) => this.isCacheValid(key)).length,
      expiredEntries: entries.filter(([key]) => !this.isCacheValid(key)).length,
      entries: entries.map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        valid: this.isCacheValid(key),
        eventCount: entry.events.length
      }))
    };
  }
}

// Singleton instance
export const calendarService = new CalendarService();
