// src/components/sidebar.tsx — 精致侧栏 (Modern Glass Design)
import { Globe, MessageSquare, ListTree, Activity, Sparkles, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const ITEMS: Array<{
  mode: 'dashboard' | 'browser' | 'chat' | 'automation' | 'monitor';
  icon: LucideIcon;
  label: string;
  shortcut: string;
  desc: string;
  color: string;
  bg: string;
}> = [
  { mode: 'dashboard', icon: LayoutDashboard, label: '仪表盘', shortcut: 'Ctrl+1', desc: '运行状态总览', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { mode: 'browser', icon: Globe, label: '浏览器', shortcut: 'Ctrl+2', desc: '操作 Chrome 浏览器', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { mode: 'chat', icon: MessageSquare, label: '助手', shortcut: 'Ctrl+3', desc: 'AI 聊天 + 工具调用', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { mode: 'automation', icon: ListTree, label: '自动化', shortcut: 'Ctrl+4', desc: '工作流 / 录制 / 模板', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { mode: 'monitor', icon: Activity, label: '监控', shortcut: 'Ctrl+5', desc: '日志 / 网络 / Console', color: 'text-violet-400', bg: 'bg-violet-500/10' },
];

interface Props {
  mode: 'dashboard' | 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';
  onChange: (m: any) => void;
}

export function Sidebar({ mode, onChange }: Props) {
  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-[60px] flex-col items-center border-r border-border bg-card/80 py-3">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = mode === it.mode;
          return (
            <Tooltip key={it.mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChange(it.mode)}
                  className={cn(
                    'relative mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && cn(it.color, 'shadow-[0_0_16px_-4px_currentColor]')
                  )}
                  aria-label={it.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      className={cn('absolute inset-0 rounded-xl', it.bg)}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
                    />
                  )}
                  <Icon className="relative h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="rounded-lg">
                <div className="text-xs">
                  <div className="font-semibold">{it.label}</div>
                  <div className="text-muted-foreground">{it.desc}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground/50">{it.shortcut}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange('wizard')}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground',
                mode === 'wizard' && 'bg-accent text-violet-400'
              )}
              aria-label="首次设置向导"
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置向导</TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
