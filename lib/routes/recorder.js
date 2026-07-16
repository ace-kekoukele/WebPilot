// lib/routes/recorder.js — §3.6 录制器 (start/stop/status/events)
import { jsonResponse, readBody, pathOnly } from './_shared.js';
import { getRecorder, startRecorder, stopRecorder } from '../../daemon/recorder.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'POST' && url === '/api/recorder/start') {
    try {
      const body = await readBody(req, res);
      const { targetId } = body;
      startRecorder(targetId || null);
      jsonResponse(res, 200, { ok: true, recording: true });
    } catch (e) { jsonResponse(res, 400, { ok: false, error: e.message }); }
    return true;
  }

  if (method === 'POST' && url === '/api/recorder/stop') {
    try {
      stopRecorder();
      const r = getRecorder();
      jsonResponse(res, 200, { ok: true, recording: false, eventCount: r.events().length });
    } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }

  if (method === 'GET' && url === '/api/recorder/status') {
    const r = getRecorder();
    jsonResponse(res, 200, { ok: true, recording: r.isRecording(), eventCount: r.events().length });
    return true;
  }

  if (method === 'GET' && url === '/api/recorder/events') {
    const r = getRecorder();
    const u = new URL(req.url, 'http://x');
    const limit = parseInt(u.searchParams.get('limit') || '500', 10);
    jsonResponse(res, 200, { ok: true, events: r.events().slice(-limit) });
    return true;
  }

  return false;
}