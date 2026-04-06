/**
 * Text embeddings for the shared knowledge layer.
 *
 * Generates vector embeddings using OpenAI's text-embedding-3-small model.
 * Used for semantic search across shared knowledge documents.
 *
 * Env vars: OPENAI_API_KEY
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingResponse {
  object: "list";
  data: EmbeddingData[];
  model: string;
  usage: EmbeddingUsage;
}

export interface EmbeddingData {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbedOptions {
  /** Maximum number of tokens the input can have. Longer inputs are truncated. */
  maxTokens?: number;
  /** Dimensionality of the output vector. Default: 1536 */
  dimensions?: number;
}

export interface EmbeddingError {
  error: {
    message: string;
    type: string;
    code: string | null;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_API_BASE = "https://api.openai.com/v1";
const MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing required environment variable: OPENAI_API_KEY",
    );
  }
  return key;
}

function isEmbeddingError(body: unknown): body is EmbeddingError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as EmbeddingError).error === "object"
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a vector embedding for a single text string.
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions by default).
 * Returns the embedding as a number array suitable for pgvector storage.
 *
 * @param text - The text to embed. Must not be empty.
 * @param options - Optional configuration for dimensions and token limits.
 * @returns A number array representing the text embedding.
 *
 * @example
 * ```ts
 * const vector = await embed("How do I create an agent?");
 * // vector.length === 1536
 * ```
 */
export async function embed(
  text: string,
  options: EmbedOptions = {},
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot embed empty text");
  }

  const { dimensions = DEFAULT_DIMENSIONS } = options;
  const apiKey = getApiKey();

  const response = await fetch(`${OPENAI_API_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
      dimensions,
      encoding_format: "float",
    }),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    if (isEmbeddingError(body)) {
      throw new Error(
        `OpenAI Embeddings API error (${response.status}): ${body.error.message}`,
      );
    }
    throw new Error(
      `OpenAI Embeddings API error (${response.status}): ${response.statusText}`,
    );
  }

  const result = body as EmbeddingResponse;

  if (!result.data || result.data.length === 0) {
    throw new Error("OpenAI Embeddings API returned no embeddings");
  }

  return result.data[0].embedding;
}

/**
 * Generate embeddings for multiple text strings in a single API call.
 *
 * More efficient than calling `embed()` in a loop for batch operations.
 * Returns embeddings in the same order as the input texts.
 *
 * @param texts - Array of texts to embed. Must not be empty.
 * @param options - Optional configuration for dimensions.
 * @returns Array of number arrays, one per input text.
 */
export async function embedBatch(
  texts: string[],
  options: EmbedOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) {
    throw new Error("Cannot embed empty text array");
  }

  const nonEmpty = texts.filter((t) => t.trim());
  if (nonEmpty.length !== texts.length) {
    throw new Error("All texts must be non-empty strings");
  }

  const { dimensions = DEFAULT_DIMENSIONS } = options;
  const apiKey = getApiKey();

  const response = await fetch(`${OPENAI_API_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      dimensions,
      encoding_format: "float",
    }),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    if (isEmbeddingError(body)) {
      throw new Error(
        `OpenAI Embeddings API error (${response.status}): ${body.error.message}`,
      );
    }
    throw new Error(
      `OpenAI Embeddings API error (${response.status}): ${response.statusText}`,
    );
  }

  const result = body as EmbeddingResponse;

  if (!result.data || result.data.length !== texts.length) {
    throw new Error(
      `OpenAI returned ${result.data?.length ?? 0} embeddings for ${texts.length} inputs`,
    );
  }

  // OpenAI returns embeddings sorted by index, but sort explicitly to be safe
  const sorted = [...result.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
