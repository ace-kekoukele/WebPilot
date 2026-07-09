// src/components/error-boundary.tsx — React ErrorBoundary (mac 级错误卡 + 复制 + 重启 + 上报)
import React from 'react';
import { AlertTriangle, Copy, RotateCw, Bug } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onRestart?: () => void;
}

interface State {
  error: Error | null;
  stack: string;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: '', copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, stack: error.stack || String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 上报到 daemon (best-effort, 不阻塞)
    try {
      fetch('/api/client/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          ts: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // 控台也打一份
    console.error('[ErrorBoundary] caught:', error, info);
  }

  restart = () => {
    if (this.props.onRestart) {
      this.props.onRestart();
    } else {
      window.location.reload();
    }
  };

  copy = async () => {
    const { error, stack } = this.state;
    const text = `WebPilot crashed\n\n${error?.message}\n\n${stack}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1500);
    } catch {}
  };

  render() {
    const { error, stack, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-lg rounded-lg border border-destructive/30 bg-card shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <div className="rounded-md bg-destructive/10 p-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">WebPilot 遇到问题</div>
              <div className="text-xs text-muted-foreground">组件渲染错误 — 重启后通常可恢复</div>
            </div>
            <Bug className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="space-y-3 px-5 py-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">错误</div>
              <div className="mt-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{error.message}</div>
            </div>

            <details className="rounded-md bg-muted">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Stack trace</summary>
              <pre className="max-h-48 overflow-auto px-3 pb-2 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
{stack}
              </pre>
            </details>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              onClick={this.copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? '已复制' : '复制错误'}
            </button>
            <button
              onClick={this.restart}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <RotateCw className="h-3.5 w-3.5" />
              重启 WebPilot
            </button>
          </div>
        </div>
      </div>
    );
  }
}