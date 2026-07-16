// src/panels/AutomationPanel.tsx — Refined Automation Panel
// Workflows / Recorder / Templates with modern card design
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Workflow, Circle, Square, Sparkles, Search, Star, Download, Play, Trash2,
  Globe, BarChart3, Lock, FileText, Eye,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { store } from '../store';
import { cn } from '../lib/cn';

interface Props {
  tools: any[];
  onSwitchMode?: (mode: 'chat') => void;
}

const CATEGORIES = ['全部', '数据采集', '登录', '表单', '监控', '逆向'] as const;

interface Template {
  id: string;
  icon: LucideIcon;
  name: string;
  desc: string;
  prompt: string;
  category: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'login-and-screenshot',
    icon: Globe,
    name: '网站逆向分析',
    desc: '分析目标页面结构，抓取 API 端点',
    prompt: '请帮我逆向这个网站：打开 https://example.com，截一张首屏图，列出页面结构，找出主要 API 端点。',
    category: '逆向',
  },
  {
    id: 'extract-table',
    icon: BarChart3,
    name: '批量抓取表格',
    desc: '列表 URL → 抓取表格 → 导出 CSV',
    prompt: '请打开 https://example.com/data，抓取页面里所有表格，导出成 CSV 文件保存。',
    category: '数据采集',
  },
  {
    id: 'login-cookies',
    icon: Lock,
    name: '登录并抓取 Cookie',
    desc: '自动登录并导出 Cookie',
    prompt: '请帮我登录 example.com（账号 password），登录完成后导出所有 cookie 到本地文件。',
    category: '登录',
  },
  {
    id: 'fill-form',
    icon: FileText,
    name: '批量填表',
    desc: 'CSV → 填表 → 提交',
    prompt: '请读取 ~/data.csv，对每一行打开 https://example.com/form，把列填入对应字段后点提交。',
    category: '表单',
  },
  {
    id: 'monitor-change',
    icon: Eye,
    name: '监控页面变化',
    desc: '定时轮询 URL，变化时截图',
    prompt: '请帮我监控 https://example.com/status，每 60 秒刷新，看到新内容就截图保存并通知我。',
    category: '监控',
  },
  {
    id: 'scrape-ecommerce',
    icon: Globe,
    name: '电商数据采集',
    desc: '抓取商品列表 + 价格 + 库存',
    prompt: '请打开 https://example.com/products，抓取所有商品名称、价格、库存，导出成表格。',
    category: '数据采集',
  },
  {
    id: 'auto-login-linkedin',
    icon: Lock,
    name: '自动登录',
    desc: '填表单 + 保持会话',
    prompt: '请帮我登录目标网站，账号和密码在 ~/credentials.json 里。',
    category: '登录',
  },
];

export function AutomationPanel({ tools, onSwitchMode }: Props) {
  const [tab, setTab] = useState<'workflow' | 'recorder' | 'templates'>('templates');
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('全部');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const recorderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderStartRef = useRef(0);

  // Recorder logic
  const startRecording = useCallback(async () => {
    setRecording(true);
    setEvents([]);
    recorderStartRef.current = Date.now();
    pushToast({ kind: 'info', title: '录制已开始', description: '在对话模式中让 AI 操作浏览器，事件将自动记录' });
    try { await fetch('/api/activity/clear', { method: 'POST' }); } catch {}
    recorderIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/activity?limit=50');
        const data = await res.json();
        const newEvents = (data.events || []).filter((e: any) => e.ts > recorderStartRef.current);
        if (newEvents.length > 0) {
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.ts + e.tool));
            return [...prev, ...newEvents.filter((e: any) => !existingIds.has(e.ts + e.tool))].slice(-200);
          });
        }
      } catch {}
    }, 2000);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
    if (recorderIntervalRef.current) { clearInterval(recorderIntervalRef.current); recorderIntervalRef.current = null; }
    pushToast({ kind: 'success', title: '录制已停止', description: `共捕获 ${events.length} 个事件` });
  }, [events.length]);

  useEffect(() => {
    return () => { if (recorderIntervalRef.current) clearInterval(recorderIntervalRef.current); };
  }, []);

  const exportRecording = useCallback(() => {
    if (events.length === 0) return;
    const data = JSON.stringify({ events, recordedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `webpilot-recording-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    pushToast({ kind: 'success', title: '录制已导出' });
  }, [events]);

  const runTemplate = (t: Template) => {
    if (!onSwitchMode) {
      pushToast({ kind: 'warn', title: '请切换到对话模式', description: '点击左侧"对话"图标' });
      return;
    }
    store.setChatDraftPrompt(t.prompt);
    pushToast({ kind: 'success', title: `模板已加载: ${t.name}`, description: '切换到对话模式后点击发送即可' });
    onSwitchMode('chat');
  };

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (favorites.has('fav-mode') && !favorites.has(t.id)) return false;
      if (templateCategory !== '全部' && t.category !== templateCategory) return false;
      if (templateSearch) {
        const q = templateSearch.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      }
      return true;
    });
  }, [templateSearch, templateCategory, favorites]);

  return (
    <section className="mode-panel">
      <Tabs value={tab} onValueChange={v => setTab(v as any)} className="flex h-full flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="workflow" className="gap-1.5">
            <Workflow className="h-3 w-3" /> 工作流
          </TabsTrigger>
          <TabsTrigger value="recorder" className="gap-1.5">
            <Circle className="h-3 w-3" /> 录制器
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Sparkles className="h-3 w-3" /> 模板
          </TabsTrigger>
        </TabsList>

        {/* Workflow tab */}
        <TabsContent value="workflow" className="flex-1">
          <EmptyState
            icon={Workflow}
            title="工作流画布"
            description="拖拽节点 + 连线编排自动化流程"
            action={
              <Button size="sm" onClick={() => {
                const host = document.getElementById('wf-host');
                if (!host) return;
                const s = document.createElement('script');
                s.src = '/workflow-canvas.js';
                s.onload = async () => {
                  const W = (window as any).WorkflowCanvas;
                  if (!W) return;
                  new W(host, {
                    tools: (tools || []).map((t: any) => ({ name: t.name, description: t.description })),
                    onRunNode: async (n: string, a: any) => {
                      try {
                        const r = await fetch('/api/tools/call', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: n, args: a }),
                        });
                        const j = await r.json();
                        return { ok: j.ok, result: j.value, error: j.error };
                      } catch (e: any) { return { ok: false, error: e.message }; }
                    },
                  });
                };
                document.head.appendChild(s);
              }}>
                打开画布
              </Button>
            }
          />
        </TabsContent>

        {/* Recorder tab */}
        <TabsContent value="recorder" className="flex-1 overflow-y-auto p-4">
          <div className="recorder-controls">
            <Button size="sm" disabled={recording} onClick={startRecording} className="gap-1.5">
              <Circle className="h-3 w-3 fill-destructive text-destructive" /> 开始录制
            </Button>
            <Button size="sm" variant="outline" disabled={!recording} onClick={stopRecording} className="gap-1.5">
              <Square className="h-3 w-3 fill-current" /> 停止
            </Button>
            <span className={cn('text-xs font-medium', recording ? 'text-destructive animate-pulse' : 'text-muted-foreground')}>
              {recording ? '● 录制中...' : '未录制'}
            </span>
            {events.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground">{events.length} 个事件</span>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={exportRecording}>
                  <Download className="h-3 w-3" /> 导出
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" onClick={() => { setEvents([]); pushToast({ kind: 'info', title: '已清空' }); }}>
                  <Trash2 className="h-3 w-3" /> 清空
                </Button>
              </>
            )}
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon={Circle}
              title={recording ? '录制中 — 等待事件' : '暂无录制事件'}
              description={recording ? '去对话模式让 AI 操作浏览器，事件会自动出现' : '点击"开始录制"，然后在对话模式中让 AI 操作浏览器'}
              className="mt-4 h-[280px]"
            />
          ) : (
            <div className="mt-3 space-y-1 rounded-lg border border-border">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-muted/50 px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                <span className="w-20">时间</span>
                <span className="w-16">状态</span>
                <span className="w-24">Agent</span>
                <span className="flex-1">工具 / 参数</span>
                <span className="w-16 text-right">耗时</span>
              </div>
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border/50 px-3 py-1.5 text-xs last:border-0 hover:bg-accent/30">
                  <span className="w-20 font-mono text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className={cn('w-16 font-medium', e.ok ? 'text-success' : 'text-destructive')}>
                    {e.ok ? '✓ OK' : '✗ ERR'}
                  </span>
                  <span className="w-24 truncate text-muted-foreground">{e.agent || '-'}</span>
                  <span className="flex-1 truncate font-mono">{e.tool}{e.args ? ` ${JSON.stringify(e.args).slice(0, 80)}` : ''}</span>
                  <span className="w-16 text-right text-muted-foreground">{e.duration ? `${e.duration}ms` : '-'}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates tab */}
        <TabsContent value="templates" className="flex-1 overflow-y-auto p-4">
          {/* Search + filters */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="搜索模板..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => {
                const data = JSON.stringify({ templates: TEMPLATES, favorites: [...favorites] }, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'webpilot-templates.json'; a.click();
                URL.revokeObjectURL(url);
                pushToast({ kind: 'success', title: '模板已导出' });
              }}>
                <Download className="h-3 w-3" /> 导出
              </Button>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategory(cat)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    templateCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Favorites toggle */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFavorites(fav => {
                  const n = new Set(fav);
                  n.has('fav-mode') ? n.delete('fav-mode') : n.add('fav-mode');
                  return n;
                })}
                className={cn(
                  'flex items-center gap-1 transition-colors',
                  favorites.has('fav-mode') ? 'text-warning' : 'text-muted-foreground hover:text-warning'
                )}
              >
                <Star className={cn('h-3 w-3', favorites.has('fav-mode') && 'fill-warning')} />
                只看收藏
              </button>
              <span className="text-muted-foreground">{TEMPLATES.length} 个模板</span>
            </div>
          </div>

          {/* Template grid */}
          {filteredTemplates.length === 0 ? (
            <EmptyState icon={Sparkles} title="无匹配模板" description="试试换个关键词或分类" className="h-[200px]" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map(t => {
                const Icon = t.icon;
                const isFav = favorites.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    {/* Favorite star */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setFavorites(fav => {
                          const n = new Set(fav);
                          isFav ? n.delete(t.id) : n.add(t.id);
                          return n;
                        });
                      }}
                      className={cn(
                        'absolute right-3 top-3 rounded-full p-1 opacity-0 transition-all hover:bg-warning/10 group-hover:opacity-100',
                        isFav && 'opacity-100'
                      )}
                    >
                      <Star className={cn('h-4 w-4', isFav ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                    </button>

                    {/* Category badge */}
                    <span className="mb-3 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t.category}
                    </span>

                    {/* Icon + content */}
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{t.name}</h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                      </div>
                    </div>

                    {/* Run button */}
                    <Button
                      size="sm"
                      onClick={() => runTemplate(t)}
                      className="w-full gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" /> 运行模板
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
