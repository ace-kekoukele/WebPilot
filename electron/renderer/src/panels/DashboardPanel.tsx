// src/panels/DashboardPanel.tsx — 首页仪表盘: 端口/Chrome/Agent/服务状态一目了然
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chrome, Server, Plug, Cpu, Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, ExternalLink, Clock, Activity, Monitor, Copy, Play, Terminal,
  Shield, Zap, Radio, Globe, ArrowRight, HardDrive, type LucideIcon,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/cn';
import { pushToast } from '../components/Toast';

// ──── 端口扫描 ────────────────────────────────────────
interface PortStatus {
  name: string;
  label: string;
  expected: number;
  actual: number | null;
  reachable: boolean;
  description: string;
}

async function scanPort(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return res.ok && data?.ok === true;
  } catch { return false; }
}

async function scanChromeDebugPort(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return !!(data?.Browser);
  } catch { return false; }
}

const DEFAULT_PORTS = [
  { name: 'cdp', label: 'Chrome CDP', expected: 9222, description: 'Chrome 远程调试端口' },
  { name: 'mcp', label: 'MCP Server', expected: 9223, description: 'Agent 工具协议服务' },
  { name: 'http', label: 'HTTP API', expected: 9224, description: 'REST API / Web 面板' },
  { name: 'control', label: 'Control', expected: 9225, description: 'Agent 控制通道' },
  { name: 'sse', label: 'SSE', expected: 9226, description: '实时事件推送' },
  { name: 'webhook', label: 'Webhook', expected: 9227, description: '外部回调接收' },
];

// ──── 格式化 ───────────────────────────────────────────
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

// ──── 组件 ─────────────────────────────────────────────

export function DashboardPanel() {
  const [health, setHealth] = useState<any>(null);
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [chromeDetected, setChromeDetected] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [appInfo, setAppInfo] = useState<any>(null);
  const scanTimer = useRef<any>(null);

  // 扫描所有端口
  const scanAllPorts = useCallback(async () => {
    setScanning(true);
    try {
      // 先拿到 health 确认 daemon 端口
      const h = await apiGet('/api/health').catch(() => null);
      setHealth(h);

      const actualPorts = (h as any)?.ports || {};
      const results: PortStatus[] = [];

      for (const dp of DEFAULT_PORTS) {
        const actual = actualPorts[dp.name] || dp.expected;
        let reachable = false;

        if (dp.name === 'cdp') {
          // CDP 端口通过 Chrome 的 /json/version 探测
          reachable = await scanChromeDebugPort('127.0.0.1', actual);
        } else {
          // 服务端口通过 /api/health 探测
          reachable = await scanPort('127.0.0.1', actual);
        }

        results.push({ ...dp, actual, reachable });
      }
      setPorts(results);
      setChromeDetected(results.find(p => p.name === 'cdp')?.reachable ?? false);
      setLastScan(Date.now());

      // 获取 agent 列表
      const ar = await apiGet('/api/agents').catch(() => ({ agents: [] }));
      setAgents(ar.agents || []);

      // 获取系统信息
      try {
        const info = await (window as any).electronAPI?.getInfo();
        if (info) setAppInfo(info);
      } catch {}
    } catch {
      // daemon 都没起来 — 所有端口标记为不可达
      setPorts(DEFAULT_PORTS.map(dp => ({ ...dp, actual: null, reachable: false })));
    } finally {
      setScanning(false);
    }
  }, []);

  // 启动时扫描 + 每 5 秒刷新
  useEffect(() => {
    scanAllPorts();
    scanTimer.current = setInterval(scanAllPorts, 5000);
    return () => { if (scanTimer.current) clearInterval(scanTimer.current); };
  }, [scanAllPorts]);

  // 一键启动 Chrome
  const launchChrome = () => {
    const cmd = 'chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1';
    navigator.clipboard.writeText(cmd).then(() => {
      pushToast({ kind: 'info', title: '命令已复制', description: cmd, duration: 4000 });
    });
  };

  const okCount = ports.filter(p => p.reachable).length;
  const allOk = ports.length > 0 && okCount === ports.length;
  const daemonOk = ports.filter(p => p.name !== 'cdp' && p.reachable).length > 0;
  const cdpOk = ports.find(p => p.name === 'cdp')?.reachable ?? false;

  // 复制 MCP 连接地址
  const copyMcpUrl = () => {
    const mcp = ports.find(p => p.name === 'mcp');
    const url = `http://127.0.0.1:${mcp?.actual || 9223}/mcp`;
    navigator.clipboard.writeText(url).then(() => {
      pushToast({ kind: 'success', title: 'MCP 地址已复制', description: url });
    });
  };

  return (
    <section className="mode-panel flex h-full flex-col gap-4 overflow-auto p-6">
      {/* ──── 头部: 整体状态 + 扫描按钮 ──── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">运行状态</h2>
          {ports.length > 0 && (
            <Badge variant={allOk ? 'default' : okCount > 0 ? 'secondary' : 'destructive'}>
              {allOk ? '全部正常' : `${okCount}/${ports.length} 在线`}
            </Badge>
          )}
          {lastScan && (
            <span className="text-[10px] text-muted-foreground">
              上次扫描: {new Date(lastScan).toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={scanAllPorts} disabled={scanning} className="gap-1.5">
          <RefreshCw className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
          {scanning ? '扫描中' : '重新扫描'}
        </Button>
      </div>

      {/* ──── 三栏卡片: Chrome / Daemon / Agent ──── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chrome 状态 */}
        <Card className={cn(
          'transition-colors',
          cdpOk === true ? 'border-success/40 bg-success/5' : cdpOk === false ? 'border-destructive/30 bg-destructive/5' : 'border-border'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Chrome className="h-4 w-4" />
              Chrome 浏览器
            </CardTitle>
            <CardDescription className="text-[11px]">DevTools Protocol 调试端口</CardDescription>
          </CardHeader>
          <CardContent>
            {cdpOk ? (
              <div className="space-y-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />已连接
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  端口 {ports.find(p => p.name === 'cdp')?.actual || 9222} · CDP 协议就绪
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />未连接
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  需要先启动 Chrome 调试端口
                </p>
                <Button size="sm" variant="outline" className="h-7 w-full gap-1 text-[10px]" onClick={launchChrome}>
                  <Play className="h-3 w-3" />复制启动命令
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daemon 服务 */}
        <Card className={cn(
          'transition-colors',
          daemonOk ? 'border-success/40 bg-success/5' : 'border-destructive/30 bg-destructive/5'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              Daemon 服务
            </CardTitle>
            <CardDescription className="text-[11px]">核心引擎运行状态</CardDescription>
          </CardHeader>
          <CardContent>
            {health ? (
              <div className="space-y-1.5">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />运行中
                </Badge>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>版本</span><span className="text-foreground">{health.version || '-'}</span>
                  <span>运行时间</span><span className="text-foreground">{formatUptime(health.uptime || 0)}</span>
                  <span>工具数</span><span className="text-foreground">{health.toolCount || 0}</span>
                  <span>内存</span><span className="text-foreground">{formatMem(health.memory?.rss || 0)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />未运行
                </Badge>
                <p className="text-[10px] text-muted-foreground">Daemon 未响应 — 尝试重启应用</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent 连接 */}
        <Card className={cn(
          'transition-colors',
          agents.length > 0 ? 'border-success/40 bg-success/5' : 'border-muted-foreground/20'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plug className="h-4 w-4" />
              Agent 连接
            </CardTitle>
            <CardDescription className="text-[11px]">AI Agent MCP 客户端</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length > 0 ? (
              <div className="space-y-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />{agents.length} 个 Agent
                </Badge>
                <div className="space-y-1">
                  {agents.map(a => (
                    <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color || '#666' }} />
                      <span>{a.name}</span>
                      <span className="text-muted-foreground">v{a.version}</span>
                      {a.callCount > 0 && (
                        <span className="text-muted-foreground">{a.callCount} 次调用</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="secondary" className="gap-1">
                  <Activity className="h-3 w-3" />等待连接
                </Badge>
                <p className="text-[10px] text-muted-foreground">尚无 Agent 连接</p>
                <Button size="sm" variant="outline" className="h-7 w-full gap-1 text-[10px]" onClick={copyMcpUrl}>
                  <Copy className="h-3 w-3" />复制 MCP 地址
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ──── 端口详细状态 ──── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="h-4 w-4" />
            端口状态
          </CardTitle>
          <CardDescription className="text-[11px]">
            自动扫描所有服务端口，实时显示连接状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ports.map(p => (
              <div
                key={p.name}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors',
                  p.reachable ? 'border-success/30 bg-success/5' : 'border-destructive/20 bg-destructive/5'
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                  p.reachable ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                )}>
                  {p.reachable ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{p.label}</span>
                    {p.actual !== p.expected && p.reachable && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        {p.actual}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {p.reachable ? p.description : `端口 ${p.actual || p.expected} 不可达`}
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] font-mono',
                  p.reachable ? 'text-success' : 'text-destructive'
                )}>
                  :{p.actual || p.expected}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ──── 快捷入口 ──── */}
      <div className="mt-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => { /* 切换到 browser 模式 */ window.dispatchEvent(new CustomEvent('nav:mode', { detail: 'browser' })); }}>
          <Globe className="h-5 w-5 text-primary" />
          <span className="text-xs">浏览器</span>
          <span className="text-[9px] text-muted-foreground">操作 Chrome</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => window.dispatchEvent(new CustomEvent('nav:mode', { detail: 'chat' }))}>
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-xs">AI 助手</span>
          <span className="text-[9px] text-muted-foreground">自然语言操控</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => window.dispatchEvent(new CustomEvent('nav:mode', { detail: 'automation' }))}>
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-xs">自动化</span>
          <span className="text-[9px] text-muted-foreground">工作流执行</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => window.dispatchEvent(new CustomEvent('nav:mode', { detail: 'monitor' }))}>
          <Monitor className="h-5 w-5 text-primary" />
          <span className="text-xs">监控</span>
          <span className="text-[9px] text-muted-foreground">日志/网络</span>
        </Button>
      </div>
    </section>
  );
}
