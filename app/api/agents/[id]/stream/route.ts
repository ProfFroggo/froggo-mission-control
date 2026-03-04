import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    // Read message from body (unused in stub, reserved for Phase 12)
    await request.json().catch(() => ({}));

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const textChunk = `data: ${JSON.stringify({ type: 'text', text: 'Agent stream not yet implemented — see Phase 12', agentId })}\n\n`;
        controller.enqueue(encoder.encode(textChunk));

        const doneChunk = `data: [DONE]\n\n`;
        controller.enqueue(encoder.encode(doneChunk));

        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('POST /api/agents/[id]/stream error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
