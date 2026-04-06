/**
 * Reverse proxy — forwards authenticated gateway requests to Fly Machine instances.
 *
 * Handles standard HTTP requests and SSE (text/event-stream) without buffering.
 * Adds forwarding headers so the instance knows the request origin.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxyRequestOptions {
  /** The incoming request to forward */
  request: Request;
  /** Base URL of the target Fly Machine (e.g. http://[private-ip]:8080) */
  machineUrl: string;
  /** Optional internal auth token to attach */
  gatewayAuthToken?: string;
  /** Timeout in milliseconds for non-streaming requests (default: 30s) */
  timeoutMs?: number;
}

export interface ProxyResult {
  response: Response;
  /** Whether the response is a streaming SSE response */
  isStreaming: boolean;
}

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

/** Headers that should not be forwarded to the upstream machine */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function buildForwardHeaders(
  incoming: Headers,
  clientIp: string,
  gatewayAuthToken?: string,
): Headers {
  const forwarded = new Headers();

  incoming.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      forwarded.set(key, value);
    }
  });

  // Standard proxy headers
  const existingForwardedFor = incoming.get("x-forwarded-for");
  forwarded.set(
    "X-Forwarded-For",
    existingForwardedFor ? `${existingForwardedFor}, ${clientIp}` : clientIp,
  );
  forwarded.set("X-Forwarded-Proto", "https");

  // Gateway authentication so the instance can verify the request came from us
  if (gatewayAuthToken) {
    forwarded.set("X-Gateway-Auth", gatewayAuthToken);
  }

  return forwarded;
}

function extractClientIp(request: Request): string {
  // Next.js / Vercel sets these
  const headers = request.headers;
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1"
  );
}

// ---------------------------------------------------------------------------
// URL rewriting
// ---------------------------------------------------------------------------

function buildUpstreamUrl(request: Request, machineBaseUrl: string): string {
  const incoming = new URL(request.url);
  // Preserve path and query, but point at the machine
  const base = machineBaseUrl.replace(/\/+$/, "");
  return `${base}${incoming.pathname}${incoming.search}`;
}

// ---------------------------------------------------------------------------
// Streaming helpers
// ---------------------------------------------------------------------------

function isSSE(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/event-stream");
}

function buildStreamingResponse(upstream: Response): Response {
  // Pass through the readable stream without buffering
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // Ensure no buffering on the gateway side
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("X-Accel-Buffering", "no"); // nginx hint

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function buildStandardResponse(upstream: Response): Response {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Proxy an incoming request to a Fly Machine instance.
 *
 * Automatically detects SSE responses and passes them through without buffering.
 * Non-streaming requests respect the configured timeout.
 */
export async function proxyRequest(
  options: ProxyRequestOptions,
): Promise<ProxyResult> {
  const { request, machineUrl, gatewayAuthToken, timeoutMs = 30_000 } = options;

  const clientIp = extractClientIp(request);
  const upstreamUrl = buildUpstreamUrl(request, machineUrl);
  const headers = buildForwardHeaders(request.headers, clientIp, gatewayAuthToken);

  // Read body if present (POST, PUT, PATCH)
  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = request.body;
  }

  // Use AbortController for timeout on non-streaming requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      // @ts-expect-error -- Node.js fetch supports duplex for streaming request bodies
      duplex: body ? "half" : undefined,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        response: new Response(
          JSON.stringify({ error: "Gateway timeout", timeoutMs }),
          {
            status: 504,
            headers: { "Content-Type": "application/json" },
          },
        ),
        isStreaming: false,
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown proxy error";
    return {
      response: new Response(
        JSON.stringify({ error: "Bad gateway", detail: message }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      ),
      isStreaming: false,
    };
  }

  clearTimeout(timeoutId);

  if (isSSE(upstream)) {
    return {
      response: buildStreamingResponse(upstream),
      isStreaming: true,
    };
  }

  return {
    response: buildStandardResponse(upstream),
    isStreaming: false,
  };
}
