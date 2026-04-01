import { NextRequest, NextResponse } from 'next/server'
import { WORKFLOW_TEMPLATES, getTemplate } from '../../../../templates'

// GET /api/local/templates — list all templates
// GET /api/local/templates?id=xxx — get specific template
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const template = getTemplate(id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json(template)
  }

  // Return list without full workflow data (just metadata)
  const list = WORKFLOW_TEMPLATES.map(({ workflow, ...meta }) => meta)
  return NextResponse.json({ templates: list })
}
