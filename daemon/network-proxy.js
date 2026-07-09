// daemon/network-proxy.js — 系统代理 / VPN 检测 (Windows 优先)
// §16 设计. v4.0 only Windows.
//
// detectSystemProxy() 输出: { enabled, type, host, port, bypass, pacUrl, source }
// detectVPN()           输出: { active, connections: [...] }
// buildChromeProxyFlags(proxy, vpn) → [] (Chrome flags)
import { execFile } from 'node:child_process';

// ──── Windows 代理查询 — 注册表 + PowerShell ─────────────────────
const PROXY_REG_PATH = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function regQuery(name) {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', PROXY_REG_PATH, '/v', name],
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        // 输出格式: "    ProxyEnable    REG_DWORD    0x1"
        const m = stdout.match(/REG_DWORD\s+(0x[0-9a-f]+|.+)/i) || stdout.match(/\s+(0x[0-9a-f]+|[01])\s*$/i);
        resolve(m ? m[1].trim() : null);
      },
    );
  });
}

async function detectWindowsSystemProxy() {
  const enabledRaw = await regQuery('ProxyEnable');
  const enabled = enabledRaw === '0x1' || enabledRaw === '1';
  if (!enabled) return { enabled: false };

  // ProxyServer 格式: "127.0.0.1:7890" 或 "http=127.0.0.1:7890;https=127.0.0.1:7890" 或 "socks=127.0.0.1:1080"
  const server = await regQuery('ProxyServer');

  // PAC: AutoConfigURL 形如 "http://wpad/wpad.dat"
  const pac = await regQuery('AutoConfigURL');

  // ProxyOverride 形如: "localhost;127.*;10.*;*.local"
  const overrideRaw = await regQuery('ProxyOverride');
  const bypass = (overrideRaw || '').replace(/"/g, '').replace(/;/g, ',');

  let type = 'http', host = '127.0.0.1', port = 0;
  if (server) {
    if (server.toLowerCase().startsWith('socks=')) {
      type = 'socks5';
      const rest = server.split('=')[1];
      [host, port] = rest.split(':');
    } else if (server.includes('=')) {
      // "http=127.0.0.1:7890" 取 https=
      const httpsPart = server.split(';').find((p) => p.startsWith('https='));
      if (httpsPart) {
        const v = httpsPart.split('=')[1];
        [host, port] = v.split(':');
      }
    } else {
      [host, port] = server.split(':');
    }
  }

  return {
    enabled: true,
    type,
    host,
    port: parseInt(port, 10) || 0,
    bypass: bypass || 'localhost,127.0.0.1,*.local',
    auto: false,
    pacUrl: pac || null,
    source: 'windows-registry',
  };
}

// ──── macOS / Linux 占位 — v4.1 ──────────────────────────────────
async function detectNonWindowsSystemProxy() {
  return { enabled: false, type: null, host: null, port: 0, bypass: null, source: 'not-implemented' };
}

// ──── VPN 探测 — Windows: Get-VpnConnection ─────────────────────
function psExec(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
       '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        resolve(err ? null : stdout);
      },
    );
  });
}

async function detectWindowsVPN() {
  const ps = `
Get-VpnConnection -ErrorAction SilentlyContinue |
  Where-Object { $_.ConnectionStatus -eq 'Connected' } |
  Select-Object Name, ServerAddress |
  ConvertTo-Csv -NoTypeInformation
`;
  try {
    const out = await psExec(ps);
    if (!out || out.trim().length < 5) return { active: false, connections: [] };
    // 解析 CSV
    const lines = out.trim().split(/\r?\n/);
    if (lines.length < 2) return { active: false, connections: [] };
    const header = lines[0].replace(/^"|"$/g, '').split('","').map((s) => s.replace(/"/g, ''));
    const conns = lines.slice(1).map((line) => {
      const cols = line.replace(/^"|"$/g, '').split('","').map((s) => s.replace(/"/g, ''));
      const obj = {};
      header.forEach((h, i) => { obj[h] = cols[i]; });
      return { name: obj.Name || 'unknown', server: obj.ServerAddress || '' };
    });
    return { active: conns.length > 0, connections: conns };
  } catch {
    return { active: false, connections: [] };
  }
}

async function detectNonWindowsVPN() {
  return { active: false, connections: [] };
}

// ──── main: detect ──────────────────────────────────────────────
export async function detectSystemProxy() {
  if (process.platform === 'win32') return detectWindowsSystemProxy();
  return detectNonWindowsSystemProxy();
}

export async function detectVPN() {
  if (process.platform === 'win32') return detectWindowsVPN();
  return detectNonWindowsVPN();
}

// ──── Chrome flags builder ───────────────────────────────────────
export function buildChromeProxyFlags(proxy, vpn) {
  const flags = [];
  if (!proxy || !proxy.enabled || !proxy.host || !proxy.port) return flags;
  const server = `${proxy.host}:${proxy.port}`;
  if (proxy.type === 'socks5') flags.push(`--proxy-server=socks5://${server}`);
  else flags.push(`--proxy-server=${server}`);
  if (proxy.bypass) flags.push(`--proxy-bypass-list=${proxy.bypass}`);
  if (proxy.pacUrl) flags.push(`--proxy-pac-url=${proxy.pacUrl}`);
  return flags;
}

// ──── test override（开发/测试时用） ──────────────────────────
export function applyOverride(proxy, vpn) {
  const ov = process.env.BB_PROXY_OVERRIDE;
  if (ov) {
    try {
      const parsed = JSON.parse(ov);
      Object.assign(proxy, parsed);
    } catch {}
  }
  const ovVpn = process.env.BB_VPN_OVERRIDE;
  if (ovVpn) {
    try { return { active: true, connections: JSON.parse(ovVpn) }; }
    catch {}
  }
  return null;
}
