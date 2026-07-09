// src/components/SettingsOverlay.tsx — 12 分类设置
import React, { useState } from 'react';
import { apiGet, apiPost } from '../lib/api';

interface Props { onClose: () => void; }

const CATS = [
  { id: 'connection', icon: '🔗', name: '连接' },
  { id: 'chrome', icon: '🌐', name: 'Chrome 浏览器' },
  { id: 'agent', icon: '🤖', name: 'Agent 连接' },
  { id: 'llm', icon: '💬', name: 'LLM API' },
  { id: 'proxy', icon: '🧅', name: '代理' },
  { id: 'ui', icon: '🖥', name: '界面' },
  { id: 'language', icon: '🌐', name: '语言' },
  { id: 'logs', icon: '📝', name: '日志' },
  { id: 'notifications', icon: '🔔', name: '通知' },
  { id: 'privacy', icon: '🔒', name: '隐私' },
  { id: 'update', icon: '🔄', name: '更新' },
  { id: 'advanced', icon: '🛠', name: '高级' },
];

export function SettingsOverlay({ onClose }: Props) {
  const [cat, setCat] = useState('connection');
  const [q, setQ] = useState('');
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState('就绪');

  React.useEffect(() => {
    if (cat === 'agent') { setFields({}); return; }
    apiGet(`/api/settings/${cat}`).then((r) => setFields(r || {})).catch(() => setFields({}));
  }, [cat]);

  const filteredCats = CATS.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    setSaveStatus('保存中...');
    try {
      await apiPost(`/api/settings/${cat}`, { patch: fields });
      setSaveStatus('✓ 已保存');
      setTimeout(() => setSaveStatus('就绪'), 2000);
    } catch (e: any) { setSaveStatus('✗ ' + e.message); }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal">
        <div className="settings-search">
          🔍 <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索设置项..." />
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {filteredCats.map((c) => (
              <div key={c.id} className={`settings-nav-item ${c.id === cat ? 'active' : ''}`} onClick={() => setCat(c.id)}>
                {c.icon} {c.name}
              </div>
            ))}
          </nav>
          <div className="settings-content">
            <h2 style={{ marginTop: 0 }}>{CATS.find((c) => c.id === cat)?.icon} {CATS.find((c) => c.id === cat)?.name}</h2>
            {cat === 'agent' ? (
              <div style={{ color: 'var(--text-3)', padding: 20 }}>
                实时显示已连接的 Agent.<br/>查看顶栏 Agent pill 或 Activity Log.
              </div>
            ) : cat === 'update' ? (
              <div style={{ color: 'var(--text-3)', padding: 20 }}>
                v4.0 不做自动更新.<br/>升级: 下载新版 .exe 覆盖装即可.
              </div>
            ) : cat === 'language' ? (
              <div style={{ color: 'var(--text-3)', padding: 20 }}>v4.0 只支持简体中文.</div>
            ) : (
              <div className="settings-section">
                {Object.entries(fields).map(([k, def]: [string, any]) => (
                  <div key={k} className="settings-field">
                    <label>{def.label || k}</label>
                    {def.type === 'boolean' ? (
                      <input type="checkbox" data-key={k} defaultChecked={def.value} onChange={(e) => setFields((f) => ({ ...f, [k]: { ...f[k], value: e.target.checked } }))} />
                    ) : def.type === 'select' ? (
                      <select data-key={k} value={def.value} onChange={(e) => setFields((f) => ({ ...f, [k]: { ...f[k], value: e.target.value } }))}>
                        {(def.options || []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type={def.type === 'number' ? 'number' : 'text'} data-key={k} defaultValue={def.value}
                        onChange={(e) => setFields((f) => ({ ...f, [k]: { ...f[k], value: def.type === 'number' ? parseInt(e.target.value, 10) : e.target.value } }))} />
                    )}
                  </div>
                ))}
                <button className="primary-btn" onClick={save} style={{ marginTop: 12 }}>保存</button>
              </div>
            )}
          </div>
        </div>
        <div className="settings-footer">
          <span className="settings-save-status">{saveStatus}</span>
          <button className="ghost-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
