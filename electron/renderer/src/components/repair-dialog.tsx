// src/components/repair-dialog.tsx — 一键修复 (4 阶段, shadcn Dialog + Progress + lucide, 真调 /api/repair)
import { useState } from 'react';
import { Check, X, Loader2, Wrench, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { apiGet } from '../lib/api';
import { pushToast } from './Toast';
import { cn } from '../lib/cn';

interface Props { onClose: () => void; onToast?: (t: any) => void; }

interface PhaseResult {
  id: string;
  label: string;
  ok: boolean;
  msg: string;
  detail?: string;
}

const PHASES: Array<{ id: string; label: string }> = [
  { id: 'health', label: 'daemon 健康检查' },
  { id: 'chrome', label: 'Chrome DevTools 连接' },
  { id: 'ports', label: '端口配置可用性' },
  { id: 'tools', label: '工具注册自检' },
];

export function RepairDialog({ onClose, onToast }: Props) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [results, setResults] = useState<PhaseResult[] | null>(null);
  const [passed, setPassed] = useState(0);
  const [total, setTotal] = useState(PHASES.length);

  const start = async () => {
    setPhase('running');
    setResults(null);

    try {
      const r = await apiGet('/api/repair');
      const phases = (r.phases || []).map((p: any, i: number) => ({
        id: p.id,
        label: PHASES[i]?.label || p.id,
        ok: !!p.ok,
        msg: p.msg,
        detail: p.detail,
      }));
      setResults(phases);
      setPassed(r.passed || 0);
      setTotal(r.total || PHASES.length);
      setPhase('done');
      const ok = r.ok;
      const toast = onToast || pushToast;
      toast({
        kind: ok ? 'success' : 'error',
        title: ok ? `✓ 修复完成 (${r.passed}/${r.total})` : `✗ 诊断未通过 (${r.passed}/${r.total})`,
        description: phases.filter((p: PhaseResult) => !p.ok).map((p: PhaseResult) => p.msg).join(' · ') || '全部通过',
      });
    } catch (e: any) {
      // 整个 /api/repair 失败 (daemon 都没起) — 走 fallback 单段健康检查
      try {
        const h = await apiGet('/api/health');
        const ok = !!h.ok;
        setResults([{
          id: 'health',
          label: 'daemon 健康检查',
          ok,
          msg: ok ? `daemon 跑通 (v${h.version})` : 'daemon 异常',
          detail: `tools=${h.toolCount}`,
        }]);
        setPassed(ok ? 1 : 0);
        setTotal(1);
        setPhase('done');
      } catch (e2: any) {
        setResults([{
          id: 'health',
          label: 'daemon 健康检查',
          ok: false,
          msg: 'daemon 不可达',
          detail: e2.message,
        }]);
        setPassed(0);
        setTotal(1);
        setPhase('done');
      }
      const toast = onToast || pushToast;
      toast({ kind: 'error', title: '✗ 诊断未通过 — daemon 可能没起', description: '右键托盘 → 修复 / 重启' });
    }
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
          <DialogDescription>诊断 + 4 个高频检查. 真有效, 不是转圈.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4 pb-2 text-sm">
          <Progress value={phase === 'idle' ? 0 : (results?.filter((r) => r.ok).length || 0) / (results?.length || PHASES.length) * 100} />

          {results === null && phase !== 'running' && (
            <div className="space-y-2">
              {PHASES.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <div className="h-3.5 w-3.5 rounded-full border border-border" />
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          )}

          {results === null && phase === 'running' && (
            <div className="space-y-2">
              {PHASES.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          )}

          {results !== null && (
            <div className="space-y-2">
              {results.map((p) => (
                <div key={p.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {p.ok ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                    <span className={cn('font-medium', p.ok ? 'text-foreground' : 'text-destructive')}>{p.label}</span>
                  </div>
                  <div className={cn('mt-1 text-[11px]', p.ok ? 'text-muted-foreground' : 'text-destructive/80')}>
                    {p.msg}
                  </div>
                  {p.detail && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{p.detail}</div>}
                </div>
              ))}
            </div>
          )}

          {phase === 'done' && results && (
            <div className={cn(
              'rounded-md border p-3 text-xs',
              passed === total ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            )}>
              {passed === total ? '✓ ' : '✗ '}通过 {passed}/{total} 项
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          {phase === 'idle' && <Button size="sm" onClick={start}>开始修复</Button>}
          {phase === 'running' && <Button size="sm" disabled><Loader2 className="h-3.5 w-3.5 animate-spin" />运行中...</Button>}
          {phase === 'done' && <Button size="sm" onClick={start}><RefreshCw className="h-3.5 w-3.5" />重跑</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}