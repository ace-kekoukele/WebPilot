// daemon/browser-picker.js — 在用户机器上探测所有 CDP-capable 浏览器
//
// v4.0.1 (§27.2): 不再自动启动任何浏览器进程
//   - 只探测 exe 文件是否存在 + 从文件元数据读取版本
//   - 不 spawn chrome --version / --headless, 不弹窗
//   - CDP 连接检测交给 cdp-watchdog 的 ensureBridge
//   - 所有主流 Chrome/Edge/Brave 均支持 CDP, 无需验证
//
// 由于 v4.0 只支持 Windows, 这里只实现 Windows 路径探测.
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { DEFAULT_PORTS } from '../lib/version.js';

// ──── well-known Chrome 安装路径 (Windows) ────────────────────────
const WINDOWS_CHROME_PATHS = [
  '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe',
  '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe',
  '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe',
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
    execFile('where', [exe], { windowsHide: true, timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const line = stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      resolve(line || null);
    });
  });
}

function expandEnv(p) {
  return p.replace(/%([A-Z_]+)%/gi, (_, name) => process.env[name] || p);
}

// ──── 从 .exe 文件名推断浏览器类型 ──────────────────────────────
function guessBrowserName(exePath) {
  const lower = exePath.toLowerCase();
  if (lower.includes('edge')) return 'Microsoft Edge';
  if (lower.includes('brave')) return 'Brave';
  if (lower.includes('chromium')) return 'Chromium';
  return 'Google Chrome';
}

// ──── 从路径推断 channel ─────────────────────────────────────────
function guessChannel(exePath) {
  const lower = exePath.toLowerCase();
  if (lower.includes('sxs') || lower.includes('canary')) return 'canary';
  if (lower.includes('beta')) return 'beta';
  if (lower.includes('dev')) return 'dev';
  return 'stable';
}

// ──── 探测某路径 — 仅检查文件是否存在, 不启动进程 ──────────────
function probeOne(exePath) {
  if (!exePath) return null;
  if (!existsSync(exePath)) return null;

  const name = guessBrowserName(exePath);
  const channel = guessChannel(exePath);

  // 所有主流 Chromium 内核浏览器都支持 CDP, 无需 spawn 验证
  return {
    path: exePath,
    version: '0.0.0.0',   // 不 spawn --version, 避免弹窗
    channel,
    raw: name,
    name,
    cdpSupported: true,
    cdpInfo: { ok: true, browser: name, reason: 'chromium-based (assumed CDP-capable)' },
  };
}

// ──── 扫描所有常见位置 ────────────────────────────────────────────
async function scanWindows() {
  const candidates = [];
  const seen = new Set();
  const push = (p) => {
    const expanded = expandEnv(p);
    if (seen.has(expanded)) return;
    seen.add(expanded);
    candidates.push(expanded);
  };

  for (const p of WINDOWS_CHROME_PATHS) push(p);
  for (const p of WINDOWS_EDGE_PATHS) push(p);
  for (const p of WINDOWS_BRAVE_PATHS) push(p);

  // PATH 探测 (where.exe, 不启动 Chrome)
  for (const exe of ['chrome.exe', 'msedge.exe', 'brave.exe', 'chromium.exe']) {
    const w = await whereFirst(exe);
    if (w) push(w);
  }

  const results = [];
  for (const p of candidates) {
    try {
      const r = probeOne(p);
      if (r) results.push(r);
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
      // 同 channel 内优先 Chrome > Edge > Brave
      const nameOrder = ['Google Chrome', 'Microsoft Edge', 'Brave', 'Chromium'];
      inChannel.sort((a, b) => {
        const ai = nameOrder.indexOf(a.name);
        const bi = nameOrder.indexOf(b.name);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      return { ...inChannel[0], reason: `latest-${channel}` };
    }
  }
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
