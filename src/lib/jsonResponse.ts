// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

/**
 * Serialize `data` to JSON and gzip-compress it if the client supports it.
 *
 * Next.js App Router does NOT apply the global compression middleware to
 * API routes, so large responses must be compressed here explicitly.
 *
 * Usage:
 *   return jsonResponse(data, request);
 *   return jsonResponse(data, request, { status: 201 });
 */
export function jsonResponse(
  data: unknown,
  request: NextRequest,
  init?: ResponseInit,
): NextResponse {
  const json = JSON.stringify(data);
  const acceptEncoding = request.headers.get('Accept-Encoding') ?? '';
  const supportsGzip = acceptEncoding.includes('gzip');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, max-age=5, stale-while-revalidate=30',
    'Vary': 'Accept-Encoding',
    ...((init?.headers ?? {}) as Record<string, string>),
  };

  if (supportsGzip) {
    const compressed = gzipSync(Buffer.from(json, 'utf8'), { level: 6 });
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = String(compressed.length);
    return new NextResponse(compressed, { ...init, headers });
  }

  return new NextResponse(json, { ...init, headers });
}
