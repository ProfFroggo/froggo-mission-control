import { type NextRequest, NextResponse } from 'next/server';
// TODO: Replace with actual Clerk auth
// import { auth } from '@clerk/nextjs/server';
// import { provisionInstance, getInstanceStatus } from '@/lib/provisioner';
// import { generateInstanceSecrets } from '@/lib/secrets';

export const runtime = 'nodejs';

interface Workspace {
  id: string;
  name: string;
  region: string;
  status: 'running' | 'stopped' | 'provisioning' | 'error';
  instanceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mock data — replace with DB queries
const MOCK_WORKSPACES: Workspace[] = [
  {
    id: 'ws_abc123',
    name: 'My Mission Control',
    region: 'iad',
    status: 'running',
    instanceUrl: 'https://ws-abc123.fly.dev',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-06T12:00:00.000Z',
  },
];

export async function GET() {
  try {
    // TODO: Authenticate with Clerk
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch workspaces from DB filtered by userId
    return NextResponse.json({ workspaces: MOCK_WORKSPACES });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Authenticate with Clerk
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { name, region } = body as { name?: string; region?: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 },
      );
    }

    const validRegions = ['iad', 'lax', 'ams', 'sin', 'gru'];
    const selectedRegion = region && validRegions.includes(region) ? region : 'iad';

    // TODO: Provision Fly Machine
    // const secrets = await generateInstanceSecrets(workspaceId);
    // const instance = await provisionInstance({
    //   workspaceId,
    //   name: name.trim(),
    //   region: selectedRegion,
    //   secrets,
    // });

    const workspace: Workspace = {
      id: `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: name.trim(),
      region: selectedRegion,
      status: 'provisioning',
      instanceUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ workspace }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 },
    );
  }
}
