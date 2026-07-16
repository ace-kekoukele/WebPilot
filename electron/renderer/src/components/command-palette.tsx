// src/components/command-palette.tsx — Ctrl+K 命令面板
import { useMemo, useState, useEffect } from 'react';
import { Search, Settings, Wrench, HelpCircle, Sun, Hash, Star, Clock, ArrowRight, type LucideIcon } from 'lucide-react';
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
import { cn } from '../lib/cn';

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
    { kind: '主题', icon: Sun, name: '切换主题', desc: '暗 / 亮', action: () => { document.documentElement.classList.toggle('light'); }, shortcut: '' },
  ], [onOpenSettings, onOpenRepair, onOpenHelp]);

  const favTools = useMemo(() =>
    (tools || []).filter(t => favorites.has(t.name)).slice(0, 10).map(t => ({
      icon: Star,
      name: t.name,
      desc: (t.description || '').slice(0, 60),
      tool: t,
      isFav: true,
    })), [tools, favorites]);

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
        <div className="flex items-center gap-2 border-b border-border/60 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <CommandInput placeholder="搜索工具 / 命令 / 设置..." />
        </div>
        <CommandList className="py-2">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-8">
              <Search className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">无匹配结果</p>
            </div>
          </CommandEmpty>

          {/* 收藏 */}
          {favTools.length > 0 && (
            <CommandGroup heading="收藏">
              {favTools.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem
                    key={`fav-${i}`}
                    value={`fav-${it.name} ${it.desc}`}
                    onSelect={() => handleToolSelect(it.tool)}
                    className="group"
                  >
                    <Icon className="h-4 w-4 text-amber-500" fill="currentColor" />
                    <span className="font-mono text-[13px]">{it.name}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground/50">{it.desc}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                      title="取消收藏"
                    >
                      <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* 最近 */}
          {recentToolsList.length > 0 && (
            <CommandGroup heading="最近使用">
              {recentToolsList.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem
                    key={`recent-${i}`}
                    value={`recent-${it.name} ${it.desc}`}
                    onSelect={() => handleToolSelect(it.tool)}
                    className="group"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[13px]">{it.name}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground/50">{it.desc}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                      title={favorites.has(it.name) ? '取消收藏' : '添加收藏'}
                    >
                      <Star className={cn(
                        'h-3.5 w-3.5 transition-colors',
                        favorites.has(it.name) ? 'text-amber-500' : 'text-muted-foreground',
                      )} fill={favorites.has(it.name) ? 'currentColor' : 'none'} />
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
                <CommandItem
                  key={it.name}
                  value={`action-${it.name} ${it.desc}`}
                  onSelect={() => { it.action(); close(); }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px]">{it.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground/50">{it.desc}</span>
                  {it.shortcut && <CommandShortcut>{it.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>

          {/* 全部工具 */}
          {toolItems.length > 0 && (
            <CommandGroup heading={`全部工具 (${toolItems.length})`}>
              {toolItems.map((it, i) => {
                const Icon = it.icon;
                return (
                  <CommandItem
                    key={`tool-${i}`}
                    value={`tool-${it.name} ${it.desc}`}
                    onSelect={() => handleToolSelect(it.tool)}
                    className="group"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[13px]">{it.name}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground/50">{it.desc}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(it.name); }}
                      className="ml-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                      title={it.isFav ? '取消收藏' : '添加收藏'}
                    >
                      <Star className={cn(
                        'h-3.5 w-3.5 transition-colors',
                        it.isFav ? 'text-amber-500' : 'text-muted-foreground',
                      )} fill={it.isFav ? 'currentColor' : 'none'} />
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>

        {/* 底部提示 */}
        <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground/50">
          <span><kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono">↑↓</kbd> 导航</span>
          <span><kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono">Enter</kbd> 选择</span>
          <span><kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono">Esc</kbd> 关闭</span>
          <span className="ml-auto"><kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono">Ctrl+K</kbd> 打开</span>
        </div>
      </CommandDialog>
      {activeTool && <ToolForm tool={activeTool} onClose={() => setActiveTool(null)} />}
    </>
  );
}
