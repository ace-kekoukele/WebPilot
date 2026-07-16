// daemon/browser-picker.js — 在用户机器上探测所有 CDP-capable 浏览器
//
// v4.0.0 设计 (§19, §27):
//   - 不主动启动 Chrome 进程, 只寻找用户已装的 .exe
//   - 多 Chrome 时: 用户指定 > 最新 Stable > 最新 Beta > 最新 Dev > ... > 其他
//   - 验证每个候选是否支持 CDP (sandbox + --version + /json/version probe)
//
// 由于 v4.0 只支持 Windows, 这里只实现 Windows 路径探测.
// Mac/Linux 路径在 v4.1 补 (PLATFORM.SUPPORTED 已声明).
import { existsSync } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { DEFAULT_PORTS } from '../lib/version.js';

// ──── well-known Chrome 安装路径 (Windows) ────────────────────────
const WINDOWS_CHROME_PATHS = [
  '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe',
  '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe',
  '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe',
  // User-level install
  '%LOCALAPPDATA%\\Programs\\Google Chrome\\chrome.exe',
];

const WINDOWS_EDGE_PATHS = [
  '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe',
  '%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe',
];

const WINDOWS_BRAVE_PATHS = [
  '%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  '%ProgramFiles(x86)%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
];

// `where.exe chrome` 输出多行, 取第一个
function whereFirst(exe) {
  return new Promise((resolve) => {
    execFile('where', [exe], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const line = stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      resolve(line || null);
    });
  });
}

function expandEnv(p) {
  return p.replace(/%([A-Z_]+)%/gi, (_, name) => process.env[name] || p);
}

// ──── version 探测 — 短跑 --version, 5s 超时 ───────────────────────
function probeVersion(exePath) {
  return new Promise((resolve) => {
    let stdout = '';
    let proc;
    try {
      proc = spawn(exePath, ['--version'], {
        windowsHide: true,
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch { return resolve({ version: null, channel: 'unknown' }); }

    let t = setTimeout(() => { try { proc.kill(); } catch {} }, 5000);
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.on('exit', () => {
      clearTimeout(t);
      const text = stdout.trim();
      // "Google Chrome 124.0.6367.91" / "Chromium 124.0.6367.0"
      // "Microsoft Edge 124.0.2478.51" / "Brave 124.0.6367.91"
      const m = text.match(/(\d+\.\d+\.\d+\.\d+)/);
      const version = m ? m[1] : null;
      let channel = 'stable';
      if (/SxS|Canary/i.test(exePath)) channel = 'canary';
      else if (/Beta/i.test(text)) channel = 'beta';
      else if (/Dev/i.test(text)) channel = 'dev';
      resolve({ version, channel, raw: text });
    });
    proc.on('error', () => {
      clearTimeout(t);
      resolve({ version: null, channel: 'unknown' });
    });
  });
}

// ──── CDP 能力验证 — sandbox 起进程, 探测 /json/version ────────────
async function validateCDPSupport(exePath, port) {
  if (!port || port < 1) port = DEFAULT_PORTS.cdp;
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(exePath, [
        `--remote-debugging-port=${port}`,
        `--remote-debugging-address=127.0.0.1`,
        '--headless=new',           // 用 headless 验证 — 不影响生产
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--user-data-dir=' + require('os').tmpdir() + '\\webpilot-validate-' + Date.now(),
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { return resolve({ ok: false, reason: 'spawn failed' }); }

    let resolved = false;
    const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };

    let probeTimer;
    const cleanup = () => { try { proc.kill(); } catch {} clearTimeout(probeTimer); };

    // 等 5s 探测
    let tried = 0;
    const tryProbe = async () => {
      tried++;
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
          signal: AbortSignal.timeout(1500),
        });
        if (r.ok) {
          const v = await r.json();
          cleanup();
          finish({
            ok: true,
            browser: v.Browser,
            protocol: v['Protocol-Version'],
            webSocketDebuggerUrl: v.webSocketDebuggerUrl,
          });
          return;
        }
      } catch {}
      if (tried < 6 && !resolved) probeTimer = setTimeout(tryProbe, 1000);
      else { cleanup(); finish({ ok: false, reason: 'CDP not responding' }); }
    };
    tryProbe();

    proc.on('exit', () => { cleanup(); finish({ ok: false, reason: 'exited' }); });
    // hard timeout 8s
    setTimeout(() => { cleanup(); finish({ ok: false, reason: 'timeout' }); }, 8000);
  });
}

// ──── 探测某路径 — 存在? version? CDP? ──────────────────────────
async function probeOne(exePath) {
  if (!exePath) return null;
  if (!existsSync(exePath)) return null;

  const { version, channel, raw } = await probeVersion(exePath);
  if (!version) return null;

  const cdp = await validateCDPSupport(exePath, 0);   // 0 = 自动分配
  // Firefox 等不支持 CDP 的会被 validateCDPSupport 返回 ok:false
  return {
    path: exePath,
    version,
    channel,
    raw,
    name: raw.split(/\s+/)[0] || 'Unknown',
    cdpSupported: cdp.ok,
    cdpInfo: cdp,
  };
}

// ──── 扫描所有常见位置 ────────────────────────────────────────────
async function scanWindows() {
  const candidates = [];
  const seen = new Set();
  const push = (path) => {
    const expanded = expandEnv(path);
    if (seen.has(expanded)) return;
    seen.add(expanded);
    candidates.push(expanded);
  };

  for (const p of WINDOWS_CHROME_PATHS) push(p);
  for (const p of WINDOWS_EDGE_PATHS) push(p);
  for (const p of WINDOWS_BRAVE_PATHS) push(p);

  // PATH 探测
  for (const exe of ['chrome.exe', 'msedge.exe', 'brave.exe', 'chromium.exe']) {
    const w = await whereFirst(exe);
    if (w) push(w);
  }

  const results = [];
  for (const p of candidates) {
    try {
      const r = await probeOne(p);
      if (r && r.cdpSupported) results.push(r);
    } catch {}
  }
  return results;
}

// ──── 选最佳 browser (latest Stable > user override > ...) ───────
export function pickBest(candidates, preferred = null) {
  if (!candidates || candidates.length === 0) return null;
  // 1. 用户指定
  if (preferred) {
    const hit = candidates.find((c) => c.path === preferred);
    if (hit) return { ...hit, reason: 'user-preferred' };
  }
  // 2. 按 channel 优先级: stable > beta > dev > canary
  const order = ['stable', 'beta', 'dev', 'canary'];
  for (const channel of order) {
    const inChannel = candidates.filter((c) => c.channel === channel);
    if (inChannel.length) {
      inChannel.sort((a, b) => {
        const va = a.version.split('.').map((n) => parseInt(n, 10));
        const vb = b.version.split('.').map((n) => parseInt(n, 10));
        for (let i = 0; i < Math.max(va.length, vb.length); i++) {
          const da = (va[i] || 0) - (vb[i] || 0);
          if (da !== 0) return -da;   // 降序
        }
        return 0;
      });
      return { ...inChannel[0], reason: `latest-${channel}` };
    }
  }
  // 3. 其他
  return { ...candidates[0], reason: 'fallback' };
}

// ──── 对外主函数 — 给 daemon/main.js 调用 ─────────────────────────
export async function discoverBrowsers({ preferredPath } = {}) {
  const result = await scanWindows();
  const best = pickBest(result, preferredPath);
  return { detected: result, best };
}

// ──── 事件流（emit 'discover:done' / 'discover:browser'） ─────────
class DiscoverEmitter extends EventEmitter {}
export const discoverEvents = new DiscoverEmitter();
