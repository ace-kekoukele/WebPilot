// lib/mcp-tool-bridge.js — 把 tools/*.js 包成 MCP server 注册所需的形式 (zod schema + handler)
// 仅被 lib/mcp-server.js 消费; 其它 HTTP API 路径无需 zod,直接用 lib/tool-loader.js 的 raw 形态。
import { z } from 'zod';
import { loadAllTools } from './tool-loader.js';
import { validateArgs } from './zod-helper.js';

/**
 * JSON-Schema 风格 → zod schema.
 * 支持 type: string/number/boolean/array/object/enum,以及 description / required.
 */
function paramsToZod(params) {
  const shape = {};
  for (const [k, v] of Object.entries(params || {})) {
    let s;
    if (v.enum) s = z.enum(v.enum);
    else if (v.type === 'string') s = z.string();
    else if (v.type === 'number') s = z.number();
    else if (v.type === 'boolean') s = z.boolean();
    else if (v.type === 'array') s = z.array(z.any());
    else if (v.type === 'object') s = z.record(z.any());
    else s = z.any();
    if (v.description && !s.description) {
      try { s = s.describe(v.description); } catch {}
    }
    if (!v.required) s = s.optional();
    shape[k] = s;
  }
  return z.object(shape).passthrough();
}

/**
 * 把 raw tool (name/description/parameters/execute) 包成 MCP SDK 注册格式。
 * @param {object} raw - tool-loader 的单条结果
 * @returns {{ name: string, description: string, inputSchema: z.ZodObject, handler: Function, parameters: object } | null}
 */
function wrapForMcp(raw) {
  try {
    let inputSchema;
    try { inputSchema = paramsToZod(raw.parameters); }
    catch { inputSchema = z.object({}).passthrough(); }

    const handler = async (args) => {
      const v = validateArgs(args, inputSchema);
      if (!v.valid) {
        return { content: [{ type: 'text', text: JSON.stringify(v.error) }], isError: true };
      }
      try {
        const result = await raw.execute(v.data || args || {}, {});
        const text = result?.content?.[0]?.text
          || (typeof result === 'string' ? result : JSON.stringify(result));
        return {
          content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text, null, 2) }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    };

    return {
      name: raw.name,
      description: (raw.description || raw.name).slice(0, 200),
      inputSchema,
      handler,
      parameters: raw.parameters,
    };
  } catch {
    return null;
  }
}

/**
 * 加载并包装所有 tools/* 为 MCP 注册格式。
 * @returns {Promise<Array>} 包装好的工具列表 — 直接遍历注册到 McpServer
 */
export async function loadToolsForMcp() {
  const raws = await loadAllTools();
  const out = [];
  for (const r of raws) {
    const w = wrapForMcp(r);
    if (w) out.push(w);
  }
  return out;
}