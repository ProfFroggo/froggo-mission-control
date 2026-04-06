import { wsDb } from '@/lib/workflow-studio-db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
    const executions = wsDb.listExecutions(id, limit, offset);
    return NextResponse.json({
      executions: executions.map((e) => ({
        ...e,
        result: e.result ? JSON.parse(e.result) : null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
