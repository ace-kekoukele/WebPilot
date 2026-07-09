// daemon/discovery/agent-detect.js — 扫描本机 MCP Agent 配置 (§23.7)
//
// v4.0 默认**不自动写**配置; 只扫描 + 列给用户 + 在 wizard 让用户选才写.
// 写配置由 wizard 控制 (auto-mode 时只显示, 不写).
//
// 支持 5 个核心 Agent + 1 个 universal fallback (检测任何 mcpServers 文件)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';

function readJsonSafe(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch { return null; }
}

function expandEnv(p) {
  return p.replace(/%([A-Z_]+)%/gi, (_, name) => process.env[name] || p);
}

// ──── 单个 Agent 探测器 ────────────────────────────────────────
async function detectClaudeDesktop() {
  const configPath = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Claude', 'claude_desktop_config.json',
  );
  if (!existsSync(configPath)) return null;
  const json = readJsonSafe(configPath);
  if (!json) return null;
  const mcpServers = Object.keys(json.mcpServers || {});
  return {
    detected: true,
    id: 'claude-desktop',
    name: 'Claude Desktop',
    configPath,
    mcpServers,
    ourServerExists: !!(json.mcpServers && (json.mcpServers['browser-bridge'] || json.mcpServers['webpilot'])),
    schemaValid: typeof json === 'object' && Array.isArray(mcpServers),
  };
}

async function detectClaudeCode() {
  const configPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!existsSync(configPath)) return null;
  const json = readJsonSafe(configPath);
  if (!json) return null;
  const mcpServers = Object.keys((json.mcpServers) || {});
  return {
    detected: true,
    id: 'claude-code',
    name: 'Claude Code (CLI)',
    configPath,
    mcpServers,
    ourServerExists: !!(json.mcpServers && (json.mcpServers['browser-bridge'] || json.mcpServers['webpilot'])),
    schemaValid: typeof json === 'object',
  };
}

async function detectCursor() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [
    path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'config.json'),
    path.join(appData, 'Cursor', 'User', 'globalStorage', 'mcp.json'),
    path.join(appData, 'Cursor', 'User', 'settings.json'),
  ];
  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue;
    const json = readJsonSafe(configPath);
    if (!json) continue;
    const mcpServers = Object.keys(json.mcpServers || {});
    if (mcpServers.length > 0 || configPath.endsWith('settings.json')) {
      return {
        detected: true,
        id: 'cursor',
        name: 'Cursor',
        configPath,
        mcpServers,
        ourServerExists: !!(json.mcpServers && (json.mcpServers['browser-bridge'] || json.mcpServers['webpilot'])),
        schemaValid: true,
      };
    }
  }
  return null;
}

async function detectContinue() {
  const configPath = path.join(os.homedir(), '.continue', 'config.json');
  if (!existsSync(configPath)) return null;
  const json = readJsonSafe(configPath);
  if (!json) return null;
  const mcpServers = Object.keys((json.mcpServers) || (json.experimental?.modelContextProtocolServers) || {});
  return {
    detected: true,
    id: 'continue',
    name: 'Continue (VS Code)',
    configPath,
    mcpServers,
    ourServerExists: !!(json.mcpServers && (json.mcpServers['browser-bridge'] || json.mcpServers['webpilot'])),
    schemaValid: typeof json === 'object',
  };
}

// MiniMax Code (国产 Coding Agent) — 配置通常在 ~/.MiniMax/ 或 ~/.config/MiniMax/
async function detectMiniMaxCode() {
  const candidates = [
    path.join(os.homedir(), '.MiniMax', 'settings.json'),
    path.join(os.homedir(), '.config', 'MiniMax', 'settings.json'),
  ];
  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue;
    const json = readJsonSafe(configPath);
    if (!json) continue;
    const mcpServers = json.mcpServers || json.mcps || {};
    return {
      detected: true,
      id: 'MiniMax-code',
      name: 'MiniMax Code (国产 Coding Agent)',
      configPath,
      mcpServers: Object.keys(mcpServers),
      ourServerExists: !!(mcpServers['browser-bridge'] || mcpServers['webpilot']),
      schemaValid: typeof json === 'object',
    };
  }
  return null;
}

// ──── universal fallback — 找任何 mcpServers 文件 ──────────────
async function scanUniversalMcpFiles() {
  const found = [];
  const candidates = [
    path.join(os.homedir(), '.codex', 'config.toml'),     // OpenAI Codex
    path.join(os.homedir(), '.aider.conf.yml'),          // Aider
    path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json'),  // Cline
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    found.push({
      id: path.basename(path.dirname(p)) + ':' + path.basename(p),
      name: `${path.basename(p)} (通用检测)`,
      configPath: p,
      format: p.endsWith('.toml') ? 'toml' : p.endsWith('.yml') ? 'yaml' : 'json',
      detected: true,
      universal: true,
    });
  }
  return found;
}

// ──── main: detectAll ──────────────────────────────────────────
export async function detectAll() {
  const known = await Promise.all([
    detectClaudeDesktop(),
    detectClaudeCode(),
    detectCursor(),
    detectContinue(),
    detectMiniMaxCode(),   // 国内 Coding Agent
  ]);
  const universal = await scanUniversalMcpFiles();
  const out = known.filter(Boolean);
  return { known: out, universal };
}

export const KNOWN_AGENT_IDS = ['claude-desktop', 'claude-code', 'cursor', 'continue', 'MiniMax-code'];

// ──── 事件发射（wizard 订阅） ─────────────────────────────────
class AgentDetectEmitter extends EventEmitter {}
export const agentDetectEvents = new AgentDetectEmitter();
