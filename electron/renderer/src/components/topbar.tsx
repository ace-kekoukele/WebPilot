// src/components/topbar.tsx — Refined TopBar
// 44px, clean layout, status indicators, quick actions
import { Sun, Moon, Command, HelpCircle, Wrench, FileText, Wifi, WifiOff, Activity, Box, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useState } from 'react';
import { apiGet } from '../lib/api';
import { useAppStore } from '../store';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onOpenRepair: () => void;
  onOpenSettings: () => void;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TopBar({ theme, onToggleTheme, onOpenPalette, onOpenHelp, onOpenRepair, onOpenSettings }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const health = useAppStore(s => s.health);
  const activity = useAppStore(s => s.activity);

  const openLogs = async () => {
    try {
      const r = await apiGet('/api/activity?limit=50');
      setLogs(
        r.events?.map(
          (e: any) => `[${new Date(e.ts).toLocaleTimeString()}] ${e.ok ? '✓' : '✗'} ${e.agent || '-'} ${e.tool}`
        ) || []
      );
    } catch {
      setLogs([]);
    }
    setLogOpen(true);
  };

  const cdpOk = health?.cdpConnected;
  const toolCount = health?.toolCount ?? 0;
  const uptime = health?.uptime ? formatUptime(health.uptime as number) : null;
  const recentOk = activity.filter((e: any) => e.ok).length;
  const recentTotal = activity.length;

  return (
    <TooltipProvider delayDuration={400}>
      <header className="topbar">
        {/* Left: Brand */}
        <div className="topbar-brand">
          <div className="topbar-logo">W</div>
          <span className="topbar-title">WebPilot</span>
          <span className="topbar-version">v4.0.4</span>
        </div>

        <div className="topbar-divider" />

        {/* Status indicators */}
        <div className="flex items-center gap-1">
          <span className={`topbar-stat ${cdpOk ? '' : 'opacity-60'}`}>
            <span className={`topbar-stat-dot ${cdpOk ? 'bg-success' : 'bg-muted-foreground'}`} />
            {cdpOk ? 'Chrome 已连接' : 'Chrome 未连接'}
          </span>

          {toolCount > 0 && (
            <span className="topbar-stat">
              <Box className="h-3 w-3" />
              {toolCount} 工具
            </span>
          )}

          {uptime && (
            <span className="topbar-stat opacity-70">
              <Activity className="h-3 w-3" />
              {uptime}
            </span>
          )}

          {recentTotal > 0 && (
            <span className="topbar-stat opacity-70">
              <span className="text-success">{recentOk}</span>
              <span className="opacity-50">/</span>
              <span>{recentTotal}</span>
            </span>
          )}
        </div>

        <div className="topbar-spacer" />

        {/* Right: Actions */}
        <div className="topbar-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenSettings}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>设置 (Ctrl+,)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleTheme}>
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? '亮色模式' : '暗色模式'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenPalette}>
                <Command className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>命令面板 (Ctrl+K)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenHelp}>
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>帮助 (F1)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenRepair}>
                <Wrench className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>一键修复</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openLogs}>
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看日志</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Log viewer modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogOpen(false)}>
          <div
            className="max-h-[70vh] w-[680px] rounded-xl border border-border bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-semibold">最近日志</h3>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setLogOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-3">
              {logs.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">暂无日志</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((l, i) => (
                    <div key={i} className="text-foreground/80">
                      {l}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                日志路径: %LOCALAPPDATA%\WebPilot\logs\
              </p>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
