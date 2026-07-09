// src/components/sidebar.tsx — 52px 侧栏, lucide 图标 + hover tooltips + framer-motion pill 指示器
import { Globe, MessageSquare, ListTree, Activity, Sparkles, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const ITEMS: Array<{ mode: 'browser' | 'chat' | 'automation' | 'monitor'; icon: LucideIcon; label: string; shortcut: string }> = [
  { mode: 'browser', icon: Globe, label: '浏览器', shortcut: 'Ctrl+1' },
  { mode: 'chat', icon: MessageSquare, label: '助手', shortcut: 'Ctrl+2' },
  { mode: 'automation', icon: ListTree, label: '自动化', shortcut: 'Ctrl+3' },
  { mode: 'monitor', icon: Activity, label: '监控', shortcut: 'Ctrl+4' },
];

interface Props {
  mode: 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';
  onChange: (m: any) => void;
}

export function Sidebar({ mode, onChange }: Props) {
  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-[52px] flex-col items-center border-r border-border bg-card/50 py-2">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = mode === it.mode;
          return (
            <Tooltip key={it.mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChange(it.mode)}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'text-foreground'
                  )}
                  aria-label={it.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-md bg-accent"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{it.label} <span className="ml-1 text-muted-foreground">{it.shortcut}</span></TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange('wizard')}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground',
                mode === 'wizard' && 'bg-accent text-foreground'
              )}
              aria-label="首次设置向导"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置向导</TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}