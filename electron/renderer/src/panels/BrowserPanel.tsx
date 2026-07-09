// src/panels/BrowserPanel.tsx — 浏览器模式 (URL 导航 + 真预览 + tab 列表 + 3 按钮)
import { useState, useEffect } from 'react';
import { Globe, Crosshair, ArrowRight, RefreshCw, ImageIcon, User, Bot, Camera, FileCode, ListTree, Cookie, Copy, ExternalLink, type LucideIcon } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { useAppStore } from '../store';
import { useClipboard } from '../hooks';
import { useDebounce } from '../hooks';
import { cn } from '../lib/cn';

interface Props { tools: any[]; }

export function BrowserPanel({ tools }: Props) {
  const [url, setUrl] = useState('https://example.com');
  const [tabs, setTabs] = useState<{ user: any[]; agent: any[] }>({ user: [], agent: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [domSnapshot, setDomSnapshot] = useState<string>('');
  const [domOpen, setDomOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [cookies, setCookies] = useState<any[]>([]);
  const [cookiesLoading, setCookiesLoading] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<any>(null);
  const health = useAppStore((s) => s.health);
  const { copy, copied } = useClipboard();

  // URL 防抖验证
  const debouncedUrl = useDebounce(url, 300);
  const [urlValid, setUrlValid] = useState(true);
  useEffect(() => {
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
      setUrlValid(true);
    } catch {
      setUrlValid(url.length === 0 || url === 'about:blank');
    }
  }, [debouncedUrl]);

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

  const firstTargetId = (): string | null => {
    const all = [...tabs.user, ...tabs.agent];
    return all[0]?.targetId || null;
  };

  const navigate = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({
          kind: 'warn',
          title: 'Chrome 未连接或没有 tab',
          description: '在 PowerShell 跑 chrome --remote-debugging-port=9222 并打开一个网页',
        });
        return;
      }
      await apiPost('/api/tools/call', { name: 'browser_navigate', args: { url, targetId } });
      pushToast({ kind: 'success', title: '✓ 已跳转', description: url });
    } catch (e: any) {
      pushToast({ kind: 'error', title: `跳转失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const screenshot = async () => {
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({ kind: 'warn', title: 'Chrome 未连接', description: '先连接 Chrome' });
        return;
      }
      const r: any = await apiPost('/api/tools/call', { name: 'browser_screenshot', args: { targetId, format: 'png' } });
      // daemon 通常返回 { value: { data: 'base64...' } } 或 { value: 'data:image/png;base64,...' }
      const v = r?.value;
      const dataUrl = typeof v === 'string' ? v : (v?.data ? `data:image/${v.format || 'png'};base64,${v.data}` : null);
      if (dataUrl) {
        setScreenshotUrl(dataUrl);
        pushToast({ kind: 'success', title: '✓ 截图已捕获' });
      } else {
        pushToast({ kind: 'info', title: '截图完成', description: '结果已返回, 但格式未识别' });
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: `截图失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const viewDOM = async () => {
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({ kind: 'warn', title: 'Chrome 未连接' });
        return;
      }
      const r: any = await apiPost('/api/tools/call', { name: 'browser_dom_snapshot', args: { targetId } });
      const v = r?.value;
      const text = typeof v === 'string' ? v : (v?.html || v?.snapshot || JSON.stringify(v, null, 2));
      setDomSnapshot(text || '(空)');
      setDomOpen(true);
    } catch (e: any) {
      pushToast({ kind: 'error', title: `DOM 抓取失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const pickElement = async () => {
    setPicking(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({ kind: 'warn', title: 'Chrome 未连接' });
        return;
      }
      await apiPost('/api/tools/call', { name: 'browser_script', args: {
        targetId,
        expression: `(() => {
          if (window.__webpilotPicking) return 'already picking';
          window.__webpilotPicking = true;
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(99,102,241,.05);cursor:crosshair;';
          const tip = document.createElement('div');
          tip.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;padding:6px 12px;border-radius:6px;font:12px sans-serif;z-index:2147483648;';
          tip.textContent = '点页面元素选中, Esc 取消';
          document.body.appendChild(overlay); document.body.appendChild(tip);
          const cleanup = () => { overlay.remove(); tip.remove(); window.__webpilotPicking = false; window.removeEventListener('keydown', onEsc); };
          const onEsc = (e) => { if (e.key === 'Escape') cleanup(); };
          window.addEventListener('keydown', onEsc);
          overlay.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const el = ev.target;
            const sel = el.tagName ? (el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : el.tagName.toLowerCase())) : 'unknown';
            const txt = (el.innerText || '').slice(0, 80);
            console.log('[webpilot-pick] ' + sel + ' :: ' + txt);
            cleanup();
            window.__webpilotPicked = { selector: sel, text: txt };
          }, true);
          return 'picker attached';
        })()`,
      } });
      pushToast({ kind: 'info', title: '元素选择器已激活', description: '在 Chrome 页面点目标元素, Esc 取消。选中结果在 Console 看' });
    } catch (e: any) {
      pushToast({ kind: 'error', title: `选择器失败: ${e.message}` });
    } finally {
      setPicking(false);
    }
  };

  const cdpOk = !!health?.cdpConnected;
  const allTabs = [...tabs.user, ...tabs.agent];

  return (
    <section className="mode-panel flex h-full flex-col gap-3 p-4">
      {/* URL bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className={cn(
            "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
            urlValid ? "text-muted-foreground" : "text-destructive"
          )} />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            placeholder="输入 URL, 回车导航..."
            className={cn(
              "pl-8 pr-8 font-mono text-xs",
              !urlValid && url.length > 0 && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {/* URL 验证图标 */}
          {url.length > 0 && (
            <div className={cn(
              "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium",
              urlValid ? "text-success" : "text-destructive"
            )}>
              {urlValid ? '✓' : '✗'}
            </div>
          )}
        </div>
        <Button size="sm" onClick={navigate} disabled={busy} className="gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" />
          {busy ? '跳转中' : '跳转'}
        </Button>
        <Button size="sm" variant="outline" onClick={refreshTabs} title="刷新 tab 列表" disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={screenshot} title="截图" disabled={busy}>
          <Camera className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={viewDOM} title="查看 DOM" disabled={busy}>
          <FileCode className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={pickElement} title="选中元素" disabled={busy || picking}>
          <Crosshair className={picking ? 'h-3.5 w-3.5 animate-pulse' : 'h-3.5 w-3.5'} />
        </Button>
      </div>

      {/* Tabs 列表 + 预览 */}
      <Tabs defaultValue="preview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="preview">预览 ({screenshotUrl ? '1' : '0'})</TabsTrigger>
          <TabsTrigger value="user">用户 Tab ({tabs.user.length})</TabsTrigger>
          <TabsTrigger value="agent">Agent Tab ({tabs.agent.length})</TabsTrigger>
          <TabsTrigger value="dom">DOM</TabsTrigger>
          <TabsTrigger value="cookies">Cookie</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="flex-1 overflow-auto">
          {screenshotUrl ? (
            <div className="space-y-2 p-2">
              <img src={screenshotUrl} alt="screenshot" className="w-full rounded border border-border" />
              <Button size="sm" variant="outline" onClick={() => setScreenshotUrl(null)}>清空</Button>
            </div>
          ) : (
            <EmptyState
              icon={ImageIcon}
              title="浏览器实时预览"
              description={cdpOk ? '点上方相机按钮截图查看当前页面' : 'Chrome 未连接 · 在 PowerShell 跑 chrome --remote-debugging-port=9222'}
              className="h-full"
            />
          )}
        </TabsContent>
        <TabsContent value="user" className="flex-1 overflow-y-auto">
          <TabList loading={loading} tabs={tabs.user} icon={User} label="用户 Tab" empty="Chrome 未连接" />
        </TabsContent>
        <TabsContent value="agent" className="flex-1 overflow-y-auto">
          <TabList loading={loading} tabs={tabs.agent} icon={Bot} label="Agent Tab" empty="Agent 未打开 tab" />
        </TabsContent>
        <TabsContent value="dom" className="flex-1 overflow-hidden">
          {domOpen ? (
            <div className="flex h-full flex-col gap-2 p-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={viewDOM} disabled={busy}><RefreshCw className="h-3.5 w-3.5" />重抓</Button>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(domSnapshot).catch(() => {})}>复制</Button>
                <Button size="sm" variant="outline" onClick={() => setDomOpen(false)}>关闭</Button>
              </div>
              <pre className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap break-all">{domSnapshot}</pre>
            </div>
          ) : (
            <EmptyState
              icon={ListTree}
              title="页面 DOM 结构"
              description="点上方 FileCode 按钮抓取当前页面的 DOM 快照"
              className="h-full"
            />
          )}
        </TabsContent>
        <TabsContent value="cookies" className="flex-1 overflow-y-auto">
          <div className="mb-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              if (!firstTargetId()) { pushToast({ kind: 'warn', title: 'Chrome 未连接' }); return; }
              setCookiesLoading(true);
              try {
                const r: any = await apiPost('/api/tools/call', { name: 'browser_cookies', args: { action: 'get', urls: ['https://example.com'] } });
                setCookies(r?.value?.cookies || []);
              } catch (e: any) { pushToast({ kind: 'error', title: '获取 Cookie 失败', description: e.message }); }
              finally { setCookiesLoading(false); }
            }}>刷新</Button>
            <Button size="sm" variant="destructive" onClick={async () => {
              try {
                await apiPost('/api/tools/call', { name: 'browser_cookies', args: { action: 'clear' } });
                setCookies([]);
                pushToast({ kind: 'success', title: '已清空所有 Cookie' });
              } catch (e: any) { pushToast({ kind: 'error', title: '清空失败', description: e.message }); }
            }}>清空全部</Button>
            <span className="text-xs text-muted-foreground">{cookies.length} 条</span>
          </div>
          {cookiesLoading ? <Skeleton className="h-9 w-full" /> :
           cookies.length === 0 ? (
            <EmptyState icon={Cookie} title="暂无 Cookie" description="连接 Chrome 后刷新 Cookie" className="h-full" />
          ) : (
            <div className="space-y-1 p-2">
              {cookies.map((c: any, i: number) => (
                <div key={i} className="rounded border border-border bg-card p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono font-medium">{c.name}</span>
                    {c.httpOnly && <span className="rounded bg-warning/10 px-1 py-0.5 text-[10px] text-warning">HttpOnly</span>}
                    {c.secure && <span className="rounded bg-success/10 px-1 py-0.5 text-[10px] text-success">Secure</span>}
                  </div>
                  <div className="mt-1 truncate font-mono text-muted-foreground" title={c.value}>{c.value?.slice(0, 60)}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{c.domain} · {c.path} · {c.expires > 0 ? `过期 ${new Date(c.expires * 1000).toLocaleDateString()}` : '会话'}</div>
                </div>
              ))}
            </div>
          )}
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
      {tabs.map((t) => {
        const tabUrl = t.url || '';
        return (
          <div
            key={t.targetId || t.id}
            className="group relative flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs transition-all hover:border-primary/50 hover:bg-accent/50"
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => {
              // Click tab to copy URL
              navigator.clipboard.writeText(tabUrl).catch(() => {});
            }}>
              <div className="truncate font-medium text-foreground hover:text-primary">{(t.title || tabUrl || 'Tab').slice(0, 60)}</div>
              <div className="truncate text-muted-foreground hover:text-primary/70">{tabUrl}</div>
            </div>
            {/* Action buttons on hover */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tabUrl).catch(() => {}); }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="复制 URL"
              >
                <Copy className="h-3 w-3" />
              </button>
              {tabUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(tabUrl, '_blank'); }}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="在浏览器打开"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}