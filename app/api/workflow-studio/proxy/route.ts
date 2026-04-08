// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/workflow-studio/proxy/route.ts
// Catch-all proxy that forwards requests to the Workflow Studio backend
// running on port 4000. This avoids CORS issues when Mission Control (port 3000)
// needs to call WS API endpoints.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WS_BASE_URL = process.env.WORKFLOW_STUDIO_URL || 'http://localhost:4000';
const PROXY_TIMEOUT_MS = 30_000;

/** Headers that should not be forwarded to the upstream service. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'host',
]);

/**
 * Build a filtered Headers object suitable for proxying.
 * Strips hop-by-hop headers and rewrites the Host to the upstream target.
 */
function proxyHeaders(incoming: Headers): HeadersInit {
  const out: Record<string, string> = {};
  incoming.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out[key] = value;
    }
  });
  return out;
}

/**
 * Extract the WS API path from the incoming request URL.
 * e.g. /api/workflow-studio/proxy?path=/api/workflows  -->  /api/workflows
 * e.g. /api/workflow-studio/proxy?path=/api/health      -->  /api/health
 */
function resolveUpstreamUrl(request: NextRequest): string | null {
  const wsPath = request.nextUrl.searchParams.get('path');
  if (!wsPath) return null;

  // Restrict to specific API prefixes to prevent SSRF abuse
  const normalized = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
  const ALLOWED_WS_PREFIXES = ['/api/v1/', '/api/workflows/', '/api/executions/', '/api/credentials/'];
  if (!ALLOWED_WS_PREFIXES.some(prefix => normalized.startsWith(prefix))) return null;

  // Forward any additional query params (strip our own `path` param)
  const upstream = new URL(normalized, WS_BASE_URL);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'path') {
      upstream.searchParams.set(key, value);
    }
  });

  return upstream.toString();
}

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const upstreamUrl = resolveUpstreamUrl(request);
  if (!upstreamUrl) {
    return NextResponse.json(
      { error: 'Missing or invalid "path" query parameter. Must start with /api/.' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    // Read request body for methods that carry one
    let body: BodyInit | null = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text();
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: proxyHeaders(request.headers),
      body,
      signal: controller.signal,
      // Prevent Next.js from caching upstream responses
      cache: 'no-store',
    });

    // Stream the upstream response back to the caller
    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = upstreamResponse.body
      ? new Response(upstreamResponse.body).body
      : null;

    return new NextResponse(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Workflow Studio request timed out', timeoutMs: PROXY_TIMEOUT_MS },
        { status: 504 },
      );
    }

    // Connection refused / unreachable — WS is probably not running
    const message = err instanceof Error ? err.message : String(err);
    console.error('[workflow-studio-proxy] upstream error:', message);
    return NextResponse.json(
      { error: 'Workflow Studio is unreachable' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Support all standard HTTP methods
export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
