// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getCircuitBreakerState, resetAllCircuits } from '@/lib/taskDispatcher';

export async function GET() {
  try {
    const state = getCircuitBreakerState();
    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/settings/reset-circuits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    resetAllCircuits();
    const state = getCircuitBreakerState();
    const count = Object.keys(state).length;
    return NextResponse.json({ success: true, message: `Circuit breakers reset (${count} agents cleared)` });
  } catch (error) {
    console.error('POST /api/settings/reset-circuits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
