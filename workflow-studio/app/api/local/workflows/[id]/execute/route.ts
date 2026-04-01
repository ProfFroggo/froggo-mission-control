import { sqliteDb } from '@sim/db'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/local/workflows/:id/execute — start a workflow execution
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id: workflowId } = await ctx.params

    const workflow = sqliteDb.getWorkflow(workflowId)
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const executionId = uuid()
    const trigger = (body.trigger as string) || 'manual'

    sqliteDb.createExecution({
      id: executionId,
      workflowId,
      trigger,
    })

    // Increment the workflow's run_count
    sqliteDb.raw
      .prepare('UPDATE workflows SET run_count = run_count + 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(workflowId)

    return NextResponse.json({
      executionId,
      workflowId,
      status: 'running',
      trigger,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
