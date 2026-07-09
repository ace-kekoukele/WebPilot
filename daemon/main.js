// daemon/main.js — bridge daemon 编排入口 (v4.0.0)
//
// 启动顺序:
//   1. parseArgs
//   2. loadConfig
//   3. setupLogger
//   4. 信号处理 (SIGINT/SIGTERM)
//   5. startChromeManager (创建桌面/开始菜单 Chrome .lnk, 等用户启 Chrome)
//   6. startWatchdog → ensureBridge
//   7. startMcpServer / startHttpApi / startControlServer
//   8. startMemoryGuard
//   9. startModuleCleanup (tab close hooks 装上)
//  10. emit('ready')
//
// v4.0 行为:
//   - BB 不启动 Chrome (用户驱动)
//   - BB attach 到用户 Chrome (9222)
//   - BB 退出不影响 Chrome
//   - WS 断线自动重连 (cdp-watchdog)
//   - 端口冲突自动迁移 (port-finder)
import { parseArgs } from 'node:util';
import { existsSync, writeFileSync } from 'node:fs';
import { DEFAULT_PORTS, PRODUCT_NAME, VERSION, banner } from '../lib/version.js';
import { loadConfig, currentConfig, saveConfig, startWatching } from './config.js';
import { setupLogger, getLogger } from './logger.js';
import { startMemoryGuard } from './memory-guard.js';
import { installModuleCleanup } from '../lib/cdp/module-cleanup.js';
import { negotiatePorts } from './port-finder.js';
import { createChromeShortcutLinks } from './browser-launcher.js';
import { discoverBrowsers } from './browser-picker.js';
import { detectSystemProxy, detectVPN, buildChromeProxyFlags } from './network-proxy.js';
import { startWatchdog, getWatchdog } from './cdp-watchdog.js';

// ──── daemon state ──────────────────────────────────────────────
const daemonState = {
  startedAt: null,
  config: null,
  ports: null,
  proxies: null,
  vpns: null,
  browser: null,
};

// ──── arg parse ──────────────────────────────────────────────────
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      'ipc-stdio': { type: 'boolean' },
      'cli': { type: 'string' },
      foreground: { type: 'boolean' },
      'config': { type: 'string' },
      'port-override': { type: 'string' },
    },
    allowPositionals: false,
    strict: false,
  });
  return values;
}

// ──── Chrome 快捷方式创建（首次启动 wizard 完成后） ────────────
async function installChromeShortcutIfNeeded() {
  try {
    const cfg = currentConfig();
    if (cfg.cdp.preferredPath && existsSync(cfg.cdp.preferredPath)) {
      const results = await createChromeShortcutLinks(cfg.cdp.preferredPath);
      const ok = results.some((r) => r.ok);
      if (ok) {
        getLogger().info('chrome-shortcut-created', { results });
      } else {
        getLogger().warn('chrome-shortcut-failed', { results });
      }
      return results;
    }
    return [];
  } catch (e) {
    getLogger().error('chrome-shortcut-error', { message: e.message });
    return [];
  }
}

// ──── 探测系统代理 + VPN ─────────────────────────────────────────
async function detectNetwork() {
  try {
    const proxy = await detectSystemProxy();
    const vpn = await detectVPN();
    return { proxy, vpn };
  } catch (e) {
    return { proxy: null, vpn: null, error: e.message };
  }
}

// ──── 探测浏览器 ──────────────────────────────────────────────
async function detectBrowser() {
  try {
    const cfg = currentConfig();
    const discovered = await discoverBrowsers({ preferredPath: cfg.cdp.preferredPath });
    return discovered;
  } catch (e) {
    return { detected: [], best: null, error: e.message };
  }
}

// ──── 端口事件总线 (GUI / IPC 订阅) ─────────────────────────
import { EventEmitter } from 'node:events';
const portEvents = new EventEmitter();
export function getPortEvents() { return portEvents; }

// ──── start MCP/HTTP/Control（按端口协商结果） ────────────────
async function startServers(ports) {
  const cfg = currentConfig();
  const log = getLogger().child({ module: 'daemon' });

  const started = {};
  if (cfg.mcp.enabled) {
    try {
      const { startMcpServer } = await import('../lib/mcp-server.js');
      const m = await startMcpServer({ port: ports.mcp.actual, host: cfg.mcp.host });
      started.mcp = m;
      log.info('mcp-started', { port: m.port });
    } catch (e) { log.error('mcp-start-failed', { error: e.message }); }
  }
  if (cfg.http.enabled) {
    try {
      const { startHttpApi } = await import('../lib/http-api.js');
      const h = await startHttpApi({ port: ports.http.actual, host: cfg.http.host });
      started.http = h;
      log.info('http-started', { port: h.port });
    } catch (e) { log.error('http-start-failed', { error: e.message }); }
  }

  // 启动 console stream (Runtime.consoleAPICalled + Log.entryAdded → SSE)
  try {
    const { ensureConsoleStream } = await import('./console-stream.js');
    await ensureConsoleStream();
    log.info('console-stream-started');
  } catch (e) { log.error('console-stream-failed', { error: e.message }); }
  // control / webhook / sse 暂不接, 留 hook
  return started;
}

// ──── 优雅退出 ──────────────────────────────────────────────
async function gracefulShutdown(signal, started) {
  const log = getLogger().child({ module: 'daemon' });
  log.info(`收到 ${signal}, 优雅退出...`);
  try { getWatchdog().stop(); } catch {}
  // 关 server / 断开 CDP (但不关 Chrome - §27.4)
  for (const [, s] of Object.entries(started || {})) {
    try { await s.close(); } catch {}
  }
  log.info('daemon exit');
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT', daemonState._started));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', daemonState._started));

// ──── start ─────────────────────────────────────────────────────
export async function startDaemon(options = {}) {
  const log = getLogger().child({ module: 'daemon' });

  log.info(`starting ${PRODUCT_NAME} v${VERSION}`);
  console.error(banner());

  // 1. 加载配置
  loadConfig();
  startWatching();
  daemonState.config = currentConfig();
  log.debug('config-loaded', { configPath: daemonState.config });

  // 2. 模块清理 hooks 装上
  installModuleCleanup();

  // 3. 内存监控
  startMemoryGuard();

  // 4. 网络探测（proxy + vpn）
  const net = await detectNetwork();
  daemonState.proxies = net.proxy;
  daemonState.vpns = net.vpn;
  log.info('network-detected', { proxyEnabled: net.proxy?.enabled, vpnActive: net.vpn?.active });

  // 5. 端口协商
  try {
    const wantPorts = {
      cdp: daemonState.config.cdp.port,
      mcp: daemonState.config.mcp.port,
      http: daemonState.config.http.port,
      control: daemonState.config.control.port,
      sse: DEFAULT_PORTS.sse,
      webhook: DEFAULT_PORTS.webhook,
    };
    const ports = await negotiatePorts(wantPorts, '127.0.0.1');
    daemonState.ports = ports;
    log.info('port-negotiated', { ports });
    // 写回 config（迁移后端口）
    const cpPatch = {};
    if (ports.cdp.migrated) cpPatch.cdp = { port: ports.cdp.actual };
    if (ports.mcp.migrated) cpPatch.mcp = { port: ports.mcp.actual };
    if (ports.http.migrated) cpPatch.http = { port: ports.http.actual };
    if (Object.keys(cpPatch).length > 0) {
      const { patchConfig } = await import('./config.js');
      patchConfig(cpPatch);
    }
    // 触发 port-changed 事件 (给 GUI 弹 toast)
    const migrated = Object.entries(ports).filter(([k, v]) => v && v.migrated).map(([k, v]) => ({
      name: k, requested: v.requested, actual: v.actual,
    }));
    if (migrated.length > 0) {
      portEvents.emit('port-changed', { migrated, ports });
      log.warn('ports-migrated', { migrated, hint: '你可以在 ⚙ 设置 → 🔗 连接 里改回默认端口' });
    }
  } catch (e) {
    log.error('port-negotiation-failed', { error: e.message });
    throw e;
  }

  // 6. 启动 watchdog → 自动 ensureBridge
  startWatchdog();

  // 7. 浏览器探测 + 创建 .lnk（如果需要）
  const browserDiscover = await detectBrowser();
  daemonState.browser = browserDiscover;
  log.info('browser-detected', { count: browserDiscover.detected?.length || 0, best: browserDiscover.best?.name });
  if (browserDiscover.best?.path) {
    await installChromeShortcutIfNeeded();
  }

  // 8. 启动 MCP / HTTP server
  const started = await startServers(daemonState.ports);
  daemonState._started = started;

  daemonState.startedAt = Date.now();
  log.info('daemon-ready', { uptime: 0 });
  return {
    ...daemonState,
    started,
    watchdog: getWatchdog(),
  };
}

// ──── 直接跑这个文件时: standalone 模式 ───────────────────────
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  parseCliArgs();
  startDaemon().catch((e) => {
    console.error('[daemon] failed to start:', e);
    process.exit(1);
  });
}
