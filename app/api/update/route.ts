// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ENV } from '@/lib/env';

const PACKAGE_NAME = 'froggo-mission-control';
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

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

      // Detect PM2
      exec('pm2 id mission-control-dashboard 2>/dev/null', (pmErr, pmOut) => {
        const hasPm2 = !pmErr && pmOut.trim() !== '' && pmOut.trim() !== '[]';

        // Run npm install -g to update
        const updateCmd = `npm install -g ${PACKAGE_NAME}@latest --prefer-online 2>&1`;
        send(`Running: ${updateCmd}`);

        const child = exec(updateCmd, {
          env: { ...process.env, FORCE_COLOR: '0' },
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
          send('Update installed successfully.');

          if (hasPm2) {
            send('Restarting via PM2...');
            exec('pm2 restart mission-control-dashboard', (restartErr) => {
              if (restartErr) {
                done(true, 'Updated. PM2 restart failed — restart manually: pm2 restart mission-control-dashboard');
              } else {
                done(true, 'Updated and restarted. The page will reload shortly.');
              }
            });
          } else {
            done(true, 'Updated. Please restart the app: run `mission-control restart` or restart your terminal session.');
          }
        });
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
