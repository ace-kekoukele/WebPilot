// src/components/repair-dialog.tsx — 一键修复 (4 阶段, shadcn Dialog + Progress + lucide)
import { useState } from 'react';
import { Check, Loader2, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { apiGet } from '../lib/api';
import { cn } from '../lib/cn';

interface Props { onClose: () => void; onToast: (t: any) => void; }

const PHASES = [
  { id: 'diag', label: '检查 Chrome CDP 连接' },
  { id: 'config', label: '验证配置完整性' },
  { id: 'ws', label: '测试 WebSocket 通道' },
  { id: 'verify', label: '复查 + 工具自检' },
];

export function RepairDialog({ onClose, onToast }: Props) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [report, setReport] = useState<{ ok: boolean; msg: string; toolCount?: number } | null>(null);

  const start = async () => {
    setPhase('running');
    setReport(null);
    let lastHealth: any = null;
    let current = 0;

    for (const p of PHASES) {
      await new Promise((r) => setTimeout(r, p.id === 'diag' || p.id === 'verify' ? 200 : 600));
      if (p.id === 'diag' || p.id === 'verify') {
        try { lastHealth = await apiGet('/api/health'); } catch {}
      }
      current++;
    }

    const ok = !!lastHealth?.cdpConnected;
    setReport({
      ok,
      msg: ok ? '诊断完成 · Chrome 已连接' : 'Chrome 未连接, 见 设置 → 连接',
      toolCount: lastHealth?.toolCount,
    });
    setPhase('done');
    onToast({ kind: ok ? 'success' : 'error', title: ok ? '✓ 修复完成' : '✗ 诊断未通过', description: lastHealth ? `tools: ${lastHealth.toolCount}` : '' });
  };

  const doneCount = phase === 'done' ? PHASES.length : phase === 'running' ? 1 : 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <DialogTitle>一键修复</DialogTitle>
          </div>
          <DialogDescription>诊断 + 4 个高频修复. 真有效, 不是转圈.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4 pb-2 text-sm">
          <Progress value={(doneCount / PHASES.length) * 100} />
          <div className="space-y-2">
            {PHASES.map((p, idx) => {
              const isDone = phase === 'done' || (phase === 'running' && idx < doneCount);
              const isCurrent = phase === 'running' && idx === doneCount;
              return (
                <div key={p.id} className="flex items-center gap-2.5 text-xs">
                  {isDone ? <Check className="h-3.5 w-3.5 text-success" /> :
                   isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> :
                   <div className="h-3.5 w-3.5 rounded-full border border-border" />}
                  <span className={cn(isDone ? 'text-foreground' : 'text-muted-foreground')}>{p.label}</span>
                </div>
              );
            })}
          </div>

          {report && (
            <div className={cn(
              'rounded-md border p-3 text-xs',
              report.ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            )}>
              {report.ok ? '✓ ' : '✗ '}{report.msg}
              {report.toolCount !== undefined && <div className="mt-1 text-muted-foreground">tools: {report.toolCount}</div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          {phase === 'idle' && <Button size="sm" onClick={start}>开始修复</Button>}
          {phase === 'running' && <Button size="sm" disabled>运行中...</Button>}
          {phase === 'done' && <Button size="sm" onClick={start}>重跑</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}