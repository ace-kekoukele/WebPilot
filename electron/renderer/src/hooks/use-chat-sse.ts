// src/hooks/use-chat-sse.ts
// SSE 流式响应解析 — 字符级 decoder + buffer + 1-N tool-call 处理
import { useCallback, useRef } from 'react';
import { store, getState } from '../store';

interface UseChatSseOpts {
  sessionId: string | null;
  onError: (msg: string) => void;
}

/**
 * 发送 user message → 触发 SSE → 实时把 chunk / tool_call / tool_result / error 写回 store。
 */
export function useChatSse({ sessionId, onError }: UseChatSseOpts) {
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;

    // 取消上一次请求
    cancel();

    store.pushMessage(sessionId, { role: 'user', content: trimmed, ts: Date.now() });

    const sess = getState().chatSession.find((s) => s.id === sessionId);
    const allMsgs = sess?.messages ?? [];

    store.pushMessage(sessionId, { role: 'assistant', content: '', toolCalls: [], ts: Date.now() });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: allMsgs }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 200) : ''}`);
      }

      if (!res.body) throw new Error('响应体为空');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      const toolCalls: any[] = [];

      const syncToolCalls = () => {
        store.updateLastMessage(sessionId, (m: any) =>
          m.role === 'assistant' ? { ...m, toolCalls: toolCalls.map(tc => ({ ...tc })) } : m,
        );
      };

      const flushBuffer = () => {
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const ln of block.split('\n')) {
            if (!ln.startsWith('data:')) continue;
            const jsonStr = ln.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const e = JSON.parse(jsonStr);
              switch (e.type) {
                case 'content':
                  text += e.delta;
                  store.updateLastMessage(sessionId, (m: any) =>
                    m.role === 'assistant' ? { ...m, content: text } : m,
                  );
                  break;
                case 'tool_call':
                  toolCalls.push({ name: e.toolCall?.name ?? 'unknown', args: e.toolCall?.args ?? {}, result: null });
                  syncToolCalls();
                  break;
                case 'tool_result':
                  const tc = toolCalls.find((t) => t.name === e.name && !t.result);
                  if (tc) {
                    tc.result = e.result;
                    syncToolCalls();
                  }
                  break;
                case 'error':
                  store.updateLastMessage(sessionId, (m: any) =>
                    m.role === 'assistant'
                      ? { ...m, content: m.content ? m.content + '\n\n⚠️ ' + e.error : '⚠️ ' + e.error }
                      : m,
                  );
                  break;
                case 'done':
                  // 流结束标记
                  break;
              }
            } catch {
              // 忽略单行解析错误
            }
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
      }

      // 处理残留 buffer
      buffer += decoder.decode();
      flushBuffer();

    } catch (e: any) {
      if (e.name === 'AbortError') return; // 用户取消，不报错

      const errMsg = e.message || String(e);
      store.updateLastMessage(sessionId, (m: any) =>
        m.role === 'assistant' && !m.content
          ? { ...m, content: '⚠️ 请求失败: ' + errMsg }
          : m,
      );
      onError(errMsg);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [sessionId, onError, cancel]);

  return { send, cancel };
}
