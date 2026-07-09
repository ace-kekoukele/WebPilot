// lib/zod-helper.js — zod schema 校验助手 + 统一错误格式
import { z } from 'zod';

// ──── 错误码常量 ──────────────────────────────────────────────────────
export const E_CODES = {
  INVALID_PARAMS: 'E_INVALID_PARAMS',
  DISABLED: 'E_DISABLED',
  NOT_CONNECTED: 'E_NOT_CONNECTED',
  TARGET_NOT_FOUND: 'E_TARGET_NOT_FOUND',
  TIMEOUT: 'E_TIMEOUT',
  CDP_GENERIC: 'E_CDP_GENERIC',
  CANCELLED: 'E_CANCELLED',
  INTERNAL: 'E_INTERNAL',
};

// ──── 标准错误返回格式 ─────────────────────────────────────────────
/**
 * 标准化工具错误返回。
 * 用法: return toolError(E_CODES.INVALID_PARAMS, 'targetId required', { received: args });
 */
export function toolError(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
}

/**
 * 标准化工具成功返回。
 */
export function toolOk(value, extra) {
  return {
    ok: true,
    value,
    ...(extra || {}),
  };
}

// ──── zod 校验 + 自动错误格式化 ───────────────────────────────────
/**
 * 把 zod schema 验证 args, 失败时返回标准 toolError。
 *
 * @param {object} args - 工具入参
 * @param {z.ZodObject} schema - zod schema
 * @returns {{ valid: boolean, data?: object, error?: object }}
 *
 * 用法:
 *   const v = validateArgs(args, z.object({
 *     targetId: z.string().min(1, 'targetId required'),
 *     action: z.enum(['list', 'get', 'set']),
 *   }));
 *   if (!v.valid) return v.error;
 */
export function validateArgs(args, schema) {
  const result = schema.safeParse(args || {});
  if (result.success) {
    return { valid: true, data: result.data };
  }
  // 收集第一个错误作为主信息, 其余作为 details
  const issues = result.error.issues || [];
  const first = issues[0];
  const path = (first?.path || []).join('.');
  const message = path ? `${path}: ${first.message}` : first?.message || 'invalid params';
  return {
    valid: false,
    error: toolError(E_CODES.INVALID_PARAMS, message, { issues }),
  };
}

// ──── 通用工具 schema 片段 ──────────────────────────────────────────
export const Common = {
  targetId: z.string().min(1, 'targetId required'),
  action: z.string().min(1, 'action required'),
  url: z.string().url().optional().or(z.literal('')),
};