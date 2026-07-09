# Contributing to WebPilot

> WebPilot v4.0.4 (2026-07-09) — 大而全版本
>
> 接手前先读 [./HANDOFF.md](./HANDOFF.md) + [./docs/CODE_STATUS.md](./docs/CODE_STATUS.md)。
>
> 🤖 **如果你是 AI Agent** — 读 [./CONTRIBUTING_AI.md](./CONTRIBUTING_AI.md),里面是 WebPilot 协作规范(约束前置复述 / DEVIATIONS.md / Chrome 124+ 已知坑 / 不静默简化)。

---

## 📋 前置

- **Node.js 22+**(`node --version` 检查)
- **Chrome 124+**(用于集成测试)
- **Git** 任何版本
- **Windows 10/11**(本项目只支持 Windows,macOS / Linux 在 v4.4+ 考虑)

---

## 🏗️ 项目结构

```
WebPilot-v4.0.1-handoff/
├── package.json            # scripts + 依赖
├── README.md               # 用户总览
├── CHANGELOG.md            # 版本变更
├── HANDOFF.md              # ★ 开发者接手(必读)
├── CONTRIBUTING.md         # 你正在看的
├── CONTRIBUTING_AI.md      # AI 协作规范
│
├── daemon/                 # ★ 守护进程
│   ├── main.js             # 入口:启停 + 端口协商
│   ├── console-stream.js   # Chrome console → SSE
│   ├── network-store.js    # 网络抓包
│   ├── recorder.js         # Chrome 录制器
│   └── config.js           # 配置持久化
│
├── lib/                    # ★ 核心库
│   ├── cdp/                # CDP 拆分模块(在用,不要绕过)
│   ├── mcp-server.js       # MCP Streamable HTTP
│   ├── http-api.js         # HTTP REST + OpenAPI 3.0
│   ├── tool-loader.js      # 工具加载器
│   ├── tool-schemas.js     # zod schemas for 20 高频工具
│   ├── recorder.js         # 录制器库
│   ├── repair.js           # 4 阶段自检
│   ├── version.js          # ★ 单一版本源
│   └── zod-helper.js       # zod schema 辅助
│
├── tools/                  # ★ 73 个 MCP 工具
├── electron/               # ★ Electron 桌面端
│   ├── main.cjs            # 主进程
│   ├── preload.cjs         # IPC 桥
│   ├── tray.cjs            # 系统托盘
│   ├── menu.cjs            # 原生菜单
│   └── renderer/           # React 18 GUI
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── panels/
│       │   ├── lib/
│       │   └── store.ts
│       └── dist/           # build 产物
├── test/                   # ★ 测试
├── docs/                   # 设计 / 架构 / FAQ / 加工具指南
│
├── electron-builder.json   # NSIS 打包配置
├── install.ps1             # Windows 用户级安装
└── uninstall.ps1
```

详细代码状态见 [./docs/CODE_STATUS.md](./docs/CODE_STATUS.md)。

---

## 🚀 快速开始

```bash
git clone <repo-url>
cd WebPilot-v4.0.1-handoff
npm install

# 启 Chrome (远程调试模式)
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9222"

# 启 WebPilot daemon
npm start

# 跑测试
npm test                  # 单元
npm run test:watch        # 监听

# 开发 GUI
npm run dev               # Vite HMR

# 重新 build GUI(改了 src/ 后)
npm run build

# 跑集成测试
npm run test:integration
```

---

## ✍️ 加新工具

详细模板和约定见 [./docs/ADDING_TOOLS.md](./docs/ADDING_TOOLS.md)。

### 最小示例

```js
// tools/browser_mything.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_mything';
export const description = '一句话说明';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId (必填)' },
};

export async function execute(args) {
  try {
    const r = await sendPageCommand(args.targetId, 'Page.captureScreenshot', {});
    return { ok: true, data: r.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 命名规范

- 工具文件名:`browser_<verb>.js`
- 工具名 export:与文件名相同
- 危险操作:用 `confirm: true` 参数;manifest 标 `risk: 'high'`

### 关键 import

```js
✅ import { ... } from '../lib/cdp/index.js'   // 新代码
❌ import { ... } from '../lib/cdp-manager.js'  // v2 兼容层已删(2026-07-09)
```

---

## 🧪 测试约定

### 单元测试(必须)

- 不依赖 Chrome / Node 网络
- 用 Node 内置 `node:test` + `node:assert/strict`,零依赖
- 模仿 Chrome WebSocket 用 `test/unit/_helpers.js` 的 `MockWs`
- 重点测:`lib/cdp/` 内部逻辑(bucket 路由、消息字段、错误响应)

### 集成测试(建议)

- 依赖 Chrome `--remote-debugging-port=9222`
- 直接 `import * as cdp from '../../lib/cdp/index.js'`
- Chrome 不可用时自动 `t.skip()`,CI 可跑

### 添加新测试

- 文件名 `*.test.js`
- 单元放 `test/unit/`,集成放 `test/integration/`
- 一个测试一件事;用 `describe` 风格 (`test('description', ...)`)

---

## 🐛 Chrome 124+ 已知行为(必须知道)

| 表达式 | 现象 | 解决办法 |
|---|---|---|
| `JSON.stringify(...)` | "Internal error" | IIFE 包:`(() => JSON.stringify(...))()` |
| `({a: 1}).prop` | "Internal error" | IIFE 包:`(() => ({a: 1}).prop)()` |
| `awaitPromise: true` + 复杂表达式 | "Execution was terminated" | 加 `awaitPromise: false` |
| `({...})` 直接块 | "Internal error" | 改 IIFE 或加返回值 |

> 这些是 Chrome 自身限制,**不是本项目 bug**。集成测试已避开。

---

## 📝 提交规范

**Conventional Commits**:

```
<type>(<scope>): <description>

[body]

[footer]
```

类型:
- `feat` — 新功能 / 新工具
- `fix` — bug 修复
- `test` — 加测试 / 修测试
- `refactor` — 重构(不改变行为)
- `docs` — 仅文档
- `chore` — 构建 / 依赖 / 配置
- `design` — GUI 设计 / UX
- `electron` — 桌面端

Scope:`cdp` / `tools` / `daemon` / `electron` / `docs` / `deps`

---

## 🔄 提 PR 前

```bash
# 1. 跑全部测试
npm run test:all

# 2. 语法检查
npm run check

# 3. CHANGELOG.md 加条目(在 ## [Unreleased] 下加 ### feat/fix 条目)

# 4. commit + push
git add .
git commit -m "feat(scope): description"
git push origin <your-branch>
```

---

## 🚫 不要做的事

- ❌ **不要在 tools/ 里写大逻辑** — 抽到 `lib/cdp/`
- ❌ **不要硬编码端口** — 用 `lib/version.js` 的 `DEFAULT_PORTS`
- ❌ **不要持久化状态到磁盘** — 违反"零状态可迁移"原则(配置除外)
- ❌ **不要加跨平台代码** — Windows-only
- ❌ **不要绕过 `cdp/index.js`** — 所有 CDP 调用必须经 `lib/cdp/`
- ❌ **不要动 isOurTab 守卫** — 用户标签页永久只读是 v4.0 硬承诺
- ❌ **不要另起 Chrome 进程** — attach 用户已开的 Chrome
- ❌ **不要覆盖 `--user-data-dir`** — 用用户登录态
- ❌ **不要静默简化代码** — 失败时回退而不是简化

---

## 📐 架构原则

1. **单 ws 连接**:整个 daemon 共享一个 Browser Target ws,Page 命令走 Page session 自己的 ws
2. **域 lazy enable**:不预 enable 所有 CDP 域,按需 enable
3. **bucket key 严格匹配**:`_send` 的 bucketKey 必须等于 `_wireUpEvents` 的 sessionKey
4. **零状态**:不写 `cdp-cache.json` 等持久化文件(配置除外)
5. **薄壳工具**:tools/ 文件 ≤ 80 行,复杂逻辑在 lib/
6. **isOurTab 守卫**:所有 73 工具 require own tab,用户标签页永久只读
7. **端口自动迁移**:6 端口被占时自动 +1,GUI 弹 toast 提示
8. **不自动写 Agent 配置**:用户显式选才写
9. **GUI 直调工具数最大化**:每个工具争取在 GUI 暴露,不只走 MCP

---

## 🆘 求助

- 文档先看 [`README.md`](./README.md) + [`HANDOFF.md`](./HANDOFF.md) + [`docs/`](./docs/)
- Issue 提具体场景(Chrome 版本、Node 版本、错误信息 + server log)
- 看 `%LOCALAPPDATA%\WebPilot\logs\` 里的日志

---

## License

贡献的代码同样按 MIT 协议授权。
