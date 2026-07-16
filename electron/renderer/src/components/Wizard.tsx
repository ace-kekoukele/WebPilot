// src/components/Wizard.tsx — 首次设置 3 步向导
import { useState, useEffect } from 'react';
import { Sparkles, Check, X, ArrowRight, ArrowLeft, Terminal, Link, Play, Copy, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { apiGet } from '../lib/api';
import { cn } from '../lib/cn';

interface Props { onDone: () => void; }

const STEPS = [
  { num: 1, title: '欢迎', icon: Sparkles },
  { num: 2, title: '启动 Chrome', icon: Play },
  { num: 3, title: '连接 Agent', icon: Link },
];

export function Wizard({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [health, setHealth] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (step === 2) {
      apiGet('/api/health').then(setHealth).catch(() => setHealth(null));
      const timer = setInterval(() => {
        apiGet('/api/health').then(setHealth).catch(() => setHealth(null));
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [step]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1`;

  const mcpConfig = `{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}`;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-xl overflow-hidden border-border/60 bg-card shadow-lg">
        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 border-b border-border/50 px-5 py-4">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => step > s.num && setStep(s.num)}
                disabled={step <= s.num}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  step === s.num && 'bg-primary/10 text-primary',
                  step > s.num && 'cursor-pointer text-muted-foreground hover:bg-accent',
                  step < s.num && 'text-muted-foreground/40',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                  step === s.num && 'bg-primary text-primary-foreground shadow-sm',
                  step > s.num && 'bg-emerald-500/20 text-emerald-500',
                  step < s.num && 'bg-muted text-muted-foreground/40',
                )}>
                  {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'mx-1 h-px w-6 transition-colors',
                  step > s.num + 1 ? 'bg-emerald-500/40' : 'bg-border/50',
                )} />
              )}
            </div>
          ))}
          <div className="ml-auto">
            <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">v4.0.4</Badge>
          </div>
        </div>

        {/* 步骤内容 */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 ring-1 ring-indigo-500/20">
                  <Sparkles className="h-7 w-7 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">欢迎使用 WebPilot</h2>
                  <p className="text-sm text-muted-foreground">AI 驱动的浏览器自动化平台</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Terminal, title: '启动 Chrome（带 debug 端口）', desc: '使用专用快捷方式或命令行启动', color: 'bg-blue-500/10 text-blue-400' },
                  { icon: Link, title: '配置 Agent 连接', desc: '将 AI Agent 指向 MCP 服务端点', color: 'bg-indigo-500/10 text-indigo-400' },
                  { icon: Play, title: '开始自动化', desc: '在聊天模式中让 AI 操作浏览器', color: 'bg-emerald-500/10 text-emerald-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', item.color, 'bg-opacity-10')}>
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Play className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">启动 Chrome 浏览器</h2>
                  <p className="text-sm text-muted-foreground">以远程调试模式启动</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <p className="mb-2 text-sm font-medium">方式一：桌面快捷方式（推荐）</p>
                  <p className="text-xs text-muted-foreground">安装后在桌面找到 <strong className="text-foreground/80">Chrome (WebPilot)</strong> 快捷方式，双击启动</p>
                </div>

                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">方式二：命令行</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => copyText(chromeCmd, 'chrome-cmd')}
                    >
                      {copied === 'chrome-cmd' ? (
                        <><Check className="h-3 w-3" />已复制</>
                      ) : (
                        <><Copy className="h-3 w-3" />复制</>
                      )}
                    </Button>
                  </div>
                  <pre className="overflow-auto rounded-lg border border-border/40 bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{chromeCmd}
                  </pre>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border/50 p-4">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    health?.cdpConnected
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-destructive/10 text-destructive',
                  )}>
                    {health?.cdpConnected ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {health?.cdpConnected ? 'Chrome 已连接' : 'Chrome 未连接'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {health?.cdpConnected ? '可以继续下一步了' : '请先启动 Chrome 浏览器'}
                    </p>
                  </div>
                  {!health?.cdpConnected && (
                    <div className="ml-auto h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
                  <Link className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">连接 AI Agent</h2>
                  <p className="text-sm text-muted-foreground">配置你的 AI 助手来使用 WebPilot</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Claude Desktop 配置</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => copyText(mcpConfig, 'mcp-config')}
                  >
                    {copied === 'mcp-config' ? (
                      <><Check className="h-3 w-3" />已复制</>
                    ) : (
                      <><Copy className="h-3 w-3" />复制</>
                    )}
                  </Button>
                </div>
                <pre className="overflow-auto rounded-lg border border-border/40 bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{mcpConfig}
                </pre>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">
                  其他 Agent（Cursor / Continue / CodeBuddy 等）接入手册请按{' '}
                  <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[11px]">F1</kbd>{' '}
                  查看帮助文档
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <ExternalLink className="h-4 w-4 text-indigo-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium">WebPilot 面板地址</p>
                  <code className="text-xs text-indigo-400">http://127.0.0.1:9224</code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            上一步
          </Button>

          <span className="text-xs text-muted-foreground">{step} / {STEPS.length}</span>

          {step < STEPS.length ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1.5">
              下一步
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={onDone} className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
              <Check className="h-3.5 w-3.5" />
              开始使用
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
