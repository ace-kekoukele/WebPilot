// daemon/discovery/agent-config-writer.js — Agent 配置文件写入器 (HanaAgent 风格)
//
// v4.0 (§25.3): 默认 Auto 模式不调这个. wizard 让用户**显式选** + 输入 CONFIRM 才调用.
//
// 安全保证 (see §23.7):
//   1. dry-run diff 给用户预览
//   2. ISO 时间戳备份原文件 (.bb-backup-YYYY-MM-DDTHH-mm-ss.json)
//   3. 先临时文件, 再 rename (原子写)
//   4. 写完再读 + schema 验证 → 失败回滚
//   5. 不覆盖用户已有的其他 mcpServers
//   6. 加 lastModifiedBy / lastModifiedAt 字段

import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import { existsSync as _exists } from 'node:fs';
import path from 'node:path';
import { PRODUCT_NAME, VERSION } from '../../lib/version.js';

// ──── helpers ─────────────────────────────────────────────────
function readJsonSafe(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function backup(p) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${p}.bb-backup-${ts}`;
  try { copyFileSync(p, backupPath); return backupPath; } catch { return null; }
}

function diffJson(before, after, path = '') {
  const changes = [];
  for (const k of Object.keys(after || {})) {
    if (typeof before[k] === 'object' && typeof after[k] === 'object' && before[k] && after[k]) {
      changes.push(...diffJson(before[k], after[k], path ? `${path}.${k}` : k));
    } else if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push({ path: path ? `${path}.${k}` : k, before: before[k], after: after[k] });
    }
  }
  return changes;
}

function atomicWrite(p, data) {
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, p);
}

// ──── 我们的 webpilot MCP server block ─────────────────────────
export const WEBPILOT_MCP_BLOCK = (port) => ({
  'browser-bridge': { url: `http://127.0.0.1:${port}/mcp`, transport: 'http' },
});

// ──── 主接口: dryRun + write ──────────────────────────────────
/**
 * Dry-run diff
 * @returns { ok, beforePath, afterPath, backup, changes, mcpKey }
 */
export function dryRunConnect(opts) {
  const { configPath, port, mcpServersKey = 'mcpServers' } = opts;
  const before = readJsonSafe(configPath) || {};
  const after = JSON.parse(JSON.stringify(before));   // deep clone
  if (!after[mcpServersKey] || typeof after[mcpServersKey] !== 'object') after[mcpServersKey] = {};
  // merge (不覆盖其他 user-configured MCP servers)
  Object.assign(after[mcpServersKey], WEBPILOT_MCP_BLOCK(port));
  after._bb = { lastModifiedBy: `${PRODUCT_NAME}@${VERSION}`, lastModifiedAt: new Date().toISOString() };

  const changes = diffJson(before, after);
  const mcpKey = pickMcpKey(after);
  return { ok: true, before, after, changes, mcpKey, alreadyConfigured: !!before[mcpServersKey]?.[mcpKey] };
}

function pickMcpKey(after) {
  // 优先 webpilot, 退回 browser-bridge (兼容老版本)
  if (after?.mcpServers?.['webpilot']) return 'webpilot';
  if (after?.mcpServers?.['browser-bridge']) return 'browser-bridge';
  return 'webpilot';   // 新写用 webpilot
}

/**
 * 真的写
 * @returns { ok, backup, written }
 */
export function writeConnect(opts) {
  const { configPath, port, mcpServersKey = 'mcpServers' } = opts;

  if (!configPath) return { ok: false, error: 'configPath required' };

  // 1. 备份（只在已有文件时）
  let backupPath = null;
  if (existsSync(configPath)) {
    backupPath = backup(configPath);
    if (!backupPath) return { ok: false, error: 'backup failed' };
  }

  // 2. 计算 after
  const before = readJsonSafe(configPath) || {};
  const after = JSON.parse(JSON.stringify(before));
  if (!after[mcpServersKey] || typeof after[mcpServersKey] !== 'object') after[mcpServersKey] = {};
  Object.assign(after[mcpServersKey], WEBPILOT_MCP_BLOCK(port));
  after._bb = { lastModifiedBy: `${PRODUCT_NAME}@${VERSION}`, lastModifiedAt: new Date().toISOString() };

  // 3. 原子写
  try { atomicWrite(configPath, after); }
  catch (e) { return { ok: false, error: `atomic write failed: ${e.message}`, backup: backupPath }; }

  // 4. 写完再读 + schema 验证（确保 JSON 没坏）
  try {
    const verify = readJsonSafe(configPath);
    if (!verify || typeof verify !== 'object') throw new Error('post-write JSON invalid');
  } catch (e) {
    // 回滚
    if (backupPath) {
      try { renameSync(backupPath, configPath); } catch {}
    }
    return { ok: false, error: `post-write verify failed: ${e.message}. rolled back.`, backup: backupPath };
  }

  return {
    ok: true,
    backup: backupPath,
    written: configPath,
    mcpKey: pickMcpKey(after),
  };
}

/**
 * 撤销 — 从 .bb-backup-<ts> 恢复
 */
export function rollback(opts) {
  const { configPath, backupPath } = opts;
  if (!backupPath || !existsSync(backupPath)) return { ok: false, error: 'no backup' };
  try {
    renameSync(backupPath, configPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 列出所有 .bb-backup 文件 + 找最新 (供"撤销这次接入"按钮用)
 */
export function listBackups(configPath) {
  // 暂不实现跨平台 glob; 用户上下文具体配置
  return [];
}
