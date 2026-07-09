// src/panels/ChatPanel.tsx — AI 助手 (Mac 级: shadcn + markdown + 流式光标 + tool-call card)
// SSE 解析器保留原逻辑(plan P5 明确"不动 — 最风险的部分")
import { useState, useEffect } from 'react';
import { Plus, Send, AlertTriangle, Sparkles } from 'lucide-react';
import { useAppStore, store } from '../store';
import { apiGet } from '../lib/api';
import { Button } from '../components/ui/button';
import { cn } from '../lib/cn';
import { useAutoScroll } from '../lib/use-auto-scroll';
import { MessageBubble } from '../components/chat/message-bubble';
import { TypingIndicator } from '../components/chat/typing-indicator';
import { EmptyState } from '../components/empty-state';

interface Props { onToast: (t: any) => void; }

export function ChatPanel({ onToast }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useAppStore((s) => s.chatSession);
  const currentId = useAppStore((s) => s.currentSessionId);
  const activeProvider = useAppStore((s) => s.llmActive);
  const [providers, setProviders] = useState<any[]>([]);
  const messagesRef = useAutoScroll<HTMLDivElement>([session, busy]);

  useEffect(() => {
    if (session.length === 0) store.newChatSession();
    apiGet('/api/llm/providers').then((r) => {
      setProviders(r.configured || []);
      store.setLLMProviders(r.configured || [], r.active);
    }).catch(() => {});
  }, []);

  const current = session.find((s) => s.id === currentId);
  const messages = current?.messages ?? [];
  const last = messages[messages.length - 1];

  const send = async () => {
    const text = input.trim();
    if (!text || !current) return;
    setInput('');
    setBusy(true);
    store.pushMessage(current.id, { role: 'user', content: text, ts: Date.now() });

    if (!activeProvider) {
      store.pushMessage(current.id, { role: 'system', content: '未配置 LLM API. 在 设置 → LLM API 添加 key.', ts: Date.now() });
      setBusy(false);
      onToast({ kind: 'warn', title: '未配置 LLM', description: '请到 设置 → LLM API 配置 key' });
      return;
    }

    // 原 SSE 解析逻辑 (P5 plan 明确"不动")
    const allMsgs = [...current.messages, { role: 'user', content: text }];
    store.pushMessage(current.id, { role: 'assistant', content: '', toolCalls: [], ts: Date.now() });

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: current.id, messages: allMsgs }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      const toolCalls: any[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
          for (const ln of block.split('\n')) {
            if (!ln.startsWith('data:')) continue;
            try {
              const e = JSON.parse(ln.slice(5).trim());
              if (e.type === 'content') {
                text += e.delta;
                store.updateLastMessage(current.id, (m: any) => m.role === 'assistant' ? { ...m, content: text } : m);
              } else if (e.type === 'tool_call') {
                toolCalls.push({ name: e.toolCall.name, args: e.toolCall.args, result: null });
                store.updateLastMessage(current.id, (m: any) => m.role === 'assistant' ? { ...m, toolCalls: [...(m.toolCalls || [])] } : m);
              } else if (e.type === 'tool_result') {
                const tc = toolCalls.find((t) => t.name === e.name && !t.result);
                if (tc) tc.result = e.result;
                store.updateLastMessage(current.id, (m: any) => m.role === 'assistant' ? { ...m, toolCalls: [...toolCalls] } : m);
              } else if (e.type === 'error') {
                store.updateLastMessage(current.id, (m: any) => m.role === 'assistant' ? { ...m, content: '⚠ ' + e.error } : m);
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      store.updateLastMessage(current.id, (m: any) => m.role === 'assistant' && !m.content ? { ...m, content: '⚠ ' + e.message } : m);
      onToast({ kind: 'error', title: '请求失败', description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <section className="mode-panel flex h-full">
      <div className="flex w-full">
        {/* 会话侧栏 */}
        <div className="flex w-56 flex-col gap-2 border-r border-border p-2">
          <Button size="sm" onClick={() => store.newChatSession()} className="w-full justify-start gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            新会话
          </Button>
          <div className="flex flex-col gap-0.5">
            {session.map((s) => (
              <button
                key={s.id}
                onClick={() => store.setCurrentSession(s.id)}
                className={cn(
                  'flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                  s.id === currentId ? 'bg-accent text-foreground' : 'text-muted-foreground'
                )}
              >
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 主区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="向 AI 提问"
                description="让 AI 助手帮你操作浏览器 · 例如「打开 github.com 并截图」"
                className="h-full"
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-1">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const isStreamingAssistant = isLast && busy && m.role === 'assistant';
                  return (
                    <MessageBubble
                      key={i}
                      role={m.role}
                      content={m.content}
                      toolCalls={m.toolCalls}
                      streaming={isStreamingAssistant}
                    />
                  );
                })}
                {busy && (!last || last.role !== 'assistant' || (!last.content && !last.toolCalls?.length)) && (
                  <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                    <TypingIndicator />
                    <span>AI 思考中...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-border p-3">
            <div className="mx-auto max-w-3xl space-y-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="输入消息... (Enter 发送 · Shift+Enter 换行 · @ 工具 · / 模板)"
                rows={3}
                disabled={busy}
                className={cn(
                  'flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                  'text-foreground placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              />
              <div className="flex items-center gap-2">
                <select
                  value={activeProvider || ''}
                  onChange={(e) => store.setLLMActive(e.target.value || null)}
                  className={cn(
                    'h-8 rounded-md border border-input bg-transparent px-2 text-xs',
                    'text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <option value="">{activeProvider ? '当前 LLM' : '未配置 LLM'}</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="ml-auto flex items-center gap-2">
                  {!activeProvider && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      未配置 LLM
                    </span>
                  )}
                  <Button size="sm" onClick={send} disabled={busy || !input.trim()} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    {busy ? '生成中...' : '发送'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}