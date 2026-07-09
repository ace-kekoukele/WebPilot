// src/components/settings-overlay.tsx — 设置 (12 类目, shadcn Dialog + Tabs + lucide)
import { useState, useEffect } from 'react';
import { Link2, Globe, Bot, MessageSquare, Layers, Monitor, Languages, FileText, Bell, Shield, RefreshCw, Wrench, Search, type LucideIcon } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/cn';

interface Props { onClose: () => void; }

const CATS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'connect', label: '连接', icon: Link2 },
  { id: 'chrome', label: 'Chrome 浏览器', icon: Globe },
  { id: 'agent', label: 'Agent 连接', icon: Bot },
  { id: 'llm', label: 'LLM API', icon: MessageSquare },
  { id: 'proxy', label: '代理', icon: Layers },
  { id: 'ui', label: '界面', icon: Monitor },
  { id: 'language', label: '语言', icon: Languages },
  { id: 'logs', label: '日志', icon: FileText },
  { id: 'notify', label: '通知', icon: Bell },
  { id: 'privacy', label: '隐私', icon: Shield },
  { id: 'update', label: '更新', icon: RefreshCw },
  { id: 'advanced', label: '高级', icon: Wrench },
];

export function SettingsOverlay({ onClose }: Props) {
  const [cat, setCat] = useState('connect');
  const [q, setQ] = useState('');
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    // 端口类目走 /api/ports(读 + 保存)
    if (cat === 'connect') {
      apiGet('/api/ports').then((r) => {
        setFields(r.current || {});
      }).catch(() => setFields({}));
      return;
    }
    // LLM 类目走 /api/llm/providers(读) + /api/llm/active(写)
    if (cat === 'llm') {
      apiGet('/api/llm/providers').then((r) => {
        setFields({ providers: r.presets || [], active: r.active, configured: r.configured || [] });
      }).catch(() => setFields({ providers: [] }));
      return;
    }
    apiGet(`/api/settings/${cat}`).then((r) => setFields(r.fields || r || {})).catch(() => setFields({}));
  }, [cat]);

  const filtered = CATS.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    setSaveStatus('保存中...');
    try {
      if (cat === 'connect') {
        await apiPost('/api/ports', { ports: fields });
        setSaveStatus('✓ 已保存 (需重启 daemon)');
      } else if (cat === 'llm') {
        // LLM 配置不通过此弹窗保存 (在 ChatPanel 选择 provider 即可)
        setSaveStatus('✓ LLM 在 ChatPanel 选择');
      } else {
        await apiPost(`/api/settings/${cat}`, { patch: fields });
        setSaveStatus('✓ 已保存');
      }
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e: any) {
      setSaveStatus(`✗ ${e.message}`);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="flex h-[60vh]">
          <aside className="flex w-52 flex-col border-r border-border">
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索设置..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <nav className="flex flex-col gap-0.5 p-1">
                {filtered.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCat(c.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                        'hover:bg-accent',
                        cat === c.id ? 'bg-accent text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {c.label}
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>
          <div className="flex flex-1 flex-col">
            <ScrollArea className="flex-1 px-5 py-4">
              <SettingsForm cat={cat} fields={fields} setFields={setFields} />
            </ScrollArea>
            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
              <span className="mr-auto text-xs text-muted-foreground">{saveStatus}</span>
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([JSON.stringify(fields, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `webpilot-${cat}-${Date.now()}.json`; a.click();
              }}>导出配置</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
                inp.onchange = async () => {
                  const file = inp.files?.[0]; if (!file) return;
                  const text = await file.text();
                  try {
                    const parsed = JSON.parse(text);
                    setFields(parsed);
                    setSaveStatus('✓ 已加载,点保存生效');
                  } catch { setSaveStatus('✗ 文件格式错误'); }
                };
                inp.click();
              }}>导入配置</Button>
              <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
              <Button size="sm" onClick={save}>保存</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ cat, fields, setFields }: { cat: string; fields: any; setFields: (f: any) => void }) {
  if (cat === 'agent') return <p className="text-sm text-muted-foreground">实时显示已连接的 Agent. 查看顶栏 Agent pill 或 Activity Log.</p>;
  if (cat === 'update') return <p className="text-sm text-muted-foreground">v4.0.3 不做自动更新. 升级: 下载新版 .exe 覆盖装即可.</p>;
  if (cat === 'language') return <p className="text-sm text-muted-foreground">v4.0.3 只支持简体中文.</p>;

  // 端口类目 — 专门 UI
  if (cat === 'connect') {
    return <PortsForm fields={fields} setFields={setFields} />;
  }

  // LLM 类目 — 专门 UI
  if (cat === 'llm') {
    return <LLMForm fields={fields} />;
  }

  const entries = Object.entries(fields || {});
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">此分类暂无设置项.</p>;

  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <label className="text-xs text-muted-foreground">{k}</label>
          <Input
            value={typeof v === 'string' || typeof v === 'number' ? v : ''}
            onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
      ))}
    </div>
  );
}

function PortsForm({ fields, setFields }: { fields: any; setFields: (f: any) => void }) {
  const ports = fields || {};
  const labels: Record<string, string> = {
    cdp: 'CDP (Chrome DevTools)',
    mcp: 'MCP (Model Context Protocol)',
    http: 'HTTP API',
    control: 'Control (内部)',
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">每个端口被占用时 daemon 会自动迁移。改完点保存需重启 daemon。</p>
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="flex items-center gap-3">
          <label className="w-40 text-xs text-muted-foreground">{label}</label>
          <Input
            type="number"
            value={ports[key] ?? ''}
            onChange={(e) => setFields({ ...ports, [key]: parseInt(e.target.value, 10) || 0 })}
            className="w-32 font-mono text-xs"
          />
          <span className="text-[10px] text-muted-foreground">{key}</span>
        </div>
      ))}
    </div>
  );
}

function LLMForm({ fields }: { fields: any }) {
  const providers = fields.providers || [];
  const configured = fields.configured || [];
  const active = fields.active;
  if (providers.length === 0) return <p className="text-sm text-muted-foreground">无法加载 LLM 列表 (daemon 未就绪)</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">15 个内置 provider。在 ChatPanel 顶栏下拉选择,再输入 API key 即可使用。当前已配置 {configured.length} 个,正在使用 {active ? active : '无'}。</p>
      <div className="space-y-1.5">
        {providers.map((p: any) => {
          const isConfigured = configured.includes(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
              <span className="font-medium">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.baseUrl || '(自定义)'}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{p.region}</span>
              {isConfigured && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600">已配置</span>}
              {active === p.id && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">使用中</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}