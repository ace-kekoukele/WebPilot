// src/panels/DashboardPanel.tsx — 首页仪表盘 (Modern Glass Design)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chrome, Server, Plug, Wifi, WifiOff, CheckCircle, XCircle,
  RefreshCw, Clock, Activity, Monitor, Copy, Play, Zap,
  Globe, Radio, ArrowRight,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/cn';
import { pushToast } from '../components/Toast';

interface PortStatus {
  name: string; label: string; expected: number; actual: number | null;
  reachable: boolean; description: string;
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

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
function formatMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export function DashboardPanel() {
  const [health, setHealth] = useState<any>(null);
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const scanTimer = useRef<any>(null);

  const scanAllPorts = useCallback(async () => {
    setScanning(true);
    try {
      const h = await apiGet('/api/health').catch(() => null);
      setHealth(h);
      const actualPorts = (h as any)?.ports || {};
      const results: PortStatus[] = [];
      for (const dp of DEFAULT_PORTS) {
        const actual = actualPorts[dp.name] || dp.expected;
        const reachable = dp.name === 'cdp'
          ? await scanChromeDebugPort('127.0.0.1', actual)
          : await scanPort('127.0.0.1', actual);
        results.push({ ...dp, actual, reachable });
      }
      setPorts(results);
      setLastScan(Date.now());
      const ar = await apiGet('/api/agents').catch(() => ({ agents: [] }));
      setAgents(ar.agents || []);
    } catch {
      setPorts(DEFAULT_PORTS.map(dp => ({ ...dp, actual: null, reachable: false })));
    } finally { setScanning(false); }
  }, []);

  useEffect(() => { scanAllPorts(); scanTimer.current = setInterval(scanAllPorts, 5000); return () => { if (scanTimer.current) clearInterval(scanTimer.current); }; }, [scanAllPorts]);

  const launchChrome = () => {
    const cmd = 'chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1';
    navigator.clipboard.writeText(cmd).then(() => pushToast({ kind: 'info', title: '命令已复制', description: cmd, duration: 4000 }));
  };
  const copyMcpUrl = () => {
    const mcp = ports.find(p => p.name === 'mcp');
    const url = `http://127.0.0.1:${mcp?.actual || 9223}/mcp`;
    navigator.clipboard.writeText(url).then(() => pushToast({ kind: 'success', title: 'MCP 地址已复制', description: url }));
  };

  const okCount = ports.filter(p => p.reachable).length;
  const allOk = ports.length > 0 && okCount === ports.length;
  const daemonOk = ports.filter(p => p.name !== 'cdp' && p.reachable).length > 0;
  const cdpOk = ports.find(p => p.name === 'cdp')?.reachable ?? false;

  return (
    <section className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">运行状态</h2>
          {ports.length > 0 && (
            <Badge variant={allOk ? 'default' : okCount > 0 ? 'secondary' : 'destructive'} className="font-medium">
              {allOk ? '全部正常' : `${okCount}/${ports.length} 在线`}
            </Badge>
          )}
          {lastScan && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(lastScan).toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={scanAllPorts} disabled={scanning} className="gap-1.5 rounded-lg">
          <RefreshCw className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
          {scanning ? '扫描中' : '重新扫描'}
        </Button>
      </div>

      {/* Three Cards — 每张卡不同主题色 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 flex-shrink-0">
        {/* Chrome — 珊瑚粉主题 */}
        <Card className={cn('overflow-hidden transition-all duration-300 border backdrop-blur-sm',
          cdpOk === true ? 'border-rose-400/25 bg-rose-500/[0.04] shadow-[0_0_24px_-8px_rgba(244,63,94,0.12)]' : cdpOk === false ? 'border-red-500/20 bg-red-500/[0.03]' : 'border-border bg-card/60')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', cdpOk ? 'bg-rose-500/15 text-rose-400' : 'bg-red-500/10 text-red-400')}>
                <Chrome className="h-4 w-4" />
              </div>
              Chrome 浏览器
            </CardTitle>
            <CardDescription className="text-[11px]">DevTools Protocol 调试端口</CardDescription>
          </CardHeader>
          <CardContent>
            {cdpOk ? (
              <div className="space-y-2">
                <Badge variant="default" className="gap-1 bg-rose-500/15 text-rose-400 hover:bg-rose-500/15 border-rose-500/20">
                  <CheckCircle className="h-3 w-3" />已连接
                </Badge>
                <p className="text-[10px] text-muted-foreground">端口 {ports.find(p => p.name === 'cdp')?.actual || 9222} · CDP 协议就绪</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="destructive" className="gap-1 bg-red-500/10"><XCircle className="h-3 w-3" />未连接</Badge>
                <p className="text-[10px] text-muted-foreground">需要先启动 Chrome 调试端口</p>
                <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-[10px] rounded-lg" onClick={launchChrome}>
                  <Play className="h-3 w-3" />复制启动命令
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 核心引擎 — 青蓝色主题 */}
        <Card className={cn('overflow-hidden transition-all duration-300 border backdrop-blur-sm',
          daemonOk ? 'border-cyan-400/25 bg-cyan-500/[0.04] shadow-[0_0_24px_-8px_rgba(6,182,212,0.12)]' : 'border-red-500/20 bg-red-500/[0.03]')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', health ? 'bg-cyan-500/15 text-cyan-400' : 'bg-red-500/10 text-red-400')}>
                <Server className="h-4 w-4" />
              </div>
              核心引擎
            </CardTitle>
            <CardDescription className="text-[11px]">WebPilot 后台服务运行状态</CardDescription>
          </CardHeader>
          <CardContent>
            {health ? (
              <div className="space-y-2">
                <Badge variant="default" className="gap-1 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/15 border-cyan-500/20">
                  <CheckCircle className="h-3 w-3" />运行中
                </Badge>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <span className="text-muted-foreground">版本</span><span className="font-medium">{health.version || '-'}</span>
                  <span className="text-muted-foreground">运行时间</span><span className="font-medium">{formatUptime(health.uptime || 0)}</span>
                  <span className="text-muted-foreground">工具数</span><span className="font-medium">{health.toolCount || 0}</span>
                  <span className="text-muted-foreground">内存</span><span className="font-medium">{formatMem(health.memory?.rss || 0)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="destructive" className="gap-1 bg-red-500/10"><XCircle className="h-3 w-3" />未运行</Badge>
                <p className="text-[10px] text-muted-foreground">后台服务未响应 — 尝试重启应用</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent — 琥珀暖色主题 */}
        <Card className={cn('overflow-hidden transition-all duration-300 border backdrop-blur-sm',
          agents.length > 0 ? 'border-amber-400/25 bg-amber-500/[0.04] shadow-[0_0_24px_-8px_rgba(251,191,36,0.12)]' : 'border-border bg-card/60')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', agents.length > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground')}>
                <Plug className="h-4 w-4" />
              </div>
              Agent 连接
            </CardTitle>
            <CardDescription className="text-[11px]">AI Agent MCP 客户端</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length > 0 ? (
              <div className="space-y-2">
                <Badge variant="default" className="gap-1 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15 border-amber-500/20">
                  <CheckCircle className="h-3 w-3" />{agents.length} 个 Agent
                </Badge>
                <div className="space-y-1.5">
                  {agents.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-[10px]">
                      <span className="h-2 w-2 rounded-full shadow-[0_0_4px_currentColor]" style={{ backgroundColor: a.color || '#666' }} />
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground">v{a.version}</span>
                      {a.callCount > 0 && <span className="text-muted-foreground">{a.callCount} 次调用</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="secondary" className="gap-1"><Activity className="h-3 w-3" />等待连接</Badge>
                <p className="text-[10px] text-muted-foreground">尚无 Agent 连接</p>
                <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-[10px] rounded-lg" onClick={copyMcpUrl}>
                  <Copy className="h-3 w-3" />复制 MCP 地址
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Port Status */}
      <Card className="overflow-hidden border backdrop-blur-sm bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-cyan-400">
              <Radio className="h-4 w-4" />
            </div>
            端口状态
          </CardTitle>
          <CardDescription className="text-[11px]">自动扫描所有服务端口，实时显示连接状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ports.map((p, i) => {
              const colors = [
                { ok: 'border-rose-400/20 bg-rose-500/[0.03]', okIcon: 'bg-rose-500/10 text-rose-400' },
                { ok: 'border-cyan-400/20 bg-cyan-500/[0.03]', okIcon: 'bg-cyan-500/10 text-cyan-400' },
                { ok: 'border-amber-400/20 bg-amber-500/[0.03]', okIcon: 'bg-amber-500/10 text-amber-400' },
                { ok: 'border-emerald-400/20 bg-emerald-500/[0.03]', okIcon: 'bg-emerald-500/10 text-emerald-400' },
                { ok: 'border-violet-400/20 bg-violet-500/[0.03]', okIcon: 'bg-violet-500/10 text-violet-400' },
                { ok: 'border-blue-400/20 bg-blue-500/[0.03]', okIcon: 'bg-blue-500/10 text-blue-400' },
              ][i % 6];
              return (
              <div key={p.name} className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-all duration-300',
                p.reachable ? colors.ok : 'border-red-500/15 bg-red-500/[0.03]'
              )}>
                <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
                  p.reachable ? colors.okIcon : 'bg-red-500/10 text-red-400')}>
                  {p.reachable ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{p.label}</span>
                    {p.actual !== p.expected && p.reachable && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">{p.actual}</Badge>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {p.reachable ? p.description : `端口 ${p.actual || p.expected} 不可达`}
                  </p>
                </div>
                <span className={cn('text-[11px] font-mono font-semibold', p.reachable ? 'text-emerald-400' : 'text-red-400')}>
                  :{p.actual || p.expected}
                </span>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { mode: 'browser', icon: Globe, label: '浏览器', desc: '操作 Chrome', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'hover:border-cyan-400/30' },
          { mode: 'chat', icon: Zap, label: 'AI 助手', desc: '自然语言操控', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'hover:border-amber-400/30' },
          { mode: 'automation', icon: Activity, label: '自动化', desc: '工作流执行', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-400/30' },
          { mode: 'monitor', icon: Monitor, label: '监控', desc: '日志/网络', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'hover:border-rose-400/30' },
        ].map(({ mode, icon: Icon, label, desc, color, bg, border }) => (
          <Button
            key={mode}
            variant="outline"
            className={cn('group h-auto flex-col gap-2 py-4 rounded-xl border-border/60 hover:bg-accent/50 transition-all duration-300', border)}
            onClick={() => window.dispatchEvent(new CustomEvent('nav:mode', { detail: mode }))}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110', bg)}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold">{label}</div>
              <div className="text-[9px] text-muted-foreground">{desc}</div>
            </div>
            <ArrowRight className={cn('h-3 w-3 opacity-0 -mt-1 transition-all duration-300 group-hover:opacity-100', color)} />
          </Button>
        ))}
      </div>
    </section>
  );
}
