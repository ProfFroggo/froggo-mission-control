import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { ENV, searchBackend } from '../../../../src/lib/env';

const execFileAsync = promisify(execFile);

const VAULT_PATH = ENV.VAULT_PATH;
const QMD_BIN   = ENV.QMD_BIN;

// ── ripgrep fallback ─────────────────────────────────────────────────────────
// Parse rg --json NDJSON output into simple { file, excerpt } records.
function parseRgJson(ndjson: string, limit: number): Array<{ file: string; excerpt: string }> {
  const results: Array<{ file: string; excerpt: string }> = [];
  const seen = new Set<string>();
  for (const line of ndjson.split('\n')) {
    if (results.length >= limit) break;
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'match') continue;
      const file = path.relative(VAULT_PATH, obj.data?.path?.text ?? '');
      if (seen.has(file)) continue;
      seen.add(file);
      const excerpt = (obj.data?.lines?.text ?? '').slice(0, 500);
      results.push({ file, excerpt });
    } catch { /* malformed line */ }
  }
  return results;
}

// ── grep fallback (pure Node, no external binary) ───────────────────────────
function grepVault(query: string, limit: number): Array<{ file: string; excerpt: string }> {
  const results: Array<{ file: string; excerpt: string }> = [];
  const SKIP = new Set(['data', 'logs', 'worktrees', '.git', '.obsidian', 'node_modules']);

  function walk(dir: string) {
    if (results.length >= limit) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= limit) break;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP.has(entry.name)) walk(fullPath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                file: path.relative(VAULT_PATH, fullPath),
                excerpt: content.slice(0, 500),
              });
            }
          } catch { /* skip unreadable */ }
        }
      }
    } catch { /* skip unreadable directory */ }
  }

  walk(VAULT_PATH);
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query      = searchParams.get('q') || '';
  const mode       = searchParams.get('mode') || 'search'; // search | vsearch | query
  const collection = searchParams.get('collection') || '';
  const limit      = parseInt(searchParams.get('limit') || '10', 10);

  if (!query) {
    return NextResponse.json({ error: 'Missing ?q= parameter' }, { status: 400 });
  }

  // ── Search unavailable ───────────────────────────────────────────────────
  if (searchBackend === 'none') {
    return NextResponse.json({
      results: [],
      query,
      mode: 'none',
      searchUnavailable: true,
      message: 'Search tool not configured. Install qmd (brew install profroggo/tap/qmd) or ensure ripgrep is available.',
    });
  }

  // ── QMD path ─────────────────────────────────────────────────────────────
  if (searchBackend === 'qmd') {
    const qmdArgs: string[] = [mode, query, '--limit', String(limit)];
    if (collection) qmdArgs.push('--collection', collection);

    try {
      const { stdout } = await execFileAsync(QMD_BIN, qmdArgs, {
        timeout: 15000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
      });
      return NextResponse.json({ results: stdout, query, mode });
    } catch (qmdErr: any) {
      // QMD was detected at startup but failed at runtime — fall through to ripgrep/grep
      console.warn('[memory/search] QMD runtime failure, falling back to ripgrep/grep:', qmdErr.message);
    }
  }

  // ── ripgrep path ─────────────────────────────────────────────────────────
  if (searchBackend === 'ripgrep') {
    try {
      const { stdout } = await execFileAsync(
        'rg',
        ['--json', '--glob', '*.md', '--max-count', '1', query, VAULT_PATH],
        {
          timeout: 10000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
        }
      );
      const results = parseRgJson(stdout, limit);
      return NextResponse.json({
        results: results.map(r => `${r.file}\n${r.excerpt}`).join('\n\n---\n\n'),
        query,
        mode: 'ripgrep',
        warning: 'QMD not installed. Using ripgrep for basic text search. Install qmd for full-text BM25/vector search.',
      });
    } catch (rgErr: any) {
      // rg exit code 1 = no matches (not an error), exit code 2 = real error
      if (rgErr.code === 1) {
        return NextResponse.json({ results: '', query, mode: 'ripgrep' });
      }
      // rg failed at runtime — fall through to Node grep
      console.warn('[memory/search] ripgrep runtime failure, falling back to Node grep:', rgErr.message);
    }
  }

  // ── Node grep fallback (last resort, or after runtime failures) ──────────
  try {
    const results = grepVault(query, limit);
    return NextResponse.json({
      results: results.map(r => `${r.file}\n${r.excerpt}`).join('\n\n---\n\n'),
      query,
      mode: 'fallback-grep',
      warning: 'Using Node.js text scan (slowest fallback). Install qmd or ripgrep for better search.',
    });
  } catch (fallbackErr: any) {
    return NextResponse.json(
      { error: `Search failed: ${fallbackErr.message}` },
      { status: 500 }
    );
  }
}
