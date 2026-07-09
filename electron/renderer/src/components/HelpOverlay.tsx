// src/components/HelpOverlay.tsx — F1 帮助
import React, { useState } from 'react';

interface Props { onClose: () => void; }

const TABS = [
  { id: 'keys', title: '⌨ 快捷键', content: `
    <table>
      <tr><th>动作</th><th>快捷键</th></tr>
      <tr><td>命令面板</td><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td></tr>
      <tr><td>打开帮助</td><td><kbd>F1</kbd> / <kbd>?</kbd></td></tr>
      <tr><td>关闭弹窗</td><td><kbd>Esc</kbd></td></tr>
      <tr><td>切换 4 个模式</td><td><kbd>Ctrl</kbd>+<kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>/<kbd>4</kbd></td></tr>
      <tr><td>打开设置</td><td><kbd>Ctrl</kbd>+<kbd>,</kbd></td></tr>
      <tr><td>开始/停止录制</td><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd></td></tr>
      <tr><td>聊天发送</td><td><kbd>Enter</kbd></td></tr>
      <tr><td>聊天换行</td><td><kbd>Shift</kbd>+<kbd>Enter</kbd></td></tr>
    </table>` },
  { id: 'samples', title: '📚 模板', content: `
    <h3>🌐 网站逆向</h3><p>分析目标页面结构 + 抓 API</p>
    <h3>📊 批量抓表格</h3><p>列表 URL → 抓表格 → CSV</p>
    <h3>🔐 登录 + 抓 Cookie</h3><p>登录并导出 cookie</p>
    <h3>📝 批量填表</h3><p>CSV → 填表 → 提交</p>
    <h3>👀 监控变化</h3><p>轮询 URL, 变化时截图</p>` },
  { id: 'fix', title: '🔧 修复', content: `
    <h3>Chrome 不连</h3><p>PowerShell 跑: <code>chrome --remote-debugging-port=9222</code></p>
    <h3>端口被占</h3><p>点 🔧 一键修复 (会迁移到下一个可用端口)</p>
    <h3>MCP 连不上</h3><p>检查: <code>curl http://127.0.0.1:9223/mcp</code></p>
    <h3>LLM 不回答</h3><p>设置 → 🤖 LLM API → 检查 key</p>
    <h3>Agent 检测不到</h3><p>常见 5 个 Agent (Claude Desktop / Code / Cursor / Continue / MiniMax Code) 自动检测. 其他手动加 MCP 配置.</p>` },
  { id: 'faq', title: '❓ FAQ', content: `
    <h3>Q: 这是 Electron 应用吗?</h3><p>A: 受环境网络限制, 当前用 daemon + Chrome tab 跑 GUI (127.0.0.1:9224). Electron 版本可在用户机器打包后用.</p>
    <h3>Q: 支持哪些 Agent?</h3><p>A: 任何支持 MCP 的 Agent: Claude Desktop / Claude Code / Cursor / Continue / MiniMax Code / Hermes / Cherry / Cline / ...</p>
    <h3>Q: 为什么不用独立 Chrome?</h3><p>A: §21 - 不开新进程, 用用户已开的 Chrome (保留登录态, 不开 headless, 不影响 tab).</p>` },
];

export function HelpOverlay({ onClose }: Props) {
  const [tab, setTab] = useState('keys');
  const cur = TABS.find((t) => t.id === tab)!;
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="help-modal">
        <div className="help-header">
          <h2>WebPilot 帮助</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="help-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`help-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.title}</button>
          ))}
        </div>
        <div className="help-content">
          <h2>{cur.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: cur.content }} />
        </div>
      </div>
    </div>
  );
}
