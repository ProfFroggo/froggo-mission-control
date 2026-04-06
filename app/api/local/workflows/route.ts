import { wsDb } from '@/lib/workflow-studio-db';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');
    const workflows = wsDb.listWorkflows(limit, offset);
    return NextResponse.json({ workflows });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || randomUUID();
    wsDb.saveWorkflow(id, body);
    const row = wsDb.getWorkflow(id);
    return NextResponse.json({ id, ...row });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
