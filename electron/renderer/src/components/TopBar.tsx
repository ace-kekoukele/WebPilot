// src/components/TopBar.tsx — 顶栏 (品牌 + Agent pill + 状态灯 + 端口 + 工具按钮)
import React from 'react';
import { useAppStore } from '../store';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onOpenRepair: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ theme, onToggleTheme, onOpenPalette, onOpenHelp, onOpenRepair, onOpenSettings }: Props) {
  const health = useAppStore((s) => s.health);
  const agents = useAppStore((s) => s.agents);
  const cdpOk = !!health?.cdpConnected;
  const agentCount = agents.length;
  const ports = (health as any)?.ports as { cdp?: number; mcp?: number; http?: number; control?: number } | undefined;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand">WebPilot</span>
        <span className="brand-version">v{health?.version || '4.0.0'}</span>
      </div>
      <div className="topbar-center">
        <span
          className={`agent-pill ${agentCount > 1 ? 'multicolor' : ''}`}
          title="已连接的 Agent"
        >
          <span
            className="agent-dot"
            style={{ background: agentCount === 0 ? '#9CA3AF' : (agents[0]?.color || 'var(--primary)') }}
          />
          <span id="agent-text">
            {agentCount === 0
              ? '未连接 Agent'
              : agentCount === 1
                ? `${agents[0].name} v${agents[0].version}`
                : `${agentCount} 个 Agent 已连接`}
          </span>
        </span>
      </div>
      <div className="topbar-right">
        <span className="bridge-status" title={`Chrome CDP 状态 · 端口: ${ports?.cdp ?? '?'}`}>
          <span className="status-dot" style={{ background: cdpOk ? 'var(--success)' : 'var(--error)' }} />
          <span>{cdpOk ? `Chrome 已连接 (${health!.toolCount} 工具)` : `Chrome 未连接 (:${ports?.cdp ?? 9222})`}</span>
        </span>
        <button
          className="icon-btn"
          title={`端口: CDP=${ports?.cdp ?? '?'} / MCP=${ports?.mcp ?? '?'} / HTTP=${ports?.http ?? '?'} / Ctrl=${ports?.control ?? '?'}. 点击改端口`}
          onClick={onOpenSettings}
        >
          🔌
        </button>
        <button className="icon-btn" title="切换主题" onClick={onToggleTheme}>🌗</button>
        <button className="icon-btn" title="命令面板 (Ctrl+K)" onClick={onOpenPalette}>⌘</button>
        <button className="icon-btn" title="帮助 (F1)" onClick={onOpenHelp}>❓</button>
        <button className="icon-btn repair-btn" title="一键修复" onClick={onOpenRepair}>🔧</button>
      </div>
    </header>
  );
}
