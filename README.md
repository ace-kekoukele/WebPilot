# WebPilot

> 通用 Chrome DevTools Protocol 桥。70+ 工具覆盖页面操控、网络、JS 调试、堆、WebSocket。
> 多 Agent 自动接入 (Claude Desktop / Claude Code / Cursor / Continue / MiniMax Code / ...)。
> MCP Streamable HTTP + OpenAPI 3.0。

[![version](https://img.shields.io/badge/version-4.0.2-blue)] [![tests](https://img.shields.io/badge/tests-199%2F199-brightgreen)] [![license](https://img.shields.io/badge/license-MIT-green)]

## 三句话解释

1. **装好 WebPilot，启动 Chrome 加一个 flag** → 用户 Chrome 自己起来
2. **你的 AI Agent（Claude / Cursor / MiniMax Code）连 WebPilot** → Agent 通过 70 个工具操控你的浏览器
3. **在 Chrome 里打开 `http://127.0.0.1:9224`** → 看到桌面 GUI，浏览器实时预览、Activity Log、Agent 控制

## 用户承诺（v4.0）

| # | 承诺 | 实现 |
|---|---|---|
| 1 | 用**用户已开的 Chrome**（不另起进程） | daemon 只 attach `127.0.0.1:9222` |
| 2 | **不开 headless** debug 浏览器 | 默认 headed 模式 |
| 3 | 用户标签页**永久只读** | `origin=user` 标 + 工具守卫 |
| 4 | 用用户**登录态**（保留 cookie/历史） | 不覆盖 `--user-data-dir` |
| 5 | BB 退出**不影响 Chrome** | daemon graceful shutdown 不杀 Chrome |
| 6 | **任意 Agent** 自动连（兼容 15+） | MCP Streamable HTTP，passive listener |
| 7 | **不自动写** Agent 配置文件 | 默认 Auto 模式，用户显式选才写 |
| 8 | **只支持简体中文** | 全 UI/错误/菜单都中文 |
| 9 | **Win only**，不签 | 给用户和好友用，下载覆盖装 |
| 10 | **不自动更新** | 手动下载覆盖装 |

## 快速开始

### 1. 启动 Chrome（带调试端口）

**推荐方式**：
- 安装 WebPilot 时会在桌面创建 `Chrome (WebPilot).lnk` 快捷方式
- 双击它 — Chrome 起来，同时开启 `9222` debug 端口

**手动方式**（PowerShell）：
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --remote-debugging-address=127.0.0.1
```

### 2. 启动 WebPilot daemon

```bash
npm install
npm start          # 或: node daemon/main.js
```

daemon 输出：
```
┌─────────────────────────────────────┐
│  WebPilot v4.0.2                     │
│  protocol: 4.0  tools: 79             │
│  MCP:    http://127.0.0.1:9223/mcp    │
│  HTTP:   http://127.0.0.1:9224/api/*  │
│  attach: http://127.0.0.1:9222/json   │
└─────────────────────────────────────┘
```

### 3. 打开桌面 GUI

Chrome 地址栏打开：**`http://127.0.0.1:9224/`**

看到 4 个图标（左） + 顶栏 + 状态指示：
- 🌐 浏览器（实时画面 + 元素选择器）
- 💬 AI 助手（Chat + 工具调用）
- 📋 自动化（工作流 + 录制器 + 模板）
- 📊 监控（Activity Log + Network + Console）

### 4. 让你的 Agent 连

在 Agent 配置里加：
```json
{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}
```

Agent 一连 → GUI 顶栏右上角立刻显示 "✅ Claude Code"；Activity Log 开始记所有工具调用。

## 多厂商 LLM（Chat 面板用）

Settings → 💬 LLM API → "导入预设" → 选：
- OpenAI（国际版）
- Anthropic（国际版）
- Google Gemini
- OpenRouter
- DeepSeek（国内版 / 国际版）
- 月之暗面 Kimi（国内版 / 国际版）
- 智谱 GLM（国内版）
- 通义千问 Qwen（国内版 / 国际版）
- **MiniMax（国内版 / 国际版）**
- Ollama 本地
- + 自定义 OpenAI 兼容端点

填 API Key → 保存 → 顶栏切换 → Chat 面板用。

## 7 Agent 即时接入（默认 Auto 模式，零配置）

| Agent | 检测 | 接入 |
|---|---|---|
| Claude Desktop | ✅ | wizard 自动 |
| Claude Code | ✅ | wizard 自动 |
| Cursor | ✅ | wizard 自动 |
| Continue (VS Code) | ✅ | wizard 自动 |
| MiniMax Code | ✅ | wizard 自动 |
| Hermes / Cherry / Cline / Codex | ✅ | wizard 自动 |
| 自研 Agent | 自动 | URL 加 `http://127.0.0.1:9223/mcp` |

默认 wizard 不动你的配置文件。Agent 一连 → daemon 自识别 → 顶栏显示。

## 一键修复（🔧 按钮）

点顶栏 🔧 按钮，4 阶段修复：
1. **诊断**：Chrome 端口 / 配置 / token / 句柄
2. **修复**：自动迁移端口 / 备份坏配置 / 重生 token / 重连 ws
3. **验证**：再诊断一次
4. **报告**：剩 X 个手动处理项

真有效，不是转圈。

## 体系架构

```
┌─────────────────────────────────────────────────────────────┐
│  WebPilot v4.0.2                                              │
│                                                              │
│  daemon/main.js (单一进程)                                   │
│   ├─ chrome-manager      ← attach 用户 Chrome (9222)        │
│   ├─ cdp-watchdog        ← WS 断线状态机重连                │
│   ├─ module-cleanup      ← Tab 关闭清理                     │
│   ├─ agent-registry      ← 6 Agent 跟踪                     │
│   ├─ activity-log        ← 10000 条 ring buffer             │
│   ├─ format-generators   ← 5 厂商 (openai/anthropic/...)    │
│   ├─ LLM presets (16)    ← OpenAI / DeepSeek / MiniMax...    │
│   ├─ repair.js           ← 5 真有效修复                     │
│   ├─ mcp-server (9223)   ← MCP Streamable HTTP               │
│   ├─ http-api (9224)     ← REST + OpenAPI 3.0 + Static UI    │
│   └─ static-server       ← daemon/static/ (index.html...)   │
└─────────────────────────────────────────────────────────────┘
                                ↓ attach
                         用户 Chrome (9222)
                                ↕
                  AI Agents (Claude / Cursor / ...)
                  通过 MCP 9223 + clientInfo 自识别
```

## 命令行

```bash
npm start              # 启 daemon
npm test               # 199 个 unit test
npm run test:all       # + integration

# 直接调工具 (via REST)
curl -X POST http://127.0.0.1:9224/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"browser_tabs","args":{"action":"list"}}'

# 列出所有工具 (OpenAPI 3.0)
curl http://127.0.0.1:9224/api/openapi.json | jq

# Agent 格式 (OpenAI / Anthropic / Gemini / A2A)
curl http://127.0.0.1:9224/api/formats/openai  | jq
curl http://127.0.0.1:9224/api/formats/anthropic | jq
curl http://127.0.0.1:9224/api/formats/gemini | jq
curl http://127.0.0.1:9224/api/formats/a2a | jq
curl http://127.0.0.1:9224/.well-known/webpilot.json | jq
```

## 故障排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 顶栏红 "Chrome 未连接" | Chrome 没启 debug 端口 | PowerShell 跑 `chrome --remote-debugging-port=9222` |
| MCP 连不上 | daemon 没起 / 端口被占 | 顶栏 🔧 一键修复 |
| LLM 不回答 | API key 没配 / 余额 | 设置 → 💬 LLM API 检查 |
| Activity Log 空 | Agent 没连接 | 让 Agent 加 MCP URL `http://127.0.0.1:9223/mcp` |

按 <kbd>F1</kbd> 看完整帮助，或 <kbd>Ctrl</kbd>+<kbd>K</kbd> 调命令面板搜任何工具。

## 开发

```bash
git log --oneline         # 看 3 个核心 commit
npm test                  # 全部测试
node daemon/main.js       # 开发模式启动
```

## License

MIT — 给用户和好友用（v4.0 决定）。
