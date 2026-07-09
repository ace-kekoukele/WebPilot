// src/components/command-palette.tsx — Ctrl+K 命令面板 (cmdk + shadcn Dialog + lucide, 工具项真调 /api/tools/call)
import { useMemo, useState } from 'react';
import { Settings, Wrench, HelpCircle, Sun, Hash, type LucideIcon } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ui/command';
import { ToolForm } from './tool-form';

interface Props {
  tools: any[];
  onClose: () => void;
  onToast: (t: any) => void;
  onOpenRepair: () => void;
  onOpenSettings: () => void;
  onOpenHelp?: () => void;
}

export function CommandPalette({ tools, onClose, onToast, onOpenRepair, onOpenSettings, onOpenHelp }: Props) {
  const [open, setOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<{ name: string; description?: string; parameters?: any } | null>(null);

  const staticItems = useMemo<Array<{ kind: string; icon: LucideIcon; name: string; desc: string; action: () => void; shortcut?: string }>>(() => [
    { kind: '设置', icon: Settings, name: '打开设置', desc: '设置面板', action: onOpenSettings, shortcut: 'Ctrl+,' },
    { kind: '修复', icon: Wrench, name: '一键修复', desc: '修复常见故障', action: onOpenRepair },
    { kind: '帮助', icon: HelpCircle, name: '帮助', desc: '快捷键 / 模板 / FAQ', action: () => onOpenHelp?.(), shortcut: 'F1' },
    { kind: '主题', icon: Sun, name: '切换主题', desc: '暗 / 亮', action: () => { document.documentElement.classList.toggle('light'); }, shortcut: '' },
  ], [onOpenSettings, onOpenRepair, onOpenHelp]);

  const toolItems = useMemo(() => (tools || []).slice(0, 200).map((t) => ({
    icon: Hash,
    name: t.name,
    desc: (t.description || '').slice(0, 80),
    tool: t,
  })), [tools]);

  const close = () => { setOpen(false); onClose(); };

  return (
    <>
      <CommandDialog open={open} onOpenChange={(v) => !v && close()}>
        <CommandInput placeholder="搜索工具 / 模板 / 命令..." />
        <CommandList>
          <CommandEmpty>无匹配结果</CommandEmpty>
          <CommandGroup heading="动作">
            {staticItems.map((it) => {
              const Icon = it.icon;
              return (
                <CommandItem key={it.name} value={`${it.name} ${it.desc}`} onSelect={() => { it.action(); close(); }}>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{it.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{it.desc}</span>
                  {it.shortcut && <CommandShortcut>{it.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {toolItems.length > 0 && (
            <CommandGroup heading={`工具 (${toolItems.length})`}>
              {toolItems.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={`tool-${i}`} value={`${it.name} ${it.desc}`} onSelect={() => { setActiveTool(it.tool); }}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{it.name}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{it.desc}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      {activeTool && <ToolForm tool={activeTool} onClose={() => setActiveTool(null)} />}
    </>
  );
}