import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

    // TODO: Validate token and determine user role
    // - admin-only for scope: "global"
    // - org-member for scope: "org"
    // const { user, role } = await validateToken(token);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { content, metadata, scope } = body as {
      content?: string;
      metadata?: {
        source?: string;
        type?: string;
        tags?: string[];
      };
      scope?: 'org' | 'global';
    };

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 },
      );
    }

    // Validate scope
    if (!scope || !['org', 'global'].includes(scope)) {
      return NextResponse.json(
        { error: 'Scope must be "org" or "global"' },
        { status: 400 },
      );
    }

    // Validate metadata
    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { error: 'Metadata object is required' },
        { status: 400 },
      );
    }

    if (!metadata.source || typeof metadata.source !== 'string') {
      return NextResponse.json(
        { error: 'metadata.source is required' },
        { status: 400 },
      );
    }

    if (!metadata.type || typeof metadata.type !== 'string') {
      return NextResponse.json(
        { error: 'metadata.type is required' },
        { status: 400 },
      );
    }

    if (metadata.tags && !Array.isArray(metadata.tags)) {
      return NextResponse.json(
        { error: 'metadata.tags must be an array' },
        { status: 400 },
      );
    }

    // TODO: Enforce role-based access
    // if (scope === 'global' && role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Admin access required for global scope' },
    //     { status: 403 },
    //   );
    // }

    // TODO: Embed content and store in vector DB
    // const embedding = await embed(content);
    // const record = await vectorStore.insert({
    //   content: content.trim(),
    //   embedding,
    //   metadata: {
    //     source: metadata.source,
    //     type: metadata.type,
    //     tags: metadata.tags ?? [],
    //   },
    //   scope,
    //   orgId: user.orgId,
    // });

    const knowledgeId = `kn_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    return NextResponse.json(
      {
        id: knowledgeId,
        status: 'ingested',
        scope,
        metadata: {
          source: metadata.source,
          type: metadata.type,
          tags: metadata.tags ?? [],
        },
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to ingest knowledge' },
      { status: 500 },
    );
  }
}
