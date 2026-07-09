// src/hooks/useKeyboardShortcuts.ts — 全局键盘快捷键 Hook
import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  modifiers?: ('ctrl' | 'meta' | 'shift' | 'alt')[];
  description: string;
  action: () => void;
  scope?: 'global' | 'input' | 'panel';
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if in input/textarea (unless scope includes 'input')
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      const isEditable = (e.target as HTMLElement)?.isContentEditable;

      for (const shortcut of shortcuts) {
        const scope = shortcut.scope || 'global';
        if (inInput && scope === 'global') continue;
        if (isEditable && scope === 'global') continue;

        const modifiers = shortcut.modifiers || [];
        const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('meta');
        const hasShift = modifiers.includes('shift');
        const hasAlt = modifiers.includes('alt');

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = hasCtrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = hasShift ? e.shiftKey : !e.shiftKey;
        const altMatch = hasAlt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

export function formatShortcut(key: string, modifiers?: string[]): string {
  const parts: string[] = [];
  if (modifiers?.includes('ctrl') || modifiers?.includes('meta')) parts.push('⌘');
  if (modifiers?.includes('shift')) parts.push('⇧');
  if (modifiers?.includes('alt')) parts.push('⌥');
  parts.push(key.toUpperCase());
  return parts.join('');
}

// Common shortcuts config
export const COMMON_SHORTCUTS = {
  PALETTE: { key: 'k', modifiers: ['ctrl'], description: '打开命令面板' },
  BROWSER: { key: '1', modifiers: ['ctrl'], description: '浏览器模式' },
  CHAT: { key: '2', modifiers: ['ctrl'], description: '聊天模式' },
  AUTOMATION: { key: '3', modifiers: ['ctrl'], description: '自动化模式' },
  MONITOR: { key: '4', modifiers: ['ctrl'], description: '监控模式' },
  SETTINGS: { key: ',', modifiers: ['ctrl'], description: '打开设置' },
  HELP: { key: 'F1', description: '打开帮助' },
  ESCAPE: { key: 'Escape', description: '关闭弹窗/取消' },
  NEW_TAB: { key: 't', modifiers: ['ctrl'], description: '新建标签页' },
  CLOSE_TAB: { key: 'w', modifiers: ['ctrl'], description: '关闭标签页' },
  REFRESH: { key: 'r', modifiers: ['ctrl'], description: '刷新' },
};
