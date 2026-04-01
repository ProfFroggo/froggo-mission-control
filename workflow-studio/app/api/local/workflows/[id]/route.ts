import { sqliteDb } from '@sim/db'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/local/workflows/:id — get a single workflow
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const workflow = sqliteDb.getWorkflow(id)

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/local/workflows/:id — update a workflow
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = sqliteDb.getWorkflow(id)

    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const body = await req.json()
    sqliteDb.saveWorkflow(id, {
      name: body.name,
      description: body.description,
      color: body.color,
      state: body.state,
      variables: body.variables,
      is_deployed: body.is_deployed,
    })

    const updated = sqliteDb.getWorkflow(id)
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/local/workflows/:id — delete a workflow
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const existing = sqliteDb.getWorkflow(id)

    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    sqliteDb.deleteWorkflow(id)
    return NextResponse.json({ deleted: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
