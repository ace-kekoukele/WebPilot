// src/panels/ChatPanel.tsx — AI 助手 (v4.0.4 拆分版)
// 仅保留 layout + 状态初始化 + 协调 SESSION/SSE/INPUT。
// SSE 解析逻辑已下沉到 hooks/use-chat-sse.ts (P5 不动 — 这里也不动其内部逻辑)。
import { useEffect, useState } from 'react';
import { Sparkles, Globe, Camera, FileText, Code, Search, Lightbulb } from 'lucide-react';
import { useAppStore, store } from '../store';
import { apiGet } from '../lib/api';
import { useAutoScroll } from '../lib/use-auto-scroll';
import { useChatSse } from '../hooks/use-chat-sse';
import { MessageBubble } from '../components/chat/message-bubble';
import { TypingIndicator } from '../components/chat/typing-indicator';
import { EmptyState } from '../components/empty-state';
import { SessionSidebar } from '../components/chat/session-sidebar';
import { ChatInput } from '../components/chat/chat-input';
import { cn } from '../lib/cn';

const EXAMPLE_PROMPTS = [
  { icon: Globe, label: '打开 GitHub 首页并截图', prompt: '请帮我打开 https://github.com 并截一张首页截图' },
  { icon: Search, label: '搜索并提取信息', prompt: '请帮我搜索"React 19 新特性"，并总结前三个搜索结果的关键信息' },
  { icon: FileText, label: '抓取页面数据', prompt: '请打开 https://news.ycombinator.com，抓取首页前10条新闻的标题和链接，整理成表格' },
  { icon: Code, label: '分析页面结构', prompt: '请帮我分析当前页面的 DOM 结构，列出所有主要的交互元素（按钮、输入框、链接）' },
  { icon: Camera, label: '批量截图多个页面', prompt: '请依次打开 github.com、google.com、bilibili.com，各截一张图' },
  { icon: Lightbulb, label: '帮我填表单', prompt: '请帮我在当前页面找到表单，并填入测试数据：姓名=张三、邮箱=test@example.com' },
];

interface Props { onToast: (t: any) => void; }

export function ChatPanel({ onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [quoteContent, setQuoteContent] = useState<string | null>(null);

  const session = useAppStore((s) => s.chatSession);
  const currentId = useAppStore((s) => s.currentSessionId);
  const activeProvider = useAppStore((s) => s.llmActive);

  // SSE hook — 内部维持原解析逻辑, 不再此处展开
  const { send: sendSse } = useChatSse({
    sessionId: currentId,
    onError: (msg) => onToast({ kind: 'error', title: '请求失败', description: msg }),
  });

  useEffect(() => {
    if (session.length === 0) store.newChatSession();
    Promise.all([
      apiGet('/api/tools/list').then((r) => setTools(r.tools || [])).catch(() => {}),
      apiGet('/api/llm/providers').then((r) => {
        setProviders(r.configured || []);
        store.setLLMProviders(r.configured || [], r.active);
      }).catch(() => {}),
    ]);
  }, []);

  // 消费模板跳过来的 draft prompt — 通过 initialDraft prop 注入 ChatInput
  const draft = useAppStore((s) => s.chatDraftPrompt);
  useEffect(() => {
    if (draft) store.setChatDraftPrompt(null);
  }, [draft]);

  const handleQuote = (content: string) => setQuoteContent(content.slice(0, 200));
  const clearQuote = () => setQuoteContent(null);

  const current = session.find((s) => s.id === currentId);
  const messages = current?.messages ?? [];
  const last = messages[messages.length - 1];

  const handleSend = async (text: string) => {
    if (!text || !current) return;
    if (!activeProvider) {
      store.pushMessage(current.id, { role: 'system', content: '未配置 LLM API. 在 设置 → LLM API 添加 key.', ts: Date.now() });
      onToast({ kind: 'warn', title: '未配置 LLM', description: '请到 设置 → LLM API 配置 key' });
      return;
    }
    setBusy(true);
    try {
      await sendSse(text);
    } finally {
      setBusy(false);
    }
  };

  const messagesRef = useAutoScroll<HTMLDivElement>([session, busy]);

  return (
    <section className="mode-panel flex h-full">
      <div className="flex w-full">
        <SessionSidebar
          sessions={session}
          currentId={currentId}
          onNew={() => store.newChatSession()}
          onSelect={(id) => store.setCurrentSession(id)}
        />

        {/* 主区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
                <EmptyState
                  icon={Sparkles}
                  title="向 AI 提问"
                  description="让 AI 助手帮你操作浏览器 · 选一个示例或直接输入"
                  className="border-0"
                />
                <div className="grid w-full max-w-lg grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((ep, i) => {
                    const Icon = ep.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSend(ep.prompt)}
                        disabled={busy || !activeProvider}
                        className={cn(
                          'flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-accent/50',
                          (!activeProvider) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <div>
                          <div className="text-xs font-medium">{ep.label}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{ep.prompt}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                      onQuote={handleQuote}
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

          <ChatInput
            tools={tools}
            busy={busy}
            hasActiveProvider={!!activeProvider}
            providers={providers}
            activeProvider={activeProvider}
            onProviderChange={(id) => store.setLLMActive(id)}
            onSend={handleSend}
            quoteContent={quoteContent}
            onClearQuote={clearQuote}
            initialDraft={draft}
          />
        </div>
      </div>
    </section>
  );
}