// src/components/command-palette.tsx — Ctrl+K 命令面板 (cmdk + shadcn Dialog + lucide)
import { useMemo, useState } from 'react';
import { Settings, Wrench, HelpCircle, Sun, Hash, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ui/command';

interface Props {
  tools: any[];
  onClose: () => void;
  onToast: (t: any) => void;
  onOpenRepair: () => void;
  onOpenSettings: () => void;
}

const STATIC_ITEMS: Array<{ kind: string; icon: LucideIcon; name: string; desc: string; action: () => void; shortcut?: string }> = [
  { kind: '设置', icon: Settings, name: '打开设置', desc: '设置面板', action: () => {}, shortcut: 'Ctrl+,' },
  { kind: '修复', icon: Wrench, name: '一键修复', desc: '修复常见故障', action: () => {}, shortcut: '' },
  { kind: '帮助', icon: HelpCircle, name: '帮助', desc: '快捷键 / 模板 / FAQ', action: () => {}, shortcut: 'F1' },
  { kind: '主题', icon: Sun, name: '切换主题', desc: '暗 / 亮', action: () => { document.documentElement.classList.toggle('light'); }, shortcut: '' },
];

export function CommandPalette({ tools, onClose, onToast, onOpenRepair, onOpenSettings }: Props) {
  const [open, setOpen] = useState(true);

  const items = useMemo(() => {
    const toolItems = (tools || []).slice(0, 200).map((t) => ({
      kind: '工具',
      icon: Hash,
      name: t.name,
      desc: (t.description || '').slice(0, 60),
      action: () => onToast({ kind: 'info', title: `调用 ${t.name}`, description: '请到 工具面板 填参数后运行' }),
      shortcut: '',
    }));
    return [
      ...STATIC_ITEMS.map((it) => ({
        ...it,
        action:
          it.kind === '设置' ? onOpenSettings :
          it.kind === '修复' ? onOpenRepair :
          it.kind === '帮助' ? () => {} :
          it.action,
      })),
      ...toolItems,
    ];
  }, [tools, onToast, onOpenRepair, onOpenSettings]);

  const close = () => { setOpen(false); onClose(); };

  return (
    <CommandDialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogTitle className="sr-only">命令面板</DialogTitle>
      <CommandInput placeholder="搜索工具 / 模板 / 命令..." />
      <CommandList>
        <CommandEmpty>无匹配结果</CommandEmpty>
        <CommandGroup heading="动作">
          {STATIC_ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <CommandItem key={it.name} value={`${it.name} ${it.desc}`} onSelect={() => { it.action?.(); close(); }}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{it.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{it.desc}</span>
                {it.shortcut && <CommandShortcut>{it.shortcut}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {tools && tools.length > 0 && (
          <CommandGroup heading={`工具 (${items.length - STATIC_ITEMS.length})`}>
            {items.slice(STATIC_ITEMS.length).map((it, i) => {
              const Icon = it.icon;
              return (
                <CommandItem key={`tool-${i}`} value={`${it.name} ${it.desc}`} onSelect={() => { it.action?.(); close(); }}>
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
  );
}