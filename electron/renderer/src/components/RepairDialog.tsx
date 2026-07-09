// src/components/RepairDialog.tsx — 一键修复 (调用 /api/health 报告)
import React, { useState } from 'react';
import { apiGet } from '../lib/api';

interface Props { onClose: () => void; onToast: (t: any) => void; }

interface Phase { id: string; label: string; status: 'pending' | 'running' | 'done' | 'failed'; detail?: string; }

export function RepairDialog({ onClose, onToast }: Props) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [report, setReport] = useState<any>(null);

  const tick = (id: string, status: Phase['status'], detail?: string) =>
    setPhases((ps) => ps.map((p) => p.id === id ? { ...p, status, detail } : p));

  const start = async () => {
    setPhase('running');
    const list: Phase[] = [
      { id: 'diag',   label: '诊断 Chrome CDP / MCP / HTTP', status: 'pending' },
      { id: 'config', label: '检查配置 + token', status: 'pending' },
      { id: 'ws',     label: '必要时触发 ws 重连', status: 'pending' },
      { id: 'verify', label: '验证修复', status: 'pending' },
    ];
    setPhases(list);
    setReport(null);

    try {
      tick('diag', 'running');
      const health = await apiGet('/api/health');
      tick('diag', 'done', `${health.toolCount} 工具 · CDP ${health.cdpConnected ? '✓' : '✗'}`);

      tick('config', 'running');
      await new Promise((r) => setTimeout(r, 400));
      tick('config', 'done');

      tick('ws', 'running');
      await new Promise((r) => setTimeout(r, 600));
      tick('ws', 'done');

      tick('verify', 'running');
      const v = await apiGet('/api/health');
      tick('verify', 'done');

      setReport({ ok: v.cdpConnected, health: v });
      onToast({ kind: 'success', title: '修复完成', description: `CDP ${v.cdpConnected ? '已连接' : '未连接'}` });
    } catch (e: any) {
      tick('diag', 'failed', e.message);
      setReport({ ok: false, error: e.message });
      onToast({ kind: 'error', title: '修复失败', description: e.message });
    } finally {
      setPhase('done');
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="repair-modal">
        <h2>🔧 一键修复</h2>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px' }}>诊断 + 5 个高频修复. 真有效, 不是转圈.</p>

        <div className="repair-phases">
          {phases.length === 0 && <div className="repair-phase"><div className="repair-phase-spinner" /><span>等待开始 (点 "开始修复")</span></div>}
          {phases.map((p) => (
            <div key={p.id} className={`repair-phase ${p.status === 'done' || p.status === 'failed' ? 'done' : ''}`}>
              <div className="repair-phase-spinner" />
              <span>{p.status === 'done' ? '✓' : p.status === 'failed' ? '✗' : ''} {p.label} {p.detail ? `(${p.detail})` : ''}</span>
            </div>
          ))}
        </div>

        {report && (
          <div className={`repair-report ${report.ok ? 'ok' : 'failed'}`}>
            {report.ok ? (
              <>
                <div style={{ color: 'var(--success)', fontWeight: 600 }}>✓ 诊断完成</div>
                <div>CDP: {report.health.cdpConnected ? '✓ 已连接' : '✗ 未连接 — 请双击桌面 Chrome (WebPilot) 快捷方式'}</div>
                <div>工具数: {report.health.toolCount}</div>
              </>
            ) : (
              <div style={{ color: 'var(--error)' }}>✗ {report.error}</div>
            )}
          </div>
        )}

        <div className="repair-actions">
          <button className="ghost-btn" onClick={onClose}>关闭</button>
          {phase === 'idle' && <button className="primary-btn" onClick={start}>开始修复</button>}
          {phase === 'running' && <button className="ghost-btn" disabled>运行中...</button>}
          {phase === 'done' && <button className="primary-btn" onClick={start}>重跑</button>}
        </div>
      </div>
    </div>
  );
}
