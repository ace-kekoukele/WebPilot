# WebPilot v4.0 — 3 步开箱即用

> 给用户 / 朋友用 · 不需要编程 · 5 分钟跑起来

---

## ✅ 你需要先准备

- **Node.js 22+** — [下载](https://nodejs.org/)（装 LTS 就行）
- **Google Chrome** — 已装就够（不需要额外步骤）
- **Windows 10/11** — v4.0 仅 Windows（Mac/Linux 留 v4.1）

---

## 🚀 安装（3 步）

### Step 1：解压
把 `WebPilot-v4.0.0.zip` 解压到任意目录（建议 `C:\WebPilot\`）

### Step 2：运行安装脚本
**右键** `install.ps1` → **"用 PowerShell 运行"**

脚本会自动：
- ✅ 验证 Node.js 版本
- ✅ `npm install` 装依赖
- ✅ 检测 Chrome 路径
- ✅ 在**桌面**创建 `Chrome (WebPilot).lnk` 快捷方式
- ✅ 在**开始菜单**创建 `WebPilot` 文件夹 + 快捷方式
- ✅ 在**桌面**创建 `启动 WebPilot.lnk` 启动 daemon
- ✅ 在**桌面**创建 `WebPilot 控制台.url` 一键打开 GUI

> 💡 如果 PowerShell 提示"无法加载脚本"，先运行：
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass`

### Step 3：启动
**两种方式**（任选其一）：

| 方式 | 步骤 |
|---|---|
| 🖱 **双击** | 双击桌面 **`Chrome (WebPilot)`** → Chrome 启动 → 双击 **`启动 WebPilot`** → daemon 启动 |
| ⌨ **命令行** | 终端运行 `npm start` |

然后 Chrome 地址栏输入：**`http://127.0.0.1:9224`** → 看到桌面 GUI

---

## 🎯 第一次使用

### 1. 桌面 GUI 长这样

```
┌─ WebPilot v4.0.0 ───────── 🟢 已连接 ─────────── 🔔 ⚙ ❓ ─┐
│  🌐    💬    📋    📊                                      │
│浏览器  助手  自动化  监控                                 │
│ (URL)  (Chat) (工作流) (Activity)                         │
│                                                              │
│         ╔══════════════════════════╗                        │
│         ║   浏览器实时预览区      ║                        │
│         ║   (用户 Chrome 画面)    ║                        │
│         ╚══════════════════════════╝                        │
└──────────────────────────────────────────────────────────────┘
```

### 2. 5 个必试操作

| 操作 | 步骤 |
|---|---|
| **🧰 调一个工具** | 按 <kbd>Ctrl</kbd>+<kbd>K</kbd> → 输入 `browser_navigate` → Enter |
| **🤖 让 AI 帮你做** | 设置 → 💬 LLM API → 导入预设（OpenAI / Anthropic / DeepSeek / MiniMax 等 16 个）→ 填 key → 切到 💬 助手 |
| **🪟 让 AI Agent 接管** | 你的 AI Agent 配 `mcpServers: { webpilot: { url: "http://127.0.0.1:9223/mcp" } }` → 顶栏立刻看到 |
| **🔧 不对了？** | 点顶栏 🔧 → 一键修复 |
| **❓ 看帮助** | 按 <kbd>F1</kbd> |

### 3. 配 AI Agent 接管浏览器（核心卖点）

打开你的 AI 客户端（Claude Desktop / Cursor / MiniMax Code / Cherry Studio...），加：

```json
{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}
```

> 完整 16 个 Agent 接入手册: 按 <kbd>F1</kbd> → 「模板示例」

---

## 📁 文件结构（解压后）

```
WebPilot/
├── install.ps1                 ← 双击运行
├── uninstall.ps1               ← 卸载
├── package.json
├── README.md                   ← 项目说明
├── INSTALL.md                  ← 你正在看的
├── CHANGELOG.md                ← 版本历史
│
├── lib/                        ← 核心桥 (CDP/MCP/HTTP/版本)
├── daemon/                     ← 守护进程 + 业务模块
│   ├── main.js
│   ├── browser-picker.js       ← 自动找 Chrome
│   ├── browser-launcher.js     ← 创建 .lnk
│   ├── network-store.js        ← 网络拦截/逆向
│   ├── llm-client.js           ← LLM 流式
│   ├── agent-registry.js       ← 多 Agent 跟踪
│   ├── activity-log.js         ← 工作日志
│   ├── repair.js               ← 一键修复
│   └── format-generators/      ← 16 个 LLM 厂商预设
│
├── tools/                      ← 73 个 MCP 工具 (含网站逆向 3 个新工具)
├── electron/renderer/          ← React 18 桌面 GUI 源码
│   ├── src/                    ← App + 9 components + 4 panels
│   └── dist/                   ← 预编译产物 (你直接用)
│
└── test/                       ← 195 个单元测试
```

---

## ❓ 故障排查

| 现象 | 怎么查 |
|---|---|
| PowerShell 拒绝执行 | 先跑 `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass` |
| `npm install` 太慢 | 用了国内镜像（`.npmrc` 已配）一般 20s 完成 |
| Chrome 桌面 .lnk 没建 | 手动跑 PowerShell 里的 [node] 那段 |
| 顶栏红 "Chrome 未连接" | 双击桌面 `Chrome (WebPilot)` 启动 Chrome，再双击 `启动 WebPilot` |
| 顶栏黄/红 Agent 一直不出现 | 在你的 Agent 配置里加 `http://127.0.0.1:9223/mcp`（看 F1 帮助） |
| LLM 报 401 | 顶栏 Settings → 💬 LLM API → 重新填 key |
| 想看完整日志 | `%LOCALAPPDATA%\WebPilot\logs\` |
| 端口 9222-9227 都被占 | 点顶栏 🔧 一键修复（自动迁移到 9223-9227） |

---

## 🧹 卸载

```powershell
# 右键 uninstall.ps1 → "用 PowerShell 运行"
# 干净卸载：停止 daemon + 删除桌面快捷 + 删除安装目录
```

---

## 📞 出问题？

1. 先按 <kbd>F1</kbd> 看帮助（GUI 里）
2. 看 `%LOCALAPPDATA%\WebPilot\logs\` 的当天日志
3. 点顶栏 🔧 一键修复

---

## 🛠️ 给开发者

```bash
# 开发模式 (HMR 热重载)
npm run dev

# 跑测试
npm test

# 重新 build React (改了 src/ 后)
npm run build

# 跑集成测试 (需 Chrome 已 attach)
npm run test:integration

# 一键清掉 (包括 node_modules 和 dist)
rm -rf node_modules electron/renderer/dist
```

API 文档:
- `GET /api/openapi.json` — OpenAPI 3.0 规范
- `GET /api/formats/openai` / `anthropic` / `gemini` / `a2a` — 多家 LLM 格式
- `curl http://127.0.0.1:9224/api/health` — 简单健康检查
