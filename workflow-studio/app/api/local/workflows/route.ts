import { sqliteDb } from '@sim/db'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'

// GET /api/local/workflows — list workflows
export async function GET(req: NextRequest) {
  try {
    const deployedOnly = req.nextUrl.searchParams.get('deployedOnly') === 'true'
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10)

    const workflows = sqliteDb.listWorkflows({ deployedOnly, limit, offset })
    return NextResponse.json({ workflows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/local/workflows — create or save a workflow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body.id || uuid()

    sqliteDb.saveWorkflow(id, {
      name: body.name,
      description: body.description,
      color: body.color,
      state: body.state,
      variables: body.variables,
      is_deployed: body.is_deployed,
    })

    const workflow = sqliteDb.getWorkflow(id)
    return NextResponse.json({ id, ...workflow })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
