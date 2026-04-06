// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Mixpanel MCP Server — self-hosted, service-account auth (no OAuth).
// Replaces mcp-remote OAuth proxy with direct REST API access.
// Credentials from env vars or fetched from MC settings API at startup.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';

// ── Credentials ───────────────────────────────────────────────────────────────

let PROJECT_ID = process.env.MIXPANEL_PROJECT_ID || '';
let AUTH_HEADER = '';

/** Build Basic Auth header from service account credentials */
function buildAuth(username: string, secret: string): string {
  return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64');
}

/** Fetch credentials from MC settings API (fallback if env vars not set) */
async function fetchCredentialsFromMC(): Promise<boolean> {
  const keys = [
    'mixpanel_project_id',
    'mixpanel_service_account_username',
    'mixpanel_service_account_password',
  ];
  try {
    const token = process.env.INTERNAL_API_TOKEN || '';
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const results: Record<string, string> = {};
    for (const key of keys) {
      const res = await fetch(`http://127.0.0.1:3000/api/settings/${key}`, { headers });
      if (res.ok) {
        const data = await res.json() as { value?: string };
        results[key] = data.value ?? '';
      }
    }

    const pid = results['mixpanel_project_id'];
    const user = results['mixpanel_service_account_username'];
    const pass = results['mixpanel_service_account_password'];
    if (pid && user && pass) {
      PROJECT_ID = pid;
      AUTH_HEADER = buildAuth(user, pass);
      return true;
    }
  } catch (err) { console.warn('[tools/index] Non-critical: MC may not be running:', err); }
  return false;
}

/** Initialize credentials from env or MC settings */
async function initCredentials(): Promise<void> {
  const envUser = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME;
  const envPass = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  const envPid = process.env.MIXPANEL_PROJECT_ID;

  if (envUser && envPass && envPid) {
    PROJECT_ID = envPid;
    AUTH_HEADER = buildAuth(envUser, envPass);
    return;
  }

  // Try fetching from MC settings API
  const ok = await fetchCredentialsFromMC();
  if (!ok) {
    console.error('[mixpanel-mcp] No credentials found in env or MC settings. Tools will return errors.');
  }
}

// ── Mixpanel API helpers ──────────────────────────────────────────────────────

const BASE_URL = 'https://eu.mixpanel.com/api/2.0';

async function mpFetch(
  endpoint: string,
  params: Record<string, string> = {},
  method: 'GET' | 'POST' = 'GET',
  body?: string,
): Promise<any> {
  if (!AUTH_HEADER || !PROJECT_ID) {
    throw new Error('Mixpanel credentials not configured. Set them in Mission Control Settings > API Keys.');
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('project_id', PROJECT_ID);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    Authorization: AUTH_HEADER,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body || undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Mixpanel API ${endpoint} returned ${res.status}: ${errBody.slice(0, 300)}`);
  }

  return res.json();
}

/** Raw export uses a different base URL */
async function mpExport(params: Record<string, string>): Promise<string> {
  if (!AUTH_HEADER || !PROJECT_ID) {
    throw new Error('Mixpanel credentials not configured.');
  }

  const url = new URL('https://data-eu.mixpanel.com/api/2.0/export');
  url.searchParams.set('project_id', PROJECT_ID);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: AUTH_HEADER, Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Mixpanel export returned ${res.status}`);
  }

  // Export returns JSONL (one JSON object per line)
  return res.text();
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'mixpanel_query_events',
    description:
      'Query event counts over time. Returns daily/hourly/weekly counts for one or more events. ' +
      'Use for dashboards, trend analysis, and KPI tracking.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event name(s) to query, e.g. ["swap_confirmed_onchain", "users_created"]',
        },
        type: {
          type: 'string',
          enum: ['general', 'unique', 'average'],
          description: 'Count type: general (total), unique (unique users), average. Default: general',
        },
        unit: {
          type: 'string',
          enum: ['minute', 'hour', 'day', 'week', 'month'],
          description: 'Time unit for bucketing. Default: day',
        },
        interval: {
          type: 'number',
          description: 'Number of units to look back from today. Default: 7',
        },
        where: {
          type: 'string',
          description: 'Optional filter expression, e.g. properties["country"]=="US"',
        },
      },
      required: ['event'],
    },
  },
  {
    name: 'mixpanel_segmentation',
    description:
      'Run segmentation queries (sum, average, median, min, max) on numeric event properties. ' +
      'Essential for revenue, volume, and performance analysis. ' +
      'Example: sum of trade_transaction.fromAmountUSD over the last 30 days.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event: { type: 'string', description: 'Event name, e.g. "trade_transaction"' },
        on: {
          type: 'string',
          description: 'Property expression, e.g. properties["fromAmountUSD"]',
        },
        type: {
          type: 'string',
          enum: ['sum', 'average', 'median', 'min', 'max'],
          description: 'Aggregation type. Default: sum',
        },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        unit: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description: 'Time unit. Default: day',
        },
        where: { type: 'string', description: 'Optional filter expression' },
      },
      required: ['event', 'on', 'from_date', 'to_date'],
    },
  },
  {
    name: 'mixpanel_top_events',
    description: 'List the most common events in the project, ranked by volume.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['general', 'unique', 'average'],
          description: 'Count type. Default: general',
        },
        limit: { type: 'number', description: 'Max events to return. Default: 20' },
      },
    },
  },
  {
    name: 'mixpanel_event_properties',
    description: 'List top properties for a given event. Useful for discovering what data is tracked.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event: { type: 'string', description: 'Event name' },
        limit: { type: 'number', description: 'Max properties to return. Default: 20' },
      },
      required: ['event'],
    },
  },
  {
    name: 'mixpanel_property_values',
    description: 'List top values for a given event property. Shows what distinct values exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event: { type: 'string', description: 'Event name' },
        name: { type: 'string', description: 'Property name, e.g. "country" or "fromToken"' },
        limit: { type: 'number', description: 'Max values to return. Default: 50' },
      },
      required: ['event', 'name'],
    },
  },
  {
    name: 'mixpanel_funnel',
    description:
      'Analyze conversion funnels. Define a sequence of events and see conversion rates between steps. ' +
      'Requires a saved funnel ID from Mixpanel, or use mixpanel_query_events on individual steps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        funnel_id: { type: 'number', description: 'Saved funnel ID from Mixpanel' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        where: { type: 'string', description: 'Optional filter expression' },
        unit: { type: 'string', enum: ['day', 'week', 'month'], description: 'Default: day' },
      },
      required: ['funnel_id', 'from_date', 'to_date'],
    },
  },
  {
    name: 'mixpanel_retention',
    description:
      'Cohort retention analysis. Shows how users who did a born_event come back to do a return_event.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        born_event: { type: 'string', description: 'Entry event, e.g. "users_created"' },
        event: { type: 'string', description: 'Return event, e.g. "swap_confirmed_onchain"' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        born_where: { type: 'string', description: 'Optional filter on born event' },
        where: { type: 'string', description: 'Optional filter on return event' },
        retention_type: {
          type: 'string',
          enum: ['birth', 'compounding'],
          description: 'Default: birth',
        },
        unit: { type: 'string', enum: ['day', 'week', 'month'], description: 'Default: day' },
      },
      required: ['born_event', 'event', 'from_date', 'to_date'],
    },
  },
  {
    name: 'mixpanel_user_profiles',
    description:
      'Query user profiles (People/Engage). Search, filter, and retrieve user properties. ' +
      'Use for cohort analysis, user lookup, and audience sizing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        where: {
          type: 'string',
          description:
            'Filter expression on user properties, e.g. properties["$country_code"]=="MX". Empty string for all.',
        },
        output_properties: {
          type: 'array',
          items: { type: 'string' },
          description: 'Properties to return, e.g. ["$email", "$name", "$country_code"]. Default: all.',
        },
        page: { type: 'number', description: 'Page number (0-indexed). Default: 0' },
        limit: { type: 'number', description: 'Results per page (max 1000). Default: 100' },
      },
    },
  },
  {
    name: 'mixpanel_export_raw',
    description:
      'Export raw event data (JSONL). Returns individual events with all properties. ' +
      'Use for detailed analysis, debugging, or when aggregate queries are insufficient. ' +
      'WARNING: Can return large datasets — always use date range and event filter.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        event: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event name(s) to export. Strongly recommended to filter.',
        },
        where: { type: 'string', description: 'Optional filter expression' },
        limit: {
          type: 'number',
          description: 'Max lines to return (applied client-side). Default: 500',
        },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'mixpanel_insights',
    description:
      'Run a custom Insights query (the same query builder as the Mixpanel Insights report). ' +
      'Supports breakdowns, formulas, and complex aggregations via the JQL-like query format.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              event: { type: 'string' },
              type: { type: 'string', enum: ['general', 'unique', 'average'] },
              where: { type: 'string' },
            },
            required: ['event'],
          },
          description: 'Array of event queries',
        },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        group_by: {
          type: 'array',
          items: { type: 'string' },
          description: 'Properties to break down by, e.g. ["properties.$country_code"]',
        },
        unit: { type: 'string', enum: ['hour', 'day', 'week', 'month'] },
      },
      required: ['events', 'from_date', 'to_date'],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'mixpanel_query_events': {
      const events = args.event || [];
      const data = await mpFetch('events', {
        event: JSON.stringify(events),
        type: args.type || 'general',
        unit: args.unit || 'day',
        interval: String(args.interval || 7),
        ...(args.where ? { where: args.where } : {}),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_segmentation': {
      const segType = args.type || 'sum';
      const data = await mpFetch(`segmentation/${segType}`, {
        event: args.event,
        on: args.on,
        from_date: args.from_date,
        to_date: args.to_date,
        unit: args.unit || 'day',
        ...(args.where ? { where: args.where } : {}),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_top_events': {
      const data = await mpFetch('events/top', {
        type: args.type || 'general',
        limit: String(args.limit || 20),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_event_properties': {
      const data = await mpFetch('events/properties/top', {
        event: args.event,
        limit: String(args.limit || 20),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_property_values': {
      const data = await mpFetch('events/properties/values', {
        event: args.event,
        name: args.name,
        limit: String(args.limit || 50),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_funnel': {
      const data = await mpFetch(`funnels/${args.funnel_id}`, {
        from_date: args.from_date,
        to_date: args.to_date,
        unit: args.unit || 'day',
        ...(args.where ? { where: args.where } : {}),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_retention': {
      const data = await mpFetch('retention', {
        born_event: args.born_event,
        event: args.event,
        from_date: args.from_date,
        to_date: args.to_date,
        retention_type: args.retention_type || 'birth',
        unit: args.unit || 'day',
        ...(args.born_where ? { born_where: args.born_where } : {}),
        ...(args.where ? { where: args.where } : {}),
      });
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_user_profiles': {
      const body = new URLSearchParams();
      if (args.where) body.set('where', args.where);
      if (args.output_properties) body.set('output_properties', JSON.stringify(args.output_properties));
      body.set('page', String(args.page || 0));

      const data = await mpFetch('engage', {}, 'POST', body.toString());
      // Trim to requested limit
      const limit = args.limit || 100;
      if (data.results && data.results.length > limit) {
        data.results = data.results.slice(0, limit);
      }
      return JSON.stringify(data, null, 2);
    }

    case 'mixpanel_export_raw': {
      const params: Record<string, string> = {
        from_date: args.from_date,
        to_date: args.to_date,
      };
      if (args.event) params.event = JSON.stringify(args.event);
      if (args.where) params.where = args.where;

      const rawText = await mpExport(params);
      const lines = rawText.trim().split('\n');
      const limit = args.limit || 500;
      const truncated = lines.slice(0, limit);
      const result = {
        total_lines: lines.length,
        returned_lines: truncated.length,
        truncated: lines.length > limit,
        data: truncated.map((line) => {
          try { return JSON.parse(line); } catch { return line; }
        }),
      };
      return JSON.stringify(result, null, 2);
    }

    case 'mixpanel_insights': {
      // Insights is a composite — we run events queries with breakdowns
      const from = args.from_date;
      const to = args.to_date;
      const unit = args.unit || 'day';
      const events = args.events || [];

      const results: any[] = [];
      for (const ev of events) {
        const params: Record<string, string> = {
          event: JSON.stringify([ev.event]),
          type: ev.type || 'general',
          unit,
          from_date: from,
          to_date: to,
        };
        if (ev.where) params.where = ev.where;

        if (args.group_by && args.group_by.length > 0) {
          // Use segmentation for breakdowns
          const segParams: Record<string, string> = {
            event: ev.event,
            on: args.group_by[0],
            from_date: from,
            to_date: to,
            unit,
            type: 'general',
          };
          if (ev.where) segParams.where = ev.where;
          const data = await mpFetch('segmentation', segParams);
          results.push({ event: ev.event, breakdown: args.group_by[0], data });
        } else {
          const data = await mpFetch('events', params);
          results.push({ event: ev.event, data });
        }
      }

      return JSON.stringify({ insights: results }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP Server ────────────────────────────────────────────────────────────────

async function main() {
  await initCredentials();

  const server = new Server(
    { name: 'mixpanel-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleTool(name, args || {});
      return { content: [{ type: 'text', text: result }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // If it's a credential error, try refreshing from MC settings
      if (msg.includes('not configured') || msg.includes('401')) {
        const refreshed = await fetchCredentialsFromMC();
        if (refreshed) {
          try {
            const retryResult = await handleTool(name, args || {});
            return { content: [{ type: 'text', text: retryResult }] };
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            return { content: [{ type: 'text', text: `Error after credential refresh: ${retryMsg}` }], isError: true };
          }
        }
      }

      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[mixpanel-mcp] Fatal:', err);
  process.exit(1);
});
