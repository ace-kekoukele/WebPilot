// src/components/command-palette.tsx — Ctrl+K 命令面板 (cmdk + shadcn Dialog + lucide, 工具项真调 /api/tools/call)
// 增强: 最近使用 + 收藏 + 分类分组
import { useMemo, useState, useEffect } from 'react';
import { Settings, Wrench, HelpCircle, Sun, Hash, Star, Clock, type LucideIcon } from 'lucide-react';
import { useTheme } from './theme-provider';
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
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { toggle: toggleTheme } = useTheme();

  // 加载最近使用和收藏
  useEffect(() => {
    try {
      const rec = localStorage.getItem('webpilot-recent-tools');
      if (rec) setRecentTools(JSON.parse(rec));
      const fav = localStorage.getItem('webpilot-fav-tools');
      if (fav) setFavorites(new Set(JSON.parse(fav)));
    } catch {}
  }, []);

  const saveRecent = (name: string) => {
    const next = [name, ...recentTools.filter(n => n !== name)].slice(0, 5);
    setRecentTools(next);
    localStorage.setItem('webpilot-recent-tools', JSON.stringify(next));
  };

  const toggleFav = (name: string) => {
    const next = new Set(favorites);
    next.has(name) ? next.delete(name) : next.add(name);
    setFavorites(next);
    localStorage.setItem('webpilot-fav-tools', JSON.stringify([...next]));
  };

  const staticItems = useMemo<Array<{ kind: string; icon: LucideIcon; name: string; desc: string; action: () => void; shortcut?: string }>>(() => [
    { kind: '设置', icon: Settings, name: '打开设置', desc: '设置面板', action: onOpenSettings, shortcut: 'Ctrl+,' },
    { kind: '修复', icon: Wrench, name: '一键修复', desc: '修复常见故障', action: onOpenRepair },
    { kind: '帮助', icon: HelpCircle, name: '帮助', desc: '快捷键 / 模板 / FAQ', action: () => onOpenHelp?.(), shortcut: 'F1' },
    { kind: '主题', icon: Sun, name: '切换主题', desc: '暗 / 亮', action: toggleTheme, shortcut: '' },
  ], [onOpenSettings, onOpenRepair, onOpenHelp, toggleTheme]);

  // 收藏工具
  const favTools = useMemo(() =>
    (tools || []).filter(t => favorites.has(t.name)).slice(0, 10).map(t => ({
      icon: Star,
      name: t.name,
      desc: (t.description || '').slice(0, 60),
      tool: t,
      isFav: true,
    })), [tools, favorites]);

  // 最近工具
  const recentToolsList = useMemo(() => {
    return recentTools
      .map(n => (tools || []).find(t => t.name === n))
      .filter(Boolean)
      .slice(0, 5)
      .map(t => ({
        icon: Clock,
        name: t!.name,
        desc: (t!.description || '').slice(0, 60),
        tool: t!,
        isFav: false,
      }));
  }, [tools, recentTools]);

  // 全部工具 (按类别分组)
  const toolItems = useMemo(() => (tools || []).slice(0, 200).map((t) => ({
    icon: Hash,
    name: t.name,
    desc: (t.description || '').slice(0, 60),
    tool: t,
    isFav: favorites.has(t.name),
  })), [tools, favorites]);

  const handleToolSelect = (tool: any) => {
    saveRecent(tool.name);
    setActiveTool(tool);
  };

  const close = () => { setOpen(false); onClose(); };

  return (
    <>
      <CommandDialog open={open} onOpenChange={(v) => !v && close()}>
        <CommandInput placeholder="搜索工具 / 模板 / 命令..." />
        <CommandList>
          <CommandEmpty>无匹配结果</CommandEmpty>
          {/* 收藏 */}
          {favTools.length > 0 && (
            <CommandGroup heading={`⭐ 收藏 (${favTools.length})`}>
              {favTools.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={`fav-${i}`} value={`${it.name} ${it.desc}`} onSelect={() => handleToolSelect(it.tool)}>
                    <Icon className="h-4 w-4 fill-warning text-warning" />
                    <span className="font-mono">{it.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto mr-1 text-muted-foreground hover:text-warning"
                    >
                      <Star className="h-3 w-3 fill-warning text-warning" />
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {/* 最近 */}
          {recentToolsList.length > 0 && (
            <CommandGroup heading={`🕐 最近 (${recentToolsList.length})`}>
              {recentToolsList.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={`recent-${i}`} value={`${it.name} ${it.desc}`} onSelect={() => handleToolSelect(it.tool)}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{it.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto mr-1 text-muted-foreground hover:text-warning"
                    >
                      <Star className={cn('h-3 w-3', favorites.has(it.name) && 'fill-warning text-warning')} />
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {/* 动作 */}
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
          {/* 全部工具 */}
          {toolItems.length > 0 && (
            <CommandGroup heading={`工具 (${toolItems.length})`}>
              {toolItems.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={`tool-${i}`} value={`${it.name} ${it.desc}`} onSelect={() => handleToolSelect(it.tool)}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{it.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto mr-1 text-muted-foreground hover:text-warning"
                    >
                      <Star className={cn('h-3 w-3', it.isFav && 'fill-warning text-warning')} />
                    </button>
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

function cn(...args: any[]) {
  return args.filter(Boolean).join(' ');
}