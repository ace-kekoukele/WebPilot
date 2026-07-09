# API 参考

> Base URL: `http://127.0.0.1:9224`
> 所有 POST 请求需要 `Content-Type: application/json`
> 所有响应含 `Access-Control-Allow-Origin` header

## 健康与状态

### `GET /api/health`
检查 daemon 健康状态。
```json
{ "ok": true, "version": "4.0.4", "cdp": "connected" }
```

### `GET /api/repair`
触发修复流程（CDP 清理、重连）。
```json
{ "ok": true, "cleared": true }
```

## 工具

### `GET /api/tools/list`
列出所有可用工具。
```json
{ "ok": true, "tools": [{ "name": "browser_navigate", "description": "...", "parameters": {...} }] }
```

### `POST /api/tools/call`
调用工具。
```json
// Request
{ "name": "browser_navigate", "args": { "targetId": "...", "url": "https://example.com" } }
// Response
{ "ok": true, "value": { "frameId": "...", "url": "https://example.com" } }
```

### `POST /api/cdp/send`
直接发送 CDP 命令。
```json
// Request
{ "method": "Page.navigate", "params": { "url": "..." }, "targetId": "..." }
// Response
{ "frameId": "...", "loaderId": "..." }
```

## 浏览器标签页

### `GET /api/browser/tabs`
列出 Chrome tabs。
```json
{ "ok": true, "tabs": { "user": [...], "agent": [...] } }
```

## Console

### `GET /api/console/stream`
SSE 流，实时 Console 事件。
```
data: {"kind":"console","type":"log","args":["hello"],"ts":1234567890}
data: {"kind":"log","type":"warn","text":"..."}
```

### `GET /api/console/recent`
获取最近 Console 事件（最多 50 条）。
```json
{ "ok": true, "entries": [...] }
```

## 网络 (Network)

### `GET /api/network/list`
列出捕获的网络请求。
```json
GET /api/network/list?urlPattern=api.&method=GET&status=200&limit=50
```

### `GET /api/network/get?requestId=xxx`
获取单个请求详情（含响应体）。
```json
{ "ok": true, "request": { "method": "GET", "url": "...", "headers": {}, "responseBody": "..." } }
```

### `POST /api/network/replay`
重发请求（可改 header/body）。
```json
// Request
{ "requestId": "xxx", "overrides": { "headers": { "X-Custom": "v" } } }
```

### `GET /api/network/schema?requestId=xxx`
推断 API schema（从响应体字段类型）。
```json
{ "ok": true, "schema": { "url": "...", "status": 200, "fields": ["id: string", "name: string"] } }
```

### `POST /api/network/clear`
清空网络记录。

### `POST /api/network/break`
添加请求断点（屏蔽 URL）。
```json
POST /api/network/break { "urlPattern": "*.ads.*" }
```

### `GET /api/network/breaks`
列出当前断点规则。

### `DELETE /api/network/breaks`
清空断点规则。

## 录制器

### `POST /api/recorder/start`
开始录制。
```json
{ "ok": true, "recordingId": "rec-001" }
```

### `POST /api/recorder/stop`
停止录制。
```json
{ "ok": true, "events": [...], "durationMs": 5230 }
```

### `GET /api/recorder/status`
当前录制状态。

### `GET /api/recorder/events`
获取录制事件列表。

## LLM 配置

### `GET /api/llm/providers`
列出可用 LLM 提供商。

### `POST /api/llm/active`
切换活跃 LLM。
```json
POST /api/llm/active { "provider": "openai", "model": "gpt-4o" }
```

### `POST /api/llm/chat`
发送聊天请求（SSE 流式）。
```
POST /api/llm/chat { "messages": [...], "provider": "openai" }
```

## 配置

### `GET /api/settings/<key>`
读取配置项。

### `POST /api/settings/<key>`
写入配置项。

## 格式导出

### `GET /api/formats/openai`
导出 OpenAI 工具格式。

### `GET /api/formats/anthropic`
导出 Anthropic 工具格式。

### `GET /api/formats/gemini`
导出 Gemini MCP 工具格式。

### `GET /api/openapi.json`
OpenAPI 3.0 schema。

## 端口

### `GET /api/ports`
获取当前 CDP/WebSocket 端口配置。

### `POST /api/ports`
设置端口。
```json
POST /api/ports { "cdpPort": 9222, "httpPort": 9224 }
```

## 活动日志

### `GET /api/activity`
查询工具调用日志。
```
GET /api/activity?ok=false&limit=50
```
