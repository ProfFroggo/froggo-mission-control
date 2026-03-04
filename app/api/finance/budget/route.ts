import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ total: 0, spent: 0, remaining: 0, categories: [] });
}
