// lib/tool-loader.js — 共享工具加载逻辑 (供 mcp-server.js + http-api.js 使用)
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as cdp from './cdp/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, '..', 'tools');

// Cache: 一进程只 import 一次
let _cached = null;

/**
 * Load all tools/* modules. Returns: [{ name, description, parameters, execute }]
 * Skips files starting with '_' (private/internal).
 */
export async function loadAllTools() {
  if (_cached) return _cached;
  const files = readdirSync(TOOLS_DIR, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'))
    .map((e) => join(e.parentPath || e.path || TOOLS_DIR, e.name));
  const out = [];
  for (const f of files) {
    try {
      const mod = await import(`file://${f.replace(/\\/g, '/')}`);
      if (mod.name && typeof mod.execute === 'function' && mod.parameters) {
        out.push({
          name: mod.name,
          description: (mod.description || mod.name).slice(0, 200),
          parameters: mod.parameters,
          execute: mod.execute,
        });
      }
    } catch (err) {
      console.error(`[tool-loader] failed to load ${f}:`, err.message);
    }
  }
  _cached = out;
  return out;
}

/**
 * Invoke a tool by name with args.
 * Returns: { ok: true, value } | { ok: false, error }
 */
export async function callTool(name, args = {}) {
  const tools = await loadAllTools();
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  try {
    const result = await tool.execute(args || {}, { cdp });
    if (result && typeof result === 'object') return result;
    return { ok: true, value: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Test-only: reset cache */
export function _resetForTest() {
  _cached = null;
}