// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

const VAULT_PATH = process.env.VAULT_PATH ||
  path.join(os.homedir(), 'mission-control');

const QMD_BIN = process.env.QMD_BIN || '/opt/homebrew/bin/qmd';
const AGENT_ID = process.env.CLAUDE_CODE_AGENT_ID || process.env.AGENT_ID || 'unknown';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Category → vault subfolder routing (relative to VAULT_PATH = ~/mission-control)
// Writes route into the correct subfolder of the wider vault.
const CATEGORY_FOLDER: Record<string, string> = {
  decision: 'memory/knowledge',
  gotcha:   'memory/knowledge',
  pattern:  'memory/knowledge',
  daily:    'memory/daily',
  review:   'memory/sessions',
  agent:    'agents',  // overridden below to agents/{agentId}
};

const server = new Server(
  { name: 'memory', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: 'Search the Obsidian memory vault using QMD BM25, vector, or hybrid search. Falls back to grep if QMD unavailable.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string',  description: 'Search query' },
          mode:  { type: 'string',  enum: ['bm25', 'vector', 'hybrid'], description: 'Search mode (default: hybrid)' },
          limit: { type: 'number',  description: 'Max results (default 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'memory_recall',
      description: 'Recall memories by topic, recency, or agent. Returns recent notes and context.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic or agent name to recall' },
          days:  { type: 'number', description: 'How many days back to look (default 7)' },
          limit: { type: 'number', description: 'Max files to return (default 5)' },
        },
        required: [],
      },
    },
    {
      name: 'memory_write',
      description: 'Write a memory note to the Obsidian vault. Routes to correct subfolder by category.',
      inputSchema: {
        type: 'object',
        properties: {
          content:  { type: 'string', description: 'Content to write' },
          category: { type: 'string', enum: ['decision', 'gotcha', 'pattern', 'daily', 'review', 'agent'], description: 'Memory category' },
          title:    { type: 'string', description: 'Note title (used as filename)' },
          agent:    { type: 'string', description: 'Agent name if category=agent' },
        },
        required: ['content', 'category', 'title'],
      },
    },
    {
      name: 'memory_read',
      description: 'Read a specific file from the Obsidian vault by relative path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path within vault (e.g., "knowledge/architecture.md")' },
        },
        required: ['path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case 'memory_search': {
        const query  = args?.query as string;
        const mode   = (args?.mode as string) || 'hybrid';
        const limit  = (args?.limit as number) || 10;

        try {
          const { stdout } = await execFileAsync(
            QMD_BIN,
            ['search', query, '--mode', mode, '--limit', String(limit)],
            {
              cwd: VAULT_PATH,
              timeout: 10000,
              env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
            }
          );
          return { content: [{ type: 'text', text: stdout || 'No results found.' }] };
        } catch (e: any) {
          // Fallback: recursive grep — skip binary/noisy dirs
          const SKIP_DIRS = new Set(['data', 'logs', 'worktrees', '.git', '.obsidian', 'node_modules']);
          ensureDir(VAULT_PATH);
          const results: string[] = [];
          function grepDir(dir: string) {
            if (results.length >= limit) return;
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (results.length >= limit) break;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  if (!SKIP_DIRS.has(entry.name)) grepDir(fullPath);
                } else if (entry.name.endsWith('.md')) {
                  try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    if (content.toLowerCase().includes(query.toLowerCase())) {
                      const relPath = path.relative(VAULT_PATH, fullPath);
                      results.push(`## ${relPath}\n${content.slice(0, 400)}...`);
                    }
                  } catch {}
                }
              }
            } catch {}
          }
          grepDir(VAULT_PATH);
          return {
            content: [{
              type: 'text',
              text: results.length > 0
                ? results.join('\n\n')
                : `No results for "${query}". (QMD unavailable: ${e.message})`,
            }],
          };
        }
      }

      case 'memory_recall': {
        const topic = (args?.topic as string) || '';
        const days  = (args?.days  as number) || 7;
        const limit = (args?.limit as number) || 5;

        ensureDir(VAULT_PATH);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const results: string[] = [];

        const SKIP_RECALL = new Set(['data', 'logs', 'worktrees', '.git', '.obsidian', 'node_modules']);
        function findRecent(dir: string) {
          if (results.length >= limit) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= limit) break;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                if (!SKIP_RECALL.has(entry.name)) findRecent(fullPath);
              } else if (entry.name.endsWith('.md')) {
                try {
                  const stat = fs.statSync(fullPath);
                  if (stat.mtimeMs >= cutoff) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const matches = !topic || content.toLowerCase().includes(topic.toLowerCase()) || entry.name.toLowerCase().includes(topic.toLowerCase());
                    if (matches) {
                      const relPath = path.relative(VAULT_PATH, fullPath);
                      results.push(`## ${relPath} (modified ${stat.mtime.toISOString().slice(0, 10)})\n${content.slice(0, 600)}...`);
                    }
                  }
                } catch {}
              }
            }
          } catch {}
        }

        findRecent(VAULT_PATH);
        return {
          content: [{
            type: 'text',
            text: results.length > 0
              ? results.join('\n\n')
              : `No memories found${topic ? ` for topic "${topic}"` : ''} in the last ${days} day(s).`,
          }],
        };
      }

      case 'memory_write': {
        const content  = args?.content  as string;
        const category = args?.category as string;
        const title    = (args?.title as string).replace(/[^a-zA-Z0-9\-_ ]/g, '-').trim().replace(/\s+/g, '-');
        const agent    = (args?.agent  as string) || AGENT_ID;

        // Resolve destination folder
        let folder = CATEGORY_FOLDER[category] || 'knowledge';
        if (category === 'agent') {
          folder = path.join('agents', agent);
        }

        const destDir = path.join(VAULT_PATH, folder);
        ensureDir(destDir);

        const filePath = path.join(destDir, `${title}.md`);
        fs.writeFileSync(filePath, content, 'utf-8');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, path: filePath, folder }),
          }],
        };
      }

      case 'memory_read': {
        const relPath  = args?.path as string;
        const filePath = path.join(VAULT_PATH, relPath);

        // Safety: ensure the resolved path stays within the vault
        if (!filePath.startsWith(VAULT_PATH)) {
          return {
            content: [{ type: 'text', text: 'Error: path traversal detected.' }],
            isError: true,
          };
        }

        if (!fs.existsSync(filePath)) {
          return {
            content: [{ type: 'text', text: `File not found: ${relPath}` }],
          };
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`memory MCP server v3 running. Agent: ${AGENT_ID}, Vault: ${VAULT_PATH}`);
}

main().catch(console.error);
