// lib/http-api.js — HTTP REST API for WebPilot (v4.0.4 — routes/ 重构版)
// 路由 40+ 分发已拆分至 lib/routes/*.js; 本文件只做 bootstrap。
//
// 端点总览(完整列表见 lib/routes/index.js MATCHERS):
//   /api/health, /api/repair
//   /api/tools/{list,call}, /api/cdp/send
//   /api/console/{stream,recent}
//   /api/ports (GET/POST), /api/{agents,activity,browser/tabs,gui-source}
//   /api/network/* (8 个端点 — §3.5.2 网络逆向)
//   /api/recorder/* (4 个端点 — §3.6 录制器)
//   /api/llm/{providers,active,chat} (chat 真流式 SSE)
//   /api/settings/<cat> (GET/POST)
//   /api/openapi.json, /api/formats/{openai,anthropic,gemini,a2a}
//
// 默认端口 9224 (MCP 9223 不冲突),可用 BB_HTTP_PORT / BB_HTTP_HOST 改。
import http from 'node:http';
import { handleHttp } from './routes/index.js';
import { loadAllTools } from './tool-loader.js';
import { setHttpPort, currentHttpPort } from './routes/_shared.js';
import { DEFAULT_PORTS, VERSION } from './version.js';

const DEFAULT_PORT = parseInt(process.env.BB_HTTP_PORT || String(DEFAULT_PORTS.http), 10);
const DEFAULT_HOST = process.env.BB_HTTP_HOST || '127.0.0.1';

/**
 * 启动 HTTP REST server.
 * @param {{ port?: number, host?: string }} options - port=0 让系统选
 * @returns {Promise<{ host: string, port: number, toolCount: number, close: () => Promise<void> }>}
 */
export async function startHttpApi(options = {}) {
  const port = options.port !== undefined ? options.port : DEFAULT_PORT;
  const host = options.host || DEFAULT_HOST;

  // pre-warm tool cache
  const tools = await loadAllTools();
  console.error(`[http-api] loaded ${tools.length} tools (v${VERSION})`);

  const server = http.createServer((req, res) => {
    handleHttp(req, res).then((handled) => {
      if (!handled) return;  // 让 static-server 处理
    }).catch((err) => {
      console.error('[http-api] unhandled:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address();
      if (actual && typeof actual === 'object') setHttpPort(actual.port);
      resolve();
    });
  });

  // v4.0: 静态文件 serve (GUI 在用户 Chrome 里打开)
  try {
    const { attachStaticHandlers } = await import('../daemon/static-server.js');
    attachStaticHandlers(server);
    console.error(`[http-api] static GUI attached at http://${host}:${currentHttpPort()}/`);
  } catch (e) {
    console.error(`[http-api] static attach failed: ${e.message}`);
  }

  const actualPort = server.address().port;
  console.error(`[http-api] listening on http://${host}:${actualPort}/api/* (${tools.length} tools)`);
  return {
    host, port: actualPort, toolCount: tools.length,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Allow direct execution: `node lib/http-api.js`
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  startHttpApi().catch((err) => {
    console.error('[http-api] failed to start:', err);
    process.exit(1);
  });
}