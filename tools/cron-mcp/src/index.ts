// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SCHEDULE_PATH = process.env.SCHEDULE_PATH || path.join(os.homedir(), 'mission-control/data/schedule.json');

function readSchedule() {
  try {
    if (!fs.existsSync(SCHEDULE_PATH)) return [];
    return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeSchedule(jobs: any[]) {
  fs.mkdirSync(path.dirname(SCHEDULE_PATH), { recursive: true });
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(jobs, null, 2));
}

const server = new Server(
  { name: 'mission-control-cron-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'schedule_task',
      description: 'Schedule a claude CLI command to run once at a specific Unix ms timestamp. Persists to ~/mission-control/data/schedule.json. The cron daemon checks this file on its tick interval. Use list_jobs to confirm the job was created and to retrieve its ID for cancellation.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          command: { type: 'string', description: 'The claude CLI command to run' },
          runAt: { type: 'number', description: 'Unix timestamp (ms) when to run' },
          label: { type: 'string', description: 'Human-readable label for this job' },
        },
        required: ['command', 'runAt'],
      },
    },
    {
      name: 'list_jobs',
      description: 'List all jobs in ~/mission-control/data/schedule.json. Filter by status: "pending" (not yet run), "executed" (completed), "cancelled". Returns job ID, label, runAt timestamp, and status. Use this to find job IDs before calling cancel_job.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          status: { type: 'string', description: 'Filter by status: pending, executed, cancelled' },
        },
      },
    },
    {
      name: 'cancel_job',
      description: 'Cancel a pending job by its ID (marks status="cancelled" in the schedule file). Only pending jobs can be cancelled — executed jobs are already done. Use list_jobs to find the job ID first. Returns an error message if the ID is not found.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Job ID to cancel' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'schedule_task') {
    const jobs = readSchedule();
    const job = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      command: args?.command as string,
      runAt: args?.runAt as number,
      label: (args?.label as string) || 'Scheduled task',
      status: 'pending',
      createdAt: Date.now(),
    };
    jobs.push(job);
    writeSchedule(jobs);
    return { content: [{ type: 'text' as const, text: `Scheduled job ${job.id}: "${job.label}" at ${new Date(job.runAt).toISOString()}` }] };
  }

  if (name === 'list_jobs') {
    const jobs = readSchedule();
    const filtered = args?.status
      ? jobs.filter((j: any) => j.status === args.status)
      : jobs;
    return { content: [{ type: 'text' as const, text: JSON.stringify(filtered, null, 2) }] };
  }

  if (name === 'cancel_job') {
    const jobs = readSchedule();
    const job = jobs.find((j: any) => j.id === args?.id);
    if (!job) return { content: [{ type: 'text' as const, text: `Job ${args?.id} not found` }] };
    job.status = 'cancelled';
    writeSchedule(jobs);
    return { content: [{ type: 'text' as const, text: `Cancelled job ${args?.id}` }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[cron-mcp] Fatal error:', err);
  process.exit(1);
});
