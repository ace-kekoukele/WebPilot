// src/panels/MonitorPanel.tsx — 监控 (工作日志 + 网络 + Console SSE) with shadcn Tabs + EmptyState + Skeleton
import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Activity, Network, Terminal, Trash2, MousePointerClick, Shield, Zap, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { useAppStore, store } from '../store';
import { apiGet, apiPost } from '../lib/api';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { cn } from '../lib/cn';
import { pushToast } from '../components/Toast';

type Tab = 'activity' | 'network' | 'console' | 'performance';

export function MonitorPanel() {
  const [tab, setTab] = useState<Tab>('activity');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<any[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const [perfData, setPerfData] = useState<any[]>([]);
  const [selectedNet, setSelectedNet] = useState<any>(null);
  const [netDetail, setNetDetail] = useState<any>(null);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [breakPattern, setBreakPattern] = useState('');
  const activity = useAppStore((s) => s.activity);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        if (tab === 'activity') {
          const r = await apiGet('/api/activity?limit=200').catch(() => ({ events: [] }));
          store.setActivity(r.events || []);
        }
        if (tab === 'network') {
          const r = await apiGet('/api/network/list?limit=200').catch(() => ({ events: [] }));
          setNetwork(r.events || []);
        }
        if (tab === 'console') {
          const r = await apiGet('/api/console/recent?limit=200').catch(() => ({ events: [] }));
          setConsoleLogs(r.events || []);
        }
        if (tab === 'performance') {
          const r = await apiGet('/api/health').catch(() => ({}));
          setPerfData((prev) => [...prev, {
            ts: Date.now(),
            cdpConnected: r.cdpConnected,
            toolCount: r.toolCount,
            uptime: r.uptime,
            memUsed: (performance as any)?.memory?.usedJSHeapSize,
            memTotal: (performance as any)?.memory?.totalJSHeapSize,
          }].slice(-60));
        }
      } finally { setLoading(false); }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [tab]);

  // Console 实时 SSE 订阅
  useEffect(() => {
    if (tab !== 'console') return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    try {
      const es = new EventSource('/api/console/stream');
      es.onmessage = (ev) => {
        try {
          const entry = JSON.parse(ev.data);
          setConsoleLogs((prev) => [...prev, entry].slice(-500));
        } catch {}
      };
      es.onerror = () => { /* EventSource 自动重连, 不动 */ };
      esRef.current = es;
    } catch {}
    return () => { if (esRef.current) { esRef.current.close(); esRef.current = null; } };
  }, [tab]);

  const filteredAct = activity.filter((e) =>
    !filter || [e.agent, e.tool, e.error || '', JSON.stringify(e.args || {})].some((s) => String(s).toLowerCase().includes(filter.toLowerCase()))
  );
  const filteredNet = network.filter((e) =>
    !filter || (e.url || '').toLowerCase().includes(filter.toLowerCase())
  );
  const filteredConsole = consoleLogs.filter((e) =>
    !filter || [e.type, ...(e.args || [e.text || ''])].some((s) => String(s).toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <section className="mode-panel flex h-full flex-col p-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3 w-3" />工作日志</TabsTrigger>
            <TabsTrigger value="network" className="gap-1.5"><Network className="h-3 w-3" />网络</TabsTrigger>
            <TabsTrigger value="console" className="gap-1.5"><Terminal className="h-3 w-3" />Console</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5"><Zap className="h-3 w-3" />性能</TabsTrigger>
          </TabsList>
          {tab !== 'console' && (
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tab === 'activity' ? '过滤 (agent/tool/状态)' : '过滤 URL'}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">
                {tab === 'activity' ? filteredAct.length : filteredNet.length} / {tab === 'activity' ? activity.length : network.length} 条
              </span>
            </div>
          )}
          {tab === 'console' && (
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="过滤 (level/text/url)"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{filteredConsole.length} / {consoleLogs.length} 条</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                LIVE
              </span>
            </div>
          )}
        </div>

        <TabsContent value="activity" className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> :
           filteredAct.length === 0 ? <EmptyState icon={Activity} title="暂无活动" description="Agent 调用工具后会出现在这里" className="h-full" /> :
           <ActivityTable rows={filteredAct.slice(-100).reverse()} />}
        </TabsContent>
        <TabsContent value="network" className="flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setBreakDialogOpen(true)}>
              <Shield className="h-3 w-3" />拦截规则
            </Button>
            {selectedNet && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={async () => {
                if (!selectedNet?.requestId) return;
                try {
                  await apiPost('/api/network/replay', { requestId: selectedNet.requestId });
                  pushToast({ kind: 'success', title: '已重放请求' });
                } catch (e: any) { pushToast({ kind: 'error', title: '重放失败', description: e.message }); }
              }}>
                <MousePointerClick className="h-3 w-3" />重放
              </Button>
            )}
          </div>
          {loading ? <SkeletonList /> :
           filteredNet.length === 0 ? <EmptyState icon={Network} title="暂无网络" description="需 Chrome 已 attach · 页面发起请求后会出现在这里" className="h-full" /> :
           <NetworkTable rows={filteredNet.slice(-100).reverse()} selectedId={selectedNet?.requestId} onSelect={(r) => { setSelectedNet(r); if (r?.requestId) apiGet(`/api/network/get?reqId=${r.requestId}`).then((d: any) => setNetDetail(d.data || null)).catch(() => setNetDetail(null)); }} />}
        </TabsContent>
        <TabsContent value="console" className="flex-1 overflow-hidden">
          {loading ? <SkeletonList /> :
           filteredConsole.length === 0 ? <EmptyState icon={Terminal} title="暂无 Console" description="Chrome 里 console.log 会实时出现在这里。先确保 Chrome 已连接。" className="h-full" /> :
           <ConsoleList rows={filteredConsole.slice(-200)} filter={filter} onFilterChange={setFilter} onClear={() => setConsoleLogs([])} />}
        </TabsContent>
        <TabsContent value="performance" className="flex-1 overflow-y-auto">
          {perfData.length === 0 ? (
            <EmptyState icon={Zap} title="性能监控" description="每 3 秒刷新 · 连接 Chrome 后开始采集" className="h-full" />
          ) : (
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: 'Chrome 连接', value: perfData[perfData.length - 1]?.cdpConnected ? '✓ 已连接' : '✗ 未连接', color: perfData[perfData.length - 1]?.cdpConnected ? 'text-success' : 'text-destructive' },
                  { label: '工具数', value: `${perfData[perfData.length - 1]?.toolCount ?? '-'} 个` },
                  { label: '运行时长', value: `${((perfData[perfData.length - 1]?.uptime || 0) / 1000).toFixed(0)}s` },
                ] as any[]).map((m) => (
                  <div key={m.label} className="rounded-lg border border-border bg-card p-3 text-center">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className={`mt-1 text-sm font-semibold ${m.color || 'text-foreground'}`}>{m.value}</div>
                  </div>
                ))}
              </div>
              {perfData[perfData.length - 1]?.memUsed && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 text-xs text-muted-foreground">内存 (GUI 进程)</div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, ((perfData[perfData.length - 1]?.memUsed || 0) / (perfData[perfData.length - 1]?.memTotal || 1)) * 100)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{(perfData[perfData.length - 1]?.memUsed / 1024 / 1024).toFixed(0)} MB 已用</span>
                    <span>{(perfData[perfData.length - 1]?.memTotal / 1024 / 1024).toFixed(0)} MB 总计</span>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-xs text-muted-foreground">最近 60 条采样</div>
                <div className="space-y-0.5">
                  {perfData.slice(-20).map((d, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                      <span>{new Date(d.ts).toLocaleTimeString()}</span>
                      <span className={d.cdpConnected ? 'text-success' : 'text-destructive'}>{d.cdpConnected ? '✓' : '✗'}</span>
                      <span>{d.memUsed ? `${(d.memUsed / 1024 / 1024).toFixed(0)}MB` : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* B2-17: 网络请求详情 */}
      {netDetail && <NetworkDetailDialog data={netDetail} onClose={() => setNetDetail(null)} />}

      {/* B2-17: 拦截规则 */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent>
          <div className="space-y-3 py-2">
            <h3 className="font-medium">添加拦截规则</h3>
            <Input
              placeholder="URL 模式 (如 /api/users 或 *.json)"
              value={breakPattern}
              onChange={(e) => setBreakPattern(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">匹配的请求会被拦截,返回自定义响应。留空则清空所有规则。</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setBreakDialogOpen(false)}>取消</Button>
              <Button size="sm" onClick={async () => {
                try {
                  if (breakPattern.trim()) {
                    await apiPost('/api/network/break', { urlPattern: breakPattern.trim() });
                    pushToast({ kind: 'success', title: '拦截规则已添加' });
                  } else {
                    await fetch('/api/network/breaks', { method: 'DELETE' });
                    pushToast({ kind: 'info', title: '已清空拦截规则' });
                  }
                  setBreakDialogOpen(false);
                  setBreakPattern('');
                } catch (e: any) { pushToast({ kind: 'error', title: '操作失败', description: e.message }); }
              }}>确定</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-1 p-1">
      {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
    </div>
  );
}

function ActivityTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-md border border-border">
      <div className="grid grid-cols-[80px_120px_140px_1fr_60px_80px] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div>时间</div><div>Agent</div><div>工具</div><div>参数</div><div>状态</div><div>耗时</div>
      </div>
      {rows.map((e, i) => (
        <div key={i} className="grid grid-cols-[80px_120px_140px_1fr_60px_80px] gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0 hover:bg-accent/30">
          <div className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</div>
          <div className="truncate">{e.agent}</div>
          <div className="truncate font-mono">{e.tool}</div>
          <div className="truncate text-muted-foreground">{JSON.stringify(e.args || {}).slice(0, 80)}</div>
          <div className={cn(e.ok ? 'text-success' : 'text-destructive')}>{e.ok ? '✓' : '✗'}</div>
          <div className="text-muted-foreground">{e.durationMs || 0}ms</div>
        </div>
      ))}
    </div>
  );
}

function NetworkTable({ rows, selectedId, onSelect }: { rows: any[]; selectedId?: string; onSelect: (r: any) => void }) {
  const [sortCol, setSortCol] = useState<'ts' | 'method' | 'url' | 'status'>('ts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va: any = a[sortCol], vb: any = b[sortCol];
      if (sortCol === 'ts') { va = a.ts ?? 0; vb = b.ts ?? 0; }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir]);

  const SortIcon = ({ col }: { col: typeof sortCol }) => sortCol === col
    ? (sortDir === 'asc' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)
    : <ArrowUpDown className="h-2.5 w-2.5 text-muted-foreground/30" />;

  const methodColor = (m: string) => {
    switch (m) {
      case 'GET': return 'bg-blue-500/10 text-blue-500';
      case 'POST': return 'bg-green-500/10 text-green-500';
      case 'PUT': return 'bg-orange-500/10 text-orange-500';
      case 'DELETE': return 'bg-red-500/10 text-red-500';
      case 'PATCH': return 'bg-purple-500/10 text-purple-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="rounded-md border border-border">
      <div className="grid grid-cols-[80px_70px_1fr_60px_120px] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { if (sortCol === 'ts') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol('ts'); setSortDir('desc'); } }}>
          <span>时间</span><SortIcon col="ts" />
        </button>
        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { if (sortCol === 'method') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol('method'); setSortDir('asc'); } }}>
          <span>Method</span><SortIcon col="method" />
        </button>
        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { if (sortCol === 'url') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol('url'); setSortDir('asc'); } }}>
          <span>URL</span><SortIcon col="url" />
        </button>
        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { if (sortCol === 'status') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol('status'); setSortDir('asc'); } }}>
          <span>状态</span><SortIcon col="status" />
        </button>
        <div>MIME</div>
      </div>
      {sorted.map((e, i) => (
        <div
          key={i}
          onClick={() => onSelect(e)}
          className={cn(
            'grid cursor-pointer grid-cols-[80px_70px_1fr_60px_120px] gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0',
            e.requestId === selectedId ? 'bg-accent' : 'hover:bg-accent/30',
          )}
        >
          <div className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</div>
          <div><span className={cn('rounded px-1 py-0.5 font-mono text-[10px] font-medium', methodColor(e.method))}>{e.method || '·'}</span></div>
          <div className="truncate text-muted-foreground" title={e.url}>{e.url}</div>
          <div className={cn('font-medium', (e.status >= 400 ? 'text-destructive' : e.status >= 300 ? 'text-warning' : 'text-success'))}>{e.status || '·'}</div>
          <div className="truncate text-muted-foreground">{(e.mimeType || '').split(';')[0]}</div>
        </div>
      ))}
    </div>
  );
}

function NetworkDetailDialog({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 font-mono text-xs', data.method === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500')}>{data.method}</span>
            <span className={cn('rounded px-1.5 py-0.5 text-xs', data.status >= 400 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>{data.status}</span>
            <span className="truncate flex-1 font-mono text-xs text-muted-foreground">{data.url}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border p-2">
              <div className="mb-1 font-medium text-muted-foreground">Request Headers</div>
              <pre className="max-h-32 overflow-auto font-mono text-[10px]">{data.headers ? JSON.stringify(data.headers, null, 2) : '(无)'}</pre>
            </div>
            <div className="rounded border border-border p-2">
              <div className="mb-1 font-medium text-muted-foreground">Response Headers</div>
              <pre className="max-h-32 overflow-auto font-mono text-[10px]">{data.responseHeaders ? JSON.stringify(data.responseHeaders, null, 2) : '(无)'}</pre>
            </div>
          </div>
          {data.responseBody && (
            <div className="rounded border border-border p-2">
              <div className="mb-1 font-medium text-muted-foreground">Response Body <span className="text-muted-foreground/50">(点击展开)</span></div>
              <details className="max-h-64 overflow-auto">
                <pre className="font-mono text-[10px]">{(() => {
                  try { return JSON.stringify(JSON.parse(data.responseBody), null, 2); } catch { return data.responseBody; }
                })()}</pre>
              </details>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsoleList({ rows, onClear }: { rows: any[]; filter: string; onFilterChange: (v: string) => void; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [rows.length, autoScroll]);

  const levelColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-destructive';
      case 'warning': return 'text-warning';
      case 'info': return 'text-info';
      case 'verbose': return 'text-muted-foreground';
      case 'log': return 'text-foreground';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border bg-card/50 px-2 py-1.5">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="h-3 w-3" />
          自动滚动
        </label>
        <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto h-6 px-2 text-[11px]">
          <Trash2 className="h-3 w-3" />清空
        </Button>
      </div>
      <div ref={ref} className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">暂无 console 事件</div>
        ) : rows.map((e, i) => {
          const text = (e.args && e.args.length ? e.args.join(' ') : e.text) || '(空)';
          return (
            <div key={i} className={cn('flex gap-2 border-b border-border/40 py-0.5 hover:bg-accent/20', levelColor(e.type))}>
              <span className="w-16 shrink-0 text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="w-12 shrink-0 uppercase">{e.type}</span>
              <span className="min-w-0 flex-1 break-all whitespace-pre-wrap">{text}</span>
              {e.url && <span className="max-w-[40%] shrink-0 truncate text-muted-foreground" title={`${e.url}:${e.line}`}>{e.url.split('/').slice(-2).join('/')}:{e.line}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}