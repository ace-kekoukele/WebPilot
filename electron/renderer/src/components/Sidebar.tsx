// src/components/Sidebar.tsx — 4 图标侧栏
import React from 'react';

const ITEMS = [
  { mode: 'browser' as const, icon: '🌐', label: '浏览器', key: '1' },
  { mode: 'chat' as const, icon: '💬', label: '助手', key: '2' },
  { mode: 'automation' as const, icon: '📋', label: '自动化', key: '3' },
  { mode: 'monitor' as const, icon: '📊', label: '监控', key: '4' },
];

interface SidebarProps {
  mode: string;
  onChange: (m: any) => void;
}

export function Sidebar({ mode, onChange }: SidebarProps) {
  return (
    <nav className="sidebar">
      {ITEMS.map((it) => (
        <button
          key={it.mode}
          className={`nav-item ${mode === it.mode ? 'active' : ''}`}
          onClick={() => onChange(it.mode)}
          title={`${it.label} (Ctrl+${it.key})`}
        >
          <span className="nav-icon">{it.icon}</span>
          <span className="nav-label">{it.label}</span>
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button
        className={`nav-item ${mode === 'wizard' ? 'active' : ''}`}
        onClick={() => onChange('wizard')}
        title="首次设置向导"
      >
        <span className="nav-icon">✨</span>
        <span className="nav-label">设置</span>
      </button>
    </nav>
  );
}
