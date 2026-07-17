// src/components/topbar.tsx — 44px 顶栏, backdrop-blur, lucide 图标按钮
// 增强: 健康状态指示器 + 实时统计
import { Sun, Moon, Command, HelpCircle, Wrench, Plug, FileText, Wifi, WifiOff, Activity } from 'lucide-react';
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

export function TopBar({ theme, onToggleTheme, onOpenPalette, onOpenHelp, onOpenRepair, onOpenSettings }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const health = useAppStore((s) => s.health);
  const activity = useAppStore((s) => s.activity);

  const openLogs = async () => {
    try {
      const r = await apiGet('/api/activity?limit=50');
      setLogs(r.events?.map((e: any) =>
        `[${new Date(e.ts).toLocaleTimeString()}] ${e.ok ? '✓' : '✗'} ${e.agent} ${e.tool}`
      ) || []);
    } catch { setLogs([]); }
    setLogOpen(true);
  };

  const recentOk = activity.filter((e: any) => e.ok).length;
  const recentTotal = activity.length;
  const uptime = health?.uptime ? `${Math.floor((health.uptime as number) / 1000)}s` : null;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-12 items-center justify-between border-b border-border/40 bg-background/70 px-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/50">
        {/* 左侧: Logo + 版本 + 状态 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-rose-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">WebPilot</span>
          <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">v4.0.4</span>
          {/* 健康状态指示器 */}
          <div className="flex items-center gap-1.5">
            {health?.cdpConnected ? (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
                <span className="hidden sm:inline">Chrome 已连接</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_currentColor]" />
                <span className="hidden sm:inline">Chrome 未连接</span>
              </span>
            )}
          </div>
          {/* 实时统计 */}
          {recentTotal > 0 && (
            <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span className="font-medium">{recentOk}/{recentTotal}</span>
              {uptime && <span className="text-muted-foreground/50">· {uptime}</span>}
            </div>
          )}
        </div>

        {/* 右侧: 工具按钮 */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={onOpenSettings} aria-label="端口设置">
                <Plug className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>端口 (Ctrl+,)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={onToggleTheme} aria-label="切换主题">
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? '切到亮色' : '切到暗色'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={onOpenPalette} aria-label="命令面板">
                <Command className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>命令面板 (Ctrl+K)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={onOpenHelp} aria-label="帮助">
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>帮助 (F1)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={onOpenRepair} aria-label="一键修复">
                <Wrench className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>一键修复</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg" onClick={openLogs} aria-label="查看日志">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>日志</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* 日志弹窗 */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogOpen(false)}>
          <div className="max-h-[70vh] w-[700px] rounded-lg border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h3 className="text-sm font-medium">最近日志</h3>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setLogOpen(false)}>关闭</Button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-3">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无日志</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((l, i) => <div key={i} className="text-foreground/80">{l}</div>)}
                </div>
              )}
              <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">日志路径: %LOCALAPPDATA%\WebPilot\logs\</p>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
