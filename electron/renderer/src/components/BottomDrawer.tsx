// src/components/BottomDrawer.tsx — 底部事件流抽屉
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { apiGet } from '../lib/api';

interface Props {
  open: boolean;
  onToggle: () => void;
  onOpenRepair: () => void;
}

export function BottomDrawer({ open, onToggle, onOpenRepair }: Props) {
  const [tab, setTab] = useState<'activity' | 'network' | 'console'>('activity');
  const [events, setEvents] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const activity = useAppStore((s) => s.activity);

  // activity: 从 store 读
  useEffect(() => {
    if (open && tab === 'activity') setEvents(activity);
  }, [open, tab, activity]);

  // network: 拉 /api/network/list
  useEffect(() => {
    if (!open || tab !== 'network') return;
    apiGet('/api/network/list?limit=50').then((r) => setItems(r.events || [])).catch(() => setItems([]));
  }, [open, tab]);

  // console: 暂时空 (需要 daemon 加 /api/console/list)
  useEffect(() => {
    if (open && tab === 'console') setItems([]);
  }, [open, tab]);

  return (
    <footer className={`bottombar ${open ? 'expanded' : ''}`}>
      <button className="bottombar-toggle" onClick={onToggle}>
        {open ? '▼' : '▲'} {open ? '折叠' : '最近事件'}
      </button>
      {open && (
        <div className="bottombar-detail">
          <div className="bottombar-tabs">
            <button className={`micro-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>事件</button>
            <button className={`micro-tab ${tab === 'network' ? 'active' : ''}`} onClick={() => setTab('network')}>网络</button>
            <button className={`micro-tab ${tab === 'console' ? 'active' : ''}`} onClick={() => setTab('console')}>Console</button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {tab === 'activity' && events.slice(-30).reverse().map((e, i) => (
              <div key={i} className="bottombar-strip-item">
                <span className={e.ok ? 'ok' : 'err'}>{e.ok ? '✓' : '✗'}</span>
                {new Date(e.ts).toLocaleTimeString()} {e.agent}/{e.tool} {e.durationMs}ms
              </div>
            ))}
            {tab === 'network' && items.slice(-30).reverse().map((e, i) => (
              <div key={i} className="bottombar-strip-item">
                <span>{e.status || '·'}</span>
                <b>{e.method}</b> {String(e.url || '').slice(0, 100)}
              </div>
            ))}
            {tab === 'console' && <div style={{ color: 'var(--text-3)', padding: 8 }}>无 console 事件 (daemon 未抓 console. v4.1 加)</div>}
          </div>
        </div>
      )}
    </footer>
  );
}
