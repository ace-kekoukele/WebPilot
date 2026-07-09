# 配置选项

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BB_CDP_PORT` | `9222` | Chrome CDP 端口 |
| `BB_CDP_HOST` | `127.0.0.1` | Chrome 主机 |
| `BB_HTTP_PORT` | `9224` | HTTP API 端口 |
| `BB_HTTP_HOST` | `127.0.0.1` | HTTP API 主机 |
| `BB_CDP_TIMEOUT` | `30000` | CDP 命令超时（毫秒） |
| `BB_HTTP_CORS_ORIGIN` | `http://127.0.0.1:*` | CORS 允许来源 |
| `BB_LOG_LEVEL` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |
| `BB_CHROME_PATH` | （自动检测） | Chrome 可执行文件路径 |
| `BB_USER_DATA_DIR` | （临时目录） | Chrome 用户数据目录 |

## 配置文件

配置文件位于 `~/.webpilot/config.json`：

```json
{
  "cdpPort": 9222,
  "cdpHost": "127.0.0.1",
  "httpPort": 9224,
  "httpHost": "127.0.0.1",
  "chromePath": "",
  "logLevel": "info",
  "llm": {
    "active": "openai",
    "providers": {
      "openai": { "model": "gpt-4o", "apiKey": "" },
      "anthropic": { "model": "claude-3-5-sonnet", "apiKey": "" }
    }
  },
  "theme": "system",
  "autoLaunch": false
}
```

## LLM 配置

在设置面板（GUI）或 `config.json` 中配置：

```json
"llm": {
  "active": "openai",
  "providers": {
    "openai": {
      "model": "gpt-4o",
      "apiKey": "sk-..."
    },
    "anthropic": {
      "model": "claude-3-5-sonnet",
      "apiKey": "sk-ant-..."
    }
  }
}
```

## 启动参数

### Chrome 启动

```powershell
chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-webpilot"
```

### daemon 独立启动

```bash
node daemon/main.js
# 指定端口
BB_HTTP_PORT=9333 node daemon/main.js
```

### Electron 桌面端启动

```bash
npm run electron
# 或双击 dist/WebPilot Setup 4.0.4.exe
```

## 调试

### 开启 debug 日志

```bash
BB_LOG_LEVEL=debug node daemon/main.js
```

### CDP 命令日志

`lib/cdp/transport.js` 中所有 CDP 发送/接收都会打印到 stderr：

```
[ws:_browser] SEND id=5 method=Runtime.evaluate isPage=false
[ws:_browser] recv id=5 method=undefined hasErr=false
```

### 网络调试

Chrome DevTools → Network 面板可看到 `~/.webpilot/network/` 下的 JSONL 文件。

## 主题

支持三种主题模式：

- `light` — 浅色
- `dark` — 深色
- `system` — 跟随操作系统（默认）
