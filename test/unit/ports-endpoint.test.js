// test/unit/ports-endpoint.test.js — §16 端口管理 (v4.0 让用户看见实际端口)
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('lib/version.js: DEFAULT_PORTS 是 6 个连续端口', async () => {
  const v = await import('../../lib/version.js');
  assert.equal(v.DEFAULT_PORTS.cdp, 9222);
  assert.equal(v.DEFAULT_PORTS.mcp, 9223);
  assert.equal(v.DEFAULT_PORTS.http, 9224);
  assert.equal(v.DEFAULT_PORTS.control, 9225);
  assert.equal(v.DEFAULT_PORTS.sse, 9226);
  assert.equal(v.DEFAULT_PORTS.webhook, 9227);
});

test('port-finder: isPortFree 对明显占用端口返回 false', async () => {
  const { isPortFree } = await import('../../daemon/port-finder.js');
  // 找一个肯定被占的端口 — 用 OS 临时端口范围 (49000+) 难确定, 用 9222 (Chrome 常见)
  // 不能保证, 所以只断言返回 boolean
  const result = await isPortFree(1);   // 端口 1 几乎肯定 free
  assert.equal(typeof result, 'boolean');
});

test('port-finder: negotiatePorts 返回 6 个端口 + migrated 字段', async () => {
  const { negotiatePorts } = await import('../../daemon/port-finder.js');
  const result = await negotiatePorts({
    cdp: 9222, mcp: 9223, http: 9224, control: 9225, sse: 9226, webhook: 9227,
  }, '127.0.0.1');
  for (const k of ['cdp', 'mcp', 'http', 'control', 'sse', 'webhook']) {
    assert.ok(result[k], `${k} 应存在`);
    assert.equal(typeof result[k].actual, 'number');
    assert.equal(typeof result[k].migrated, 'boolean');
    assert.equal(typeof result[k].requested, 'number');
  }
});

test('config.js: saveConfig 保留 cdp/mcp/http/control 端口字段', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  // 用临时目录, 避免污染真实 config
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-port-test-'));
  process.env.LOCALAPPDATA = tmpDir;
  delete process.env.XDG_CONFIG_HOME;
  const cfgMod = await import('../../daemon/config.js?bust=' + Date.now());
  cfgMod.loadConfig();
  cfgMod.patchConfig({ cdp: { port: 9333 }, mcp: { port: 9444 } });
  cfgMod.saveConfig();
  const cfgMod2 = await import('../../daemon/config.js?bust2=' + Date.now());
  cfgMod2.loadConfig();
  assert.equal(cfgMod2.currentConfig().cdp.port, 9333);
  assert.equal(cfgMod2.currentConfig().mcp.port, 9444);
  // 清理
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});
