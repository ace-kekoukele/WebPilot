// src/components/chat/tool-call-card.tsx — 工具调用卡片 (shadcn Card + Badge + Collapsible)
import { useState } from 'react';
import { ChevronDown, Wrench, Check, X, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/cn';

interface ToolCall {
  name: string;
  args?: any;
  result?: { ok: boolean; value?: any; error?: any } | null;
}

interface Props { call: ToolCall; }

export function ToolCallCard({ call }: Props) {
  const [open, setOpen] = useState(false);
  const argsText = JSON.stringify(call.args || {}, null, 2);
  const resultText = call.result
    ? call.result.ok
      ? JSON.stringify(call.result.value, null, 2)
      : String(call.result.error || '')
    : null;

  return (
    <Card className="mt-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40"
        aria-expanded={open}
      >
        <Wrench className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-xs">{call.name}</span>
        {call.result ? (
          <Badge variant={call.result.ok ? 'secondary' : 'destructive'} className="h-4 gap-0.5 px-1.5 text-[10px]">
            {call.result.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            {call.result.ok ? 'OK' : 'ERR'}
          </Badge>
        ) : (
          <Badge variant="outline" className="h-4 gap-0.5 px-1.5 text-[10px]">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            运行中
          </Badge>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">参数</div>
            <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[11px]">{argsText}</pre>
          </div>
          {resultText !== null && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">结果</div>
              <pre className={cn(
                'max-h-40 overflow-auto rounded p-2 font-mono text-[11px]',
                call.result?.ok ? 'bg-success/5' : 'bg-destructive/5',
              )}>{resultText}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ToolCallList({ calls }: { calls: ToolCall[] }) {
  if (!calls || calls.length === 0) return null;
  return (
    <div className="mt-1 space-y-1">
      {calls.map((c, i) => <ToolCallCard key={i} call={c} />)}
    </div>
  );
}