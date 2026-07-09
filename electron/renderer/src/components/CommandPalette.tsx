// src/components/CommandPalette.tsx — Ctrl+K 命令面板
import React, { useEffect, useState, useMemo } from 'react';
import { apiPost } from '../lib/api';

interface Props {
  tools: any[];
  onClose: () => void;
  onToast: (t: any) => void;
  onOpenRepair: () => void;
  onOpenSettings: () => void;
}

const STATIC_ITEMS = [
  { kind: '设置', icon: '⚙', name: '打开设置', desc: '设置面板' },
  { kind: '修复', icon: '🔧', name: '一键修复', desc: '修复常见故障' },
  { kind: '帮助', icon: '❓', name: '帮助 (F1)', desc: '快捷键 / 模板 / FAQ' },
  { kind: '主题', icon: '🌗', name: '切换主题', desc: '暗 / 亮' },
];

export function CommandPalette({ tools, onClose, onToast, onOpenRepair, onOpenSettings }: Props) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(0);

  const items = useMemo(() => {
    const toolItems = (tools || []).slice(0, 200).map((t) => ({
      kind: '工具', icon: '🔧', name: t.name, desc: (t.description || '').slice(0, 60),
      action: async () => {
        onToast({ kind: 'info', title: `调用 ${t.name}`, description: '请到 工具面板 填参数后运行' });
      },
    }));
    const all = [...STATIC_ITEMS.map((it) => ({ ...it, action:
      it.kind === '设置' ? onOpenSettings :
      it.kind === '修复' ? onOpenRepair :
      it.kind === '帮助' ? () => {} :
      it.kind === '主题' ? () => document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark' :
      () => {}
    })), ...toolItems];
    if (!q) return all.slice(0, 50);
    const ql = q.toLowerCase();
    return all.filter((it) => it.name.toLowerCase().includes(ql) || (it.desc || '').toLowerCase().includes(ql)).slice(0, 50);
  }, [q, tools]);

  useEffect(() => { setSelected(0); }, [q]);

  const execute = (item: typeof items[0]) => {
    item.action?.();
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[selected] && execute(items[selected]); }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-modal" onKeyDown={onKey} tabIndex={0} ref={(el) => el?.focus()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="搜索工具 / 模板 / 命令... (↑↓ 选择 · Enter 执行 · Esc 关闭)"
        />
        <div className="cmd-results">
          {items.map((it, i) => (
            <div
              key={i}
              className={`cmd-result-item ${i === selected ? 'selected' : ''}`}
              onClick={() => execute(it)}
            >
              <span className="cmd-result-icon">{it.icon}</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="cmd-result-name">{it.name}</div>
                <div className="cmd-result-desc">{it.desc}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{it.kind}</span>
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: 20, color: 'var(--text-3)', textAlign: 'center' }}>无匹配结果</div>}
        </div>
        <div className="cmd-hint">F1 完整帮助 · Esc 关闭</div>
      </div>
    </div>
  );
}
