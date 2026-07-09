// src/components/topbar.tsx — 44px 顶栏, backdrop-blur, lucide 图标按钮
import { Sun, Moon, Command, HelpCircle, Wrench, Plug, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useState } from 'react';
import { apiGet } from '../lib/api';

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

  const openLogs = async () => {
    try {
      const r = await apiGet('/api/activity?limit=50');
      setLogs(r.events?.map((e: any) =>
        `[${new Date(e.ts).toLocaleTimeString()}] ${e.ok ? '✓' : '✗'} ${e.agent} ${e.tool}`
      ) || []);
    } catch { setLogs([]); }
    setLogOpen(true);
  };
  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-11 items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">WebPilot</span>
          <span className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">v4.0.4</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenSettings} aria-label="端口设置">
                <Plug className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>端口 (Ctrl+,)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleTheme} aria-label="切换主题">
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? '切到亮色' : '切到暗色'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenPalette} aria-label="命令面板">
                <Command className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>命令面板 (Ctrl+K)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenHelp} aria-label="帮助">
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>帮助 (F1)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenRepair} aria-label="一键修复">
                <Wrench className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>一键修复</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openLogs} aria-label="查看日志">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>日志</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* B2-23: 日志弹窗 */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogOpen(false)}>
          <div className="max-h-[70vh] w-[700px] rounded-lg border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h3 className="text-sm font-medium">最近日志</h3>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setLogOpen(false)}>关闭</Button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-3">
              <p className="text-xs text-muted-foreground">日志路径: %LOCALAPPDATA%\WebPilot\logs\</p>
              <p className="mt-1 text-xs text-muted-foreground">完整日志请用文件管理器打开上述路径</p>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}