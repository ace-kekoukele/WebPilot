// test/unit/zod-helper.test.js — zod 校验助手测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { toolError, toolOk, validateArgs, E_CODES, Common } from '../../lib/zod-helper.js';

test('toolError: 基础结构', () => {
  const e = toolError(E_CODES.INVALID_PARAMS, 'bad input');
  assert.equal(e.ok, false);
  assert.equal(e.error.code, 'E_INVALID_PARAMS');
  assert.equal(e.error.message, 'bad input');
  assert.ok(!('details' in e.error));
});

test('toolError: 带 details', () => {
  const e = toolError(E_CODES.NOT_CONNECTED, 'no chrome', { port: 9222 });
  assert.equal(e.error.code, 'E_NOT_CONNECTED');
  assert.deepEqual(e.error.details, { port: 9222 });
});

test('toolOk: 基础', () => {
  const r = toolOk({ foo: 1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { foo: 1 });
});

test('toolOk: 带 extra 字段', () => {
  const r = toolOk('done', { count: 5 });
  assert.equal(r.value, 'done');
  assert.equal(r.count, 5);
});

test('validateArgs: 通过', () => {
  const schema = z.object({
    targetId: z.string(),
    action: z.enum(['a', 'b']),
  });
  const v = validateArgs({ targetId: 'T', action: 'a' }, schema);
  assert.equal(v.valid, true);
  assert.equal(v.data.targetId, 'T');
});

test('validateArgs: 缺字段返回 INVALID_PARAMS', () => {
  const schema = z.object({
    targetId: z.string().min(1, 'targetId required'),
    action: z.enum(['a', 'b']),
  });
  const v = validateArgs({ action: 'a' }, schema);
  assert.equal(v.valid, false);
  assert.equal(v.error.error.code, 'E_INVALID_PARAMS');
  assert.match(v.error.error.message, /targetId/);
});

test('validateArgs: 枚举不匹配', () => {
  const schema = z.object({ action: z.enum(['a', 'b']) });
  const v = validateArgs({ action: 'c' }, schema);
  assert.equal(v.valid, false);
  assert.match(v.error.error.message, /action/);
});

test('validateArgs: 空 args', () => {
  const schema = z.object({ x: z.string() });
  const v = validateArgs({}, schema);
  assert.equal(v.valid, false);
});

test('validateArgs: 多错误, 第一个为主', () => {
  const schema = z.object({ a: z.string(), b: z.number() });
  const v = validateArgs({}, schema);
  assert.equal(v.valid, false);
  assert.ok(Array.isArray(v.error.error.details.issues));
});

test('Common.targetId 缺值报错', () => {
  const v = validateArgs({}, z.object({ targetId: Common.targetId }));
  assert.equal(v.valid, false);
  assert.match(v.error.error.message, /targetId|Required/i);
});

test('Common.targetId 空字符串报错', () => {
  const v = validateArgs({ targetId: '' }, z.object({ targetId: Common.targetId }));
  assert.equal(v.valid, false);
});

test('E_CODES 包含所有标准码', () => {
  for (const code of Object.values(E_CODES)) {
    assert.ok(code, `E_CODES.${code} missing`);
  }
});

test('Common.url 接受合法 URL', () => {
  const v = validateArgs({ url: 'https://example.com' }, z.object({ url: Common.url }));
  assert.equal(v.valid, true);
});

test('Common.url 接受空字符串 (optional)', () => {
  const v = validateArgs({ url: '' }, z.object({ url: Common.url }));
  assert.equal(v.valid, true);
});

test('Common.url 拒绝非法 URL', () => {
  const v = validateArgs({ url: 'not a url' }, z.object({ url: Common.url }));
  assert.equal(v.valid, false);
});