// lib/routes/console.js — /api/console/stream (SSE), /api/console/recent
import { jsonResponse, pathOnly } from './_shared.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/console/stream') {
    await handleConsoleStream(req, res);
    return true;
  }
  if (method === 'GET' && url === '/api/console/recent') {
    await handleConsoleRecent(req, res);
    return true;
  }
  return false;
}

async function handleConsoleStream(req, res) {
  // SSE: 新事件流式推
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  try {
    const { addSubscriber, removeSubscriber } = await import('../../daemon/console-stream.js');
    addSubscriber(res);
    const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      removeSubscriber(res);
    });
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
    res.end();
  }
}

async function handleConsoleRecent(req, res) {
  try {
    const { getBuffer } = await import('../../daemon/console-stream.js');
    const limit = Math.min(parseInt(new URL(req.url, 'http://x').searchParams.get('limit') || '200'), 1000);
    const all = getBuffer();
    jsonResponse(res, 200, { ok: true, events: all.slice(-limit) });
  } catch (e) {
    jsonResponse(res, 500, { ok: false, error: e.message });
  }
}