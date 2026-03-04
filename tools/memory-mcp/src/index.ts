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
  path.join(os.homedir(), 'froggo', 'memory');

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_PATH)) {
    fs.mkdirSync(VAULT_PATH, { recursive: true });
  }
}

const server = new Server(
  { name: 'memory', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: 'Search memory vault for relevant notes using keyword search',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'memory_recall',
      description: 'Semantic search of memory vault using vector similarity',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query to find semantically similar content' },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'memory_write',
      description: 'Write a note to the memory vault',
      inputSchema: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Note filename (without .md extension)' },
          content: { type: 'string', description: 'Markdown content to write' },
          append: { type: 'boolean', description: 'Append to existing file instead of overwrite (default false)' },
        },
        required: ['filename', 'content'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'memory_search': {
        const query = args?.query as string;
        const limit = (args?.limit as number) || 10;
        try {
          const { stdout } = await execFileAsync('qmd', ['search', query, '--limit', String(limit)], {
            timeout: 10000,
            env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
          });
          return { content: [{ type: 'text', text: stdout || 'No results found.' }] };
        } catch (e: any) {
          // Fallback: grep the vault directory
          ensureVaultDir();
          const files = fs.readdirSync(VAULT_PATH).filter(f => f.endsWith('.md'));
          const results: string[] = [];
          for (const file of files.slice(0, 50)) {
            try {
              const content = fs.readFileSync(path.join(VAULT_PATH, file), 'utf-8');
              if (content.toLowerCase().includes(query.toLowerCase())) {
                results.push(`## ${file}\n${content.slice(0, 300)}...`);
              }
            } catch {}
            if (results.length >= limit) break;
          }
          return { content: [{ type: 'text', text: results.length > 0 ? results.join('\n\n') : `No results for "${query}". (qmd not available: ${e.message})` }] };
        }
      }

      case 'memory_recall': {
        const query = args?.query as string;
        const limit = (args?.limit as number) || 5;
        try {
          const { stdout } = await execFileAsync('qmd', ['vsearch', query, '--limit', String(limit)], {
            timeout: 15000,
            env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
          });
          return { content: [{ type: 'text', text: stdout || 'No results found.' }] };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `Semantic search unavailable (qmd not installed or not indexed): ${e.message}. Use memory_search for keyword search.` }] };
        }
      }

      case 'memory_write': {
        ensureVaultDir();
        const filename = (args?.filename as string).replace(/[^a-zA-Z0-9\-_]/g, '-');
        const filePath = path.join(VAULT_PATH, `${filename}.md`);
        const content = args?.content as string;
        if (args?.append && fs.existsSync(filePath)) {
          fs.appendFileSync(filePath, `\n\n${content}`);
        } else {
          fs.writeFileSync(filePath, content);
        }
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, path: filePath }) }] };
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
  console.error('memory MCP server running on stdio');
}

main().catch(console.error);
