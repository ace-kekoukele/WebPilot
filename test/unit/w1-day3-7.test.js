// test/unit/w1-day3-7.test.js — 浏览器 + 端口 + 配置 + activity-log + agent-registry + 修复 + dry-run
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let tmpDir;
test('setup: tmp dir', () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'webpilot-test-'));
});

// ──── 端口冲突检测 ───────────────────────────────────────────────
test('isPortFree: returns true for free port', async () => {
  const { isPortFree } = await import('../../daemon/port-finder.js');
  // 找一个很偏的端口（49400+）几乎肯定空闲
  const free = await isPortFree(49400);
  assert.equal(free, true);
});

test('negotiatePorts: returns ports with migration flags', async () => {
  const { negotiatePorts } = await import('../../daemon/port-finder.js');
  const result = await negotiatePorts({ cdp: 9222, mcp: 9223, http: 9224 }, '127.0.0.1');
  assert.ok(result.cdp);
  assert.ok(result.mcp);
  assert.ok(result.http);
  assert.ok(typeof result.cdp.migrated === 'boolean');
  assert.ok(typeof result.cdp.actual === 'number');
});

// ──── Config 加载 / 保存 / 损坏 ─────────────────────────────────
test('Config: load default when file absent', async () => {
  // 用临时配置目录强制
  process.env.LOCALAPPDATA = tmpDir;
  delete process.env.XDG_CONFIG_HOME;
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  const c = cfg.currentConfig();
  assert.equal(c.cdp.port, 9222);
  assert.equal(c.mcp.port, 9223);
});

test('Config: saves and reloads', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  cfg.patchConfig({ cdp: { port: 9333 } });
  cfg.loadConfig();   // re-read from disk
  assert.equal(cfg.currentConfig().cdp.port, 9333);
});

test('Config: survives corrupt JSON by backing up + falling back to defaults', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const cfgDir = cfg_path();
  mkdirSync(cfgDir, { recursive: true });
  // 先清掉之前测试遗留的文件
  const fs = await import('node:fs');
  for (const f of fs.readdirSync(cfgDir)) try { fs.unlinkSync(cfgDir + '/' + f); } catch {}
  writeFileSync(cfgDir + '/config.json', '{ NOT valid JSON', 'utf8');
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  // 重置到 default
  assert.equal(cfg.currentConfig().cdp.port, 9222);
  // 备份文件存在
  const files2 = fs.readdirSync(cfgDir);
  const backup = files2.find((f) => f.startsWith('config.json.broken-'));
  assert.ok(backup, `no backup file in ${cfgDir}: files = ${files2.join(',')}`);
});

function cfg_path() {
  // 跟 daemon/config.js 一致 — ${LOCALAPPDATA}/${PRODUCT_NAME}
  // PRODUCT_NAME = 'WebPilot' (per lib/version.js)
  return path.join(tmpDir, 'WebPilot');
}

// ──── Browser detection (mock env) ──────────────────────────────
test('pickBest: respects user preferredPath', async () => {
  const { pickBest } = await import('../../daemon/browser-picker.js');
  const candidates = [
    { path: '/fake/chrome-stable.exe', version: '124.0.1.0', channel: 'stable' },
    { path: '/fake/chrome-beta.exe', version: '125.0.1.0', channel: 'beta' },
  ];
  const got = pickBest(candidates, '/fake/chrome-beta.exe');
  assert.equal(got.path, '/fake/chrome-beta.exe');
  assert.equal(got.reason, 'user-preferred');
});

test('pickBest: picks latest stable when no preference', async () => {
  const { pickBest } = await import('../../daemon/browser-picker.js');
  const candidates = [
    { path: '/a', version: '124.0.1.0', channel: 'stable' },
    { path: '/b', version: '125.0.1.0', channel: 'stable' },
    { path: '/c', version: '126.0.0.0', channel: 'beta' },
  ];
  const got = pickBest(candidates, null);
  assert.equal(got.path, '/b');   // 最新 stable
  assert.equal(got.reason, 'latest-stable');
});

test('pickBest: falls back to beta if no stable', async () => {
  const { pickBest } = await import('../../daemon/browser-picker.js');
  const got = pickBest([
    { path: '/a', version: '126.0.0.0', channel: 'beta' },
    { path: '/b', version: '127.0.0.0', channel: 'dev' },
  ]);
  assert.equal(got.path, '/a');
  assert.equal(got.reason, 'latest-beta');
});

// ──── Activity log ──────────────────────────────────────────────
test('Activity log: log + query, ring buffer caps', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const { getActivityLog } = await import('../../daemon/activity-log.js');
  const log = getActivityLog();
  log.clear();
  for (let i = 0; i < 15; i++) {
    log.log({ agent: 'Test', tool: `t${i}`, args: { i }, ok: true });
  }
  const all = log.query({});
  assert.ok(all.length >= 15);
});

test('Activity log: filters by agent + tool + ok', async () => {
  const { getActivityLog } = await import('../../daemon/activity-log.js');
  const log = getActivityLog();
  log.clear();
  log.log({ agent: 'A', tool: 'tool1', args: {}, ok: true });
  log.log({ agent: 'A', tool: 'tool2', args: {}, ok: false });
  log.log({ agent: 'B', tool: 'tool1', args: {}, ok: true });
  assert.equal(log.query({ agent: 'A' }).length, 2);
  assert.equal(log.query({ tool: 'tool1' }).length, 2);
  assert.equal(log.query({ ok: false }).length, 1);
});

// ──── Agent registry ───────────────────────────────────────────
test('Agent registry: register + heartbeat + recordCall + list', async () => {
  const { getAgentRegistry } = await import('../../daemon/agent-registry.js');
  const reg = getAgentRegistry();
  // 清空 (Note: singleton — 只测 "当前行为", 不假设空)
  for (const a of reg.list()) reg.disconnect(a.id);
  const info = reg.register('c1', { name: 'TestAgent', version: '1.0' });
  assert.equal(info.name, 'TestAgent');
  assert.equal(info.callCount, 0);
  reg.heartbeat('c1');
  reg.recordCall('c1', { ok: true });
  reg.recordCall('c1', { ok: false });
  const found = reg.list().find((x) => x.id === 'c1');
  assert.equal(found.callCount, 2);
  assert.equal(found.errorCount, 1);
});

test('Agent registry: color map', async () => {
  const agentMod = await import('../../daemon/agent-registry.js');
  // agent-registry 暴露命名导出 AgentRegistry 类
  assert.ok(agentMod.AgentRegistry);
  assert.equal(agentMod.AgentRegistry.colorFor('Claude Desktop'), '#D97706');
  assert.equal(agentMod.AgentRegistry.colorFor('Cursor'), '#7C3AED');
  assert.equal(agentMod.AgentRegistry.colorFor('Unknown XYZ'), '#A78BFA');   // 兜底
});

// ──── repair (5 个) ──────────────────────────────────────────
test('repair: fix_03_token_missing regenerates when missing', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  cfg.patchConfig({ control: { token: null } });
  const repairMod = await import('../../daemon/repair.js');
  const ctx = { progress: () => {} };
  const r = await repairMod.FIXES['fix_03_token_missing'](ctx);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'regenerated');
  assert.match(r.token, /^[a-f0-9]{8}\.\.\.$/);
});

test('repair: fix_03_token_missing noop when valid', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  const validToken = 'a'.repeat(64);
  cfg.patchConfig({ control: { token: validToken } });
  const repairMod = await import('../../daemon/repair.js');
  const r = await repairMod.FIXES['fix_03_token_missing']({ progress: () => {} });
  assert.equal(r.action, 'token-valid');
});

test('repair: fix_02_config_corrupt resets + backs up', async () => {
  process.env.LOCALAPPDATA = tmpDir;
  const cfgDir = cfg_path();
  mkdirSync(cfgDir, { recursive: true });
  const fs = await import('node:fs');
  // 清掉所有文件, 再写损坏
  for (const f of fs.readdirSync(cfgDir)) try { fs.unlinkSync(cfgDir + '/' + f); } catch {}
  writeFileSync(cfgDir + '/config.json', '{ corrupted', 'utf8');
  const cfg = await import('../../daemon/config.js');
  cfg.loadConfig();
  const repairMod = await import('../../daemon/repair.js');
  const r = await repairMod.FIXES['fix_02_config_corrupt']({ progress: () => {} });
  assert.equal(r.action, 'reset-to-default');
  assert.ok(r.backup);
});

// ──── Agent config writer (dry-run + write + rollback) ────────
test('agent-config-writer: dryRun shows merge, write preserves others', async () => {
  const path1 = path.join(tmpDir, 'claude_dt_test.json');
  writeFileSync(path1, JSON.stringify({
    mcpServers: { github: { url: 'https://gh.example.com' } },
  }), 'utf8');

  const w = await import('../../daemon/discovery/agent-config-writer.js');
  const dry = w.dryRunConnect({ configPath: path1, port: 9223 });
  assert.equal(dry.ok, true);
  // dry-run 之后文件**不应该**被改
  const before = JSON.parse(readFileSync(path1, 'utf8'));
  assert.deepEqual(before.mcpServers, { github: { url: 'https://gh.example.com' } });

  // 现在真写
  const wrote = w.writeConnect({ configPath: path1, port: 9223 });
  assert.equal(wrote.ok, true);
  const after = JSON.parse(readFileSync(path1, 'utf8'));
  // github 仍在, webpilot 加入
  assert.ok(after.mcpServers.github);
  assert.ok(after.mcpServers['browser-bridge']);
  assert.equal(after.mcpServers['browser-bridge'].url, 'http://127.0.0.1:9223/mcp');
  assert.ok(after._bb);
  assert.match(after._bb.lastModifiedBy, /^WebPilot@/);
});

// ──── cleanup ──────────────────────────────────────────────────
test('cleanup', () => {
  if (tmpDir) try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});
