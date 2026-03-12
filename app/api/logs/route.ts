// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LOG_PATH = process.env.LOG_PATH || join(homedir(), 'mission-control', 'logs', 'mission-control.log');
const MAX_READ = 256 * 1024; // 256 KB max per request

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = parseInt(searchParams.get('cursor') ?? '0', 10);
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 1000);

    if (!existsSync(LOG_PATH)) {
      return NextResponse.json({ file: LOG_PATH, cursor: 0, size: 0, lines: [], truncated: false });
    }

    const stat = statSync(LOG_PATH);
    const size = stat.size;
    const start = cursor > 0 ? cursor : Math.max(0, size - MAX_READ);
    const readLen = Math.min(size - start, MAX_READ);

    if (readLen <= 0) {
      return NextResponse.json({ file: LOG_PATH, cursor: size, size, lines: [], truncated: false });
    }

    const buf = new Uint8Array(readLen);
    const fd = openSync(LOG_PATH, 'r');
    readSync(fd, buf, 0, readLen, start);
    closeSync(fd);

    const text = Buffer.from(buf).toString('utf-8');
    const rawLines = text.split('\n').filter(Boolean);
    const lines = rawLines.slice(-limit);
    const truncated = rawLines.length > limit;

    return NextResponse.json({ file: LOG_PATH, cursor: start + readLen, size, lines, truncated });
  } catch (error) {
    console.error('GET /api/logs error:', error);
    return NextResponse.json({ file: LOG_PATH, cursor: 0, size: 0, lines: [], truncated: false });
  }
}
