// src/store.ts — 全局状态 (React 18 useSyncExternalStore, no zustand)
import { useSyncExternalStore } from 'react';

export interface AppState {
  health: { cdpConnected: boolean; toolCount: number; version: string; uptime: number } | null;
  agents: Array<{ id: string; name: string; version: string; color: string; callCount: number; connectedAt: number }>;
  llmProviders: any[];
  llmActive: string | null;
  chatSession: Array<{ id: string; title: string; messages: any[] }>;
  currentSessionId: string | null;
  activity: any[];
  // 各种面板开关
  showWizard: boolean;
}

const initial: AppState = {
  health: null,
  agents: [],
  llmProviders: [],
  llmActive: null,
  chatSession: [],
  currentSessionId: null,
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
  setLLMActive: (id: string | null) => setState({ llmActive: id }),
  appendActivity: (a: any[]) => setState((s) => ({ activity: [...s.activity, ...a].slice(-200) })),
  setActivity: (a: any[]) => setState({ activity: a }),
  clearActivity: () => setState({ activity: [] }),
  newChatSession: () => {
    const id = 'sess-' + Date.now();
    setState((s) => ({
      chatSession: [{ id, title: `会话 ${s.chatSession.length + 1}`, messages: [] }, ...s.chatSession].slice(0, 50),
      currentSessionId: id,
    }));
    return id;
  },
  setCurrentSession: (id: string | null) => setState({ currentSessionId: id }),
  pushMessage: (sessId: string, msg: any) =>
    setState((s) => ({
      chatSession: s.chatSession.map((x) =>
        x.id === sessId ? { ...x, messages: [...x.messages, msg] } : x,
      ),
    })),
  updateLastMessage: (sessId: string, update: (m: any) => any) =>
    setState((s) => ({
      chatSession: s.chatSession.map((x) => {
        if (x.id !== sessId) return x;
        const msgs = [...x.messages];
        if (msgs.length) msgs[msgs.length - 1] = update(msgs[msgs.length - 1]);
        return { ...x, messages: msgs };
      }),
    })),
  showWizard: () => setState({ showWizard: true }),
  hideWizard: () => setState({ showWizard: false }),
};
