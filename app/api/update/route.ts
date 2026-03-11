// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { exec, execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { ENV } from '@/lib/env';

const PACKAGE_NAME = 'froggo-mission-control';
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

// Resolve npm bin — LaunchAgent PATH doesn't include it, so find via process.execPath
function findNpm(): string {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, 'npm'),
    join(nodeDir, '..', 'bin', 'npm'),
    '/opt/homebrew/bin/npm',
    '/usr/local/bin/npm',
    '/usr/bin/npm',
  ];
  const found = candidates.find(p => existsSync(p));
  if (found) return found;
  // Last resort: try which
  try { return execSync('which npm', { encoding: 'utf-8', timeout: 3000 }).trim(); } catch {}
  return 'npm';
}

// Cache registry check for 1 hour
let registryCache: RegistryInfo | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCurrentVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

interface RegistryInfo {
  version: string;
  description?: string;
  releaseNotes?: string;
  fetchedAt: number;
}

async function getLatestInfo(): Promise<RegistryInfo> {
  if (registryCache && Date.now() - registryCache.fetchedAt < CACHE_TTL_MS) {
    return registryCache;
  }
  const res = await fetch(NPM_REGISTRY_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const data = await res.json();
  const version = data.version as string;

  // Fetch GitHub release notes for this version
  let releaseNotes: string | undefined;
  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/ProfFroggo/froggo-mission-control/releases/tags/v${version}`,
      { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      releaseNotes = ghData.body as string | undefined;
    }
  } catch { /* GitHub unreachable — skip */ }

  const info: RegistryInfo = { version, description: data.description, releaseNotes, fetchedAt: Date.now() };
  registryCache = info;
  return info;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

// GET — check current vs latest version
export async function GET() {
  try {
    const current = getCurrentVersion();
    const info = await getLatestInfo();
    const updateAvailable = compareVersions(info.version, current) > 0;
    return NextResponse.json({
      current,
      latest: info.version,
      updateAvailable,
      releaseNotes: info.releaseNotes ?? null,
      description: info.description ?? null,
    });
  } catch (err: any) {
    const current = getCurrentVersion();
    return NextResponse.json({
      current,
      latest: null,
      updateAvailable: false,
      releaseNotes: null,
      error: err.message,
    });
  }
}

// POST — stream the update process
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
      };

      const done = (success: boolean, message: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, success, message })}\n\n`)
        );
        controller.close();
      };

      send('Starting update...');

      const npmBin = findNpm();
      const nodeBin = process.execPath;
      const launchAgent = join(process.env.HOME || '', 'Library', 'LaunchAgents', 'com.mission-control.app.plist');
      const isMac = process.platform === 'darwin';

      // Run npm install -g to update
      const updateCmd = `"${npmBin}" install -g ${PACKAGE_NAME}@latest --prefer-online 2>&1`;
      send(`Running: npm install -g ${PACKAGE_NAME}@latest --prefer-online`);

      const child = exec(updateCmd, {
        env: { ...process.env, FORCE_COLOR: '0' },
        timeout: 300000,
      });

      child.stdout?.on('data', (data: string) => {
        data.split('\n').filter(Boolean).forEach((l: string) => send(l));
      });

      child.stderr?.on('data', (data: string) => {
        data.split('\n').filter(Boolean).forEach((l: string) => send(l));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          done(false, `Update failed (exit code ${code}). Check the log above.`);
          return;
        }

        send('');
        send('Update installed. Restarting...');

        // Restart via LaunchAgent (macOS) or PM2
        if (isMac && existsSync(launchAgent)) {
          exec(`/bin/launchctl stop com.mission-control.app`, () => {
            setTimeout(() => {
              exec(`/bin/launchctl start com.mission-control.app`, (restartErr) => {
                if (restartErr) {
                  done(true, 'Updated. Restart failed — run: mission-control restart');
                } else {
                  done(true, 'Updated and restarted. Page will reload in a moment.');
                }
              });
            }, 2000);
          });
        } else {
          exec('pm2 id mission-control-dashboard 2>/dev/null', (pmErr, pmOut) => {
            const hasPm2 = !pmErr && pmOut.trim() !== '' && pmOut.trim() !== '[]';
            if (hasPm2) {
              exec('pm2 restart mission-control-dashboard', (restartErr) => {
                if (restartErr) {
                  done(true, 'Updated. PM2 restart failed — run: pm2 restart mission-control-dashboard');
                } else {
                  done(true, 'Updated and restarted. Page will reload in a moment.');
                }
              });
            } else {
              done(true, 'Updated. Run `mission-control restart` to apply changes.');
            }
          });
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
