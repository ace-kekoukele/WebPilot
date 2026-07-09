// src/panels/BrowserPanel.tsx — 浏览器模式 (URL 导航 + tab 列表 + 元素选择器)
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { pushToast } from '../components/Toast';

interface Props { tools: any[]; }

export function BrowserPanel({ tools }: Props) {
  const [url, setUrl] = useState('https://example.com');
  const [tabs, setTabs] = useState<{ user: any[]; agent: any[] }>({ user: [], agent: [] });
  const [busy, setBusy] = useState(false);

  const refreshTabs = async () => {
    try { const r = await apiGet('/api/browser/tabs'); setTabs(r.tabs || { user: [], agent: [] }); }
    catch { setTabs({ user: [], agent: [] }); }
  };
  useEffect(() => { refreshTabs(); const t = setInterval(refreshTabs, 5000); return () => clearInterval(t); }, []);

  const navigate = async () => {
    if (!url) return;
    setBusy(true);
    try { await apiPost('/api/browser/navigate', { url }); pushToast({ kind: 'success', title: '已跳转', description: url }); }
    catch (e: any) { pushToast({ kind: 'error', title: '跳转失败', description: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <section className="mode-panel">
      <div className="browser-header">
        <div className="browser-tabs">
          {tabs.user.length === 0 && tabs.agent.length === 0 && (
            <span className="browser-tabs-empty">Chrome 未连接 - 在 PowerShell 跑: <code>chrome --remote-debugging-port=9222</code></span>
          )}
          {tabs.user.map((t) => <div key={t.targetId || t.id} className="browser-tab user" title={t.url}>👤 {(t.title || t.url || 'Tab').slice(0, 30)}</div>)}
          {tabs.agent.map((t) => <div key={t.targetId || t.id} className="browser-tab agent" title={t.url}>🤖 {(t.title || t.url || 'Tab').slice(0, 30)}</div>)}
        </div>
        <div className="browser-actions">
          <button className="icon-btn" title="元素选择器 (Ctrl+K 搜它)" onClick={() => pushToast({ kind: 'info', title: '提示', description: 'Ctrl+K 搜 "元素选择器"' })}>🎯</button>
        </div>
      </div>
      <div className="browser-body">
        <div className="browser-url-bar">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            placeholder="输入 URL, 回车导航..."
          />
          <button className="primary-btn" onClick={navigate} disabled={busy}>→</button>
          <button className="ghost-btn" onClick={refreshTabs} title="刷新 tab 列表">⟳</button>
        </div>
        <div className="browser-preview">
          <div className="preview-empty">
            <div className="preview-empty-icon">🪟</div>
            <div className="preview-empty-text">浏览器实时预览</div>
            <div className="preview-empty-hint">
              v4.0: 浏览器在用户 Chrome (127.0.0.1:9222).<br />
              实时截图通过 Page.captureScreenshot 每 {`{频率可配}`} ms 拉取.<br />
              <small>(功能已就绪, UI 在 v4.1 接流)</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
