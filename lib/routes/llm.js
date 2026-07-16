// lib/routes/llm.js — /api/llm/providers, /api/llm/active, /api/llm/chat (SSE 真流式)
import { jsonResponse, readBody, pathOnly } from './_shared.js';
import { VERSION, VERSION_HEADERS } from '../version.js';
import { loadPresets } from '../../daemon/format-generators/presets.js';
import {
  loadLLMConfig, saveLLMConfig, listProviders,
  streamChat, executeToolCall,
} from '../../daemon/llm-client.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/llm/providers') {
    await handleGetLLMProviders(req, res);
    return true;
  }
  if (method === 'POST' && url === '/api/llm/active') {
    await handleSetActiveLLM(req, res);
    return true;
  }
  if (method === 'POST' && url === '/api/llm/chat') {
    await handleLLMChat(req, res);
    return true;
  }
  return false;
}

async function handleGetLLMProviders(_req, res) {
  try {
    const presets = loadPresets();
    const configured = listProviders();
    const activeId = loadLLMConfig().activeId;
    jsonResponse(res, 200, {
      ok: true,
      // 16 个 preset (一键填充用)
      presets: presets.map((p) => ({
        id: p.id, name: p.name, baseUrl: p.baseUrl,
        defaultModel: p.defaultModel, availableModels: p.availableModels,
        region: (p.regions || []).join(','),
      })),
      // 用户已配置的 provider (含 apiKey)
      configured: configured.map((p) => ({
        id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model,
        type: p.type, active: p.id === activeId,
        hasKey: !!p.apiKey,
      })),
      active: activeId,
    });
  } catch {
    jsonResponse(res, 200, { ok: true, providers: [], configured: [], active: null });
  }
}

async function handleSetActiveLLM(req, res) {
  let body;
  try { body = await readBody(req, res); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  const cfg = loadLLMConfig();

  if (body.action === 'add-preset') {
    const preset = loadPresets().find((p) => p.id === body.presetId);
    if (!preset) return jsonResponse(res, 400, { ok: false, error: 'preset not found' });
    if (!body.apiKey) return jsonResponse(res, 400, { ok: false, error: 'apiKey required' });
    cfg.providers.push({
      id: preset.id + '-' + Date.now(),
      name: body.name || preset.name,
      baseUrl: preset.baseUrl,
      apiKey: body.apiKey,
      model: body.model || preset.defaultModel,
      type: preset.id.includes('anthropic') ? 'anthropic'
          : preset.id.includes('gemini') ? 'gemini'
          : 'openai-compatible',
      presetId: preset.id,
    });
    cfg.activeId = cfg.providers[cfg.providers.length - 1].id;
  } else if (body.action === 'add-custom') {
    if (!body.name || !body.baseUrl || !body.apiKey || !body.model) {
      return jsonResponse(res, 400, { ok: false, error: 'name + baseUrl + apiKey + model required' });
    }
    cfg.providers.push({
      id: 'custom-' + Date.now(),
      name: body.name, baseUrl: body.baseUrl, apiKey: body.apiKey,
      model: body.model, type: body.type || 'openai-compatible',
    });
    cfg.activeId = cfg.providers[cfg.providers.length - 1].id;
  } else if (body.action === 'activate') {
    if (!cfg.providers.find((p) => p.id === body.id)) return jsonResponse(res, 400, { ok: false, error: 'id not in providers' });
    cfg.activeId = body.id;
  } else if (body.action === 'delete') {
    cfg.providers = cfg.providers.filter((p) => p.id !== body.id);
    if (cfg.activeId === body.id) cfg.activeId = cfg.providers[0]?.id || null;
  } else {
    return jsonResponse(res, 400, { ok: false, error: 'unknown action: ' + body.action });
  }
  saveLLMConfig(cfg);
  jsonResponse(res, 200, { ok: true, activeId: cfg.activeId, providers: cfg.providers.map((p) => ({ ...p, hasKey: !!p.apiKey })) });
}

async function handleLLMChat(req, res) {
  let body;
  try { body = await readBody(req, res); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }

  // body: { sessionId, messages, tools: [toolName...] }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-WebPilot-Version': VERSION,
    'Connection': 'keep-alive',
    ...VERSION_HEADERS,
  });

  // 工具 schema (跟 activity-log + tool-loader 对接)
  let tools = [];
  try {
    const { loadAllTools } = await import('../tool-loader.js');
    const all = await loadAllTools();
    if (Array.isArray(body.tools) && body.tools.length > 0) {
      tools = all.filter((t) => body.tools.includes(t.name));
    } else {
      tools = all;
    }
  } catch {}

  try {
    let fullText = '';
    const toolCalls = [];
    for await (const ev of streamChat({ messages: body.messages, tools })) {
      if (ev.content) {
        fullText += ev.content;
        res.write(`data: ${JSON.stringify({ type: 'content', delta: ev.content })}\n\n`);
      } else if (ev.toolCall) {
        // 1. 立刻推 tool_call 给 client
        res.write(`data: ${JSON.stringify({ type: 'tool_call', toolCall: { name: ev.toolCall.name, args: ev.toolCall.args } })}\n\n`);
        // 2. 真的执行 tool
        const r = await executeToolCall(ev.toolCall.name, ev.toolCall.args);
        toolCalls.push({ name: ev.toolCall.name, args: ev.toolCall.args, result: r, ts: Date.now() });
        res.write(`data: ${JSON.stringify({ type: 'tool_result', name: ev.toolCall.name, result: r })}\n\n`);
      } else if (ev.done) {
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolCalls })}\n\n`);
        res.end();
        return;
      }
    }
    res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolCalls })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
    res.end();
  }
}