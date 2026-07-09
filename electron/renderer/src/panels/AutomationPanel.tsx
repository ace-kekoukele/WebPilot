// src/panels/AutomationPanel.tsx — 自动化 (工作流 / 录制器 / 模板)
import React, { useState, useEffect, useRef } from 'react';
import { pushToast } from '../components/Toast';

interface Props { tools: any[]; }

const TEMPLATES = [
  { id: 'login-and-screenshot', icon: '🌐', name: '网站逆向', desc: '分析目标页面结构 + 抓 API' },
  { id: 'extract-table', icon: '📊', name: '批量抓表格', desc: '列表 URL → 抓表格 → CSV' },
  { id: 'login-cookies', icon: '🔐', name: '登录 + 抓 Cookie', desc: '登录并导出 cookie' },
  { id: 'fill-form', icon: '📝', name: '批量填表', desc: 'CSV → 填表 → 提交' },
  { id: 'monitor-change', icon: '👀', name: '监控变化', desc: '轮询 URL, 变化时截图' },
];

export function AutomationPanel({ tools }: Props) {
  const [tab, setTab] = useState<'workflow' | 'recorder' | 'templates'>('workflow');
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const recorderStartRef = useRef<number>(0);

  return (
    <section className="mode-panel">
      <div className="automation-tabs">
        <button className={`tab-btn ${tab === 'workflow' ? 'active' : ''}`} onClick={() => setTab('workflow')}>工作流</button>
        <button className={`tab-btn ${tab === 'recorder' ? 'active' : ''}`} onClick={() => setTab('recorder')}>录制器</button>
        <button className={`tab-btn ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>模板</button>
      </div>
      <div className="automation-content">
        {tab === 'workflow' && (
          <div id="wf-host" style={{ height: '100%', minHeight: 400 }}>
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📋</div>
              <h3>工作流画布 (vanilla SVG)</h3>
              <p>已实现: 节点拖入 + 端口连线 + 运行/单步/重置/清空</p>
              <p>当前 React 模式简化展示. 用 <kbd>Ctrl</kbd>+<kbd>K</kbd> 选工具或切到 自动化 → 工作流 tab 启动画布</p>
              <button className="primary-btn" onClick={() => {
                const host = document.getElementById('wf-host');
                if (!host) return;
                // 加载 vanilla 画布 (兼容模式)
                const s = document.createElement('script');
                s.src = '/workflow-canvas.js';
                s.onload = async () => {
                  const W = (window as any).WorkflowCanvas;
                  if (!W) return;
                  const nodeTools = (tools || []).map((t: any) => ({ name: t.name, description: t.description }));
                  new W(host, { tools: nodeTools, onRunNode: async (n: string, a: any) => {
                    try {
                      const r = await fetch('/api/tools/call', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: n, args: a }) });
                      const j = await r.json();
                      return { ok: j.ok, result: j.value, error: j.error };
                    } catch (e: any) { return { ok: false, error: e.message }; }
                  }});
                };
                document.head.appendChild(s);
              }}>打开工作流画布</button>
            </div>
          </div>
        )}
        {tab === 'recorder' && (
          <div style={{ padding: 24 }}>
            <div className="recorder-controls">
              <button className="primary-btn" disabled={recording} onClick={() => {
                setRecording(true);
                recorderStartRef.current = Date.now();
                pushToast({ kind: 'info', title: '录制中', description: '在 Chrome 里操作, 这里会记录工具调用' });
              }}>● 开始录制</button>
              <button className="ghost-btn" disabled={!recording} onClick={() => {
                setRecording(false);
                const dur = ((Date.now() - recorderStartRef.current) / 1000).toFixed(1);
                pushToast({ kind: 'success', title: '录制已停止', description: `时长 ${dur}s · ${events.length} 个事件` });
              }}>■ 停止</button>
              <span className={`recorder-status ${recording ? 'active' : ''}`}>{recording ? '● 录制中...' : '未录制'}</span>
            </div>
            <div className="recorder-events" style={{ marginTop: 12, minHeight: 200 }}>
              {events.length === 0 && <div style={{ padding: 20, color: 'var(--text-3)' }}>暂无事件</div>}
            </div>
          </div>
        )}
        {tab === 'templates' && (
          <div className="templates-grid">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="template-card" onClick={() => pushToast({ kind: 'info', title: '模板', description: '运行需要 LLM Provider. 先在 ⚙ 设置 → 💬 LLM API 配 key', actions: [{ label: '去设置', onClick: () => location.reload() }] })}>
                <div className="template-card-name">{t.icon} {t.name}</div>
                <div className="template-card-desc">{t.desc}</div>
                <div className="template-card-tags">
                  <span className="template-tag">{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
