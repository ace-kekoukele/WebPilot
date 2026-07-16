// src/components/Wizard.tsx — 首次设置 3 步向导
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { apiGet } from '../lib/api';

interface Props { onDone: () => void; }

export function Wizard({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    if (step === 2) {
      apiGet('/api/health').then(setHealth).catch(() => setHealth(null));
    }
  }, [step]);

  return (
    <div className="wizard-container" style={{ padding: 32, maxWidth: 720, margin: '40px auto', background: 'var(--bg-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
      {step === 1 && (
        <>
          <h2>欢迎使用 WebPilot</h2>
          <p style={{ color: 'var(--text-2)' }}>v4.0.4 · protocol 4.0</p>
          <p>三步跑起来:</p>
          <ol>
            <li>启动 Chrome (带 debug 端口)</li>
            <li>让 Agent 连 <code>http://127.0.0.1:9223/mcp</code></li>
            <li>Chrome 打开 <code>http://127.0.0.1:9224</code> 看桌面面板</li>
          </ol>
          <button className="primary-btn" onClick={() => setStep(2)}>下一步 →</button>
        </>
      )}
      {step === 2 && (
        <>
          <h2>① 启动 Chrome</h2>
          <p>推荐方式: 双击桌面 <strong>Chrome (WebPilot)</strong> 快捷方式</p>
          <p>或手动 (PowerShell):</p>
          <pre style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto' }}>
{`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" \\
  --remote-debugging-port=9222 \\
  --remote-debugging-address=127.0.0.1`}
          </pre>
          <p>状态: <span style={{ color: health?.cdpConnected ? 'var(--success)' : 'var(--error)' }}>
            {health ? (health.cdpConnected ? '✓ Chrome 已连接' : '✗ Chrome 未连接') : '检查中...'}
          </span></p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="ghost-btn" onClick={() => setStep(1)}>← 上一步</button>
            <button className="primary-btn" onClick={() => setStep(3)}>下一步 →</button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h2>② 让 Agent 连接</h2>
          <p>Agent 配置里加 (Claude Desktop 示例):</p>
          <pre style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 6, fontSize: 13 }}>
{`{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}`}
          </pre>
          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
            其他 Agent (Cursor / Continue / MiniMax Code) 接入手册: 按 F1 看
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="ghost-btn" onClick={() => setStep(2)}>← 上一步</button>
            <button className="primary-btn" onClick={onDone}>完成</button>
          </div>
        </>
      )}
    </div>
  );
}
