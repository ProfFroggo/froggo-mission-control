import { NextResponse } from 'next/server';

// Returns an empty widget manifest for any agent that doesn't have one defined.
// Prevents 404 console noise when WidgetLoader probes for manifests.
export async function GET() {
  return NextResponse.json({ widgets: [] });
}
