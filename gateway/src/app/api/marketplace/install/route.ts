import { type NextRequest, NextResponse } from 'next/server';
// TODO: Replace with actual Clerk auth and provisioner
// import { auth } from '@clerk/nextjs/server';
// import { getInstanceUrl } from '@/lib/provisioner';

export const runtime = 'nodejs';

interface InstallRequest {
  workspaceId: string;
  productId: string;
  type: 'agent' | 'module';
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Authenticate with Clerk
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { workspaceId, productId, type } = body as Partial<InstallRequest>;

    // Validate required fields
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 },
      );
    }

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 },
      );
    }

    const validTypes = ['agent', 'module'] as const;
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'type must be "agent" or "module"' },
        { status: 400 },
      );
    }

    // TODO: Verify workspace belongs to the authenticated user
    // const workspace = await getWorkspace(workspaceId, userId);
    // if (!workspace) {
    //   return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    // }

    // TODO: Look up product assets from marketplace DB
    // const product = await getMarketplaceProduct(productId);
    // if (!product) {
    //   return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    // }

    // TODO: Forward install payload to the running instance
    // const instanceUrl = await getInstanceUrl(workspaceId);
    // const installResponse = await fetch(`${instanceUrl}/api/marketplace/install`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${workspace.internalToken}`,
    //   },
    //   body: JSON.stringify({
    //     productId,
    //     type,
    //     assets: product.assets,
    //   }),
    // });
    //
    // if (!installResponse.ok) {
    //   return NextResponse.json(
    //     { error: 'Failed to install on instance' },
    //     { status: 502 },
    //   );
    // }

    return NextResponse.json({
      status: 'installed',
      workspaceId,
      productId,
      type,
      installedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to install marketplace product' },
      { status: 500 },
    );
  }
}
