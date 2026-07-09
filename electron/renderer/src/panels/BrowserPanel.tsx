// src/panels/BrowserPanel.tsx — 浏览器模式 (URL 导航 + tab 列表 + 元素选择器)
import { useState, useEffect } from 'react';
import { Globe, Crosshair, ArrowRight, RefreshCw, ImageIcon, User, Bot, type LucideIcon } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useAppStore } from '../store';

interface Props { tools: any[]; }

export function BrowserPanel({ tools }: Props) {
  const [url, setUrl] = useState('https://example.com');
  const [tabs, setTabs] = useState<{ user: any[]; agent: any[] }>({ user: [], agent: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const health = useAppStore((s) => s.health);

  const refreshTabs = async () => {
    try {
      const r = await apiGet('/api/browser/tabs');
      setTabs(r.tabs || { user: [], agent: [] });
    } catch {
      setTabs({ user: [], agent: [] });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refreshTabs(); const t = setInterval(refreshTabs, 5000); return () => clearInterval(t); }, []);

  const navigate = async () => {
    if (!url) return;
    setBusy(true);
    try { await apiPost('/api/browser/navigate', { url }); }
    catch (e: any) { console.error(e); }
    finally { setBusy(false); }
  };

  const cdpOk = !!health?.cdpConnected;
  const allTabs = [...tabs.user, ...tabs.agent];

  return (
    <section className="mode-panel flex h-full flex-col gap-3 p-4">
      {/* URL bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            placeholder="输入 URL, 回车导航..."
            className="pl-8 font-mono text-xs"
          />
        </div>
        <Button size="sm" onClick={navigate} disabled={busy} className="gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" />
          {busy ? '跳转中' : '跳转'}
        </Button>
        <Button size="sm" variant="outline" onClick={refreshTabs} title="刷新 tab 列表">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => alert('Ctrl+K 搜 "元素选择器"')} title="元素选择器">
          <Crosshair className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabs 列表 + 预览 */}
      <Tabs defaultValue="preview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="preview">预览</TabsTrigger>
          <TabsTrigger value="user">用户 Tab ({tabs.user.length})</TabsTrigger>
          <TabsTrigger value="agent">Agent Tab ({tabs.agent.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="flex-1 overflow-hidden">
          <EmptyState
            icon={ImageIcon}
            title="浏览器实时预览"
            description={cdpOk ? '截图流接口已就绪, UI 接流在 v4.1 (当前可用工具调用截图)' : 'Chrome 未连接 · 在 PowerShell 跑 chrome --remote-debugging-port=9222'}
            className="h-full"
          />
        </TabsContent>
        <TabsContent value="user" className="flex-1 overflow-y-auto">
          <TabList loading={loading} tabs={tabs.user} icon={User} label="用户 Tab" empty="Chrome 未连接" />
        </TabsContent>
        <TabsContent value="agent" className="flex-1 overflow-y-auto">
          <TabList loading={loading} tabs={tabs.agent} icon={Bot} label="Agent Tab" empty="Agent 未打开 tab" />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TabList({ loading, tabs, icon: Icon, label, empty }: { loading: boolean; tabs: any[]; icon: LucideIcon; label: string; empty: string }) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }
  if (tabs.length === 0) {
    return <EmptyState icon={Icon} title={label} description={empty} className="h-full" />;
  }
  return (
    <div className="space-y-1 p-2">
      {tabs.map((t) => (
        <div key={t.targetId || t.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 truncate">
            <div className="truncate font-medium text-foreground">{(t.title || t.url || 'Tab').slice(0, 60)}</div>
            <div className="truncate text-muted-foreground">{t.url}</div>
          </div>
        </div>
      ))}
    </div>
  );
}