// lib/tool-validation.js — 工具参数统一校验中间件
//
// 用法:
//   import { validateToolArgs } from '../lib/tool-validation.js';
//   const args = await validateToolArgs(params, {
//     url: { type: 'string', maxLen: 2048 },
//     selector: { type: 'string', maxLen: 512 },
//     timeout: { type: 'number', min: 0, max: 300000 },
//   });
//   if (!args.ok) return args;

export const LIMITS = {
  URL_MAX_LENGTH: 2048,
  SELECTOR_MAX_LENGTH: 512,
  EXPRESSION_MAX_LENGTH: 10000,
  ARGS_OBJECT_MAX_KEYS: 50,
  STRING_MAX_LENGTH: 10000,
};

/**
 * 校验工具参数
 * @param {object} args - 原始参数对象
 * @param {object} schema - 字段定义 { fieldName: { type, maxLen?, min?, max?, required? } }
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateToolArgs(args, schema) {
  // 防灌水：参数对象不能太大
  if (!args || typeof args !== 'object') {
    return { ok: false, error: '参数必须是对象' };
  }
  const keys = Object.keys(args);
  if (keys.length > LIMITS.ARGS_OBJECT_MAX_KEYS) {
    return { ok: false, error: `参数数量超过限制 (${LIMITS.ARGS_OBJECT_MAX_KEYS})` };
  }

  const data = {};

  for (const [field, def] of Object.entries(schema)) {
    const value = args[field];

    // required 检查
    if (def.required && (value === undefined || value === null || value === '')) {
      return { ok: false, error: `参数 ${field} 必填` };
    }
    if (value === undefined || value === null) {
      data[field] = value;
      continue;
    }

    // 类型检查
    if (def.type === 'string') {
      if (typeof value !== 'string') {
        return { ok: false, error: `参数 ${field} 必须是字符串` };
      }
      const maxLen = def.maxLen ?? LIMITS.STRING_MAX_LENGTH;
      if (value.length > maxLen) {
        return { ok: false, error: `参数 ${field} 长度超过限制 (${maxLen})` };
      }
      data[field] = value;
    } else if (def.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        return { ok: false, error: `参数 ${field} 必须是数字` };
      }
      if (def.min !== undefined && value < def.min) {
        return { ok: false, error: `参数 ${field} 不能小于 ${def.min}` };
      }
      if (def.max !== undefined && value > def.max) {
        return { ok: false, error: `参数 ${field} 不能大于 ${def.max}` };
      }
      data[field] = value;
    } else if (def.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return { ok: false, error: `参数 ${field} 必须是布尔值` };
      }
      data[field] = value;
    } else if (def.type === 'array') {
      if (!Array.isArray(value)) {
        return { ok: false, error: `参数 ${field} 必须是数组` };
      }
      data[field] = value;
    } else if (def.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, error: `参数 ${field} 必须是对象` };
      }
      data[field] = value;
    } else {
      data[field] = value;
    }
  }

  return { ok: true, data };
}

/**
 * 快捷: 校验 URL 参数
 */
export function validateUrl(url, fieldName = 'url') {
  if (!url || typeof url !== 'string') {
    return { ok: false, error: `参数 ${fieldName} 必填` };
  }
  if (url.length > LIMITS.URL_MAX_LENGTH) {
    return { ok: false, error: `${fieldName} 长度超过限制 (${LIMITS.URL_MAX_LENGTH})` };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: `${fieldName} 必须是 http:// 或 https:// URL` };
    }
  } catch {
    return { ok: false, error: `${fieldName} 格式无效` };
  }
  return { ok: true, url };
}

/**
 * 快捷: 校验选择器参数
 */
export function validateSelector(selector, fieldName = 'selector') {
  if (!selector || typeof selector !== 'string') {
    return { ok: false, error: `参数 ${fieldName} 必填` };
  }
  if (selector.length > LIMITS.SELECTOR_MAX_LENGTH) {
    return { ok: false, error: `${fieldName} 长度超过限制 (${LIMITS.SELECTOR_MAX_LENGTH})` };
  }
  return { ok: true, selector };
}
