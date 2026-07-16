// lib/routes/formats.js — /api/openapi.json, /api/formats/*, /api/a2a
// v4.0 多格式工具清单生成器 (§17) — 让 Agent 用 OpenAI/Anthropic/Gemini JSON Schema 接入
import { jsonResponse, pathOnly } from './_shared.js';
import { VERSION, PRODUCT_NAME, PROTOCOL_VERSION } from '../version.js';

const FORMAT_GENERATORS_PATH = '../../daemon/format-generators/index.js';
const FORMATS = ['openai', 'anthropic', 'gemini'];

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method !== 'GET') return false;

  if (url === '/api/openapi.json') {
    try {
      const generators = await import(FORMAT_GENERATORS_PATH);
      const tools = await generators.loadAllToolsSpec();
      const spec = generators.openapi.generate(tools, { version: VERSION });
      jsonResponse(res, 200, spec);
    } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }

  for (const fmt of FORMATS) {
    if (url === `/api/formats/${fmt}`) {
      try {
        const generators = await import(FORMAT_GENERATORS_PATH);
        if (!generators[fmt]) return jsonResponse(res, 404, { ok: false, error: `unknown format: ${fmt}` });
        const tools = await generators.loadAllToolsSpec();
        const out = generators[fmt].generate(tools);
        jsonResponse(res, 200, out);
      } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
      return true;
    }
  }

  if (url === '/api/formats/a2a') {
    try {
      const generators = await import(FORMAT_GENERATORS_PATH);
      const tools = await generators.loadAllToolsSpec();
      jsonResponse(res, 200, buildA2ACard(tools));
    } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }

  return false;
}

/** A2A protocol agent card (§25) */
function buildA2ACard(tools) {
  return {
    id: 'webpilot',
    name: PRODUCT_NAME,
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      streaming: true,
      tools: tools.length,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: tools.map((t) => ({
      id: t.name,
      name: t.name,
      description: t.description,
      tags: ['browser', 'cdp'],
      examples: [],
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    })),
    provider: {
      organization: 'WebPilot',
      url: 'https://github.com/ace-kekoukele/webpilot',
    },
    urls: [],
  };
}