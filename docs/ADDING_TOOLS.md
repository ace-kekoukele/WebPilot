# 加工具指南 (Adding Tools)

> 适用于 `tools/browser_*.js` 下所有 MCP 工具。

---

## 文件结构

每个工具一个 `.js` 文件,扁平放 `tools/` 目录。loader (`lib/tool-loader.js`) 在启动时自动扫 `tools/`,挑出所有 `export const name` 合法的模块,注册到 `/api/tools/list`。

**目标:** 单文件 ≤ 80 行。复杂逻辑抽到 `lib/cdp/`,工具本身只做"参数校验 → 调 lib → 包装返回"。

---

## 最小模板

```js
// tools/browser_mything.js
// 一句话功能说明 — loader 会作为 description 的一部分
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_mything';
export const description = '一句话说明';
export const parameters = {
  targetId: {
    type: 'string',
    description: '标签页 targetId (必填,除非 connection/meta 类)',
    required: false, // 大多数工具必填,这里展示可省
  },
  // 业务参数...
  url: {
    type: 'string',
    description: '要打开的 URL',
  },
};

export async function execute(args) {
  // 1. 快速校验必填参数
  if (!args.targetId) return { ok: false, error: 'targetId required' };
  if (!args.url) return { ok: false, error: 'url required' };

  try {
    // 2. 调 CDP 命令(走 lib/cdp/index.js,不要自己 import ws)
    const r = await sendPageCommand(args.targetId, 'Page.navigate', { url: args.url });

    // 3. 包装返回值
    return { ok: true, data: { frameId: r.frameId } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

---

## 命名规范

| 维度 | 规则 |
|---|---|
| 文件名 | `browser_<verb>_<noun>.js`,全小写,下划线分词 |
| export name | 与文件名相同(去掉 `.js`) |
| description | 一句话,**中文**用户也看得懂 |
| 危险操作 | 必须有 `confirm: true` 参数;manifest `risk: 'high'` |

例:`browser_close_tab.js` / `browser_get_cookies.js` / `browser_set_enabled.js`

---

## 参数 schema

参数用 JSON Schema 风格 object 描述(loader 直接转 zod)。

```js
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  selector: { type: 'string', description: 'CSS selector' },
  count: { type: 'number', description: '返回条数', default: 10 },
  enabled: { type: 'boolean', description: '开关' },
  mode: { type: 'string', enum: ['fast', 'safe', 'debug'], description: '模式' },
  tags: { type: 'array', items: { type: 'string' }, description: '标签' },
  nested: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      value: { type: 'number' },
    },
    description: '嵌套对象',
  },
};
```

复杂参数(`array`/`object`)建议加 `required: ['field1']` 在 object 上,不然校验可能漏。

---

## 在 GUI 暴露

新增/改完工具,**同时**在 `electron/renderer/src/lib/tool-schemas.ts` 加 zod schema(只针对 20 个高频工具),就能在 Ctrl+K 命令面板调起来。

如果不在 20 高频里,工具仍能通过 MCP 调用,只是 GUI 没有快捷入口。

---

## 错误返回

**统一格式:**

```js
return { ok: true, data: {...} };          // 成功
return { ok: false, error: 'human msg' };  // 失败(用户能看的)
```

不要 throw,不要返回 `undefined`,不要返回纯字符串。

---

## 必读

1. **`isOurTab` 守卫** — 工具默认 require 自己开的 tab。如果传用户已有的 `targetId`,工具内部必须先 `isOurTab(targetId)` 校验,否则拒绝。
2. **危险操作必带 confirm** — `close_tab` / `clear_cookies` / `set_extra_headers` 等,没有 `confirm: true` 一律拒绝执行。
3. **不要持久化** — 不写文件、不写 DB,所有结果返回给调用方。
4. **不要绕过 `lib/cdp/index.js`** — 自己 import `ws` 调 Chrome 走不通 daemon 的 bucket 路由。

---

## 测试

每个工具至少 1 个单元测试(参数校验 + 错误路径),放 `test/unit/tools-args-validation.test.js` 或 `test/unit/<toolname>.test.js`。

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execute, parameters } from '../../tools/browser_mything.js';

test('browser_mything requires targetId', async () => {
  const r = await execute({ url: 'https://example.com' });
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId/);
});

test('browser_mything requires url', async () => {
  const r = await execute({ targetId: 'fake-id' });
  assert.equal(r.ok, false);
  assert.match(r.error, /url/);
});
```

集成测试可选(`test/integration/browser-mything.test.js`),需要 Chrome 在 `9222` 跑。

---

## 上 PR 前

```bash
# 1. 跑自己的测试
npm test

# 2. 跑全部测试(确保没破别的)
npm test

# 3. 语法检查
npm run check

# 4. CHANGELOG.md 加 ### feat 条目

# 5. commit
git add tools/browser_mything.js test/...
git commit -m "feat(tools): add browser_mything"
```
