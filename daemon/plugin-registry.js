// daemon/plugin-registry.js — 插件注册表，按需加载功能子集
//
// PLUGIN_REGISTRY 定义插件名 → 工具列表的映射
// userConfig.enabled 定义加载哪些插件
//
// 用法:
//   import { loadPlugin, isPluginLoaded, listPlugins } from './plugin-registry.js';
//   loadPlugin('core-browser');          // 加载 core-browser 插件
//   isPluginLoaded('core-network');    // 检查是否已加载
//   listPlugins();                      // 返回所有可用插件

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// ──── 插件定义 ────────────────────────────────────────────────────────────────
export const PLUGIN_REGISTRY = {
  // 核心浏览器控制（最常用）
  'core-browser': [
    'browser_navigate', 'browser_click', 'browser_type', 'browser_input',
    'browser_go_back', 'browser_go_forward', 'browser_reload', 'browser_close',
  ],

  // 网络相关
  'core-network': [
    'browser_network', 'browser_fetch', 'browser_websocket',
  ],

  // 截图 / DOM 快照
  'core-capture': [
    'browser_screenshot', 'browser_dom_snapshot', 'browser_screencast',
  ],

  // 调试（Debugger / Tracing）
  'advanced-debug': [
    'browser_debugger', 'browser_tracing', 'browser_heap_snapshot',
  ],

  // 审计 / API 提取
  'advanced-audit': [
    'browser_audit_full', 'browser_extract_apis',
  ],

  // 存储 / Cookie
  'advanced-storage': [
    'browser_storage', 'browser_cookies_get', 'browser_cookies_set', 'browser_cookies_delete',
  ],

  // 性能监控
  'advanced-performance': [
    'browser_performance_metrics',
  ],

  // 目标管理
  'core-targets': [
    'browser_list_targets', 'browser_create_target', 'browser_close_target', 'browser_activate_target',
  ],

  // 录制器
  'advanced-recorder': [
    'browser_recorder_start', 'browser_recorder_stop',
  ],

  // 实验性
  'experimental': [
    'browser_cdp_command',
  ],
};

// 默认加载的插件（core 全开，advanced/experimental 按需）
export const DEFAULT_PLUGINS = [
  'core-browser',
  'core-network',
  'core-capture',
  'core-targets',
  'advanced-performance',
  'advanced-storage',
  'advanced-recorder',
  'advanced-debug',
  'advanced-audit',
  'experimental',
];

// ──── 已加载插件状态 ──────────────────────────────────────────────────────────
const _loadedPlugins = new Set();
const _loadedTools = new Set();

// ──── 加载单个插件 ───────────────────────────────────────────────────────────
export function loadPlugin(pluginName) {
  const tools = PLUGIN_REGISTRY[pluginName];
  if (!tools) {
    throw new Error(`Unknown plugin: ${pluginName}. Available: ${Object.keys(PLUGIN_REGISTRY).join(', ')}`);
  }
  if (_loadedPlugins.has(pluginName)) return; // 幂等

  for (const tool of tools) {
    _loadedTools.add(tool);
  }
  _loadedPlugins.add(pluginName);
  console.log(`[plugin] loaded ${pluginName} (${tools.length} tools)`);
}

// ──── 批量加载 ──────────────────────────────────────────────────────────────
export function loadPlugins(pluginNames = DEFAULT_PLUGINS) {
  for (const name of pluginNames) {
    loadPlugin(name);
  }
}

// ──── 查询 API ───────────────────────────────────────────────────────────────
export function isPluginLoaded(pluginName) {
  return _loadedPlugins.has(pluginName);
}

export function isToolLoaded(toolName) {
  return _loadedTools.has(toolName);
}

export function listPlugins() {
  return {
    available: Object.keys(PLUGIN_REGISTRY),
    loaded: Array.from(_loadedPlugins),
    tools: {
      loaded: Array.from(_loadedTools),
      total: Object.values(PLUGIN_REGISTRY).flat().length,
    },
  };
}

export function getToolsByPlugin(pluginName) {
  return PLUGIN_REGISTRY[pluginName] || [];
}

// ──── 从 tools/ 目录验证工具文件是否存在 ──────────────────────────────────────
export function validatePlugins() {
  const toolsDir = path.join(process.cwd(), 'tools');
  const results = {};

  for (const [plugin, tools] of Object.entries(PLUGIN_REGISTRY)) {
    const missing = [];
    for (const tool of tools) {
      const filePath = path.join(toolsDir, `${tool}.js`);
      if (!existsSync(filePath)) {
        missing.push(tool);
      }
    }
    results[plugin] = {
      total: tools.length,
      missing,
      ok: missing.length === 0,
    };
  }
  return results;
}

// ──── 热重载插件配置（从磁盘重读） ───────────────────────────────────────────
export function reloadPlugins(config) {
  if (!config || !Array.isArray(config.enabled)) {
    throw new Error('reloadPlugins expects { enabled: string[] }');
  }
  _loadedPlugins.clear();
  _loadedTools.clear();
  loadPlugins(config.enabled);
  return listPlugins();
}
