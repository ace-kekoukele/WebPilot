// src/components/bottom-drawer.tsx — 底部抽屉 (3 micro-tabs, lucide 图标, framer-motion 220ms 弹入)
// 增强: 快捷操作 + 历史条目点击跳转
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Activity, Network, Terminal, Wrench, Settings, RefreshCw, Zap } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './ui/button';
import { useAppStore } from '../store';
import { apiGet } from '../lib/api';
import { EmptyState } from './empty-state';

interface Props {
  open: boolean;
  onToggle: () => void;
  onOpenRepair: () => void;
  onOpenSettings?: () => void;
}

type Tab = 'activity' | 'network' | 'console';

export function BottomDrawer({ open, onToggle, onOpenRepair, onOpenSettings }: Props) {
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
          <DrawerTab current={tab} value="activity" icon={Activity} label="事件" badge={activity.length} onClick={(v) => { setTab(v); loadItems(v); }} />
          <DrawerTab current={tab} value="network" icon={Network} label="网络" badge={items.length} onClick={(v) => { setTab(v); loadItems(v); }} />
          <DrawerTab current={tab} value="console" icon={Terminal} label="Console" badge={0} onClick={(v) => { setTab(v); loadItems(v); }} />
        </div>
        <div className="flex items-center gap-1">
          {/* 快捷操作 */}
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="设置">
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onOpenRepair} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="修复">
            <Wrench className="h-3.5 w-3.5" />
          </button>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 gap-1 text-xs text-muted-foreground">
            {open ? '折叠' : '最近'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </Button>
        </div>
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
  badge?: number;
  onClick: (v: Tab) => void;
}
function DrawerTab({ current, value, icon: Icon, label, badge, onClick }: DrawerTabProps) {
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
      {badge !== undefined && badge > 0 && (
        <span className="ml-0.5 rounded bg-muted px-1 py-0.5 text-[9px] font-medium">{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}

function DrawerContent({ tab, activity, items }: { tab: Tab; activity: any[]; items: any[] }) {
  if (tab === 'activity') {
    if (activity.length === 0) return <EmptyState icon={Activity} title="暂无事件" description="Agent 调用工具后会出现在这里" className="h-[240px]" />;
    return (
      <div className="space-y-0.5">
        {activity.slice(-30).reverse().map((e, i) => (
          <button
            key={i}
            onClick={() => navigator.clipboard.writeText(`${e.agent}/${e.tool} ${JSON.stringify(e.args || {})}`).catch(() => {})}
            className="flex w-full items-center gap-2 text-left text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <span className={e.ok ? 'text-success' : 'text-destructive'}>{e.ok ? '✓' : '✗'}</span>
            <span className="text-foreground/70">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className="font-medium text-foreground">{e.agent}/{e.tool}</span>
            <span className="ml-auto text-muted-foreground">{e.durationMs}ms</span>
          </button>
        ))}
      </div>
    );
  }
  if (tab === 'network') {
    if (items.length === 0) return <EmptyState icon={Network} title="无网络事件" description="页面发起请求后会出现在这里" className="h-[240px]" />;
    return (
      <div className="space-y-0.5">
        {items.slice(-30).reverse().map((e, i) => (
          <button
            key={i}
            onClick={() => navigator.clipboard.writeText(e.url || '').catch(() => {})}
            className="flex w-full items-center gap-2 text-left text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <span className="rounded bg-blue-500/10 px-1 py-0.5 font-mono text-[10px] text-blue-500">{e.method || '?'}</span>
            <span className="truncate flex-1">{e.url}</span>
            <span className={e.status >= 400 ? 'text-destructive' : 'text-success'}>{e.status || '?'}</span>
          </button>
        ))}
      </div>
    );
  }
  return <EmptyState icon={Terminal} title="无 console 事件" description="daemon 暂未抓 console, v4.1 加" className="h-[240px]" />;
}