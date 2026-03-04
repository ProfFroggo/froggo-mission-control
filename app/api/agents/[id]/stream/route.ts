import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message, model } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const proc = spawn('claude', [
          '--agents', id,
          '--print',
          '--output-format', 'stream-json',
          '--model', model || 'claude-sonnet-4-5',
          message,
        ], {
          cwd: process.cwd(),
          env: { ...process.env },
        });

        proc.stdout.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
            } catch {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'text', text: line })}\n\n`
              ));
            }
          }
        });

        proc.stderr.on('data', (data: Buffer) => {
          const err = data.toString().trim();
          if (err) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'debug', text: err })}\n\n`
            ));
          }
        });

        proc.on('close', (code) => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'done', code })}\n\n`
          ));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        });

        proc.on('error', (err) => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`
          ));
          controller.close();
        });

        // Timeout after 10 minutes
        setTimeout(() => {
          proc.kill();
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'timeout', text: 'Stream timeout after 10 minutes' })}\n\n`
          ));
          controller.close();
        }, 600000);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', text: msg })}\n\n`
        ));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
