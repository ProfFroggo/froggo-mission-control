import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface KnowledgeResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    type: string;
    tags: string[];
    scope: 'org' | 'global';
    createdAt: string;
  };
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Validate token against instance's INTERNAL_API_TOKEN
    // const instance = await validateInstanceToken(token);
    // if (!instance) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { query, scope, limit } = body as {
      query?: string;
      scope?: 'org' | 'global' | 'both';
      limit?: number;
    };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query string is required' },
        { status: 400 },
      );
    }

    const validScopes = ['org', 'global', 'both'];
    if (scope && !validScopes.includes(scope)) {
      return NextResponse.json(
        { error: 'Scope must be "org", "global", or "both"' },
        { status: 400 },
      );
    }

    const resultLimit = Math.min(Math.max(limit ?? 10, 1), 100);

    // TODO: Implement vector DB search (pgvector / Pinecone / etc.)
    // const embedding = await embed(query);
    // const results = await vectorSearch(embedding, {
    //   scope: scope ?? 'both',
    //   limit: resultLimit,
    //   orgId: instance.orgId,
    // });

    const mockResults: KnowledgeResult[] = [
      {
        id: 'kn_mock_001',
        content: `Mock result for query: "${query.trim()}"`,
        score: 0.92,
        metadata: {
          source: 'documentation',
          type: 'text',
          tags: ['example'],
          scope: 'org',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      },
    ];

    return NextResponse.json({
      results: mockResults.slice(0, resultLimit),
      query: query.trim(),
      scope: scope ?? 'both',
      total: mockResults.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to search knowledge base' },
      { status: 500 },
    );
  }
}
