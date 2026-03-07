import { WebSocket } from 'undici';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCRAPE_ST_API_KEY = '72c4b6224bb8b92a39490134e69128621d5f68363529fd00c6c71c43428ef917';

export async function GET() {
  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let isClientDisconnected = false;

  const stream = new ReadableStream({
    start(controller) {
      ws = new WebSocket('wss://scrape.st/ws', {
        headers: { 'x-api-key': SCRAPE_ST_API_KEY },
      });

      ws.addEventListener('open', () => {
        if (isClientDisconnected) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event: 'connected' })}\n\n`),
        );
        // Send keepalive comment every 25s
        pingInterval = setInterval(() => {
          if (!isClientDisconnected) {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
            } catch {
              // ignore
            }
          }
        }, 25000);
      });

      ws.addEventListener('message', (event) => {
        if (isClientDisconnected) return;
        try {
          const message =
            typeof event.data === 'string' ? event.data : String(event.data);
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (e) {
          console.error('[x-tracker/stream] encode error:', e);
        }
      });

      ws.addEventListener('error', (event) => {
        console.error(
          '[x-tracker/stream] ws error:',
          (event as ErrorEvent).message || 'unknown',
        );
      });

      ws.addEventListener('close', () => {
        if (pingInterval) clearInterval(pingInterval);
        if (isClientDisconnected) return;
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ event: 'disconnected' })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          // controller may already be closed
        }
      });
    },
    cancel() {
      isClientDisconnected = true;
      if (pingInterval) clearInterval(pingInterval);
      if (ws) {
        ws.close();
        ws = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
