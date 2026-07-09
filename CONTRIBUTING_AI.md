# AI 协作规范(For WebPilot v4.0.x)

> 适用对象:任何 AI Agent(Claude Code / Cursor / Codex / MiniMax Code 等)在 v4.0.x codebase 上做改动时。
> 非 AI 贡献者可忽略本文件。
>
> 配套文档:`CONTRIBUTING.md`(开发流程)+ `HANDOFF.md`(架构交接)+ `docs/CODE_STATUS.md`(代码状态)。

---

## 0. 为什么需要这份规范

WebPilot 是**用户浏览器桥**——一个 bug 会直接动到用户的 Chrome 标签页、登录态、cookie、网络代理。这种代码不能容忍 AI"先跑通再说,细节我后面补"。

AI 在 WebPilot 上的偷懒模式:

1. **跨 CDP 域偷懒**:用户让加 `Network.getCookies`,AI 直接 `sendCommand`(Browser 域)而不是 `sendPageCommand`(Page 域),结果只能拿到当前标签页的 cookies,漏掉其他标签。
2. **isOurTab 守卫绕过**:危险操作(关 tab / 清 cookie / 拦截请求)忘了加 `confirm: true` 和 `risk: 'high'`。
3. **持久化承诺违反**:偷偷写 `.cache` / `.state` / `.session` 文件,违反"零状态可迁移"硬原则。
4. **import 路径走偏**:用 `lib/cdp-manager.js`(v2 兼容层)而不是 `lib/cdp/index.js`,导致新工具混进老架构。
5. **测试瞎写**:只写 happy path,错误处理 / 边界 / `isOurTab` 守卫全不测。
6. **Windows-only 假设漏掉**:AI 默认写 POSIX 路径 / 信号 / 进程逻辑,在 Windows 上直接挂。

---

## 1. 三条铁律(不可妥协)

### 铁律 1:严禁静默简化

所有未实现的约束必须显式标注 `// DEFERRED: <约束> <后续计划>`,**不得隐式省略**。
所有"我自己决定加的东西"必须写进 `docs/DEVIATIONS.md`。

**反面例子:**
```js
// AI 简化:把 if (!tab.isOurs) return err 整段删了
export async function execute(args) {
  const r = await sendPageCommand(args.targetId, 'Page.close', {});
  return { ok: true };
}
```

**正确例子:**
```js
export async function execute(args) {
  const tab = await ensureOwnTab(args.targetId); // isOurTab 守卫保留
  if (!tab.ok) return tab;
  // DEFERRED: Page.close 前应 await Page.navigateToBlank 避免中途报错,见 v4.1 TODO
  const r = await sendPageCommand(args.targetId, 'Page.close', {});
  return { ok: true, data: { closed: tab.targetId } };
}
```

### 铁律 2:复杂规则前置复述

开始写代码前,先输出从用户指令 + 相关 `.md`(`HANDOFF.md` / `CONTRIBUTING.md` / `docs/CODE_STATUS.md`)中提取的约束清单:

```
## 约束清单(本任务)
P0(违反会让用户浏览器出问题):
1. 必须用 sendPageCommand 不是 sendCommand
2. 危险操作必须 confirm:true
...
P1(违反会破坏架构):
1. import 必须走 lib/cdp/index.js
2. 不要碰 lib/cdp-manager.js
...
P2(可简化但需标注):
1. 错误返回文案可省略细节
```

**用户没确认前不要动手写代码。**

### 铁律 3:WebPilot 特有约束不可绕过

以下约束来自 `CONTRIBUTING.md §"不要做的事"` + `HANDOFF.md §"v4.0 用户承诺"`,AI 不得"觉得没必要"而省略:

| 约束 | 违反后果 |
|---|---|
| 所有 CDP 调用走 `lib/cdp/index.js` | 混进 v2 兼容层,v4.1 清理时全废 |
| 危险工具加 `confirm: true` + `risk: 'high'` | 用户标签页被 AI 误关 / cookie 被清 |
| `isOurTab()` 守卫不可少 | 用户私人标签页被 AI 操作 |
| 不写 `.cache` / `.state` 文件 | 破坏"零状态可迁移"承诺 |
| 不覆盖 `--user-data-dir` | 用户登录态丢失 |
| 不另起 Chrome 进程 | 违反 attach 模式硬承诺 |
| tools/ 单文件 ≤ 80 行 | 复杂逻辑必须抽 `lib/cdp/` |
| 不动 `lib/cdp-manager.js` | 42 个老 tools 会全挂 |
| Windows-only 代码 | macOS/Linux 路径 / 信号会带进来 |

---

## 2. 任务接收流程

### 2.1 用户给你任务时的标准动作

```
1. 先读:
   - HANDOFF.md(必读,确认架构认知)
   - CONTRIBUTING.md §"不要做的事"
   - docs/CODE_STATUS.md(确认目标模块状态)

2. 输出约束清单(P0/P1/P2)

3. 等用户确认(或修正约束分类)

4. 写代码 + DEVIATIONS.md

5. 跑 npm test + node --check

6. 输出变更摘要 + DEVIATIONS 链接
```

### 2.2 任务切分阈值

| 任务规模 | 切分方式 |
|---|---|
| 单个新工具(≤ 80 行) | 不切,直接做 |
| 多个新工具 | 每个独立 commit |
| daemon 模块重构 | 先输出重构计划,确认后再动 |
| lib/cdp/ 改动 | 必须单独 review,影响所有 tools |
| electron/ 改动 | 必须 React build 验证 |
| 跨 daemon + lib + tools | 分阶段交付,每阶段停下来等验收 |

---

## 3. 实现规范(WebPilot 特定)

### 3.1 新增 MCP 工具模板

```js
// tools/browser_mything.js
// 一句话功能:在用户标签页上做 X
import { sendPageCommand, ensureOwnTab } from '../lib/cdp/index.js';

export const name = 'browser_mything';
export const description = '一句话说明,Agent 看 description 决定调不调';
export const risk = 'medium'; // low | medium | high
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId,几乎所有工具必填' },
  requiredField: { type: 'string', description: '业务必填' },
  // 高危操作加 confirm
  // confirm: { type: 'boolean', description: '必填 true 才执行', default: false },
};

export async function execute(args) {
  try {
    // 1. 校验必填
    if (!args.requiredField) {
      return { ok: false, error: 'requiredField required' };
    }
    // 2. isOurTab 守卫(危险操作必须)
    const tab = await ensureOwnTab(args.targetId);
    if (!tab.ok) return tab;

    // 3. 业务调用
    const r = await sendPageCommand(args.targetId, 'CDP.Domain.method', {
      // ...
    });

    // 4. 包装返回值
    return { ok: true, data: r.someField };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 3.2 错误返回统一格式

```js
// 正确
return { ok: false, error: 'human-readable 中文消息' }; // 项目只支持简体中文

// 错误(AI 偷懒常见)
return { error: 'something wrong' };           // 缺 ok 字段
throw new Error('xxx');                        // 抛异常,上层要 try/catch
return { success: false, msg: 'xxx' };         // 字段名不对
```

### 3.3 Chrome 124+ 已知坑(必须避)

参考 `CONTRIBUTING.md §"Chrome 124+ 已知行为"`,AI 写 `Runtime.evaluate` 时:

```js
// 错(Chrome 124+ 会 Internal error)
expression: 'JSON.stringify(window.localStorage)'

// 对
expression: '(() => JSON.stringify(window.localStorage))()'

// 错
expression: '({a: 1}).prop'

// 对
expression: '(() => ({a: 1}).prop))()'
```

**AI 自己写的 evaluate 表达式必须用 IIFE 包,否则 Chrome 直接拒。**

### 3.4 端口引用

```js
// 对
import { DEFAULT_PORTS } from '../lib/version.js';
const port = DEFAULT_PORTS.MCP_HTTP;

// 错(AI 默认偷懒)
const port = 9223;
```

### 3.5 LLM 厂商相关

```js
// 加新厂商走 daemon/format-generators/
// 不要直接改 llm-client.js,加 format adapter
```

---

## 4. 测试规范

### 4.1 每个新工具必须有单元测试

放 `test/unit/tools-args-validation.test.js`,测:
- 缺必填参数 → 返 `{ ok: false, error: '...' }`
- 危险工具 `confirm` 缺失 → 拒绝执行
- `isOurTab` 守卫对非自有 tab → 拒绝

### 4.2 lib/cdp 改动必须有集成测试

放 `test/integration/`,Chrome 不可用时 `t.skip()`,CI 可跑。

### 4.3 自检清单(每次交付前过一遍)

```
□ P0 约束全部实现?无 SIMPLIFIED 注释?
□ DEVIATIONS.md 已更新?
□ 单元测试覆盖核心 / 错误 / isOurTab 守卫?
□ node --check 通过?
□ npm test 通过?
□ import 走 lib/cdp/index.js 没碰 lib/cdp-manager.js?
□ 没写 .cache / .state / .session 文件?
□ 端口引用走 lib/version.js?
□ Runtime.evaluate 用了 IIFE 包?
□ 错误返 ok:false + error 中文?
□ Windows-only 假设(没 POSIX 路径 / 信号)?
□ CHANGELOG.md 加了 ### 条目?
```

---

## 5. DEVIATIONS.md 规范

每完成一个变更,在 `docs/DEVIATIONS.md` 追加(文件不存在就创建):

```markdown
## [任务简述] - YYYY-MM-DD

### 用户原始约束
- (复述用户的核心需求)

### 简化项(用户没让但 AI 做了)
- [描述] → [实际实现] → [原因]

### 未实现项(用户让了但 AI 标 DEFERRED)
- [约束] → [代码位置] → [后续计划]

### 新增项(用户没要求 AI 加了)
- [描述] → [理由] → [需要用户确认是否保留]

### 自检结论
- P0 全部实现 ✅
- npm test 通过 ✅
- node --check 通过 ✅
```

**没写 DEVIATIONS.md = 没交付完。**

---

## 6. 交互规范

### 6.1 AI 不要做的事

- ❌ 不要在用户没问时说"我建议简化..."然后顺手简化
- ❌ 不要用"为了简洁"作为裁剪理由
- ❌ 不要用 `// ...` 省略号代替未实现代码
- ❌ 不要在代码里留 TODO 不写后续计划
- ❌ 不要"我觉得用户应该不在意"——所有简化都标 DEFERRED
- ❌ 不要给用户标签页相关代码加 `try/catch` 吞异常
- ❌ 不要为"跑得通"绕开 `isOurTab` 守卫
- ❌ 不要在 React 组件里直接调 CDP(走 IPC)

### 6.2 AI 应当做的事

- ✅ 主动报告"这部分我假设 X,请确认"
- ✅ 主动暴露"文档没说但我必须决定的事"
- ✅ 主动标注"我加了 Y 因为 Z,需要请确认是否保留"
- ✅ 跨文件改动时,显式列出影响范围(几个 tools / 几个 tests)
- ✅ `lib/cdp/` 改动时,主动跑 `npm run test:all` 不是只 `npm test`
- ✅ 写完代码先 `node --check` 再交付

---

## 7. 分阶段交付阈值

| 任务 | 阶段 |
|---|---|
| 单文件 ≤ 80 行,1 个 tool | 1 阶段直接交付 |
| 1-3 个 tool + 测试 | 2 阶段(工具 + 测试) |
| daemon 模块重构 | 3 阶段(计划 / 骨架 / 测试 + DEVIATIONS) |
| lib/cdp/ 改动 | 3 阶段 + 每阶段 npm run test:all |
| 跨 daemon + lib + tools | 4+ 阶段,每阶段停下来等验收 |

每阶段结束**必须停下来等用户验收**,不要连发。

---

## 8. 故障处理

### AI 跑挂了的处理

1. **不要静默 fallback** —— 例如 Chrome 没启,不要"假装"返回空数据。
2. **报清晰错误** —— `return { ok: false, error: 'Chrome 未启动,需先 --remote-debugging-port=9222' }`。
3. **写进 DEVIATIONS** —— 标记 fallback 路径,让用户决定要不要保留。

### 用户改需求的处理

- 中途改需求 → 沉默三拍(等用户说完)
- 不抱怨
- 评估影响范围(几个文件 / 几个测试)
- 列出来再动手

### 用户追问"为什么不这样做"

- 直接回答:基于哪条约束 / 哪个文件第几行
- 不要绕弯子
- 如果 AI 自己判断错了,直接认

---

## 9. 与现有规范的关系

| 关注点 | 本文件 | CONTRIBUTING.md |
|---|---|---|
| 开发流程 | 不重复 | ✅ 详细 |
| 加新工具模板 | ✅ WebPilot 特定 | 通用版 |
| AI 偷懒模式 | ✅ 6 大类 | 不涉及 |
| 约束清单流程 | ✅ 强制 | 不涉及 |
| DEVIATIONS.md | ✅ 必填 | 不涉及 |
| 测试规范 | AI 协作角度 | 工程角度 |
| "不要做的事" | 不重复 | ✅ 9 条硬规则 |

两者互补,不冲突。读 `CONTRIBUTING.md` 知道怎么开发,读本文件知道 AI 怎么协作。

---

**总结: WebPilot 这种"动用户浏览器"的代码,AI 不能用通用 coding assistant 的标准来对待。每条 P0 都是用户真实损失。约束前置、显式标注、不静默简化,是底线。**