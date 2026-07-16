// src/hooks/use-chat-sse.ts
// 原 ChatPanel.tsx 内的 SSE 流式响应解析逻辑 — 字符级复制，仅迁移位置。
// plan P5 标记："最风险的部分，不动"。保持原文 decoder + buffer + 1-N tool-call 处理。
import { useCallback } from 'react';
import { store, getState } from '../store';

interface UseChatSseOpts {
  sessionId: string | null;
  onError: (msg: string) => void;
}

/**
 * 发送 user message → 触发 SSE → 实时把 chunk / tool_call / tool_result / error 写回 store。
 */
export function useChatSse({ sessionId, onError }: UseChatSseOpts) {
  const send = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;

    store.pushMessage(sessionId, { role: 'user', content: trimmed, ts: Date.now() });

    // 从 store 拿当前历史 (pushMessage 之后才能拿到刚 push 的 user msg)
    const sess = getState().chatSession.find((s) => s.id === sessionId);
    const allMsgs = sess?.messages ?? [];

    store.pushMessage(sessionId, { role: 'assistant', content: '', toolCalls: [], ts: Date.now() });

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: allMsgs }),
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
                store.updateLastMessage(sessionId, (m: any) => m.role === 'assistant' ? { ...m, content: text } : m);
              } else if (e.type === 'tool_call') {
                toolCalls.push({ name: e.toolCall.name, args: e.toolCall.args, result: null });
                store.updateLastMessage(sessionId, (m: any) => m.role === 'assistant' ? { ...m, toolCalls: [...(m.toolCalls || [])] } : m);
              } else if (e.type === 'tool_result') {
                const tc = toolCalls.find((t) => t.name === e.name && !t.result);
                if (tc) tc.result = e.result;
                store.updateLastMessage(sessionId, (m: any) => m.role === 'assistant' ? { ...m, toolCalls: [...toolCalls] } : m);
              } else if (e.type === 'error') {
                store.updateLastMessage(sessionId, (m: any) => m.role === 'assistant' ? { ...m, content: '⚠ ' + e.error } : m);
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      store.updateLastMessage(sessionId, (m: any) => m.role === 'assistant' && !m.content ? { ...m, content: '⚠ ' + e.message } : m);
      onError(e.message || String(e));
    }
  }, [sessionId, onError]);

  return { send };
}