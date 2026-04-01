import { sqliteDb } from '@sim/db'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/local/executions/:id — get execution status and result
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const execution = sqliteDb.getExecution(id)

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...execution,
      result: execution.result ? JSON.parse(execution.result) : {},
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/local/executions/:id — update execution (status, result, error)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = sqliteDb.getExecution(id)

    if (!existing) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    const body = await req.json()
    sqliteDb.updateExecution(id, {
      status: body.status,
      result: body.result,
      error: body.error,
      durationMs: body.durationMs ?? body.duration_ms,
      completedAt: body.completedAt ?? body.completed_at,
    })

    const updated = sqliteDb.getExecution(id)
    return NextResponse.json({
      ...updated,
      result: updated?.result ? JSON.parse(updated.result) : {},
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
