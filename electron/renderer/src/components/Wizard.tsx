// src/components/Wizard.tsx — 首次设置 3 步向导 (shadcn 风格)
import { useState, useEffect } from 'react';
import { Chrome, Plug, PartyPopper, Check, Copy, ExternalLink, ArrowRight, ArrowLeft, Terminal } from 'lucide-react';
import { useAppStore } from '../store';
import { apiGet } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/cn';

interface Props { onDone: () => void; }

const STEPS = [
  { id: 1, label: '启动 Chrome', icon: Chrome },
  { id: 2, label: '连接 Agent', icon: Plug },
  { id: 3, label: '完成', icon: PartyPopper },
];

export function Wizard({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [health, setHealth] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step === 2) {
      apiGet('/api/health').then(setHealth).catch(() => setHealth(null));
      const timer = setInterval(() => {
        apiGet('/api/health').then(setHealth).catch(() => {});
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [step]);

  const cdpOk = !!health?.cdpConnected;

  const copyCmd = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">欢迎使用 WebPilot</CardTitle>
          <CardDescription>三步完成初始设置，开始用 AI 操控浏览器</CardDescription>
          {/* 步骤指示器 */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    active && 'bg-primary text-primary-foreground',
                    done && 'bg-primary/10 text-primary',
                    !active && !done && 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('h-px w-6', done ? 'bg-primary/30' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="min-h-[260px]">
          {/* Step 1: 启动 Chrome */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">启动带调试端口的 Chrome</h3>
              <p className="text-xs text-muted-foreground">
                WebPilot 需要通过 Chrome DevTools Protocol 控制浏览器。
                推荐复制下面命令在 PowerShell 中运行：
              </p>
              <div className="group relative">
                <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                  <code>chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2 h-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => copyCmd('chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1')}
                >
                  {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <Terminal className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  提示：也可以直接双击桌面 <strong>Chrome (WebPilot)</strong> 快捷方式启动
                </span>
              </div>
            </div>
          )}

          {/* Step 2: 连接 Agent */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">让 AI Agent 连接 WebPilot</h3>
                <Badge variant={cdpOk ? 'default' : 'secondary'} className="text-[10px]">
                  {cdpOk ? '✓ Chrome 已连接' : health ? '✗ Chrome 未连接' : '检查中...'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                在 Claude Desktop / Cursor / Continue 等 Agent 的 MCP 配置中添加：
              </p>
              <div className="group relative">
                <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
{`{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}`}
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2 h-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => copyCmd('{"mcpServers":{"webpilot":{"url":"http://127.0.0.1:9223/mcp"}}}')}
                >
                  {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5">
                <ExternalLink className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  配置后重启 Agent 即可使用。按 <kbd className="rounded border px-1 text-[10px]">F1</kbd> 查看更多接入方式
                </span>
              </div>
            </div>
          )}

          {/* Step 3: 完成 */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <PartyPopper className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">设置完成!</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chrome 已连接，Agent 已就绪 — 现在你可以让 AI 帮你操控浏览器了
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <span className="text-[10px] font-medium">浏览器模式</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">直接输入 URL 导航，截图，查看 DOM 和 Cookies</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <span className="text-[10px] font-medium">AI 助手</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">用自然语言让 AI 操控浏览器完成复杂任务</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <span className="text-[10px] font-medium">自动化</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">执行 Agent 编排的浏览器自动化流程</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-2.5">
                  <span className="text-[10px] font-medium">快捷键</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Ctrl+1~4 切换模式 · Ctrl+K 命令面板</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />上一步
              </Button>
            )}
          </div>
          {step < 3 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              下一步<ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={onDone}>
              <Check className="mr-1 h-3.5 w-3.5" />开始使用
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
