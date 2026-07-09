// src/panels/ChatPanel.tsx — AI 助手 (真流式 + 工具调用)
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, store } from '../store';
import { apiGet, apiPost } from '../lib/api';
import { pushToast } from '../components/Toast';

interface Props { onToast: (t: any) => void; }

export function ChatPanel({ onToast }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useAppStore((s) => s.chatSession);
  const currentId = useAppStore((s) => s.currentSessionId);
  const activeProvider = useAppStore((s) => s.llmActive);
  const [providers, setProviders] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session.length === 0) store.newChatSession();
    apiGet('/api/llm/providers').then((r) => {
      setProviders(r.configured || []);
      store.setLLMProviders(r.configured || [], r.active);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  const current = session.find((s) => s.id === currentId);

  const send = async () => {
    const text = input.trim();
    if (!text || !current) return;
    setInput('');
    setBusy(true);
    store.pushMessage(current.id, { role: 'user', content: text, ts: Date.now() });

    if (!activeProvider) {
      store.pushMessage(current.id, { role: 'assistant', content: '⚠ 未配置 LLM API. 在 ⚙ 设置 → 💬 LLM API 添加 key.', ts: Date.now() });
      setBusy(false);
      return;
    }

    // 真流式
    const allMsgs = [...current.messages, { role: 'user', content: text }];
    store.pushMessage(current.id, { role: 'assistant', content: '', toolCalls: [], ts: Date.now() });
    const assIdx = current.messages.length + 1;   // assistant push 后 idx

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
    } finally { setBusy(false); }
  };

  return (
    <section className="mode-panel">
      <div className="chat-container">
        <div className="chat-sidebar">
          <button className="primary-btn full-width" onClick={() => store.newChatSession()}>+ 新会话</button>
          <div className="chat-session-list">
            {session.map((s) => (
              <div key={s.id} className={`chat-session ${s.id === currentId ? 'active' : ''}`} onClick={() => store.setCurrentSession(s.id)}>
                {s.title}
              </div>
            ))}
          </div>
        </div>
        <div className="chat-main">
          <div className="chat-messages">
            {current?.messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>💬</div>
                <div>向 AI 提问，让它控制浏览器</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>例如: "打开 github.com 并截图"</div>
              </div>
            )}
            {current?.messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-msg-avatar">{m.role === 'user' ? '👤' : '🤖'}</div>
                <div className="chat-msg-body">
                  <div className="chat-msg-role">{m.role}</div>
                  <div className="chat-msg-content">{m.content}</div>
                  {m.toolCalls?.map((t: any, j: number) => (
                    <div key={j} className="chat-tool-call">
                      <div className="chat-tool-call-name">🔧 {t.name}</div>
                      <div className="chat-tool-call-args">{JSON.stringify(t.args || {})}</div>
                      {t.result && <div className={`chat-tool-call-result ${t.result.ok ? 'ok' : 'err'}`}>{t.result.ok ? '✓' : '✗'} {JSON.stringify(t.result.value || t.result.error).slice(0, 200)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="输入消息... (Enter 发送 · Shift+Enter 换行 · @ 工具 · / 模板)"
              rows={3}
              disabled={busy}
            />
            <div className="chat-input-toolbar">
              <select value={activeProvider || ''} onChange={(e) => store.setLLMActive(e.target.value || null)}>
                <option value="">{activeProvider ? '当前 LLM' : '未配置 LLM'}</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="primary-btn" onClick={send} disabled={busy}>{busy ? '生成中...' : '发送'}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
