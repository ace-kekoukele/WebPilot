// lib/version.js — 单一版本源 (v4.0.0 起)
// 所有地方 (index.js / mcp-server.js / http-api.js / package.json / Electron
// package.json 的 build 脚本) 都从这里读。升版本改这里一处即可。
//
// 注意:package.json 的 "version" 字段仍由 npm 使用,发布时手动同步此处。
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __pkgPath = join(__dirname, '..', 'package.json');

/** 产品主版本号 — 升版本只改这里 */
export const VERSION = '4.0.2';

/** 产品名（也用作 MCP serverInfo.name / Application name）*/
export const PRODUCT_NAME = 'WebPilot';

/** 协议版本 — MAJOR 不变 = 完全兼容；MINOR 加 = 新增向后兼容功能 */
export const PROTOCOL_VERSION = '4.0';

/** 兼容的协议版本范围（旧 Agent / 旧 daemon 都能连）*/
export const MIN_COMPATIBLE_PROTOCOL = '4.0';
export const MAX_COMPATIBLE_PROTOCOL = '5.0';

/** 工具 schema 版本 — 改了 tools/*.js 的输出结构时 +1 */
export const TOOL_SCHEMA_VERSION = '4.0';

/** 工具总数（v4.0 起步 = 原 70 + 新增 9 = 79）*/
export const TOOL_COUNT = 79;

/** 可用 CLI 工具集 — 与 lib/cdp/transport.js 配合 */
export const DEFAULT_PORTS = {
  cdp: 9222,        // 用户 Chrome debug port (attach 用)
  mcp: 9223,        // MCP Streamable HTTP
  http: 9224,       // HTTP REST API
  control: 9225,    // bb CLI TCP control
  sse: 9226,        // SSE 实时事件
  webhook: 9227,    // webhook 推送
};

/** 平台 */
export const PLATFORM = {
  SUPPORTED: ['win32'],          // v4.0 仅 Windows
  DEFAULT_NODE: '>=22.0.0',      // Node SEA 要求
};

/** 读取 package.json 中的 git SHA 和仓库信息 */
function readPackageMeta() {
  try {
    if (!existsSync(__pkgPath)) return { gitSha: null, name: PRODUCT_NAME };
    const raw = readFileSync(__pkgPath, 'utf8');
    const json = JSON.parse(raw);
    return { gitSha: json._gitSha || null, name: json.name || PRODUCT_NAME };
  } catch {
    return { gitSha: null, name: PRODUCT_NAME };
  }
}
const _pkgMeta = readPackageMeta();

export const GIT_SHA = _pkgMeta.gitSha;

/** 完整的 serverInfo（给 MCP initialize 用）*/
export function serverInfo() {
  return {
    name: PRODUCT_NAME,
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    minCompatibleProtocol: MIN_COMPATIBLE_PROTOCOL,
    maxCompatibleProtocol: MAX_COMPATIBLE_PROTOCOL,
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    toolCount: TOOL_COUNT,
    gitSha: GIT_SHA,
    supportedPlatforms: PLATFORM.SUPPORTED,
  };
}

/** 简短字符串（给日志 / CLI 输出）*/
export const VERSION_STRING = GIT_SHA
  ? `${VERSION}+${GIT_SHA.slice(0, 7)}`
  : VERSION;

/** 用户可见的友好版本（"WebPilot v4.0.0"）*/
export const DISPLAY_NAME = `${PRODUCT_NAME} v${VERSION}`;

/** HTTP 响应头（跨入口统一加）*/
export const VERSION_HEADERS = {
  'X-WebPilot-Version': VERSION,
  'X-WebPilot-Protocol-Version': PROTOCOL_VERSION,
  'X-WebPilot-Min-Compatible-Version': MIN_COMPATIBLE_PROTOCOL,
  'X-WebPilot-Max-Compatible-Version': MAX_COMPATIBLE_PROTOCOL,
};

/** 当前平台是否支持 */
export function isPlatformSupported(platform = process.platform) {
  return PLATFORM.SUPPORTED.includes(platform);
}

/** 渲染简短 banner（启动时打印）*/
export function banner() {
  const lines = [
    `┌─────────────────────────────────────┐`,
    `│  ${DISPLAY_NAME.padEnd(35)} │`,
    `│  protocol: ${PROTOCOL_VERSION}  tools: ${TOOL_COUNT}  ${VERSION_STRING.padEnd(11)} │`,
    `│  MCP:    http://127.0.0.1:${DEFAULT_PORTS.mcp}/mcp           │`,
    `│  HTTP:   http://127.0.0.1:${DEFAULT_PORTS.http}/api/*         │`,
    `│  attach: http://127.0.0.1:${DEFAULT_PORTS.cdp}/json/version   │`,
    `└─────────────────────────────────────┘`,
  ];
  return lines.join('\n');
}
