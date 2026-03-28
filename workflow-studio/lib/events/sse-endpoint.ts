/**
 * SSE endpoint stub — stripped during Sim Studio fork.
 */

import { NextResponse } from 'next/server'

export interface SSESubscription {
  subscribe: (workspaceId: string, send: (event: string, data: any) => void) => () => void
}

export interface CreateWorkspaceSSEOptions {
  label: string
  subscriptions: SSESubscription[]
}

export function createWorkspaceSSE(_options: CreateWorkspaceSSEOptions) {
  return async function GET() {
    return new NextResponse('SSE not available in this build', { status: 501 })
  }
}
