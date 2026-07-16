// src/components/sidebar.tsx — Refined sidebar navigation
// 56px, pill indicator, tooltip with keyboard shortcut
import { Globe, MessageSquare, Workflow, Activity, Sparkles, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface NavItem {
  mode: 'browser' | 'chat' | 'automation' | 'monitor';
  icon: LucideIcon;
  label: string;
  shortcut: string;
  desc: string;
}

const ITEMS: NavItem[] = [
  { mode: 'browser', icon: Globe, label: '浏览器', shortcut: 'Ctrl+1', desc: '操控 Chrome 浏览器' },
  { mode: 'chat', icon: MessageSquare, label: '对话', shortcut: 'Ctrl+2', desc: 'AI 对话与工具调用' },
  { mode: 'automation', icon: Workflow, label: '自动化', shortcut: 'Ctrl+3', desc: '工作流 / 录制 / 模板' },
  { mode: 'monitor', icon: Activity, label: '监控', shortcut: 'Ctrl+4', desc: '日志 / 网络 / Console' },
];

interface Props {
  mode: 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';
  onChange: (m: any) => void;
}

export function Sidebar({ mode, onChange }: Props) {
  return (
    <TooltipProvider delayDuration={400}>
      <aside className="sidebar">
        {ITEMS.map(it => {
          const Icon = it.icon;
          const active = mode === it.mode;
          return (
            <Tooltip key={it.mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChange(it.mode)}
                  className={cn(
                    'nav-item',
                    active && 'active'
                  )}
                  aria-label={it.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      className="absolute inset-1 rounded-md bg-primary"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
                    />
                  )}
                  <Icon className="nav-icon relative z-10" strokeWidth={1.75} />
                  <span className="nav-label relative z-10">{it.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[180px]">
                <div className="text-xs">
                  <div className="font-semibold">{it.label}</div>
                  <div className="text-muted-foreground">{it.desc}</div>
                  <kbd className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {it.shortcut}
                  </kbd>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="sidebar-spacer" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange('wizard')}
              className={cn(
                'nav-item',
                mode === 'wizard' && 'active'
              )}
              aria-label="设置向导"
            >
              <Sparkles className="nav-icon relative z-10" strokeWidth={1.75} />
              <span className="nav-label relative z-10">向导</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">首次设置向导</TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
