// src/components/bottom-drawer.tsx — 底部抽屉 (3 micro-tabs, lucide 图标, framer-motion 220ms 弹入)
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Activity, Network, Terminal } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './ui/button';
import { useAppStore } from '../store';
import { apiGet } from '../lib/api';
import { EmptyState } from './empty-state';

interface Props {
  open: boolean;
  onToggle: () => void;
  onOpenRepair: () => void;
}

type Tab = 'activity' | 'network' | 'console';

export function BottomDrawer({ open, onToggle }: Props) {
  const [tab, setTab] = useState<Tab>('activity');
  const [items, setItems] = useState<any[]>([]);
  const activity = useAppStore((s) => s.activity);

  // activity: 从 store 读
  // network: 拉 /api/network/list
  // console: 暂时空
  const loadItems = (t: Tab) => {
    if (t === 'network') {
      apiGet('/api/network/list?limit=50').then((r) => setItems(r.events || [])).catch(() => setItems([]));
    } else if (t === 'console') {
      setItems([]);
    }
  };

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="flex h-9 items-center justify-between px-3">
        <div className="flex h-full items-center gap-0.5">
          <DrawerTab current={tab} value="activity" icon={Activity} label="事件" onClick={(v) => { setTab(v); loadItems(v); }} />
          <DrawerTab current={tab} value="network" icon={Network} label="网络" onClick={(v) => { setTab(v); loadItems(v); }} />
          <DrawerTab current={tab} value="console" icon={Terminal} label="Console" onClick={(v) => { setTab(v); loadItems(v); }} />
        </div>
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 gap-1 text-xs text-muted-foreground">
          {open ? '折叠' : '最近事件'}
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 280, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="h-full overflow-y-auto border-t border-border bg-background/40 px-3 py-2 font-mono text-[11px]">
              <DrawerContent tab={tab} activity={activity} items={items} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}

interface DrawerTabProps {
  current: Tab;
  value: Tab;
  icon: typeof Activity;
  label: string;
  onClick: (v: Tab) => void;
}
function DrawerTab({ current, value, icon: Icon, label, onClick }: DrawerTabProps) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        'inline-flex h-full items-center gap-1.5 border-b-2 border-transparent px-2.5 text-xs transition-colors',
        active ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function DrawerContent({ tab, activity, items }: { tab: Tab; activity: any[]; items: any[] }) {
  if (tab === 'activity') {
    if (activity.length === 0) return <EmptyState icon={Activity} title="暂无事件" description="Agent 调用工具后会出现在这里" className="h-[240px]" />;
    return (
      <div className="space-y-0.5">
        {activity.slice(-30).reverse().map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-muted-foreground">
            <span className={e.ok ? 'text-success' : 'text-destructive'}>{e.ok ? '✓' : '✗'}</span>
            <span className="text-foreground/70">{new Date(e.ts).toLocaleTimeString()}</span>
            <span>{e.agent}/{e.tool}</span>
            <span className="ml-auto text-muted-foreground">{e.durationMs}ms</span>
          </div>
        ))}
      </div>
    );
  }
  if (tab === 'network') {
    if (items.length === 0) return <EmptyState icon={Network} title="无网络事件" description="页面发起请求后会出现在这里" className="h-[240px]" />;
    return (
      <div className="space-y-0.5">
        {items.slice(-30).reverse().map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-8 text-foreground/70">{e.status || '·'}</span>
            <b className="text-foreground/80">{e.method}</b>
            <span className="truncate">{String(e.url || '').slice(0, 100)}</span>
          </div>
        ))}
      </div>
    );
  }
  return <EmptyState icon={Terminal} title="无 console 事件" description="daemon 暂未抓 console, v4.1 加" className="h-[240px]" />;
}