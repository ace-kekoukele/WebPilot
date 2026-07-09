// scripts/start-mcp-server.mjs - 同时启 MCP + HTTP REST
// 默认: 两者都启 (MCP 9223, HTTP 9224)
//   BB_HTTP_ONLY=1  只启 HTTP
//   BB_MCP_ONLY=1   只启 MCP
//   BB_HTTP_PORT=9225 BB_HTTP_HOST=...
import { startMcpServer } from '../lib/mcp-server.js';
import { startHttpApi } from '../lib/http-api.js';
import { ensureBridge } from '../lib/cdp/index.js';

// Pre-warm Chrome connection
try {
  await ensureBridge(parseInt(process.env.BB_CDP_PORT || '9222', 10), process.env.BB_CDP_HOST || '127.0.0.1');
  console.error('[mcp] Chrome bridge ready');
} catch (e) {
  console.error('[mcp] Warning: Chrome not reachable:', e.message);
}

const httpOnly = process.env.BB_HTTP_ONLY === '1';
const mcpOnly = process.env.BB_MCP_ONLY === '1';

const srvs = [];

if (!httpOnly) {
  const mcpPort = parseInt(process.env.BB_MCP_PORT || '9223', 10);
  const mcpHost = process.env.BB_MCP_HOST || '127.0.0.1';
  const srv = await startMcpServer({ port: mcpPort, host: mcpHost });
  srvs.push({ name: 'mcp', srv });
  console.log(`[mcp] ready at http://${srv.host}:${srv.port}/mcp`);
}

if (!mcpOnly) {
  const srv = await startHttpApi();
  srvs.push({ name: 'http', srv });
  console.log(`[http] ready at http://${srv.host}:${srv.port}/api/*`);
}

const shutdown = async () => {
  console.error('\n[bridge] shutting down...');
  for (const { srv } of srvs) {
    try { await srv.close(); } catch {}
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);