// src/panels/ChatPanel.tsx — Refined Chat Panel
// Session sidebar + message list + input area with welcome hints
import { useEffect, useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useAppStore, store } from '../store';
import { apiGet } from '../lib/api';
import { useAutoScroll } from '../lib/use-auto-scroll';
import { useChatSse } from '../hooks/use-chat-sse';
import { MessageBubble } from '../components/chat/message-bubble';
import { TypingIndicator } from '../components/chat/typing-indicator';
import { EmptyState } from '../components/empty-state';
import { SessionSidebar } from '../components/chat/session-sidebar';
import { ChatInput } from '../components/chat/chat-input';

interface Props {
  onToast: (t: any) => void;
}

const WELCOME_HINTS = [
  '打开 github.com 并截图',
  '帮我分析这个网页的结构',
  '抓取页面中的表格数据',
  '登录网站并导出 Cookie',
];

export function ChatPanel({ onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [quoteContent, setQuoteContent] = useState<string | null>(null);

  const sessions = useAppStore(s => s.chatSession);
  const currentId = useAppStore(s => s.currentSessionId);
  const activeProvider = useAppStore(s => s.llmActive);
  const draft = useAppStore(s => s.chatDraftPrompt);

  const { send: sendSse } = useChatSse({
    sessionId: currentId,
    onError: msg => onToast({ kind: 'error', title: '请求失败', description: msg }),
  });

  useEffect(() => {
    if (sessions.length === 0) store.newChatSession();
    Promise.all([
      apiGet('/api/tools/list').then(r => setTools(r.tools || [])).catch(() => {}),
      apiGet('/api/llm/providers').then(r => {
        setProviders(r.configured || []);
        store.setLLMProviders(r.configured || [], r.active);
      }).catch(() => {}),
    ]);
  }, []);

  // Consume draft prompt from template
  useEffect(() => {
    if (draft) store.setChatDraftPrompt(null);
  }, [draft]);

  const handleQuote = (content: string) => setQuoteContent(content.slice(0, 200));
  const clearQuote = () => setQuoteContent(null);

  const current = useMemo(() => sessions.find(s => s.id === currentId), [sessions, currentId]);
  const messages = current?.messages ?? [];
  const last = messages[messages.length - 1];

  const handleSend = async (text: string) => {
    if (!text || !current) return;
    if (!activeProvider) {
      store.pushMessage(current.id, {
        role: 'system',
        content: '未配置 LLM API。请到 设置 → LLM API 添加 key。',
        ts: Date.now(),
      });
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

  const messagesRef = useAutoScroll<HTMLDivElement>([sessions, busy]);

  return (
    <section className="chat-container">
      <SessionSidebar
        sessions={sessions}
        currentId={currentId}
        onNew={() => store.newChatSession()}
        onSelect={id => store.setCurrentSession(id)}
        onDelete={id => store.deleteSession(id)}
        onRename={(id, title) => store.renameSession(id, title)}
      />

      {/* Main chat area */}
      <div className="chat-main">
        <div ref={messagesRef} className="chat-messages">
          <div className="chat-messages-inner">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="chat-welcome-title">AI 浏览器助手</div>
                <div className="chat-welcome-desc">
                  让 AI 帮你操控浏览器。输入自然语言指令，AI 会自动选择工具完成任务。
                </div>
                <div className="chat-welcome-hints">
                  {WELCOME_HINTS.map(hint => (
                    <button
                      key={hint}
                      className="chat-welcome-hint"
                      onClick={() => {
                        const input = document.querySelector('.chat-input-textarea') as HTMLTextAreaElement;
                        if (input) {
                          input.value = hint;
                          input.focus();
                        }
                      }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const isStreaming = isLast && busy && m.role === 'assistant';
                  return (
                    <MessageBubble
                      key={i}
                      role={m.role}
                      content={m.content}
                      toolCalls={m.toolCalls}
                      streaming={isStreaming}
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
        </div>

        <ChatInput
          tools={tools}
          busy={busy}
          hasActiveProvider={!!activeProvider}
          providers={providers}
          activeProvider={activeProvider}
          onProviderChange={id => store.setLLMActive(id)}
          onSend={handleSend}
          quoteContent={quoteContent}
          onClearQuote={clearQuote}
          initialDraft={draft}
        />
      </div>
    </section>
  );
}
