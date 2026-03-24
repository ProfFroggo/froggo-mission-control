// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared Gemini API client with automatic retry on 429 (rate limit).
// All routes that call generateContent should go through geminiPost().

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // doubles each retry: 1s, 2s, 4s

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST to a Gemini generateContent endpoint with automatic retry on 429.
 * Respects the `Retry-After` response header when present.
 *
 * @param model   e.g. "gemini-2.0-flash"
 * @param apiKey  Gemini API key
 * @param body    Request body object (will be JSON-serialised)
 * @param endpoint Override the endpoint suffix, default ":generateContent"
 */
export async function geminiPost(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  endpoint = ':generateContent'
): Promise<Response> {
  const url = `${BASE_URL}/${model}${endpoint}?key=${apiKey}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status !== 429) return res; // success or non-retryable error

    if (attempt === MAX_RETRIES) return res; // exhausted retries, return 429 to caller

    // Respect Retry-After header if present, otherwise exponential backoff
    const retryAfterSec = res.headers.get('Retry-After');
    const waitMs = retryAfterSec
      ? Math.min(parseInt(retryAfterSec, 10) * 1000, 30_000)
      : BASE_DELAY_MS * Math.pow(2, attempt);

    console.warn(
      `[geminiClient] 429 on ${model} — retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`
    );
    await sleep(waitMs);
  }

  // TypeScript requires a return here, but the loop above always returns
  throw new Error('geminiPost: unreachable');
}
