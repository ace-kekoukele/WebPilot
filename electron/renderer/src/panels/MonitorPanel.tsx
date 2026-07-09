// src/panels/MonitorPanel.tsx — 监控 (工作日志 + 网络 + Console) with shadcn Tabs + EmptyState + Skeleton
import { useState, useEffect } from 'react';
import { Search, Activity, Network, Terminal } from 'lucide-react';
import { useAppStore, store } from '../store';
import { apiGet } from '../lib/api';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { cn } from '../lib/cn';

type Tab = 'activity' | 'network' | 'console';

export function MonitorPanel() {
  const [tab, setTab] = useState<Tab>('activity');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<any[]>([]);
  const activity = useAppStore((s) => s.activity);

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
      } finally { setLoading(false); }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [tab]);

  const filteredAct = activity.filter((e) =>
    !filter || [e.agent, e.tool, e.error || '', JSON.stringify(e.args || {})].some((s) => String(s).toLowerCase().includes(filter.toLowerCase()))
  );
  const filteredNet = network.filter((e) =>
    !filter || (e.url || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section className="mode-panel flex h-full flex-col p-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3 w-3" />工作日志</TabsTrigger>
            <TabsTrigger value="network" className="gap-1.5"><Network className="h-3 w-3" />网络</TabsTrigger>
            <TabsTrigger value="console" className="gap-1.5"><Terminal className="h-3 w-3" />Console</TabsTrigger>
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
        </div>

        <TabsContent value="activity" className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> :
           filteredAct.length === 0 ? <EmptyState icon={Activity} title="暂无活动" description="Agent 调用工具后会出现在这里" className="h-full" /> :
           <ActivityTable rows={filteredAct.slice(-100).reverse()} />}
        </TabsContent>
        <TabsContent value="network" className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> :
           filteredNet.length === 0 ? <EmptyState icon={Network} title="暂无网络" description="需 Chrome 已 attach · 页面发起请求后会出现在这里" className="h-full" /> :
           <NetworkTable rows={filteredNet.slice(-100).reverse()} />}
        </TabsContent>
        <TabsContent value="console" className="flex-1">
          <EmptyState icon={Terminal} title="Console 抓取" description="v4.1 加 (需 daemon 接 Runtime.consoleAPICalled)" className="h-full" />
        </TabsContent>
      </Tabs>
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

function NetworkTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-md border border-border">
      <div className="grid grid-cols-[80px_60px_1fr_60px_120px] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div>时间</div><div>Method</div><div>URL</div><div>状态</div><div>MIME</div>
      </div>
      {rows.map((e, i) => (
        <div key={i} className="grid grid-cols-[80px_60px_1fr_60px_120px] gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0 hover:bg-accent/30">
          <div className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</div>
          <div className="font-mono font-medium">{e.method || '·'}</div>
          <div className="truncate text-muted-foreground" title={e.url}>{e.url}</div>
          <div className={cn((e.status >= 400 ? 'text-destructive' : 'text-success'))}>{e.status || '·'}</div>
          <div className="truncate text-muted-foreground">{(e.mimeType || '').split(';')[0]}</div>
        </div>
      ))}
    </div>
  );
}