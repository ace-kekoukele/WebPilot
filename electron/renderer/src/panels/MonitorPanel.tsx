// src/panels/MonitorPanel.tsx — 监控 (Activity Log + Network + Console)
import React, { useState, useEffect } from 'react';
import { useAppStore, store } from '../store';
import { apiGet } from '../lib/api';

type Tab = 'activity' | 'network' | 'console';

export function MonitorPanel() {
  const [tab, setTab] = useState<Tab>('activity');
  const [filter, setFilter] = useState('');
  const activity = useAppStore((s) => s.activity);
  const [network, setNetwork] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (tab === 'activity') apiGet('/api/activity?limit=200').then((r) => store.setActivity(r.events || [])).catch(() => {});
      if (tab === 'network') apiGet('/api/network/list?limit=200').then((r) => setNetwork(r.events || [])).catch(() => {});
    }, 3000);
    if (tab === 'activity') apiGet('/api/activity?limit=200').then((r) => store.setActivity(r.events || [])).catch(() => {});
    if (tab === 'network') apiGet('/api/network/list?limit=200').then((r) => setNetwork(r.events || [])).catch(() => {});
    return () => clearInterval(timer);
  }, [tab]);

  const filteredAct = activity.filter((e) =>
    !filter || [e.agent, e.tool, e.error || '', JSON.stringify(e.args || {})].some((s) => String(s).toLowerCase().includes(filter.toLowerCase()))
  );
  const filteredNet = network.filter((e) =>
    !filter || (e.url || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <section className="mode-panel">
      <div className="monitor-tabs">
        <button className={`tab-btn ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>工作日志</button>
        <button className={`tab-btn ${tab === 'network' ? 'active' : ''}`} onClick={() => setTab('network')}>网络</button>
        <button className={`tab-btn ${tab === 'console' ? 'active' : ''}`} onClick={() => setTab('console')}>Console</button>
      </div>
      <div className="monitor-content">
        {tab !== 'console' && (
          <div className="monitor-filters">
            <input type="text" placeholder={tab === 'activity' ? '过滤 (agent/tool/状态)' : '过滤 URL'} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <span className="activity-count">{tab === 'activity' ? filteredAct.length : filteredNet.length} / {tab === 'activity' ? activity.length : network.length} 条</span>
          </div>
        )}
        {tab === 'activity' && (
          <div className="activity-table">
            <div className="activity-row head">
              <div>时间</div><div>Agent</div><div>工具</div><div>参数</div><div>状态</div><div>耗时</div>
            </div>
            {filteredAct.slice(-100).reverse().map((e, i) => (
              <div key={i} className="activity-row">
                <div>{new Date(e.ts).toLocaleTimeString()}</div>
                <div>{e.agent}</div>
                <div>{e.tool}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(e.args || {}).slice(0, 100)}</div>
                <div className={e.ok ? 'ok' : 'err'}>{e.ok ? '✓' : '✗'}</div>
                <div>{e.durationMs || 0}ms</div>
              </div>
            ))}
            {filteredAct.length === 0 && <div style={{ padding: 20, color: 'var(--text-3)' }}>暂无活动</div>}
          </div>
        )}
        {tab === 'network' && (
          <div className="activity-table">
            <div className="activity-row head">
              <div>时间</div><div>Method</div><div>URL</div><div>状态</div><div>MIME</div>
            </div>
            {filteredNet.slice(-100).reverse().map((e, i) => (
              <div key={i} className="activity-row">
                <div>{new Date(e.ts).toLocaleTimeString()}</div>
                <div><b>{e.method || '·'}</b></div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.url}>{e.url}</div>
                <div className={e.status >= 400 ? 'err' : 'ok'}>{e.status || '·'}</div>
                <div>{(e.mimeType || '').split(';')[0]}</div>
              </div>
            ))}
            {filteredNet.length === 0 && <div style={{ padding: 20, color: 'var(--text-3)' }}>暂无网络 (需 Chrome 已 attach)</div>}
          </div>
        )}
        {tab === 'console' && (
          <div style={{ padding: 20, color: 'var(--text-3)' }}>
            Console 抓取 (Runtime.consoleAPICalled) v4.1 加 — v4.0 用 Activity Log 查
          </div>
        )}
      </div>
    </section>
  );
}
