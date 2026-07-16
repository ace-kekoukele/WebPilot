// daemon/port-finder.js — 端口冲突自动迁移
//
// §18.1 修复项 #02-05: 9222 (CDP) / 9223 (MCP) / 9224 (HTTP) / 9225 (Control)
//                     / 9226 (SSE) / 9227 (webhook) 端口被占时
//                     自动迁移到下一可用端口 + 持久化到 config.json
import net from 'node:net';

const PORT_RANGES = {
  mcp:      [9223, 9233],
  http:     [9224, 9234],
  control:  [9225, 9235],
  sse:      [9226, 9236],
  webhook:  [9227, 9237],
};

// 单次探测一个端口是否空闲
export function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, host);
  });
}

// 找第一个空闲端口 (在 preferred 范围内)
// 默认: try preferred → preferred+1 → preferred+2 → ...
// exclude: 本轮协商中已经分配给别的服务的端口 — 避免同批内两个服务抢到同一个
//          还没真正 listen 的"空闲"端口 (isPortFree 探测后立刻关闭, 不是占位)。
export async function findAvailablePort(preferred, range = null, host = '127.0.0.1', exclude = new Set()) {
  const max = (range && range[1]) || (preferred + 10);
  const min = (range && range[0]) || preferred;

  for (let p = preferred; p <= max; p++) {
    if (p < min) continue;
    if (exclude.has(p)) continue;
    if (await isPortFree(p, host)) return p;
  }
  return null;  // 全占用
}

// 找到所有端口 (MCP/HTTP/Control/...) 的可用配置
// 注意: cdp 端口不在这里协商 —— 它是用户 Chrome 自己监听的端口 (attach 目标),
// daemon 不绑定它, 也绝不该"迁移"它 (§HANDOFF: 只用用户自己的 Chrome)。
export async function negotiatePorts(preferred = {}, host = '127.0.0.1') {
  const result = {};
  const claimed = new Set();   // 本轮已分配出去的端口, 排除同批冲突
  for (const [name, defaultPort] of Object.entries({
    mcp: 9223, http: 9224, control: 9225, sse: 9226, webhook: 9227,
  })) {
    const wantPort = preferred[name] || defaultPort;
    const got = await findAvailablePort(wantPort, PORT_RANGES[name], host, claimed);
    if (got === null) {
      throw new Error(`无法为 ${name} 找到空闲端口 (range ${PORT_RANGES[name].join('-')})`);
    }
    claimed.add(got);
    result[name] = {
      requested: wantPort,
      actual: got,
      migrated: got !== wantPort,
    };
  }
  return result;
}

// 在 .lnk 启动用户 Chrome 时: 给用户 Chrome 一个 free port 9222
//   这是给 attach 模式用的 — 用户 Chrome 自己的端口不需要我们占用
//   所以这个 finder 主要是给 daemon 自己的 server 用

// 杀占用端口的进程 — PowerShell (Windows only)
export async function killPortOccupant(port) {
  if (process.platform !== 'win32') return { ok: false, reason: 'non-windows' };

  const { execFile } = await import('node:child_process');
  return new Promise((resolve) => {
    // 1. 找 PID 占 9222 的
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', `-Command`,
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1`],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        const pid = (stdout || '').trim().split(/\r?\n/)[0];
        if (!pid || pid === '') return resolve({ ok: false, reason: 'no-process-found' });
        // 2. kill 它
        execFile('taskkill.exe', ['/F', '/PID', pid], { windowsHide: true, timeout: 5000 },
          (e2) => {
            resolve({ ok: !e2, pid, error: e2?.message });
          },
        );
      },
    );
  });
}
