// src/panels/AutomationPanel.tsx — 自动化 (工作流 / 录制器 / 模板) with shadcn Tabs + EmptyState + lucide
import { useState, useRef } from 'react';
import { ListTree, Circle, Square, Globe, BarChart3, Lock, FileText, Eye, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { store } from '../store';
import { cn } from '../lib/cn';

interface Props {
  tools: any[];
  onSwitchMode?: (mode: 'chat') => void;
}

const TEMPLATES = [
  {
    id: 'login-and-screenshot',
    icon: Globe,
    name: '网站逆向',
    desc: '分析目标页面结构 + 抓 API',
    prompt: '请帮我逆向这个网站:打开 https://example.com, 截一张首屏图, 列出页面结构, 找出主要 API 端点。',
  },
  {
    id: 'extract-table',
    icon: BarChart3,
    name: '批量抓表格',
    desc: '列表 URL → 抓表格 → CSV',
    prompt: '请打开 https://example.com/data, 抓页面里所有表格, 导出成 CSV 文件保存。',
  },
  {
    id: 'login-cookies',
    icon: Lock,
    name: '登录 + 抓 Cookie',
    desc: '登录并导出 cookie',
    prompt: '请帮我登录 example.com (账号 password), 登录完成后导出所有 cookie 到本地文件。',
  },
  {
    id: 'fill-form',
    icon: FileText,
    name: '批量填表',
    desc: 'CSV → 填表 → 提交',
    prompt: '请读取 ~/data.csv, 对每一行打开 https://example.com/form, 把列填入对应字段后点提交。',
  },
  {
    id: 'monitor-change',
    icon: Eye,
    name: '监控变化',
    desc: '轮询 URL, 变化时截图',
    prompt: '请帮我监控 https://example.com/status, 每 60 秒刷新, 看到新内容就截图保存并通知我。',
  },
];

export function AutomationPanel({ tools, onSwitchMode }: Props) {
  const [tab, setTab] = useState<'workflow' | 'recorder' | 'templates'>('workflow');
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const recorderStartRef = useRef<number>(0);

  const runTemplate = (t: typeof TEMPLATES[number]) => {
    if (!onSwitchMode) {
      pushToast({ kind: 'warn', title: '运行需要切到聊天模式', description: '点侧边栏"聊天"图标' });
      return;
    }
    // 检查 LLM 是否配置
    const llmActive = store.getState ? store.getState() : null;
    // store 没有 getState — 用 useAppStore 不行这里; 走 pushToast 提示
    store.setChatDraftPrompt(t.prompt);
    pushToast({ kind: 'success', title: `模板已填好: ${t.name}`, description: '跳到聊天 → 点发送即可' });
    onSwitchMode('chat');
  };

  return (
    <section className="mode-panel flex h-full flex-col p-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex h-full flex-col">
        <TabsList>
          <TabsTrigger value="workflow" className="gap-1.5"><ListTree className="h-3 w-3" />工作流</TabsTrigger>
          <TabsTrigger value="recorder" className="gap-1.5"><Circle className="h-3 w-3" />录制器</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><Sparkles className="h-3 w-3" />模板</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="flex-1">
          <EmptyState
            icon={ListTree}
            title="工作流画布"
            description="节点拖入 + 端口连线 + 运行/单步/重置. v4.0.4 接 @xyflow/react (P2-28 待做)"
            action={
              <Button size="sm" onClick={() => {
                const host = document.getElementById('wf-host');
                if (!host) return;
                const s = document.createElement('script');
                s.src = '/workflow-canvas.js';
                s.onload = async () => {
                  const W = (window as any).WorkflowCanvas;
                  if (!W) return;
                  const nodeTools = (tools || []).map((t: any) => ({ name: t.name, description: t.description }));
                  new W(host, { tools: nodeTools, onRunNode: async (n: string, a: any) => {
                    try {
                      const r = await fetch('/api/tools/call', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: n, args: a }) });
                      const j = await r.json();
                      return { ok: j.ok, result: j.value, error: j.error };
                    } catch (e: any) { return { ok: false, error: e.message }; }
                  }});
                };
                document.head.appendChild(s);
              }}>打开画布</Button>
            }
          />
        </TabsContent>

        <TabsContent value="recorder" className="flex-1 overflow-y-auto">
          <div className="mb-3 flex items-center gap-2">
            <Button size="sm" disabled={recording} onClick={() => { setRecording(true); recorderStartRef.current = Date.now(); }} className="gap-1.5">
              <Circle className="h-3 w-3 fill-destructive text-destructive" />
              开始录制
            </Button>
            <Button size="sm" variant="outline" disabled={!recording} onClick={() => setRecording(false)} className="gap-1.5">
              <Square className="h-3 w-3 fill-current" />
              停止
            </Button>
            <span className={cn('text-xs', recording ? 'text-destructive' : 'text-muted-foreground')}>
              {recording ? '● 录制中...' : '未录制'}
            </span>
          </div>
          {events.length === 0 ? (
            <EmptyState icon={Circle} title={recording ? '录制中' : '暂无事件'} description={recording ? '在 Chrome 里操作, 这里会记录工具调用' : '点击"开始录制"开始捕获浏览器动作'} className="h-[280px]" />
          ) : (
            <div className="space-y-1 rounded-md border border-border p-2">
              {events.map((e, i) => (
                <div key={i} className="rounded bg-muted/30 px-2 py-1 font-mono text-xs">
                  {new Date(e.ts).toLocaleTimeString()} {e.tool}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className="group rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
                  onClick={() => runTemplate(t)}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold">{t.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <div className="mt-3 font-mono text-[10px] text-muted-foreground">{t.id}</div>
                </button>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}