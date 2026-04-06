import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface SharedMemory {
  id: string;
  key: string;
  value: string;
  orgId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// Mock data — replace with Supabase queries
const MOCK_MEMORIES: SharedMemory[] = [
  {
    id: 'mem_001',
    key: 'team.coding-standards',
    value: 'Use strict TypeScript. Prefer composition over inheritance.',
    orgId: 'org_mock',
    createdBy: 'user_abc',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-06T12:00:00.000Z',
  },
  {
    id: 'mem_002',
    key: 'team.deploy-process',
    value: 'All deploys must pass CI. No direct pushes to main.',
    orgId: 'org_mock',
    createdBy: 'user_abc',
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-05T10:00:00.000Z',
  },
];

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Validate token and resolve org membership
    // const { user, orgId } = await validateToken(token);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch shared memories from Supabase filtered by orgId
    // const memories = await supabase
    //   .from('shared_memories')
    //   .select('*')
    //   .eq('org_id', orgId)
    //   .order('updated_at', { ascending: false });

    return NextResponse.json({ memories: MOCK_MEMORIES });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch shared memories' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Validate token and resolve org membership
    // const { user, orgId } = await validateToken(token);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string };

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return NextResponse.json(
        { error: 'Memory key is required' },
        { status: 400 },
      );
    }

    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json(
        { error: 'Memory value is required' },
        { status: 400 },
      );
    }

    // TODO: Upsert shared memory in Supabase
    // const memory = await supabase
    //   .from('shared_memories')
    //   .upsert({
    //     key: key.trim(),
    //     value: value.trim(),
    //     org_id: orgId,
    //     created_by: user.id,
    //   }, { onConflict: 'org_id,key' })
    //   .select()
    //   .single();

    const memory: SharedMemory = {
      id: `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      key: key.trim(),
      value: value.trim(),
      orgId: 'org_mock',
      createdBy: 'user_mock',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ memory }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to write shared memory' },
      { status: 500 },
    );
  }
}
