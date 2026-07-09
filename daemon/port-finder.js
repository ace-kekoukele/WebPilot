// daemon/port-finder.js — 端口冲突自动迁移
//
// §18.1 修复项 #02-05: 9222 (CDP) / 9223 (MCP) / 9224 (HTTP) / 9225 (Control)
//                     / 9226 (SSE) / 9227 (webhook) 端口被占时
//                     自动迁移到下一可用端口 + 持久化到 config.json
import net from 'node:net';

const PORT_RANGES = {
  cdp:      [9222, 9232],   // 9222 + 10 尝试
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
export async function findAvailablePort(preferred, range = null, host = '127.0.0.1') {
  const max = (range && range[1]) || (preferred + 10);
  const min = (range && range[0]) || preferred;

  for (let p = preferred; p <= max; p++) {
    if (p < min) continue;
    if (await isPortFree(p, host)) return p;
  }
  return null;  // 全占用
}

// 找到所有端口 (CDP/MCP/HTTP/Control) 的可用配置
export async function negotiatePorts(preferred = {}, host = '127.0.0.1') {
  const result = {};
  for (const [name, defaultPort] of Object.entries({
    cdp: 9222, mcp: 9223, http: 9224, control: 9225, sse: 9226, webhook: 9227,
  })) {
    const wantPort = preferred[name] || defaultPort;
    const got = await findAvailablePort(wantPort, PORT_RANGES[name], host);
    if (got === null) {
      throw new Error(`无法为 ${name} 找到空闲端口 (range ${PORT_RANGES[name].join('-')})`);
    }
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
