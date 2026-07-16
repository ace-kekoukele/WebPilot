# WebPilot v4.0 全面修改建议报告

> 本报告共计约十万字，系统性地分析 WebPilot v4.0.4 项目在架构、代码质量、安全、测试、文档、GUI 等各个维度的问题，并提供详尽的修改方案与代码示例。

---

## 第一部分：项目整体评估与问题诊断

### 一、项目定位与现状

WebPilot 是一个 Chrome DevTools Protocol（CDP）桥接工具，旨在让 AI 助手（如 Claude Desktop、Cursor、Windsurf 等）能够直接操控用户本地的 Chrome 浏览器。项目的核心价值在于：用户无需打开额外的浏览器实例，AI 助手可以直接使用用户已登录的浏览器会话进行操作。

经过对项目代码的全面分析，我发现项目存在一个显著的结构性问题：**文档声明的功能数量与实际可用的功能数量之间存在较大差距**。README 声称提供 79 个 MCP 工具，支持 16 家 LLM 厂商，但经过代码审查发现，其中相当一部分工具仅有空壳实现，或存在依赖已删除模块的遗留代码。这种"功能先行、文档后补"的模式在快速迭代的项目中较为常见，但已经对用户体验造成了实质性的负面影响。

### 二、核心问题分类

通过系统性的代码审查，我将项目存在的问题归纳为以下几个类别：

**第一类是完全空壳问题**。这类工具在 tools/ 目录下存在对应的 JavaScript 文件，参数定义完整，代码结构看似合理，但实际执行逻辑要么完全缺失，要么引用了不存在的模块或函数。例如，`browser_websocket.js` 声称提供 WebSocket 消息捕获功能，但代码中 `_buffers` 变量永远不会被填充，事件监听逻辑完全缺失。

**第二类是依赖断裂问题**。在 v4.0.2 版本进行代码整合时，项目删除了 `lib/cdp-manager.js` 兼容层，将 68 个工具文件的 import 路径迁移到 `lib/cdp/index.js`。然而，这一迁移工作并不彻底，部分工具文件仍然保留了指向已删除模块的注释或引用，导致功能无法正常运行。

**第三类是部分实现问题**。这类工具的基础功能可以工作，但高级特性或边缘情况处理存在缺陷。例如，`browser_tracing.js` 的 trace 导出功能引用了不存在的 `on` 和 `off` 函数；`browser_screencast.js` 启动了屏幕录制但没有处理帧数据的接收和写入。

**第四类是文档与实现脱节问题**。README 和 CHANGELOG 中描述的部分功能在代码中找不到对应的实现，而代码中实现的功能可能没有在文档中得到充分说明。这种信息不对称会导致用户和开发者对项目能力的误判。

### 三、问题严重程度分级

为了便于后续修复工作的优先级排序，我将所有发现的问题按照严重程度分为四个级别：

**P0（紧急）** 是指核心功能完全不可用，或存在安全隐患的问题。这类问题直接影响项目的基本可用性，必须立即修复。

**P1（高优先级）** 是指重要功能存在明显缺陷，或存在依赖断裂导致功能无法工作的问题。这类问题影响用户的核心使用场景，应当尽快修复。

**P2（中优先级）** 是指功能可以基本工作但实现不够完善，或存在边缘情况未处理的问题。这类问题不影响基本使用，但会影响用户体验和专业口碑。

**P3（低优先级）** 是指代码质量、文档完善度、测试覆盖等方面的改进建议。这类问题不会影响当前功能，但对项目的长期维护和发展具有重要意义。

---

## 第二部分：架构层面修改建议

### 一、现有架构分析

WebPilot v4.0 采用的是单进程 Daemon 架构，这一设计决策在项目早期是合理的，因为它简化了部署和调试。但随着项目规模扩大和功能增加，这一架构开始显现出一些局限性。

当前架构的核心组件包括：`daemon/main.js` 作为唯一入口，负责启动顺序编排；`lib/cdp/` 目录下的模块负责 CDP 协议的封装；`tools/` 目录下的 73 个文件作为 MCP 工具；`lib/mcp-server.js` 和 `lib/http-api.js` 分别提供 MCP 和 HTTP 两种接入方式；`electron/renderer/` 目录下的 React 应用提供桌面 GUI。

在连接管理层面，项目使用 `lib/cdp/connection.js` 中的 `ensureBridge()` 函数来建立与 Chrome 的连接，使用 `lib/cdp/transport.js` 中的 bucket routing 机制来路由 CDP 响应。事件监听通过 `lib/cdp/transport.js` 中的 `on`/`off`/`emit` 函数实现。

在工具加载层面，`lib/tool-loader.js` 负责扫描 tools/ 目录并加载所有工具模块，每个工具的 `execute` 函数是实际的执行入口。

### 二、架构优化建议

#### 2.1 建立工具功能状态追踪系统

当前项目最大的问题是缺乏对工具实际功能状态的追踪。我建议建立一个工具清单系统，记录每个工具的：功能完整性评级（完整实现/部分实现/空壳/待开发）；依赖关系（依赖哪些 lib 模块）；已知问题列表；最后测试时间；维护责任人。

这个清单应该是一个 JSON 文件，存放在项目根目录，例如 `TOOL_STATUS.json`。文件结构如下：

```json
{
  "browser_websocket": {
    "status": "broken",
    "severity": "P0",
    "reason": "依赖已删除的 cdp-manager 模块，_buffers 永远不会被填充",
    "fix": "需要在 transport.js 中添加 WebSocketFrameReceived 事件监听",
    "testable": false,
    "lastReviewed": "2026-07-09"
  },
  "browser_audit_full": {
    "status": "partial",
    "severity": "P1",
    "reason": "基础 metrics 可以获取，但 Audit.getAudits 增强功能未实现",
    "fix": "添加对 Chrome 150 Audits 域的完整支持",
    "testable": true,
    "lastReviewed": "2026-07-09"
  }
}
```

#### 2.2 重构工具薄壳模式

当前的"薄壳模式"要求每个工具文件不超过 80 行，复杂逻辑下沉到 `lib/cdp/` 目录。这一设计的初衰是好的，但在实践中导致了两个问题：一是部分工具的"壳"太薄，几乎只有参数验证和函数调用；二是 `lib/cdp/` 目录下的模块承担了过多职责，边界不够清晰。

我建议将工具分为三类：**基础工具**（直接封装单个 CDP 调用）、**组合工具**（组合多个 CDP 调用实现业务逻辑）、**分析工具**（在 CDP 基础上添加数据处理逻辑）。对于每类工具，应该有不同的代码组织要求和测试要求。

#### 2.3 引入插件机制

当前 79 个工具全部内置在 tools/ 目录中，这种设计导致工具数量持续膨胀但质量参差不齐。我建议引入插件机制，允许用户按需加载功能子集：

```javascript
// 插件注册表
const PLUGIN_REGISTRY = {
  'core-browser': ['browser_navigate', 'browser_click', 'browser_type', ...],
  'core-network': ['browser_network', 'browser_intercept', ...],
  'advanced-debug': ['browser_debugger', 'browser_tracing', ...],
  'experimental': ['browser_websocket', 'browser_extract_apis', ...]
};

// 用户配置
const userPlugins = {
  enabled: ['core-browser', 'core-network'],
  experimental: ['browser_extract_apis']
};
```

这样用户可以根据自己的使用场景选择加载哪些工具，减少不必要的依赖和复杂性。

### 三、核心模块重构建议

#### 3.1 修复 lib/cdp/transport.js 的事件系统

当前 `lib/cdp/transport.js` 的 `on`/`off`/`emit` 函数是全局事件系统，但部分工具（如 `browser_fetch.js`）错误地期望它支持按 session 分发事件。这导致了一个设计缺陷：当多个页面 tab 同时运行时，无法区分事件来自哪个 tab。

我建议重构事件系统，增加 session-aware 的事件分发机制：

```javascript
// 增强后的事件系统
class EventBus {
  constructor() {
    this._globalListeners = new Map();
    this._sessionListeners = new Map();
  }
  
  // 全局事件监听（所有 session 共享）
  onGlobal(eventName, callback) {
    return this._addListener(this._globalListeners, eventName, callback);
  }
  
  // 按 session 的事件监听
  onSession(sessionId, eventName, callback) {
    const key = `${sessionId}:${eventName}`;
    return this._addListener(this._sessionListeners, key, callback);
  }
  
  emit(eventName, params, sessionId) {
    // 触发全局监听器
    const globalCbs = this._globalListeners.get(eventName);
    if (globalCbs) {
      for (const cb of globalCbs) {
        try { cb(params, sessionId); } catch (e) { console.error(e); }
      }
    }
    
    // 触发 session 监听器
    if (sessionId) {
      const key = `${sessionId}:${eventName}`;
      const sessionCbs = this._sessionListeners.get(key);
      if (sessionCbs) {
        for (const cb of sessionCbs) {
          try { cb(params); } catch (e) { console.error(e); }
        }
      }
    }
  }
}
```

#### 3.2 增强 lib/cdp/send.js 的错误处理

当前 `sendCommand` 和 `sendPageCommand` 函数的错误处理较为简单，对于网络异常、超时、CDP 协议错误等情况的处理不够细致。我建议增加详细的错误分类和重试机制：

```javascript
// 错误分类
const CDP_ERROR_CODES = {
  E_NOT_CONNECTED: 'bridge_not_connected',
  E_SESSION_CLOSED: 'page_session_closed',
  E_TIMEOUT: 'command_timeout',
  E_PROTOCOL_ERROR: 'cdp_protocol_error',
  E_INVALID_TARGET: 'invalid_target_id'
};

class CDPError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.retryable = ['E_TIMEOUT', 'E_NOT_CONNECTED'].includes(code);
  }
}

// 增强的 sendCommand 带重试
async function sendCommandWithRetry(method, params = {}, targetId, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendCommand(method, params, targetId, options.timeout);
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      console.warn(`Retrying ${method} (attempt ${attempt}/${maxRetries})...`);
      await sleep(retryDelay * attempt);
    }
  }
}
```

---

## 第三部分：工具逐个分析与修复方案

### 一、完全空壳类工具修复

#### 1.1 browser_websocket.js 修复方案

**问题诊断**：当前实现完全没有事件监听逻辑，`_buffers` 永远为空。注释中提到的 `cdp-manager` 模块已在 v4.0.2 删除。

**修复方案**：需要利用 transport.js 中的全局事件系统来监听 WebSocketFrameReceived、WebSocketFrameSent、WebSocketCreated 等事件。

```javascript
// tools/browser_websocket.js - 完整重写
import { sendPageCommand, sendCommand, evaluate } from '../lib/cdp/index.js';
import { on, off, getSessionMap } from '../lib/cdp/transport.js';

const _buffers = new Map();
let _handlersInstalled = new Set();

export const name = 'browser_websocket';
export const description = 'WebSocket 消息捕获: 监听/列表/清除 (v4.0 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'listen/stop/list/clear' },
  limit: { type: 'number', description: '最多返回消息数，默认 100' },
};

// 安装全局 WebSocket 事件监听器（只需要安装一次）
function installWebSocketHandlers(targetId) {
  if (_handlersInstalled.has(targetId)) return;
  
  // Network.webSocketFrameReceived
  const handlerReceived = (params, sessionId) => {
    if (sessionId !== targetId) return;
    const buf = getBuffer(targetId);
    buf.push({
      type: 'received',
      timestamp: params.timestamp || Date.now(),
      opcode: params.response?.opcode,
      mask: params.response?.mask,
      data: params.response?.payloadData,
      requestId: params.requestId,
    });
  };
  
  // Network.webSocketFrameSent
  const handlerSent = (params, sessionId) => {
    if (sessionId !== targetId) return;
    const buf = getBuffer(targetId);
    buf.push({
      type: 'sent',
      timestamp: params.timestamp || Date.now(),
      opcode: params.response?.opcode,
      mask: params.response?.mask,
      data: params.response?.payloadData,
      requestId: params.requestId,
    });
  };
  
  // Network.webSocketFrameError
  const handlerError = (params, sessionId) => {
    if (sessionId !== targetId) return;
    const buf = getBuffer(targetId);
    buf.push({
      type: 'error',
      timestamp: Date.now(),
      requestId: params.requestId,
      errorMessage: params.errorMessage,
    });
  };
  
  on('Network.webSocketFrameReceived', handlerReceived);
  on('Network.webSocketFrameSent', handlerSent);
  on('Network.webSocketFrameError', handlerError);
  
  _handlersInstalled.add(targetId);
}

function getBuffer(targetId) {
  if (!_buffers.has(targetId)) {
    _buffers.set(targetId, []);
  }
  return _buffers.get(targetId);
}

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    
    // 启用 Network 域
    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
    
    if (args.action === 'listen') {
      installWebSocketHandlers(args.targetId);
      return { ok: true, listening: true, targetId: args.targetId };
    }
    
    if (args.action === 'stop') {
      // 移除监听器
      _handlersInstalled.delete(args.targetId);
      return { ok: true, listening: false };
    }
    
    if (args.action === 'clear') {
      _buffers.set(args.targetId, []);
      return { ok: true, cleared: true };
    }
    
    if (args.action === 'list' || !args.action) {
      const limit = args.limit || 100;
      const buf = getBuffer(args.targetId);
      const messages = buf.slice(-limit);
      
      // 聚合统计
      const stats = {
        total: buf.length,
        received: buf.filter(m => m.type === 'received').length,
        sent: buf.filter(m => m.type === 'sent').length,
        errors: buf.filter(m => m.type === 'error').length,
      };
      
      return { 
        ok: true, 
        count: messages.length,
        total: buf.length,
        stats,
        messages 
      };
    }
    
    return { ok: false, error: 'action: listen/stop/list/clear' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

#### 1.2 browser_tracing.js 修复方案

**问题诊断**：当前实现引用了不存在的 `on` 和 `off` 函数（应该是 `getEventListeners` 和 `removeEventListener` 的误用）。

**修复方案**：重写 trace 收集逻辑，使用正确的 transport.js API。

```javascript
// tools/browser_tracing.js - 完整重写
import { sendCommand } from '../lib/cdp/index.js';
import { on, off } from '../lib/cdp/transport.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

let _traceData = [];
let _traceFile = null;
let _currentCategories = [];

export const name = 'browser_tracing';
export const description = 'Performance trace: 启动/停止/导出 (v4.0 修复版)';
export const parameters = {
  action: { type: 'string', description: 'start/stop/status' },
  categories: { type: 'string', description: '逗号分隔的 trace 类别' },
  traceFile: { type: 'string', description: '导出文件路径 (stop 时)' },
  format: { type: 'string', description: 'json/chrome-json (默认 json)' },
};

const DEFAULT_CATEGORIES = [
  '-disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'v8.execute',
  'blink.user_timing',
  'netlog',
  'benchmark'
];

const _handlersInstalled = new Set();

// Trace 事件处理器
function handleTraceData(params) {
  if (params.value && Array.isArray(params.value)) {
    // Chrome JSON 格式
    _traceData.push(...params.value);
  } else {
    // 单个事件
    _traceData.push(params);
  }
}

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (start/stop/status)' };

    if (args.action === 'start') {
      // 清空之前的数据
      _traceData = [];
      
      // 解析类别
      const categories = args.categories 
        ? args.categories.split(',').map(c => c.trim())
        : DEFAULT_CATEGORIES;
      _currentCategories = categories;
      
      // 设置文件路径
      _traceFile = args.traceFile || null;
      if (_traceFile) {
        const dir = _traceFile.substring(0, _traceFile.lastIndexOf('/') || _traceFile.lastIndexOf('\\'));
        if (dir && !existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }
      
      // 启用 Network 域（需要先启用才能捕获网络事件）
      try {
        await sendCommand('Network.enable', {}, null, 2000);
      } catch {}
      
      // 注册事件处理器
      const handlerId = `trace-${Date.now()}`;
      _handlersInstalled.add(handlerId);
      on('Tracing.dataCollected', handleTraceData);
      
      // 启动 tracing
      const r = await sendCommand('Tracing.start', {
        traceConfig: {
          includedCategories: categories,
          excludedCategories: [],
          recordMode: 'recordUntilFull',
          enableSystrace: true,
        },
      }, 5000);
      
      return { 
        ok: true, 
        started: true, 
        categories,
        traceFile: _traceFile,
        handlerId
      };
    }

    if (args.action === 'stop') {
      // 停止 tracing
      await sendCommand('Tracing.end', {}, 10000);
      
      // 等待数据收集完成
      await new Promise(r => setTimeout(r, 2000));
      
      // 移除事件处理器
      off('Tracing.dataCollected', handleTraceData);
      
      // 准备结果
      const result = {
        ok: true,
        eventCount: _traceData.length,
        categories: _currentCategories,
      };
      
      // 如果指定了文件，写入
      const outputFile = args.traceFile || _traceFile;
      if (outputFile) {
        const format = args.format || 'json';
        if (format === 'json') {
          writeFileSync(outputFile, JSON.stringify({
            traceEvents: _traceData,
            metadata: {
              version: 'WebPilot v4.0',
              timestamp: new Date().toISOString(),
              categoryCount: _currentCategories.length,
            }
          }, null, 2));
          result.file = outputFile;
        } else if (format === 'chrome-json') {
          // Chrome DevTools 格式
          writeFileSync(outputFile, JSON.stringify(_traceData));
          result.file = outputFile;
        }
      } else {
        // 返回摘要（避免返回大量数据）
        result.sample = _traceData.slice(0, 10);
        result.truncated = _traceData.length > 10;
      }
      
      // 清空数据
      _traceData = [];
      _currentCategories = [];
      _traceFile = null;
      
      return result;
    }

    if (args.action === 'status') {
      return { 
        ok: true, 
        active: _traceData.length > 0 || _handlersInstalled.size > 0,
        eventCount: _traceData.length,
        categories: _currentCategories,
        file: _traceFile
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    // 确保清理
    off('Tracing.dataCollected', handleTraceData);
    _traceData = [];
    return { ok: false, error: err.message };
  }
}
```

#### 1.3 browser_screencast.js 修复方案

**问题诊断**：当前实现启动了 Page.startScreencast 但没有处理 Page.screencastFrame 事件来接收帧数据。

**修复方案**：添加事件监听器来接收和处理帧数据。

```javascript
// tools/browser_screencast.js - 完整重写
import { sendPageCommand } from '../lib/cdp/index.js';
import { on, off } from '../lib/cdp/transport.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

let _running = false;
let _outputDir = null;
let _frameCount = 0;
let _activeHandlers = [];

export const name = 'browser_screencast';
export const description = 'Page screencast: 启动/停止/状态 (v4.0 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'start/stop/status' },
  outputDir: { type: 'string', description: '输出目录' },
  format: { type: 'string', description: 'jpeg/png (默认 jpeg)' },
  quality: { type: 'number', description: '质量 0-100 (默认 80)' },
  everyNthFrame: { type: 'number', description: '每 N 帧取 1 (默认 1)' },
};

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function execute(args) {
  try {
    if (args.action === 'start') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      if (!args.outputDir) return { ok: false, error: 'outputDir required' };
      
      ensureDir(args.outputDir);
      _outputDir = args.outputDir;
      _frameCount = 0;
      _running = true;
      
      // 启用 Page 域
      await sendPageCommand(args.targetId, 'Page.enable', {}, 3000).catch(() => {});
      
      // 注册帧处理函数
      const frameHandler = (params, sessionId) => {
        if (sessionId !== args.targetId) return;
        if (!_running) return;
        
        const { data, metadata } = params;
        if (!data) return;
        
        // 解码 base64 帧数据
        const buffer = Buffer.from(data, 'base64');
        const filename = `frame_${String(_frameCount).padStart(6, '0')}.${args.format || 'jpeg'}`;
        const filepath = path.join(_outputDir, filename);
        
        writeFileSync(filepath, buffer);
        _frameCount++;
        
        // 记录 metadata
        if (metadata) {
          const metaFile = path.join(_outputDir, 'metadata.json');
          const meta = existsSync(metaFile) 
            ? JSON.parse(readFileSync(metaFile, 'utf8'))
            : { frames: [] };
          meta.frames.push({
            filename,
            timestamp: metadata.timestamp,
            duration: metadata.duration,
            sequenceNumber: metadata.sequenceNumber,
          });
          writeFileSync(metaFile, JSON.stringify(meta, null, 2));
        }
      };
      
      on('Page.screencastFrame', frameHandler);
      _activeHandlers.push({ event: 'Page.screencastFrame', handler: frameHandler });
      
      // 启动录屏
      await sendPageCommand(args.targetId, 'Page.startScreencast', {
        format: args.format || 'jpeg',
        quality: args.quality || 80,
        everyNthFrame: args.everyNthFrame || 1,
        maxWidth: 1920,
        maxHeight: 1080,
      }, 5000);
      
      return { 
        ok: true, 
        outputDir: _outputDir, 
        format: args.format || 'jpeg',
        quality: args.quality || 80,
        listening: true
      };
    }
    
    if (args.action === 'stop') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      
      _running = false;
      
      // 移除事件处理器
      for (const { event, handler } of _activeHandlers) {
        off(event, handler);
      }
      _activeHandlers = [];
      
      // 停止录屏
      await sendPageCommand(args.targetId, 'Page.stopScreencast', {}, 5000).catch(() => {});
      
      const result = { 
        ok: true, 
        frameCount: _frameCount, 
        outputDir: _outputDir 
      };
      
      // 重置状态
      const fc = _frameCount;
      _frameCount = 0;
      _outputDir = null;
      
      return result;
    }
    
    if (args.action === 'status') {
      return { 
        ok: true, 
        running: _running, 
        frameCount: _frameCount, 
        outputDir: _outputDir,
        handlersActive: _activeHandlers.length
      };
    }
    
    return { ok: false, error: 'action: start/stop/status' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 二、部分实现类工具完善

#### 2.1 browser_fetch.js 增强方案

**问题诊断**：当前实现的事件处理逻辑存在缺陷，`on` 函数返回的 `off` 卸载函数使用方式不正确（因为 `on` 返回的是 Set.delete，而不是一个可以被调用的函数）。

```javascript
// 当前错误代码：
const off = on('Fetch.requestPaused', async (params, sessionId) => {
  // ...
});
// ...
off(); // 这里会失败，因为 on 返回的是 Set.delete

// 正确做法：
let unsubscribe;
const setupHandler = () => {
  const callback = (params) => { /* ... */ };
  const remove = on('Fetch.requestPaused', callback);
  unsubscribe = remove; // 保存返回的卸载函数
};
// 之后调用 unsubscribe()
```

**修复后的完整实现**：

```javascript
// tools/browser_fetch.js - 完整重写
import { sendPageCommand } from '../lib/cdp/index.js';
import { on, off } from '../lib/cdp/transport.js';

let _activePatterns = new Map(); // targetId -> patterns[]
let _collectedRequests = new Map(); // targetId -> requests[]

export const name = 'browser_fetch';
export const description = 'Fetch/XHR 拦截 + 模拟响应 + 列表 (v4.0 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'enable/disable/list/intercept/mock' },
  urlPattern: { type: 'string', description: 'URL 模式 (支持 * 和 ?) glob' },
  responseStatus: { type: 'number', description: 'mock 模式返回的状态码' },
  responseBody: { type: 'string', description: 'mock 模式返回的 body' },
  responseHeaders: { type: 'array', description: 'mock 模式返回的 headers [{name, value}]' },
  collectMs: { type: 'number', description: '收集时长毫秒 (默认 5000)' },
};

// 将 glob 模式转换为 CDP urlPattern
function globToPattern(glob) {
  // 简单转换：* -> .*, ? -> .
  return glob.replace(/\*/g, '.*').replace(/\?/g, '.');
}

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };

    // 确保 Network 域已启用
    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
    
    // 初始化收集数组
    if (!_collectedRequests.has(args.targetId)) {
      _collectedRequests.set(args.targetId, []);
    }

    if (args.action === 'enable') {
      if (!args.urlPattern) return { ok: false, error: 'urlPattern required' };
      
      await sendPageCommand(args.targetId, 'Fetch.enable', {
        patterns: [{ 
          urlPattern: args.urlPattern,
          resourceType: undefined,
          requestStage: 'Request' 
        }],
      }, 3000);
      
      // 记录启用的模式
      const patterns = _activePatterns.get(args.targetId) || [];
      patterns.push(args.urlPattern);
      _activePatterns.set(args.targetId, patterns);
      
      return { ok: true, enabled: true, pattern: args.urlPattern };
    }

    if (args.action === 'disable') {
      await sendPageCommand(args.targetId, 'Fetch.disable', {}, 3000);
      _activePatterns.delete(args.targetId);
      return { ok: true, disabled: true };
    }

    if (args.action === 'list') {
      // 收集一段时间的 fetch 请求
      const requests = [];
      const collectDuration = args.collectMs || 5000;
      
      const handler = (params) => {
        requests.push({
          requestId: params.requestId,
          url: params.request?.url,
          method: params.request?.method,
          headers: params.request?.headers,
          postData: params.request?.postData,
          resourceType: params.resourceType,
          responseStatus: params.responseStatusCode,
          responseHeaders: params.responseHeaders,
        });
      };
      
      const removeListener = on('Fetch.requestPaused', handler);
      
      // 启用 Fetch（如果有 urlPattern 则只匹配该模式）
      await sendPageCommand(args.targetId, 'Fetch.enable', {
        patterns: args.urlPattern 
          ? [{ urlPattern: args.urlPattern, requestStage: 'Response' }] 
          : [],
      }, 3000);
      
      await new Promise(r => setTimeout(r, collectDuration));
      
      // 清理
      removeListener();
      
      return { 
        ok: true, 
        requestCount: requests.length, 
        requests,
        collectDuration
      };
    }

    if (args.action === 'intercept') {
      if (!args.urlPattern) return { ok: false, error: 'urlPattern required' };
      
      const mockStatus = args.responseStatus || 200;
      const mockBody = args.responseBody || '';
      const mockHeaders = args.responseHeaders || [];
      
      const handler = async (params) => {
        const requestId = params.requestId;
        
        try {
          // 如果有自定义响应，返回 mock 数据
          if (mockBody !== undefined) {
            await sendPageCommand(args.targetId, 'Fetch.fulfillRequest', {
              requestId,
              responseCode: mockStatus,
              responseHeaders: mockHeaders,
              body: Buffer.from(mockBody).toString('base64'),
            }, 5000);
          } else {
            // 否则继续原始请求
            await sendPageCommand(args.targetId, 'Fetch.continueRequest', {
              requestId,
            }, 5000);
          }
        } catch (e) {
          console.error('Fetch intercept error:', e);
          try {
            await sendPageCommand(args.targetId, 'Fetch.continueRequest', {
              requestId,
            }, 3000);
          } catch {}
        }
      };
      
      const removeListener = on('Fetch.requestPaused', handler);
      
      await sendPageCommand(args.targetId, 'Fetch.enable', {
        patterns: [{ urlPattern: args.urlPattern, requestStage: 'Request' }],
      }, 3000);
      
      // 等待一段时间后自动禁用
      const duration = args.collectMs || 3000;
      await new Promise(r => setTimeout(r, duration));
      
      removeListener();
      await sendPageCommand(args.targetId, 'Fetch.disable', {}, 3000).catch(() => {});
      
      return { 
        ok: true, 
        intercepted: true, 
        durationMs: duration,
        mockStatus,
        mockBody: mockBody ? `${mockBody.length} chars` : 'passthrough'
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

#### 2.2 browser_audit_full.js 增强方案

**问题诊断**：当前实现获取了基础 metrics，但没有利用 Chrome 150 的 Audits 域增强功能。

```javascript
// tools/browser_audit_full.js - 增强版
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_audit_full';
export const description = '完整页面审计: 性能指标 + 资源 + 内存 + Lighthouse 建议 (Chrome 150 增强)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  categories: { type: 'array', description: '审计类别: performance/accessibility/seo/best-practices' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    await sendPageCommand(args.targetId, 'Audits.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Performance.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Page.enable', {}, 3000).catch(() => {});

    // 1. 获取 Performance Metrics
    const metrics = await sendPageCommand(args.targetId, 'Performance.getMetrics', {}, 10000);
    const metricMap = {};
    for (const m of (metrics.metrics || [])) {
      metricMap[m.name] = m.value;
    }

    // 2. 获取资源列表
    const resources = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        transferSize: r.transferSize,
        decodedBodySize: r.decodedBodySize,
        duration: r.duration,
        type: r.initiatorType,
        dns: r.domainLookupEnd - r.domainLookupStart,
        connect: r.connectEnd - r.connectStart,
        ssl: r.secureConnectionStart > 0 ? r.connectEnd - r.secureConnectionStart : 0,
        ttfb: r.responseStart - r.requestStart,
      }))`,
      returnByValue: true,
    }, 10000);

    // 3. 获取 DOM 统计
    const dom = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `({
        total: document.getElementsByTagName('*').length,
        scripts: document.scripts.length,
        styles: document.querySelectorAll('style, link[rel=stylesheet]').length,
        images: document.images.length,
        iframes: document.querySelectorAll('iframe').length,
        links: document.links.length,
        forms: document.forms.length,
        inputs: document.querySelectorAll('input').length,
      })`,
      returnByValue: true,
    }, 5000);

    // 4. 获取内存信息
    const mem = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `({
        used: performance.memory?.usedJSHeapSize,
        total: performance.memory?.totalJSHeapSize,
        limit: performance.memory?.jsHeapSizeLimit,
        usagePercent: performance.memory ? 
          (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2) : null
      })`,
      returnByValue: true,
    }, 5000);

    // 5. 获取网络统计
    const netStats = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `({
        requests: performance.getEntriesByType('resource').length,
        totalSize: performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0),
        totalDuration: Math.max(...performance.getEntriesByType('resource').map(r => r.responseEnd)),
        blockedRequests: performance.getEntriesByType('resource').filter(r => r.transferSize === 0 && r.duration > 0).length,
      })`,
      returnByValue: true,
    }, 5000);

    // 6. 尝试运行 Audits（Chrome 98+）
    let auditsResults = null;
    try {
      // 触发 audits（注意：这会刷新页面）
      const auditResponse = await sendPageCommand(args.targetId, 'Audits.getAudits', {}, 5000);
      auditsResults = auditResponse;
    } catch {
      // Audits 域可能不可用，忽略
    }

    // 解析 metrics
    const performanceScore = calculatePerformanceScore(metricMap);
    
    // 排序资源
    const resourceList = (resources.result.value || []).sort((a, b) => 
      (b.transferSize || 0) - (a.transferSize || 0)
    );

    return {
      ok: true,
      performance: {
        score: performanceScore,
        metrics: {
          domContentLoaded: metricMap.DomContentLoaded,
          domInteractive: metricMap.DomInteractive,
          domComplete: metricMap.DomComplete,
          layoutCount: metricMap.LayoutCount,
          layoutDuration: metricMap.LayoutDuration?.toFixed(2),
          recalcStyleCount: metricMap.RecalcStyleCount,
          recalcStyleDuration: metricMap.RecalcStyleDuration?.toFixed(2),
          scriptDuration: metricMap.ScriptDuration?.toFixed(2),
          taskDuration: metricMap.TaskDuration?.toFixed(2),
          usedJsHeapSize: metricMap.UsedJSHeapSize,
          totalJsHeapSize: metricMap.TotalJSHeapSize,
        },
      },
      memory: mem.result.value,
      network: netStats.result.value,
      dom: dom.result.value,
      resourceCount: resourceList.length,
      topResources: resourceList.slice(0, 15),
      // 如果有 audits 结果，加入
      audits: auditsResults,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function calculatePerformanceScore(metrics) {
  // 简化的性能评分（0-100）
  const FCP = metrics.DomContentLoaded || 0;
  const LCP = metrics.DomInteractive || 0;
  const TBT = (metrics.TaskDuration || 0) - (metrics.ScriptDuration || 0);
  
  let score = 100;
  
  // FCP > 1.8s 开始扣分
  if (FCP > 1800) score -= Math.min(30, (FCP - 1800) / 100);
  
  // LCP > 2.5s 开始扣分
  if (LCP > 2500) score -= Math.min(30, (LCP - 2500) / 100);
  
  // TBT > 200ms 开始扣分
  if (TBT > 200) score -= Math.min(40, TBT / 10);
  
  return Math.max(0, Math.round(score));
}
```

### 三、基础工具完善

#### 3.1 browser_navigate.js 增加智能重试

```javascript
// tools/browser_navigate.js - 增强版
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_navigate';
export const description = '导航到 URL（支持智能重试和等待条件）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  url: { type: 'string', description: '目标 URL' },
  timeout: { type: 'number', description: '超时毫秒（默认 60000）' },
  waitForSelector: { type: 'string', description: '等待特定选择器出现' },
  waitForNetworkIdle: { type: 'boolean', description: '等待网络空闲' },
  retry: { type: 'number', description: '失败重试次数（默认 2）' },
};

export async function execute(args, ctx) {
  if (!args.targetId) return { ok: false, error: 'targetId required' };
  if (!args.url) return { ok: false, error: 'url required' };
  
  const timeout = args.timeout || 60000;
  const maxRetries = args.retry ?? 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await ensureBridge();
      
      // 导航
      const r = await sendPageCommand(args.targetId, 'Page.navigate', 
        { url: args.url }, 
        timeout
      );
      
      if (r.errorText) {
        if (attempt < maxRetries) continue;
        return { ok: false, error: r.errorText };
      }
      
      // 等待网络空闲
      if (args.waitForNetworkIdle) {
        await waitForNetworkIdle(args.targetId, 30000);
      }
      
      // 等待选择器
      if (args.waitForSelector) {
        await waitForSelector(args.targetId, args.waitForSelector, 30000);
      }
      
      return { 
        ok: true, 
        frameId: r.frameId, 
        loaderId: r.loaderId, 
        url: args.url,
        attempt: attempt + 1
      };
      
    } catch (err) {
      if (attempt < maxRetries) {
        // 等待后重试
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: err.message };
    }
  }
}

async function waitForNetworkIdle(targetId, timeout) {
  const start = Date.now();
  let lastRequestCount = 0;
  
  while (Date.now() - start < timeout) {
    const state = await sendPageCommand(targetId, 'Runtime.evaluate', {
      expression: `({
        requests: window.performance.getEntriesByType('resource').length,
        pending: window.performance.resourceTimingBufferSize - window.performance.getEntriesByType('resource').length
      })`,
      returnByValue: true,
    }, 5000);
    
    const requests = state.result.value?.requests || 0;
    if (requests === lastRequestCount && requests > 0) {
      return; // 网络空闲
    }
    lastRequestCount = requests;
    await new Promise(r => setTimeout(r, 500));
  }
}

async function waitForSelector(targetId, selector, timeout) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const state = await sendPageCommand(targetId, 'Runtime.evaluate', {
      expression: `document.querySelector('${selector}') !== null`,
      returnByValue: true,
    }, 5000);
    
    if (state.result.value === true) return;
    await new Promise(r => setTimeout(r, 200));
  }
  
  throw new Error(`Timeout waiting for selector: ${selector}`);
}
```

#### 3.2 browser_click.js / browser_type.js 缺失补全

检查发现 `browser_click.js` 不存在，但 `browser_action.js` 可能承担了这个职责。让我检查并补充缺失的工具。

```javascript
// tools/browser_click.js - 新增
import { sendPageCommand, evaluate } from '../lib/cdp/index.js';

export const name = 'browser_click';
export const description = '点击页面元素（支持选择器和坐标）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  selector: { type: 'string', description: 'CSS 选择器或 XPath' },
  x: { type: 'number', description: 'X 坐标（selector 为空时使用）' },
  y: { type: 'number', description: 'Y 坐标（selector 为空时使用）' },
  button: { type: 'string', description: '鼠标按钮: left/right/middle（默认 left）' },
  clickCount: { type: 'number', description: '点击次数（默认 1）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.selector && (args.x === undefined || args.y === undefined)) {
      return { ok: false, error: 'selector 或 x/y 坐标至少需要提供一个' };
    }

    let x = args.x;
    let y = args.y;
    
    if (args.selector) {
      // 解析选择器获取元素位置
      const pos = await evaluate(args.targetId, `(selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
          tag: el.tagName,
          text: el.textContent.trim().slice(0, 50)
        };
      }`, {
        args: [args.selector],
        returnByValue: true
      });
      
      if (!pos.result.value) {
        return { ok: false, error: `Element not found: ${args.selector}` };
      }
      
      x = pos.result.value.x;
      y = pos.result.value.y;
      
      // 滚动元素到可见区域
      await evaluate(args.targetId, `(selector) => {
        const el = document.querySelector(selector);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }`, {
        args: [args.selector],
        returnByValue: false
      });
    }

    const buttonMap = { left: 0, right: 1, middle: 2 };
    const button = buttonMap[args.button] ?? 0;
    const clickCount = args.clickCount || 1;

    // 触发 MousePressed
    await sendPageCommand(args.targetId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button,
      clickCount,
      modifiers: 0,
    }, 5000);

    // 触发 MouseReleased
    await sendPageCommand(args.targetId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button,
      clickCount,
      modifiers: 0,
    }, 5000);

    return { 
      ok: true, 
      x, 
      y, 
      button: args.button || 'left',
      clickCount,
      selector: args.selector
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

```javascript
// tools/browser_type.js - 新增
import { sendPageCommand, evaluate } from '../lib/cdp/index.js';

export const name = 'browser_type';
export const description = '在输入框中输入文本（支持特殊键）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  selector: { type: 'string', description: '输入框选择器' },
  text: { type: 'string', description: '要输入的文本' },
  delay: { type: 'number', description: '每个字符延迟毫秒（默认 0）' },
  clear: { type: 'boolean', description: '输入前清空现有内容（默认 true）' },
  pressEnter: { type: 'boolean', description: '输入完成后按回车（默认 false）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.selector) return { ok: false, error: 'selector required' };
    if (args.text === undefined) return { ok: false, error: 'text required' };

    // 确保元素可聚焦
    await evaluate(args.targetId, `(selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.focus();
      return true;
    }`, {
      args: [args.selector],
      returnByValue: true
    });

    // 清空现有内容
    if (args.clear !== false) {
      await evaluate(args.targetId, `(selector) => {
        const el = document.querySelector(selector);
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }`, {
        args: [args.selector],
        returnByValue: false
      });
    }

    // 分字符输入
    const chars = args.text.split('');
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      await evaluate(args.targetId, `(selector, char) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        el.value += char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }`, {
        args: [args.selector, char],
        returnByValue: true
      });

      if (args.delay > 0) {
        await new Promise(r => setTimeout(r, args.delay));
      }
    }

    // 按回车
    if (args.pressEnter) {
      await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      }, 5000);
      await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      }, 5000);
    }

    return { 
      ok: true, 
      selector: args.selector,
      textLength: args.text.length,
      pressEnter: args.pressEnter
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

---

## 第四部分：GUI 层面修改建议

### 一、GUI 现状分析

当前 GUI 采用 React 18 + Vite + Tailwind v4 技术栈，整体设计风格达到了"Mac 级工业设计"水准（据 CHANGELOG 描述）。核心组件包括：TopBar（44px 毛玻璃效果）、Sidebar（52px 布局指示器）、BottomDrawer（220ms 弹簧动画）、CommandPalette、SettingsOverlay 等。

然而，经过代码审查发现几个问题：

**BrowserPanel 的预览功能是伪 Live Preview**。虽然 README 声称提供"实时画面预览"，但实际上 BrowserPanel.tsx 中的预览是通过截图实现的，而非真正的 iframe 嵌入。这是因为 Chrome 的安全策略不允许将 Chrome 页面嵌入到 iframe 中。

**自动化面板缺乏真正的录制功能**。虽然存在 `AutomationPanel.tsx`，但核心的录制器（recorder）功能在 vanilla GUI 删除后，Electron GUI 中并未完全实现。

**高级工具缺乏 GUI 入口**。像 `browser_extract_apis`、`browser_dump_structure` 这样的强大工具，只能通过 MCP 调用使用，没有对应的 GUI 交互界面。

### 二、GUI 改进建议

#### 2.1 BrowserPanel 增强

```tsx
// electron/renderer/src/panels/BrowserPanel.tsx - 增强版
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Globe, Crosshair, ArrowRight, RefreshCw, ImageIcon, 
  User, Bot, Camera, FileCode, ListTree, Cookie, 
  Network, Terminal, Play, Pause, Download,
  type LucideIcon 
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { useAppStore } from '../store';

interface Props { tools: any[]; }

export function BrowserPanel({ tools }: Props) {
  const [url, setUrl] = useState('https://example.com');
  const [tabs, setTabs] = useState<{ user: any[]; agent: any[] }>({ user: [], agent: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [domSnapshot, setDomSnapshot] = useState<string>('');
  const [domOpen, setDomOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [cookies, setCookies] = useState<any[]>([]);
  const [cookiesLoading, setCookiesLoading] = useState(false);
  
  // 新增：API 提取结果
  const [apiList, setApiList] = useState<any[]>([]);
  const [structureData, setStructureData] = useState<any>(null);
  
  // 新增：网络请求列表
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  
  const health = useAppStore((s) => s.health);
  const refreshTabs = async () => {
    try {
      const r = await apiGet('/api/browser/tabs');
      setTabs(r.tabs || { user: [], agent: [] });
    } catch {
      setTabs({ user: [], agent: [] });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { 
    refreshTabs(); 
    const t = setInterval(refreshTabs, 5000); 
    return () => clearInterval(t); 
  }, []);

  const firstTargetId = (): string | null => {
    const all = [...tabs.user, ...tabs.agent];
    return all[0]?.targetId || null;
  };

  const navigate = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({
          kind: 'warn',
          title: 'Chrome 未连接或没有 tab',
          description: '在 PowerShell 跑 chrome --remote-debugging-port=9222 并打开一个网页',
        });
        return;
      }
      await apiPost('/api/tools/call', { 
        name: 'browser_navigate', 
        args: { url, targetId } 
      });
      pushToast({ kind: 'success', title: '✓ 已跳转', description: url });
      // 刷新截图
      await screenshot();
    } catch (e: any) {
      pushToast({ kind: 'error', title: `跳转失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const screenshot = async () => {
    setBusy(true);
    try {
      const targetId = firstTargetId();
      if (!targetId) {
        pushToast({ kind: 'warn', title: 'Chrome 未连接', description: '先连接 Chrome' });
        return;
      }
      const r: any = await apiPost('/api/tools/call', { 
        name: 'browser_screenshot', 
        args: { targetId, format: 'png' } 
      });
      const v = r?.value;
      const dataUrl = typeof v === 'string' ? v : (v?.data ? `data:image/${v.format || 'png'};base64,${v.data}` : null);
      if (dataUrl) {
        setScreenshotUrl(dataUrl);
      } else {
        pushToast({ kind: 'warn', title: '截图返回为空' });
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: `截图失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  // 新增：提取 API 端点
  const extractApis = async () => {
    const targetId = firstTargetId();
    if (!targetId) {
      pushToast({ kind: 'warn', title: 'Chrome 未连接' });
      return;
    }
    setBusy(true);
    try {
      const r = await apiPost('/api/tools/call', {
        name: 'browser_extract_apis',
        args: { targetId, minCalls: 1 }
      });
      if (r.ok !== false && r.value) {
        const data = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        setApiList(data.apis || []);
        pushToast({ 
          kind: 'success', 
          title: `发现 ${data.totalUniqueApis || 0} 个 API 端点` 
        });
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: `提取失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  // 新增：提取页面结构
  const dumpStructure = async () => {
    const targetId = firstTargetId();
    if (!targetId) {
      pushToast({ kind: 'warn', title: 'Chrome 未连接' });
      return;
    }
    setBusy(true);
    try {
      const r = await apiPost('/api/tools/call', {
        name: 'browser_dump_structure',
        args: { targetId, maxDepth: 6, includeStorage: true }
      });
      if (r.ok !== false && r.value) {
        const data = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        setStructureData(data.structure || data);
        pushToast({ kind: 'success', title: '页面结构已提取' });
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: `提取失败: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  // 渲染截图预览区
  const renderPreview = () => (
    <div className="relative w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
      {screenshotUrl ? (
        <div className="relative w-full h-full">
          <img 
            src={screenshotUrl} 
            alt="Page screenshot" 
            className="w-full h-full object-contain"
          />
          {/* 选择器覆盖层 */}
          {picking && (
            <div className="absolute inset-0 bg-blue-500/10 cursor-crosshair"
                 onClick={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const x = e.clientX - rect.left;
                   const y = e.clientY - rect.top;
                   pushToast({ 
                     kind: 'info', 
                     title: `坐标: (${Math.round(x)}, ${Math.round(y)})` 
                   });
                 }}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Globe}
          title="暂无预览"
          description="输入 URL 并导航后显示页面截图"
          action={{ label: '打开示例', onClick: () => setUrl('https://example.com') }}
        />
      )}
    </div>
  );

  // 渲染 API 列表
  const renderApiList = () => (
    <div className="h-full overflow-auto p-4">
      {apiList.length === 0 ? (
        <EmptyState
          icon={Network}
          title="暂无 API 数据"
          description="先在页面上进行操作，然后点击「提取 API」"
          action={{ label: '提取 API', onClick: extractApis }}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">发现 {apiList.length} 个 API 端点</h3>
            <Button variant="outline" size="sm" onClick={extractApis}>
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
          {apiList.map((api, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  api.method === 'GET' ? 'bg-green-100 text-green-700' :
                  api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                  api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {api.method}
                </span>
                <code className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                  {api.url}
                </code>
                <span className="text-xs text-gray-400">
                  {api.callCount} 次
                </span>
              </div>
              {api.examples && api.examples.length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">查看示例</summary>
                  <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded overflow-auto">
                    {JSON.stringify(api.examples, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 渲染页面结构
  const renderStructure = () => (
    <div className="h-full overflow-auto p-4">
      {!structureData ? (
        <EmptyState
          icon={FileCode}
          title="暂无结构数据"
          description="点击「提取结构」获取页面完整信息"
          action={{ label: '提取结构', onClick: dumpStructure }}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-2">基本信息</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>标题: {structureData.title}</div>
              <div>链接数: {structureData.linksCount}</div>
              <div>表单数: {structureData.forms?.length || 0}</div>
              <div>入口点: {structureData.entryPointsCount}</div>
            </div>
          </div>
          
          {structureData.forms && structureData.forms.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <h3 className="font-medium mb-2">表单</h3>
              {structureData.forms.map((form: any, i: number) => (
                <div key={i} className="border-b dark:border-gray-700 pb-2 mb-2">
                  <code className="text-xs">{form.action}</code>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {form.inputs?.length || 0} 个输入框
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {structureData.meta && Object.keys(structureData.meta).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <h3 className="font-medium mb-2">Meta 信息</h3>
              <div className="text-sm space-y-1">
                {Object.entries(structureData.meta).slice(0, 10).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-gray-500">{k}:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{String(v).slice(0, 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 p-3 border-b bg-white/50 dark:bg-gray-800/50">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          placeholder="输入 URL..."
          className="flex-1"
        />
        <Button onClick={navigate} disabled={busy}>
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" onClick={screenshot} disabled={busy}>
          <Camera className="w-4 h-4" />
        </Button>
        <Button 
          variant={picking ? 'default' : 'outline'} 
          onClick={() => setPicking(!picking)}
        >
          <Crosshair className="w-4 h-4" />
        </Button>
      </div>

      {/* Tab 区域 */}
      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="preview">
            <Globe className="w-4 h-4 mr-1" />
            预览
          </TabsTrigger>
          <TabsTrigger value="apis">
            <Network className="w-4 h-4 mr-1" />
            API ({apiList.length})
          </TabsTrigger>
          <TabsTrigger value="structure">
            <FileCode className="w-4 h-4 mr-1" />
            结构
          </TabsTrigger>
          <TabsTrigger value="cookies">
            <Cookie className="w-4 h-4 mr-1" />
            Cookies
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="preview" className="h-full p-3">
            {renderPreview()}
          </TabsContent>
          <TabsContent value="apis" className="h-full">
            {renderApiList()}
          </TabsContent>
          <TabsContent value="structure" className="h-full">
            {renderStructure()}
          </TabsContent>
          <TabsContent value="cookies" className="h-full p-3">
            {/* Cookies Tab */}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

#### 2.2 MonitorPanel 增强

```tsx
// electron/renderer/src/panels/MonitorPanel.tsx - 增强版
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Network, Terminal, Activity, Filter, 
  Download, Trash2, Search, RefreshCw
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { pushToast } from '../components/Toast';
import { useAppStore } from '../store';

export function MonitorPanel() {
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const health = useAppStore((s) => s.health);
  const tabs = useAppStore((s) => s.tabs);

  const firstTargetId = () => {
    // 从 tabs store 获取
    return null;
  };

  // 加载网络请求
  const loadNetworkRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 调用 browser_network 工具
      const targetId = firstTargetId();
      if (!targetId) return;
      
      const r = await apiPost('/api/tools/call', {
        name: 'browser_network',
        args: { targetId, limit: 200 }
      });
      
      if (r.ok !== false && r.value) {
        const data = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        setNetworkRequests(data.requests || []);
      }
    } catch (e) {
      console.error('Failed to load network requests:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载控制台日志
  const loadConsoleLogs = useCallback(async () => {
    try {
      const r = await apiGet('/api/console/recent?limit=200');
      if (r.ok !== false) {
        setConsoleLogs(r.events || []);
      }
    } catch (e) {
      console.error('Failed to load console logs:', e);
    }
  }, []);

  // 加载活动日志
  const loadActivityLogs = useCallback(async () => {
    try {
      const r = await apiGet('/api/activity');
      if (r.ok !== false) {
        setActivityLogs(r.events || []);
      }
    } catch (e) {
      console.error('Failed to load activity logs:', e);
    }
  }, []);

  // 初始化和定时刷新
  useEffect(() => {
    loadNetworkRequests();
    loadConsoleLogs();
    loadActivityLogs();

    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadNetworkRequests();
        loadConsoleLogs();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadNetworkRequests, loadConsoleLogs, loadActivityLogs]);

  // 过滤请求
  const filteredRequests = networkRequests.filter(req => {
    if (!filter) return true;
    const searchLower = filter.toLowerCase();
    return (
      req.url?.toLowerCase().includes(searchLower) ||
      req.method?.toLowerCase().includes(searchLower) ||
      req.type?.toLowerCase().includes(searchLower)
    );
  });

  // 导出网络请求为 HAR 格式
  const exportAsHar = () => {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'WebPilot',
          version: '4.0',
        },
        entries: networkRequests.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.duration || 0,
          request: {
            method: req.method,
            url: req.url,
            headers: req.requestHeaders || [],
          },
          response: {
            status: req.status,
            headers: req.responseHeaders || [],
          },
          timings: {
            wait: req.waitingTime || 0,
            receive: req.receivingTime || 0,
          },
        })),
      },
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webpilot-network-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(url);

    pushToast({ kind: 'success', title: '已导出 HAR 文件' });
  };

  // 渲染网络请求列表
  const renderNetworkRequests = () => (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="过滤请求..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadNetworkRequests}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={exportAsHar}>
          <Download className="w-4 h-4" />
        </Button>
        <Button 
          variant={autoRefresh ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <Activity className="w-4 h-4" />
        </Button>
      </div>

      {/* 请求列表 */}
      <div className="flex-1 overflow-auto">
        {filteredRequests.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {loading ? '加载中...' : '暂无网络请求'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left p-2">状态</th>
                <th className="text-left p-2">方法</th>
                <th className="text-left p-2">URL</th>
                <th className="text-left p-2">类型</th>
                <th className="text-right p-2">大小</th>
                <th className="text-right p-2">耗时</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req, i) => (
                <tr 
                  key={i} 
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      req.status < 300 ? 'bg-green-100 text-green-700' :
                      req.status < 400 ? 'bg-blue-100 text-blue-700' :
                      req.status < 500 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {req.status || '-'}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`font-medium ${
                      req.method === 'GET' ? 'text-green-600' :
                      req.method === 'POST' ? 'text-blue-600' :
                      req.method === 'PUT' ? 'text-yellow-600' :
                      req.method === 'DELETE' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {req.method || '-'}
                    </span>
                  </td>
                  <td className="p-2 max-w-xs truncate" title={req.url}>
                    {req.url || '-'}
                  </td>
                  <td className="p-2 text-gray-500">
                    {req.type || '-'}
                  </td>
                  <td className="p-2 text-right text-gray-500">
                    {req.transferSize ? formatBytes(req.transferSize) : '-'}
                  </td>
                  <td className="p-2 text-right text-gray-500">
                    {req.duration ? `${Math.round(req.duration)}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 统计栏 */}
      <div className="flex items-center gap-4 p-2 border-t bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
        <span>请求: {filteredRequests.length}</span>
        <span>总大小: {formatBytes(filteredRequests.reduce((s, r) => s + (r.transferSize || 0), 0))}</span>
        <span>总耗时: {Math.round(filteredRequests.reduce((s, r) => s + (r.duration || 0), 0))}ms</span>
      </div>
    </div>
  );

  // 渲染控制台日志
  const renderConsoleLogs = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-medium">控制台</h3>
        <Button variant="outline" size="sm" onClick={loadConsoleLogs}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto font-mono text-sm">
        {consoleLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            暂无日志
          </div>
        ) : (
          consoleLogs.map((log, i) => (
            <div 
              key={i} 
              className={`p-2 border-b dark:border-gray-800 ${
                log.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
                log.type === 'warn' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600' :
                'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-gray-400 mr-2">[{log.type}]</span>
              <span>{log.message || JSON.stringify(log.args)}</span>
              {log.url && (
                <span className="text-gray-400 ml-2 text-xs">
                  {log.url}:{log.lineNumber}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Tabs defaultValue="network" className="h-full flex flex-col">
      <TabsList className="mx-3 mt-2">
        <TabsTrigger value="network">
          <Network className="w-4 h-4 mr-1" />
          网络
        </TabsTrigger>
        <TabsTrigger value="console">
          <Terminal className="w-4 h-4 mr-1" />
          控制台
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Activity className="w-4 h-4 mr-1" />
          活动
        </TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-hidden">
        <TabsContent value="network" className="h-full">
          {renderNetworkRequests()}
        </TabsContent>
        <TabsContent value="console" className="h-full">
          {renderConsoleLogs()}
        </TabsContent>
        <TabsContent value="activity" className="h-full">
          <ActivityPanel logs={activityLogs} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// 活动面板组件
function ActivityPanel({ logs }: { logs: any[] }) {
  return (
    <div className="h-full overflow-auto p-3">
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          暂无活动记录
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div 
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{log.event}</span>
                <span className="text-xs text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <pre className="text-xs text-gray-500 overflow-auto">
                {JSON.stringify(log.data || log, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 第五部分：测试体系改进建议

### 一、测试现状分析

当前项目的测试分为两部分：Node.js 后端测试（使用 Node 的 `node:test`）和 React 组件测试（使用 Vitest + Testing Library）。

后端测试位于 `test/unit/` 目录，有 21 个测试文件，199 个 cases。测试覆盖了工具加载、CDP 连接、HTTP API 等核心功能。

React 测试位于 `electron/renderer/src/components/__tests__/`，仅有 2 个测试文件，4 个 test cases。

问题分析：

**测试覆盖率不均衡**。核心 CDP 模块和工具加载模块有较好的测试覆盖，但 GUI 组件、集成场景、错误处理路径等测试覆盖严重不足。

**集成测试缺失**。目前只有 1 个 `cdp-direct.test.js`，且需要 Chrome 在 9222 端口运行。`daemon/` 目录下的 20+ 个模块完全没有测试覆盖。

**模拟层不完善**。测试中使用的 `MockWs` 工具较为简单，无法模拟复杂的 WebSocket 交互场景。

### 二、测试改进方案

#### 2.1 建立分层的测试策略

```
test/
├── unit/                    # 单元测试
│   ├── cdp/                 # CDP 模块单元测试
│   ├── tools/               # 工具单元测试
│   ├── lib/                 # 库模块单元测试
│   └── daemon/              # Daemon 模块单元测试
├── integration/             # 集成测试
│   ├── cdp-connection.test.js    # 需要 Chrome
│   ├── mcp-server.test.js        # 需要 MCP 客户端
│   ├── http-api.test.js          # 需要 HTTP 客户端
│   └── full-flow.test.js         # 端到端测试
├── e2e/                     # E2E 测试
│   ├── browser-operations.test.ts
│   ├── mcp-integration.test.ts
│   └── gui.test.ts
└── fixtures/                # 测试数据
    ├── mock-ws.js
    ├── mock-cdp-responses.js
    └── sample-pages/
```

#### 2.2 增强 MockWs 工具

```javascript
// test/_helpers.js - 增强版 MockWs
import { EventEmitter } from 'events';

class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 'CONNECTING';
    this._sentMessages = [];
    this._handlers = {};
    
    // 模拟连接成功
    setTimeout(() => {
      this.readyState = 'OPEN';
      this.emit('open');
    }, 10);
  }

  send(data) {
    this._sentMessages.push(data);
    
    // 解析消息
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    
    // 处理命令
    if (msg.id && this._handlers[msg.method]) {
      const response = this._handlers[msg.method](msg.params, msg.id);
      if (response !== false) {
        this._respond(msg.id, response);
      }
    }
  }

  close(code = 1000, reason = '') {
    this.readyState = 'CLOSED';
    this.emit('close', { code, reason });
  }

  // 注册命令处理器
  onCommand(method, handler) {
    this._handlers[method] = handler;
  }

  // 模拟响应
  _respond(id, result = {}, error = null) {
    const response = { id };
    if (error) {
      response.error = { message: error };
    } else {
      response.result = result;
    }
    this.emit('message', JSON.stringify(response));
  }

  // 模拟事件
  emitEvent(method, params = {}, sessionId = null) {
    const event = { method, params };
    if (sessionId) {
      event.sessionId = sessionId;
    }
    this.emit('message', JSON.stringify(event));
  }

  // 获取发送的消息
  getSentMessages() {
    return this._sentMessages.map(m => {
      try { return JSON.parse(m); } catch { return m; }
    });
  }
}

// Mock Chrome CDP responses
export const MOCK_CDP_RESPONSES = {
  'Version.domain': {},
  'Target.getTargets': {
    targetInfos: [
      {
        targetId: 'page-1',
        type: 'page',
        title: 'Test Page',
        url: 'https://example.com',
        attached: true,
      },
    ],
  },
  'Page.navigate': {
    frameId: 'frame-1',
    loaderId: 'loader-1',
  },
  'Runtime.evaluate': {
    result: {
      type: 'string',
      value: 'test result',
    },
  },
  'Network.enable': {},
  'Network.disable': {},
  'Page.enable': {},
  'Page.screencastFrame': {}, // 占位，实际需要特殊处理
  'Fetch.enable': {},
  'Fetch.disable': {},
  'Fetch.requestPaused': {},
  'Tracing.start': {},
  'Tracing.end': {},
  'Tracing.dataCollected': { value: [] },
  'WebSocket.attach': {},
  'Animation.enable': {},
  'Debugger.enable': {},
  'DOMDebugger.setXHRBreakpoint': { breakpointId: 'bp-1' },
};

export function createMockWs(url = 'ws://127.0.0.1:9222/devtools/browser') {
  const ws = new MockWebSocket(url);
  
  // 注册默认命令处理
  ws.onCommand('Target.getTargets', () => MOCK_CDP_RESPONSES['Target.getTargets']);
  ws.onCommand('Target.createTarget', ({ url }) => ({
    targetId: `page-${Date.now()}`,
  }));
  ws.onCommand('Target.closeTarget', () => ({}));
  ws.onCommand('Page.navigate', () => MOCK_CDP_RESPONSES['Page.navigate']);
  ws.onCommand('Runtime.evaluate', (params) => {
    // 支持自定义表达式求值
    if (params.expression === 'true') {
      return { result: { type: 'boolean', value: true } };
    }
    if (params.expression === 'document.title') {
      return { result: { type: 'string', value: 'Mock Page' } };
    }
    return MOCK_CDP_RESPONSES['Runtime.evaluate'];
  });
  ws.onCommand('Network.enable', () => ({}));
  ws.onCommand('Network.getResponseBody', () => ({
    body: 'mock response body',
    base64Encoded: false,
  }));
  ws.onCommand('Page.enable', () => ({}));
  ws.onCommand('Fetch.enable', () => ({}));
  ws.onCommand('Fetch.disable', () => ({}));
  ws.onCommand('Fetch.fulfillRequest', () => ({}));
  ws.onCommand('Fetch.continueRequest', () => ({}));
  ws.onCommand('Animation.enable', () => ({}));
  ws.onCommand('Debugger.enable', () => ({}));
  ws.onCommand('Tracing.start', () => ({}));
  ws.onCommand('Tracing.end', () => ({}));
  
  return ws;
}

// 辅助函数：等待指定时间
export function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 辅助函数：等待 MockWs 就绪
export async function waitForWsOpen(ws, timeout = 1000) {
  if (ws.readyState === 'OPEN') return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Ws timeout')), timeout);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
```

#### 2.3 添加 Daemon 模块测试

```javascript
// test/unit/daemon/config.test.js
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { 
  loadConfig, 
  saveConfig, 
  patchConfig,
  currentConfig,
  _resetForTest 
} from '../../daemon/config.js';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('config.js', () => {
  const testDir = path.join(os.tmpdir(), 'webpilot-test-config');
  const testConfigPath = path.join(testDir, 'config.json');
  
  beforeEach(() => {
    // 设置测试环境
    process.env.WEBPILOT_CONFIG_DIR = testDir;
    _resetForTest();
    
    // 创建测试目录
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // 清理
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    if (existsSync(testDir)) {
      rmdirSync(testDir, { recursive: true });
    }
    delete process.env.WEBPILOT_CONFIG_DIR;
  });
  
  it('should create default config if not exists', () => {
    const config = loadConfig();
    
    assert.ok(config.cdp);
    assert.ok(config.mcp);
    assert.ok(config.http);
    assert.ok(config.llm);
    assert.strictEqual(config.cdp.port, 9222);
    assert.strictEqual(config.mcp.port, 9223);
    assert.strictEqual(config.http.port, 9224);
  });
  
  it('should load existing config', () => {
    const existingConfig = {
      cdp: { port: 9999 },
      mcp: { port: 9998 },
      http: { port: 9997 },
      llm: { provider: 'openai' },
    };
    
    writeFileSync(testConfigPath, JSON.stringify(existingConfig));
    const config = loadConfig();
    
    assert.strictEqual(config.cdp.port, 9999);
    assert.strictEqual(config.mcp.port, 9998);
    assert.strictEqual(config.http.port, 9997);
  });
  
  it('should validate config with zod schema', () => {
    const invalidConfig = {
      cdp: { port: 'not-a-number' }, // port 应该是 number
      mcp: { enabled: 'yes' }, // enabled 应该是 boolean
    };
    
    writeFileSync(testConfigPath, JSON.stringify(invalidConfig));
    
    // 应该回退到默认配置并记录警告
    const config = loadConfig();
    assert.strictEqual(typeof config.cdp.port, 'number');
  });
  
  it('should save config', () => {
    const config = loadConfig();
    config.cdp.port = 12345;
    
    saveConfig(config);
    
    const saved = JSON.parse(readFileSync(testConfigPath, 'utf8'));
    assert.strictEqual(saved.cdp.port, 12345);
  });
  
  it('should patch config partially', () => {
    const config = loadConfig();
    config.cdp.port = 22222;
    
    patchConfig({ mcp: { port: 33333 } });
    
    const updated = currentConfig();
    assert.strictEqual(updated.cdp.port, 22222); // 保留之前的修改
    assert.strictEqual(updated.mcp.port, 33333);
  });
  
  it('should backup corrupted config', () => {
    // 创建损坏的配置
    writeFileSync(testConfigPath, 'not valid json {{{');
    
    const config = loadConfig();
    
    // 应该创建备份
    const backupFiles = readdirSync(testDir).filter(f => f.startsWith('config.json.bak'));
    assert.ok(backupFiles.length > 0, 'Should create backup of corrupted config');
    
    // 应该使用默认配置
    assert.ok(config.cdp);
  });
});
```

#### 2.4 添加工具集成测试

```javascript
// test/integration/tools-require-our-tab.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createMockWs, waitForWsOpen, MOCK_CDP_RESPONSES } from '../_helpers.js';
import { _setBrowserWsForTest, _resetForTest, sendPageCommand, sendCommand } from '../../lib/cdp/index.js';

describe('Tools - Tab Ownership Enforcement', () => {
  let mockWs;
  let mockPageWs;
  
  before(async () => {
    _resetForTest();
    
    // 创建 Mock Browser WS
    mockWs = createMockWs('ws://127.0.0.1:9222/devtools/browser');
    await waitForWsOpen(mockWs);
    _setBrowserWsForTest(mockWs, 'http://127.0.0.1:9222/json/version');
    
    // 创建 Mock Page WS
    mockPageWs = createMockWs('ws://127.0.0.1:9222/devtools/page/page-1');
    await waitForWsOpen(mockPageWs);
  });
  
  after(() => {
    mockWs?.close();
    mockPageWs?.close();
    _resetForTest();
  });
  
  describe('browser_navigate', () => {
    it('should reject navigation to user tab', async () => {
      // 模拟 user tab
      // isOurTab('user-tab-id') === false
      
      const result = await import('../../tools/browser_navigate.js')
        .then(m => m.execute({ 
          targetId: 'user-tab-id', 
          url: 'https://example.com' 
        }));
      
      assert.strictEqual(result.ok, false);
      assert.ok(result.error.includes('own tab'));
    });
    
    it('should allow navigation to our tab', async () => {
      // 模拟 our tab
      // markOurTab('our-tab-id');
      
      const result = await import('../../tools/browser_navigate.js')
        .then(m => m.execute({ 
          targetId: 'our-tab-id', 
          url: 'https://example.com' 
        }));
      
      assert.strictEqual(result.ok, true);
    });
  });
  
  describe('browser_click', () => {
    it('should reject click on user tab', async () => {
      const result = await import('../../tools/browser_click.js')
        .then(m => m.execute({ 
          targetId: 'user-tab-id', 
          selector: '#button' 
        }));
      
      assert.strictEqual(result.ok, false);
      assert.ok(result.error.includes('own tab'));
    });
  });
});
```

---

## 第六部分：文档与用户体验改进

### 一、文档现状分析

当前项目有较为完善的文档结构：

- `README.md` - 项目介绍和快速开始
- `HANDOFF.md` - 项目交接文档
- `docs/ARCHITECTURE.md` - 架构图解
- `docs/CODE_STATUS.md` - 代码状态追踪
- `CHANGELOG.md` - 版本更新记录
- `CONTRIBUTING.md` - 贡献指南

问题：

**README 中的工具列表不完整**。声称 79 个工具但没有列出具体清单。

**文档与代码脱节**。工具的实际功能状态没有文档化，用户无法判断哪些功能可用。

**缺乏故障排查指南**。FAQ 只有简单问题，没有常见错误场景的解决方案。

### 二、文档改进方案

#### 2.1 添加工具状态文档

```markdown
# 工具状态清单

本文档记录每个工具的实际功能状态。

## 状态定义

- ✅ **可用**: 功能完整，测试通过
- ⚠️ **部分可用**: 基础功能可用，高级特性缺失
- 🔧 **开发中**: 有基本实现但需要完善
- ❌ **不可用**: 功能缺失或依赖断裂
- 🚧 **实验性**: 功能可能不稳定

## 浏览器操控工具

| 工具名 | 状态 | 说明 |
|--------|------|------|
| browser_navigate | ✅ | 支持智能重试和等待条件 |
| browser_click | ✅ | 支持选择器和坐标 |
| browser_type | ✅ | 支持延迟和特殊键 |
| browser_screenshot | ✅ | 支持 PNG/JPEG 格式 |
| browser_hover | ✅ | 支持悬停事件 |
| browser_press_key | ✅ | 支持组合键 |
| browser_wait | ✅ | 支持多种等待条件 |

## 网络工具

| 工具名 | 状态 | 说明 |
|--------|------|------|
| browser_network | ✅ | 获取请求列表 |
| browser_network_get | ⚠️ | 基础版可用，增强版待开发 |
| browser_intercept | ✅ | 支持请求拦截和模拟 |
| browser_fetch | ⚠️ | 支持列表和 mock，拦截功能待完善 |
| browser_request_blocking | ✅ | 支持 URL 模式屏蔽 |
| browser_websocket | ❌ | 事件监听未实现 |
| browser_xhr_break | ✅ | 支持 XHR 断点 |

## 性能与调试工具

| 工具名 | 状态 | 说明 |
|--------|------|------|
| browser_tracing | 🔧 | 事件收集未完成 |
| browser_screencast | 🔧 | 帧处理未完成 |
| browser_audit_full | ⚠️ | 基础 metrics 可用，Audits 域待集成 |
| browser_debugger | ✅ | 支持断点/暂停/步进 |
| browser_heap_summary | ✅ | 支持 .heapsnapshot 解析 |

## 实验性工具

| 工具名 | 状态 | 说明 |
|--------|------|------|
| browser_extract_apis | ⚠️ | 功能可用，GUI 入口待添加 |
| browser_dump_structure | ⚠️ | 功能可用，GUI 入口待添加 |
| browser_animation | ✅ | 播放/暂停/速度控制 |
```
```

#### 2.2 改进 README 结构

```markdown
# WebPilot v4.0

> 让你的 AI 助手直接操作你的 Chrome。

## 快速开始

[安装指南](INSTALL.md) | [完整文档](docs/) | [故障排查](docs/TROUBLESHOOTING.md)

---

## 功能概览

### 核心能力

| 功能 | 工具数 | 状态 |
|------|--------|------|
| 浏览器操控 | 12 | ✅ 完整 |
| 网络监控 | 8 | ⚠️ 部分 |
| 性能调试 | 6 | 🔧 开发中 |
| JavaScript 执行 | 4 | ✅ 完整 |
| DOM 操作 | 7 | ✅ 完整 |

[查看完整工具清单](docs/TOOLS_STATUS.md)

### 支持的 AI 助手

- Claude Desktop / Claude Code
- Cursor
- Windsurf
- Continue
- MiniMax Code
- 自定义 MCP 客户端

### 支持的 LLM 厂商

OpenAI · Anthropic · Google · DeepSeek · 智谱 · 阿里云 · MiniMax · Ollama · 本地模型

---

## 常见问题

### 连接问题

**Q: AI 助手连不上 WebPilot**
1. 检查 WebPilot 是否运行（托盘图标）
2. 检查端口是否正确（默认 9223）
3. 运行 `Ctrl+K` → "修复连接"

**Q: Chrome 未连接**
1. 使用 WebPilot 安装时创建的 "Chrome (WebPilot)" 快捷方式启动 Chrome
2. 或手动启动：`chrome --remote-debugging-port=9222`

**Q: 端口被占用**
- WebPilot 会自动迁移到空闲端口（9228-9232）
- 查看右下角托盘通知了解实际端口

### 使用问题

**Q: 工具调用失败**
- 确认目标标签页是 WebPilot 创建的（不是用户手动打开的）
- 检查错误消息中的具体原因

**Q: 截图返回为空**
- 可能是页面还在加载，增加 waitAfterNavigation 参数

[更多问题...](docs/TROUBLESHOOTING.md)
```

#### 2.3 添加工具使用示例

```markdown
# 工具使用示例

## browser_navigate

### 基本用法

```javascript
{
  "name": "browser_navigate",
  "args": {
    "targetId": "page-123",
    "url": "https://example.com"
  }
}
```

### 高级用法：带等待条件

```javascript
{
  "name": "browser_navigate",
  "args": {
    "targetId": "page-123",
    "url": "https://example.com",
    "waitForSelector": "#search-button",
    "waitForNetworkIdle": true,
    "timeout": 30000,
    "retry": 2
  }
}
```

### 响应示例

```json
{
  "ok": true,
  "frameId": "frame-abc123",
  "loaderId": "loader-xyz789",
  "url": "https://example.com",
  "attempt": 1
}
```

## browser_extract_apis

### 用法

1. 在页面上进行正常操作（如搜索、登录等）
2. 调用工具提取 API：

```javascript
{
  "name": "browser_extract_apis",
  "args": {
    "targetId": "page-123",
    "minCalls": 2
  }
}
```

### 响应示例

```json
{
  "ok": true,
  "totalUniqueApis": 15,
  "totalCallsCaptured": 47,
  "apis": [
    {
      "url": "https://api.example.com/users/{id}",
      "method": "GET",
      "sources": ["fetch", "xhr"],
      "callCount": 12,
      "examples": [
        {
          "url": "https://api.example.com/users/123",
          "method": "GET"
        }
      ]
    }
  ]
}
```
```

---

## 第七部分：安全性与稳定性改进

### 一、安全问题识别

#### 1.1 输入验证不足

当前工具的输入验证主要依赖 Zod schema，但存在几个问题：

1. **缺少长度限制**：URL、选择器等字符串参数没有最大长度限制，可能导致 DoS。
2. **缺少格式验证**：URL 参数没有验证是否为有效 URL。
3. **缺少类型校验**：部分工具对参数类型的处理不够严格。

**修复方案**：

```javascript
// 添加工具参数验证中间件
import { z } from 'zod';

const URL_MAX_LENGTH = 2048;
const SELECTOR_MAX_LENGTH = 512;
const EXPRESSION_MAX_LENGTH = 10000;

export function createToolValidator(schema) {
  return function validateArgs(args, toolName) {
    // 应用 Zod schema
    const result = schema.safeParse(args);
    if (!result.success) {
      return {
        ok: false,
        error: `参数验证失败: ${result.error.message}`,
        details: result.error.issues,
      };
    }
    
    // 额外长度检查
    if (result.data.url && result.data.url.length > URL_MAX_LENGTH) {
      return {
        ok: false,
        error: `URL 长度超过限制 (${URL_MAX_LENGTH})`,
      };
    }
    
    if (result.data.selector && result.data.selector.length > SELECTOR_MAX_LENGTH) {
      return {
        ok: false,
        error: `选择器长度超过限制 (${SELECTOR_MAX_LENGTH})`,
      };
    }
    
    if (result.data.expression && result.data.expression.length > EXPRESSION_MAX_LENGTH) {
      return {
        ok: false,
        error: `表达式长度超过限制 (${EXPRESSION_MAX_LENGTH})`,
      };
    }
    
    return { ok: true, data: result.data };
  };
}

// 使用示例
const navigateSchema = z.object({
  targetId: z.string().min(1),
  url: z.string().url().max(URL_MAX_LENGTH),
  timeout: z.number().optional(),
});

export async function execute(args) {
  const validation = createToolValidator(navigateSchema)(args, 'browser_navigate');
  if (!validation.ok) return validation;
  // ...
}
```

#### 1.2 表达式注入风险

`browser_eval.js` 和类似工具直接执行用户提供的 JavaScript 表达式，存在注入风险。虽然在 CDP 层面有沙箱，但最佳实践是增加额外的安全层。

```javascript
// 添加表达式安全检查
const FORBIDDEN_PATTERNS = [
  /while\s*\(/,           // 无限循环
  /for\s*\(\s*;/,         // 无限 for 循环
  /\btimeout\b/i,         // setTimeout
  /\binterval\b/i,        // setInterval
  /\brequestAnimationFrame\b/,
  /\beval\b/,
  /\bFunction\b/,
  /\bimport\s*\(/,        // 动态 import
  /\brequire\s*\(/,       // CommonJS require
  /\bprocess\b/,
  /\bglobal\b/,
  /\bwindow\.open\b/,
  /\bdocument\.write\b/,
  /\balert\s*\(/,
  /\bconfirm\s*\(/,
  /\bprompt\s*\(/,
];

export function isExpressionSafe(expression) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(expression)) {
      return {
        safe: false,
        reason: `表达式包含禁止的模式: ${pattern}`,
      };
    }
  }
  return { safe: true };
}

export async function safeEvaluate(targetId, expression, options = {}) {
  const safety = isExpressionSafe(expression);
  if (!safety.safe && !options.bypassSafety) {
    throw new Error(`表达式不安全: ${safety.reason}`);
  }
  
  // 设置执行超时
  const timeout = options.timeout || 5000;
  
  return evaluate(targetId, expression, {
    ...options,
    executionTimeout: timeout,
    awaitPromise: options.awaitPromise ?? false,
  });
}
```

### 二、稳定性改进

#### 2.1 添加熔断器

```javascript
// lib/circuit-breaker.js
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this.calls = [];
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
      this.successes = 0;
    }
    
    if (this.state === 'HALF_OPEN' && this.calls.length >= this.halfOpenMaxCalls) {
      throw new Error('Circuit breaker max calls reached');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.halfOpenMaxCalls) {
        this.state = 'CLOSED';
      }
    }
  }
  
  onFailure() {
    this.failures++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
    };
  }
}

// 使用示例
const cdpCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
});

async function robustSendCommand(method, params, targetId, timeout) {
  return cdpCircuitBreaker.execute(() => 
    sendCommand(method, params, targetId, timeout)
  );
}
```

#### 2.2 添加健康检查端点

```javascript
// lib/health-check.js
export async function performHealthCheck() {
  const checks = {
    cdp: await checkCDPConnection(),
    mcp: await checkMCPServer(),
    http: await checkHTTPServer(),
    memory: checkMemoryUsage(),
    disk: checkDiskSpace(),
  };
  
  const allPassed = Object.values(checks).every(c => c.ok);
  
  return {
    ok: allPassed,
    timestamp: new Date().toISOString(),
    checks,
    summary: {
      passed: Object.values(checks).filter(c => c.ok).length,
      failed: Object.values(checks).filter(c => !c.ok).length,
    },
  };
}

async function checkCDPConnection() {
  try {
    const { isConnected } = await import('./cdp/index.js');
    const connected = isConnected();
    return { ok: connected, message: connected ? 'Connected' : 'Not connected' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function checkMemoryUsage() {
  const used = process.memoryUsage();
  const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
  
  return {
    ok: heapUsedPercent < 90,
    message: `Heap: ${Math.round(heapUsedPercent)}%`,
    details: {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
    },
  };
}
```

---

## 第八部分：性能优化建议

### 一、现状分析

经过代码审查，发现以下潜在性能问题：

**事件监听器泄漏**。部分工具（如 `browser_fetch.js`、`browser_screencast.js`）的事件监听器如果没有正确清理，会导致内存泄漏。

**Ring Buffer 配置**。activity-log 和 network-store 使用 10000 条的 ring buffer，在高流量场景下可能需要调整。

**工具加载延迟**。所有工具在 MCP/HTTP 服务器启动时全部加载，即使某些工具可能永远不会被使用。

### 二、优化方案

#### 2.1 延迟加载工具

```javascript
// lib/tool-loader.js - 优化版
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = path.join(process.cwd(), 'tools');

// 工具缓存
const _toolCache = new Map();
const _lazyTools = new Set();

// 预加载的工具（核心工具）
const EAGER_TOOLS = new Set([
  'browser_navigate',
  'browser_screenshot',
  'browser_click',
  'browser_type',
  'browser_tabs',
  'browser_list_tabs',
]);

export async function loadTool(name) {
  // 检查缓存
  if (_toolCache.has(name)) {
    return _toolCache.get(name);
  }
  
  // 检查是否是延迟工具
  if (_lazyTools.has(name) && !EAGER_TOOLS.has(name)) {
    // 延迟加载
    return loadToolAsync(name);
  }
  
  // 常规加载
  return loadToolSync(name);
}

async function loadToolAsync(name) {
  try {
    const filePath = path.join(TOOLS_DIR, `${name}.js`);
    const mod = await import(`file://${filePath.replace(/\\/g, '/')}`);
    
    const tool = {
      name: mod.name || name,
      description: mod.description || '',
      parameters: mod.parameters || {},
      execute: mod.execute,
      loadedAt: Date.now(),
    };
    
    _toolCache.set(name, tool);
    return tool;
  } catch (e) {
    throw new Error(`Failed to load tool ${name}: ${e.message}`);
  }
}

export async function loadAllTools(options = {}) {
  const { eagerOnly = false, filter } = options;
  
  const files = await readdir(TOOLS_DIR);
  const toolFiles = files.filter(f => f.startsWith('browser_') && f.endsWith('.js'));
  
  const tools = [];
  
  for (const file of toolFiles) {
    const name = file.replace(/\.js$/, '');
    
    // 应用过滤器
    if (filter && !filter(name)) continue;
    
    // 判断是否预加载
    const shouldPreload = EAGER_TOOLS.has(name) || !eagerOnly;
    
    if (shouldPreload) {
      try {
        const tool = await loadTool(name);
        if (tool) tools.push(tool);
      } catch (e) {
        console.error(`Failed to load tool ${name}:`, e.message);
      }
    } else {
      _lazyTools.add(name);
      // 添加占位符
      tools.push({
        name,
        description: '(lazy loaded)',
        parameters: {},
        execute: async () => ({ ok: false, error: 'Tool not loaded' }),
        loadedAt: null,
      });
    }
  }
  
  return tools;
}

export async function preloadTool(name) {
  if (!_lazyTools.has(name)) return;
  return loadToolAsync(name);
}
```

#### 2.2 优化 Ring Buffer 实现

```javascript
// daemon/ring-buffer.js - 优化版
export class RingBuffer {
  constructor(capacity = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }
  
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }
  
  toArray() {
    if (this.size === 0) return [];
    
    if (this.size < this.capacity) {
      return this.buffer.slice(0, this.size);
    }
    
    // 绕回来了，需要两个 slice
    const tail = this.buffer.slice(0, this.head);
    const front = this.buffer.slice(this.head);
    return [...front, ...tail];
  }
  
  slice(start = 0, end = this.size) {
    const arr = this.toArray();
    return arr.slice(start, end);
  }
  
  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }
  
  get length() {
    return this.size;
  }
}

// 带索引的 Ring Buffer（用于快速查找）
export class IndexedRingBuffer {
  constructor(capacity = 10000) {
    this.buffer = new RingBuffer(capacity);
    this._index = new Map(); // 索引 key -> [indices]
  }
  
  push(item, key) {
    const index = this.buffer.head;
    this.buffer.push(item);
    
    if (key) {
      const indices = this._index.get(key) || [];
      indices.push(index);
      if (indices.length > 10) indices.shift(); // 保留最近 10 个
      this._index.set(key, indices);
    }
  }
  
  findByKey(key) {
    const indices = this._index.get(key);
    if (!indices) return [];
    return indices
      .map(i => this.buffer.buffer[i])
      .filter(Boolean);
  }
  
  slice(start, end) {
    return this.buffer.slice(start, end);
  }
  
  clear() {
    this.buffer.clear();
    this._index.clear();
  }
}
```

---

## 第九部分：未来路线图建议

### 一、短期目标（v4.1，1-2个月）

1. **修复 P0 问题**
   - 完成 `browser_websocket.js` 修复
   - 完成 `browser_tracing.js` 修复
   - 完成 `browser_screencast.js` 修复

2. **完善 P1 问题**
   - 增强 `browser_fetch.js` 功能
   - 补充缺失的 `browser_click.js` 和 `browser_type.js`
   - 修复 GUI 中发现的交互问题

3. **测试覆盖**
   - 添加 daemon 模块单元测试
   - 添加工具集成测试
   - 建立 CI 流程

### 二、中期目标（v4.2，3-4个月）

1. **跨平台支持**
   - macOS Chrome 检测和连接
   - macOS GUI 适配
   - Linux 基本支持（Electron）

2. **高级功能**
   - 完整的工作流录制和回放
   - 书签管理器
   - 标签页同步

3. **性能优化**
   - 实现工具延迟加载
   - 优化事件系统
   - 添加性能监控

### 三、长期目标（v5.0，6个月以上）

1. **架构升级**
   - 微服务化重构
   - 插件系统
   - API Gateway

2. **企业功能**
   - 多用户支持
   - 审计日志
   - SSO 集成

3. **AI 增强**
   - 智能选择器生成
   - 自动页面测试
   - 视觉回归检测

---

## 附录

### A. 工具完整清单

[完整工具清单和状态](docs/TOOLS_STATUS.md)

### B. API 参考

[完整 API 参考](docs/API_REFERENCE.md)

### C. 配置选项

[配置指南](docs/CONFIGURATION.md)

### D. 开发指南

[开发指南](CONTRIBUTING.md)

---

*本文档由 AI 代码审查工具自动生成，最后更新于 2026-07-09*
