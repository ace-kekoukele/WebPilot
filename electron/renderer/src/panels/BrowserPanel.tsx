// src/panels/BrowserPanel.tsx — Refined Browser Panel
// URL bar + tab management + preview/DOM/cookies
import { useState, useEffect, useMemo } from 'react';
import {
  Globe, Crosshair, ArrowRight, RefreshCw, Camera, FileCode, Cookie,
  User, Bot, ImageIcon, ListTree, Copy, ExternalLink, Search, X, Check,
  type LucideIcon,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { useAppStore } from '../store';
import { useDebounce } from '../hooks';
import { cn } from '../lib/cn';

interface Props {
  tools: any[];
}

export function BrowserPanel({ tools }: Props) {
  const [url, setUrl] = useState('https://example.com');
  const [tabs, setTabs] = useState<{ user: any[]; agent: any[] }>({ user: [], agent: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [domSnapshot, setDomSnapshot] = useState('');
  const [domOpen, setDomOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [cookies, setCookies] = useState<any[]>([]);
  const [cookiesLoading, setCookiesLoading] = useState(false);
  const [tabSearch, setTabSearch] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set());

  const health = useAppStore(s => s.health);

  // URL validation
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

  useEffect(() => {
    refreshTabs();
    const t = setInterval(refreshTabs, 5000);
    return () => clearInterval(t);
  }, []);

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
        pushToast({ kind: 'warn', title: 'Chrome 未连接', description: '请在 PowerShell 运行 chrome --remote-debugging-port=9222' });
        return;
      }
      await apiPost('/api/tools/call', { name: 'browser_navigate', args: { url, targetId } });
      pushToast({ kind: 'success', title: '已跳转', description: url });
    } catch (e: any) {
      pushToast({ kind: 'error', title: '跳转失败', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const screenshot = async () => {
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) { pushToast({ kind: 'warn', title: 'Chrome 未连接' }); return; }
      const r: any = await apiPost('/api/tools/call', { name: 'browser_screenshot', args: { targetId, format: 'png' } });
      const v = r?.value;
      const dataUrl = typeof v === 'string' ? v : v?.data ? `data:image/${v.format || 'png'};base64,${v.data}` : null;
      if (dataUrl) {
        setScreenshotUrl(dataUrl);
        pushToast({ kind: 'success', title: '截图已捕获' });
      } else {
        pushToast({ kind: 'info', title: '截图完成', description: '格式未识别' });
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: '截图失败', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const viewDOM = async () => {
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) { pushToast({ kind: 'warn', title: 'Chrome 未连接' }); return; }
      const r: any = await apiPost('/api/tools/call', { name: 'browser_dom_snapshot', args: { targetId } });
      const v = r?.value;
      const text = typeof v === 'string' ? v : v?.html || v?.snapshot || JSON.stringify(v, null, 2);
      setDomSnapshot(text || '(空)');
      setDomOpen(true);
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'DOM 抓取失败', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const pickElement = async () => {
    setPicking(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) { pushToast({ kind: 'warn', title: 'Chrome 未连接' }); return; }
      await apiPost('/api/tools/call', {
        name: 'browser_script',
        args: {
          targetId,
          expression: `(() => {
            if (window.__webpilotPicking) return;
            window.__webpilotPicking = true;
            const o = document.createElement('div');
            o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(99,102,241,.06);cursor:crosshair;';
            const t = document.createElement('div');
            t.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;padding:6px 14px;border-radius:8px;font:12px sans-serif;z-index:2147483648;';
            t.textContent = '点击元素选中 · Esc 取消';
            document.body.appendChild(o); document.body.appendChild(t);
            const c = () => { o.remove(); t.remove(); window.__webpilotPicking = false; window.removeEventListener('keydown', k); };
            const k = (e) => { if(e.key==='Escape')c(); };
            window.addEventListener('keydown', k);
            o.addEventListener('click', (ev) => {
              ev.preventDefault(); ev.stopPropagation();
              const el = ev.target;
              const sel = el.tagName ? (el.id ? '#'+el.id : (el.className && typeof el.className==='string' ? '.'+el.className.split(' ').filter(Boolean).join('.') : el.tagName.toLowerCase())) : 'unknown';
              console.log('[webpilot-pick] '+sel+' :: '+(el.innerText||'').slice(0,80));
              c(); window.__webpilotPicked = {selector:sel, text:(el.innerText||'').slice(0,80)};
            }, true);
            return 'picker attached';
          })()`,
        },
      });
      pushToast({ kind: 'info', title: '元素选择器已激活', description: '在 Chrome 页面点击目标元素' });
    } catch (e: any) {
      pushToast({ kind: 'error', title: '选择器失败', description: e.message });
    } finally {
      setPicking(false);
    }
  };

  const cdpOk = !!health?.cdpConnected;

  return (
    <section className="mode-panel">
      {/* URL Toolbar */}
      <div className="browser-toolbar">
        <div className="relative flex-1">
          <Globe className={cn(
            'pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
            urlValid ? 'text-muted-foreground' : 'text-destructive'
          )} />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate()}
            placeholder="输入 URL，回车导航..."
            className="browser-url-input pl-8"
          />
        </div>
        <Button size="sm" onClick={navigate} disabled={busy} className="gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" /> 跳转
        </Button>
        <Button size="sm" variant="outline" onClick={refreshTabs} disabled={busy} title="刷新标签页">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={screenshot} disabled={busy} title="截图">
          <Camera className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={viewDOM} disabled={busy} title="DOM 快照">
          <FileCode className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={pickElement} disabled={busy || picking} title="元素选择器">
          <Crosshair className={cn('h-3.5 w-3.5', picking && 'animate-pulse text-primary')} />
        </Button>
      </div>

      {/* Content area */}
      <Tabs defaultValue="preview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="px-3">
          <TabsTrigger value="preview">预览 {screenshotUrl ? '(1)' : ''}</TabsTrigger>
          <TabsTrigger value="user">用户 Tab ({tabs.user.length})</TabsTrigger>
          <TabsTrigger value="agent">Agent Tab ({tabs.agent.length})</TabsTrigger>
          <TabsTrigger value="dom">DOM</TabsTrigger>
          <TabsTrigger value="cookies">Cookie</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 overflow-auto">
          {screenshotUrl ? (
            <div className="space-y-2 p-3">
              <img src={screenshotUrl} alt="screenshot" className="w-full rounded-lg border border-border shadow-sm" />
              <Button size="sm" variant="outline" onClick={() => setScreenshotUrl(null)}>清空</Button>
            </div>
          ) : (
            <EmptyState
              icon={ImageIcon}
              title="浏览器实时预览"
              description={cdpOk ? '点击上方相机按钮截图查看当前页面' : 'Chrome 未连接 · 运行 chrome --remote-debugging-port=9222'}
              className="h-full"
            />
          )}
        </TabsContent>

        <TabsContent value="user" className="flex-1 overflow-hidden">
          <TabList
            loading={loading}
            tabs={tabs.user}
            icon={User}
            label="用户标签页"
            empty="Chrome 未连接或无标签页"
            searchValue={tabSearch}
            onSearchChange={setTabSearch}
            selectedTabs={selectedTabs}
            onToggleSelect={id => {
              const next = new Set(selectedTabs);
              next.has(id) ? next.delete(id) : next.add(id);
              setSelectedTabs(next);
            }}
            onSelectAll={() => setSelectedTabs(new Set(tabs.user.map(t => t.targetId || t.id)))}
            onClearSelect={() => setSelectedTabs(new Set())}
          />
        </TabsContent>

        <TabsContent value="agent" className="flex-1 overflow-hidden">
          <TabList
            loading={loading}
            tabs={tabs.agent}
            icon={Bot}
            label="Agent 标签页"
            empty="Agent 尚未打开标签页"
            searchValue={tabSearch}
            onSearchChange={setTabSearch}
            selectedTabs={selectedTabs}
            onToggleSelect={id => {
              const next = new Set(selectedTabs);
              next.has(id) ? next.delete(id) : next.add(id);
              setSelectedTabs(next);
            }}
            onSelectAll={() => setSelectedTabs(new Set(tabs.agent.map(t => t.targetId || t.id)))}
            onClearSelect={() => setSelectedTabs(new Set())}
          />
        </TabsContent>

        <TabsContent value="dom" className="flex-1 overflow-hidden">
          {domOpen ? (
            <div className="flex h-full flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={viewDOM} disabled={busy}>
                  <RefreshCw className="h-3.5 w-3.5" /> 重新抓取
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(domSnapshot).catch(() => {})}>
                  复制
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDomOpen(false)}>关闭</Button>
              </div>
              <pre className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {domSnapshot}
              </pre>
            </div>
          ) : (
            <EmptyState
              icon={ListTree}
              title="页面 DOM 结构"
              description="点击上方代码按钮抓取当前页面的 DOM 快照"
              className="h-full"
            />
          )}
        </TabsContent>

        <TabsContent value="cookies" className="flex-1 overflow-auto p-3">
          <div className="mb-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              if (!firstTargetId()) { pushToast({ kind: 'warn', title: 'Chrome 未连接' }); return; }
              setCookiesLoading(true);
              try {
                const r: any = await apiPost('/api/tools/call', { name: 'browser_cookies', args: { action: 'get', urls: ['https://example.com'] } });
                setCookies(r?.value?.cookies || []);
              } catch (e: any) {
                pushToast({ kind: 'error', title: '获取失败', description: e.message });
              } finally {
                setCookiesLoading(false);
              }
            }}>
              刷新
            </Button>
            <Button size="sm" variant="destructive" onClick={async () => {
              try {
                await apiPost('/api/tools/call', { name: 'browser_cookies', args: { action: 'clear' } });
                setCookies([]);
                pushToast({ kind: 'success', title: '已清空所有 Cookie' });
              } catch (e: any) {
                pushToast({ kind: 'error', title: '清空失败', description: e.message });
              }
            }}>
              清空全部
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">{cookies.length} 条</span>
          </div>

          {cookiesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : cookies.length === 0 ? (
            <EmptyState icon={Cookie} title="暂无 Cookie" description="连接 Chrome 后刷新获取" className="h-full" />
          ) : (
            <div className="space-y-2">
              {cookies.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium">{c.name}</span>
                    {c.httpOnly && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">HttpOnly</span>}
                    {c.secure && <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">Secure</span>}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={c.value}>
                    {c.value?.slice(0, 80)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{c.domain}</span>
                    <span>{c.path}</span>
                    <span>{c.expires > 0 ? `过期 ${new Date(c.expires * 1000).toLocaleDateString()}` : '会话'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

// Sub-component: TabList
function TabList({
  loading, tabs, icon: Icon, label, empty,
  searchValue, onSearchChange,
  selectedTabs, onToggleSelect, onSelectAll, onClearSelect,
}: {
  loading: boolean;
  tabs: any[];
  icon: LucideIcon;
  label: string;
  empty: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  selectedTabs?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelect?: () => void;
}) {
  const filteredTabs = useMemo(() => {
    if (!searchValue) return tabs;
    const q = searchValue.toLowerCase();
    return tabs.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.url || '').toLowerCase().includes(q)
    );
  }, [tabs, searchValue]);

  const allSelected = tabs.length > 0 && tabs.every(t => selectedTabs?.has(t.targetId || t.id));

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (tabs.length === 0) {
    return <EmptyState icon={Icon} title={label} description={empty} className="h-full" />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search + batch actions */}
      <div className="flex items-center gap-2 p-2 pb-0">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue || ''}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="搜索标签页..."
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {onToggleSelect && (
          <button
            onClick={() => (allSelected ? onClearSelect?.() : onSelectAll?.())}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary"
            title={allSelected ? '取消全选' : '全选'}
          >
            {allSelected ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </button>
        )}
        <span className="text-xs text-muted-foreground">{filteredTabs.length}/{tabs.length}</span>
      </div>

      {/* Tab items */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {filteredTabs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">无匹配结果</div>
        ) : (
          filteredTabs.map(t => {
            const tabId = t.targetId || t.id;
            const tabUrl = t.url || '';
            const isSelected = selectedTabs?.has(tabId);
            return (
              <div
                key={tabId}
                className={cn(
                  'group relative flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs transition-all',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                )}
              >
                {onToggleSelect && (
                  <button
                    onClick={e => { e.stopPropagation(); onToggleSelect(tabId); }}
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" />}
                  </button>
                )}
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(tabUrl).catch(() => {})}
                >
                  <div className="truncate font-medium hover:text-primary">
                    {(t.title || tabUrl || 'Tab').slice(0, 60)}
                  </div>
                  <div className="truncate text-muted-foreground">{tabUrl}</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(tabUrl).catch(() => {}); }}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="复制 URL"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {tabUrl && (
                    <button
                      onClick={e => { e.stopPropagation(); window.open(tabUrl, '_blank'); }}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="在浏览器打开"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Batch action bar */}
      {selectedTabs && selectedTabs.size > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-2 py-1.5">
          <span className="text-xs text-muted-foreground">已选 {selectedTabs.size} 个</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              const urls = tabs.filter(t => selectedTabs.has(t.targetId || t.id)).map(t => t.url).filter(Boolean);
              navigator.clipboard.writeText(urls.join('\n')).catch(() => {});
              pushToast({ kind: 'success', title: `已复制 ${urls.length} 个 URL` });
            }}
          >
            <Copy className="h-3 w-3" /> 复制全部
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              tabs.filter(t => selectedTabs.has(t.targetId || t.id)).map(t => t.url).filter(Boolean).forEach(u => window.open(u, '_blank'));
            }}
          >
            <ExternalLink className="h-3 w-3" /> 批量打开
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs" onClick={() => onClearSelect?.()}>
            取消
          </Button>
        </div>
      )}
    </div>
  );
}
