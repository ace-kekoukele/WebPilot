// src/store.ts — 全局状态 (React 18 useSyncExternalStore, no zustand)
// 聊天历史持久化到 localStorage
import { useSyncExternalStore } from 'react';

export interface AppState {
  health: { cdpConnected: boolean; toolCount: number; version: string; uptime: number } | null;
  agents: Array<{ id: string; name: string; version: string; color: string; callCount: number; connectedAt: number }>;
  llmProviders: any[];
  llmActive: string | null;
  chatSession: Array<{ id: string; title: string; messages: any[] }>;
  currentSessionId: string | null;
  chatDraftPrompt: string | null;
  activity: any[];
  showWizard: boolean;
}

const HISTORY_KEY = 'webpilot-chat-history';
const SESSION_KEY = 'webpilot-current-session';

function loadHistory(): Array<{ id: string; title: string; messages: any[] }> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHistory(sessions: Array<{ id: string; title: string; messages: any[] }>) {
  try {
    // 只存最近 50 个会话,每个会话最多 200 条消息
    const trimmed = sessions.slice(0, 50).map((s) => ({
      ...s,
      messages: s.messages.slice(-200),
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

function loadCurrentSession(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function saveCurrentSession(id: string | null) {
  try { id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY); } catch {}
}

const initial: AppState = {
  health: null,
  agents: [],
  llmProviders: [],
  llmActive: null,
  chatSession: loadHistory(),
  currentSessionId: loadCurrentSession(),
  chatDraftPrompt: null,
  activity: [],
  showWizard: false,
};

let state: AppState = initial;
const listeners = new Set<() => void>();

export function getState() { return state; }
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const update = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...update };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const store = {
  setHealth: (h: any) => setState({ health: h }),
  setAgents: (a: any[]) => setState({ agents: a }),
  setLLMProviders: (p: any[], active: string | null) => setState({ llmProviders: p, llmActive: active }),
  setLLMActive: (id: string | null) => {
    setState({ llmActive: id });
    // B2-14: 切换后通知 daemon 同步 (POST /api/llm/active)
    if (id) {
      fetch('/api/llm/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', id }),
      }).catch(() => {});
    }
  },
  appendActivity: (a: any[]) => setState((s) => ({ activity: [...s.activity, ...a].slice(-200) })),
  setActivity: (a: any[]) => setState({ activity: a }),
  clearActivity: () => setState({ activity: [] }),
  newChatSession: () => {
    const id = 'sess-' + Date.now();
    setState((s) => {
      const sessions = [{ id, title: `会话 ${s.chatSession.length + 1}`, messages: [] }, ...s.chatSession].slice(0, 50);
      saveHistory(sessions);
      saveCurrentSession(id);
      return { chatSession: sessions, currentSessionId: id };
    });
    return id;
  },
  setCurrentSession: (id: string | null) => {
    setState({ currentSessionId: id });
    saveCurrentSession(id);
  },
  deleteSession: (id: string) => {
    setState((s) => {
      const sessions = s.chatSession.filter((x) => x.id !== id);
      saveHistory(sessions);
      const nextId = s.currentSessionId === id
        ? (sessions.length > 0 ? sessions[0].id : null)
        : s.currentSessionId;
      saveCurrentSession(nextId);
      return { chatSession: sessions, currentSessionId: nextId };
    });
  },
  renameSession: (id: string, title: string) => {
    setState((s) => {
      const sessions = s.chatSession.map((x) =>
        x.id === id ? { ...x, title } : x,
      );
      saveHistory(sessions);
      return { chatSession: sessions };
    });
  },
  setChatDraftPrompt: (p: string | null) => setState({ chatDraftPrompt: p }),
  pushMessage: (sessId: string, msg: any) =>
    setState((s) => {
      const sessions = s.chatSession.map((x) =>
        x.id === sessId ? { ...x, messages: [...x.messages, msg] } : x,
      );
      // 自动根据第一条用户消息更新会话标题
      const sess = sessions.find(x => x.id === sessId);
      if (sess && sess.messages.filter((m: any) => m.role === 'user').length === 1 && sess.title.startsWith('会话 ')) {
        const firstUserMsg = sess.messages.find((m: any) => m.role === 'user');
        if (firstUserMsg) {
          sess.title = (firstUserMsg.content || '').slice(0, 30) || sess.title;
        }
      }
      saveHistory(sessions);
      return { chatSession: sessions };
    }),
  updateLastMessage: (sessId: string, update: (m: any) => any) =>
    setState((s) => {
      const sessions = s.chatSession.map((x) => {
        if (x.id !== sessId) return x;
        const msgs = [...x.messages];
        if (msgs.length) msgs[msgs.length - 1] = update(msgs[msgs.length - 1]);
        return { ...x, messages: msgs };
      });
      saveHistory(sessions);
      return { chatSession: sessions };
    }),
  showWizard: () => setState({ showWizard: true }),
  hideWizard: () => setState({ showWizard: false }),
};
