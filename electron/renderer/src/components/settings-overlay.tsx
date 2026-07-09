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
    apiGet(`/api/settings/${cat}`).then((r) => setFields(r.fields || r || {})).catch(() => setFields({}));
  }, [cat]);

  const filtered = CATS.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    setSaveStatus('保存中...');
    try {
      await apiPost(`/api/settings/${cat}`, { patch: fields });
      setSaveStatus('✓ 已保存');
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