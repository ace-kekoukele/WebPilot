# Contributing to WebPilot

> ⚠️ **项目还在 active 开发** — v4.0.1 (2026-07-06) 已发,下一步是 v4.1
>
> v3.0 时代的"项目已归档"声明已删除(2026-07-09 整理 docs 时),那是错的,项目 v4 重写后一直在动。
>
> 接手前先读 [./HANDOFF.md](./HANDOFF.md) + [./docs/CODE_STATUS.md](./docs/CODE_STATUS.md)。

---

## 📋 前置

- **Node.js 22+**(`node --version` 检查)
- **Chrome 124+**(用于集成测试)
- **Git** 任何版本
- **PowerShell**(Windows-only 项目)

> ⚠️ 本项目 **只支持 Windows**。v4.1 才考虑 macOS/Linux。

---

## 🏗️ 项目结构

```
browser-bridge-main/
├── package.json            # scripts + 依赖
├── README.md               # 用户总览
├── INSTALL.md              # 用户安装
├── CHANGELOG.md            # 版本变更
├── HANDOFF.md              # ★ 开发者接手(必读)
├── CONTRIBUTING.md         # 你正在看的
│
├── daemon/                 # ★ 守护进程 + 业务编排
│   ├── main.js             # 入口:启停 + 端口协商 + 信号处理
│   ├── *.js                # 14 个业务模块
│   ├── discovery/          # Agent 配置
│   ├── format-generators/  # 5 厂商 LLM 格式
│   └── static/             # GUI 运行时
│
├── lib/                    # ★ 核心库
│   ├── cdp/                # CDP 拆分模块(在用)
│   ├── mcp-server.js       # MCP Streamable HTTP
│   ├── http-api.js         # HTTP REST + OpenAPI 3.0
│   ├── tool-loader.js      # 工具加载器
│   ├── version.js          # ★ 单一版本源
│   ├── zod-helper.js       # zod schema 辅助
│   └── cdp-manager.js      # ⚠️ v2 兼容层,别动
│
├── tools/                  # ★ 79 个 MCP 工具
├── electron/renderer/      # ★ React 18 桌面 GUI
├── test/                   # ★ 测试
├── scripts/                # 🟠 legacy 脚本(待清理)
│
├── install.ps1             # Windows 用户级安装
└── uninstall.ps1
```

详细代码状态见 [./docs/CODE_STATUS.md](./docs/CODE_STATUS.md)。

---

## 🚀 快速开始

```bash
git clone <your-fork-url>
cd browser-bridge-main
npm install

# 启 Chrome
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9222"

# 启 WebPilot daemon
npm start

# 跑测试
npm test                  # 单元
npm run test:all          # 单元 + 集成(需 Chrome)

# 开发 GUI
npm run dev               # Vite HMR

# 重新 build GUI(改了 src/ 后)
npm run build

# 跑集成测试
npm run test:integration
```

---

## ✍️ 加新工具

工具是薄壳(`tools/browser_*.js`),大部分逻辑在 `lib/cdp/`。

### 1. 创建文件 `tools/browser_mything.js`

```js
// tools/browser_mything.js - 一句话功能说明
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_mything';
export const description = '一句话说明';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId (必填,除非 connection/meta 类)' },
  // 业务参数...
};

export async function execute(args) {
  try {
    // 1. 快速校验必填参数
    if (!args.requiredField) return { ok: false, error: 'requiredField required' };
    // 2. 调 CDP 命令
    const r = await sendPageCommand(args.targetId, 'CDP.Domain.method', { ... });
    // 3. 包装返回值
    return { ok: true, data: r.someField };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 2. 命名规范

- 工具文件名:`browser_<verb>.js`
- 工具名 export:与文件名相同
- 危险操作(关闭非自有 tab / 清 cookies / 伪造响应):用 `confirm: true` 参数;manifest 标 `risk: 'high'`

### 3. 关键 import path

✅ **新代码:** `import { ... } from '../lib/cdp/index.js'`
❌ **不要用:** `import { ... } from '../lib/cdp-manager.js'`(那是 v2 兼容层,42 个老 tools 还在用,新工具不要学)

### 4. 参数模式

- 所有工具(除 `browser_set_enabled` / `browser_connect` / `browser_list_tabs` 等 connection 类)都必填 `targetId`
- 复杂参数用 `JSON.stringify` 内嵌到 `Runtime.evaluate` 表达式,避免字符串拼接 bug
- 错误返回统一 `{ ok: false, error: 'human-readable msg' }`

### 5. 测试

加参数校验单元测试到 `test/unit/tools-args-validation.test.js`。

---

## 🧪 测试约定

### 单元测试(必须)

- 不依赖 Chrome / Node 网络
- 用 Node 内置 `node:test` + `node:assert/strict`,零依赖
- 模仿 Chrome WebSocket 用 `test/unit/_helpers.js` 的 `MockWs`
- 重点测:`lib/cdp/` 内部逻辑(bucket 路由、消息字段、错误响应)

### 集成测试(建议)

- 依赖 Chrome `--remote-debugging-port=9222`
- 不通过 MCP SDK(单 transport 限制),直接 `import * as cdp from '../../lib/cdp/index.js'`
- Chrome 不可用时自动 `t.skip()`,CI 可跑

### 跑测试

```bash
npm test                  # 单元
npm run test:integration  # 集成(需 Chrome)
npm run test:all          # 全部
```

### 添加新测试

- 文件名 `*.test.js`
- 单元放 `test/unit/`,集成放 `test/integration/`
- 一个测试一件事;用 `describe` 风格 (`test('description', ...)`)
- 失败时打印清晰的 expected vs actual

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

用 **Conventional Commits**:

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

Scope(可选):`cdp` / `tools` / `daemon` / `electron` / `docs` / `deps`

例:

```
feat(tools): add browser_xhr_break tool

- 实现 Debugger.setBreakpointByUrl (含 URL pattern + condition)
- 加 zod schema 校验
- 加单元测试 4 cases
```

```
fix(cdp): page ws no longer embeds sessionId field

Chrome 124+ 拒绝 nested-session lookup, 报 "Session with given id not found"。
_split cdpSessionId and bucketKey in _send()_。

Refs: v1.7.1 P0 regression
```

---

## 🔄 提 PR 前

```bash
# 1. 跑全部测试
npm run test:all

# 2. 语法检查
npm run check    # node --check index.js && node --check lib/*.js

# 3. CHANGELOG.md 加条目(在 ## [Unreleased] 下加 ### feat/fix 条目)

# 4. commit + push
git add .
git commit -m "feat(scope): description"
git push origin <your-branch>
```

## 🤖 CI (GitHub Actions)

PR / push 触发 `.github/workflows/`:
- **unit-test** (matrix: Windows + Node 20/22):`npm test`
- **integration-test** (Windows + Chrome):`npm run test:integration`
- **lint**:全部 .js 语法检查

Tag 触发(待补):
- 推送 `v*.*.*` tag → 自动生成 GitHub Release + 从 CHANGELOG.md 提取 notes

---

## 🚫 不要做的事

- ❌ **不要在 tools/ 里写大逻辑** — 抽到 `lib/cdp/`
- ❌ **不要硬编码端口** — 用 `lib/version.js` 的 `DEFAULT_PORTS`
- ❌ **不要持久化状态到磁盘** — 违反"零状态可迁移"原则(配置除外)
- ❌ **不要加跨平台代码** — Windows-only
- ❌ **不要绕过 `cdp/index.js`** — 所有 CDP 调用必须经 `lib/cdp/`
- ❌ **不要动 `lib/cdp-manager.js`** — 那是 v2 兼容层,42 个 tools 还在用
- ❌ **不要改 isOurTab 守卫** — 用户标签页永久只读是 v4.0 硬承诺
- ❌ **不要另起 Chrome 进程** — attach 用户已开的 Chrome
- ❌ **不要覆盖 `--user-data-dir`** — 用用户登录态

---

## 📐 架构原则

1. **单 ws 连接**:整个 daemon 共享一个 Browser Target ws,Page 命令走 Page session 自己的 ws
2. **域 lazy enable**:不预 enable 所有 CDP 域,按需 enable
3. **bucket key 严格匹配**:`_send` 的 bucketKey 必须等于 `_wireUpEvents` 的 sessionKey
4. **零状态**:不写 `cdp-cache.json` 等持久化文件(配置除外)
5. **薄壳工具**:tools/ 文件 ≤ 80 行,复杂逻辑在 lib/
6. **isOurTab 守卫**:所有 79 工具 require own tab,用户标签页永久只读
7. **端口自动迁移**:6 端口被占时自动 +1,GUI 弹 toast 提示
8. **不自动写 Agent 配置**:用户显式选才写

---

## 🆘 求助

- 文档先看 [`README.md`](./README.md) + [`HANDOFF.md`](./HANDOFF.md) + [`docs/`](./docs/)
- Issue 提具体场景(Chrome 版本、Node 版本、错误信息 + server log)
- 看 `%LOCALAPPDATA%\WebPilot\logs\` 里的日志

---

## License

贡献的代码同样按 MIT 协议授权。
