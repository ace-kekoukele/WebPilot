# WebPilot

> 让你的 AI 助手(Claude / Cursor / ...)直接操作你电脑上的 Chrome。
> 双击图标就用,不用懂任何技术。

[![version](https://img.shields.io/badge/version-4.0.4-blue)] [![tests](https://img.shields.io/badge/tests-201%2F201-brightgreen)] [![license](https://img.shields.io/badge/license-MIT-green)]

---

## 3 步开始

1. **下载安装包** — [WebPilot Setup 4.0.4.exe (91 MB)](https://github.com/webpilot/webpilot/releases/latest)
2. **双击装好** — "下一步 → 下一步 → 完成",桌面出现 `WebPilot` 图标
3. **启动 Chrome + 双击桌面图标** — 看到桌面应用,搞定

> macOS / Linux 用户:见下方"开发者安装"。v4.4+ 才考虑 macOS;Linux 不在路线图上。

---

## 它能做什么

| 用 AI 助手... | 你能做... |
|---|---|
| 🌐 **点网页** | "帮我点搜索按钮"、"填这个表单"、"下载这个文件" |
| 📝 **抓数据** | "把这个表格 100 行的内容抓下来" |
| 🔄 **自动化** | "每天早上 9 点打开这个页面,看价格有没有变" |
| 🕵️ **监控** | "看哪些 API 调用失败了,贴日志给我" |
| 🎬 **录脚本** | "录下我刚才的操作,下次自动跑" |

用**你已经登录**的网站 — 不另起浏览器、不丢 cookie、不踢掉你的会话。

---

## 怎么让 AI 助手连上 WebPilot

在 Claude Desktop / Cursor / Windsurf / Continue 等任意 AI 助手的配置文件里加一段 JSON:

```json
{
  "mcpServers": {
    "webpilot": {
      "url": "http://127.0.0.1:9223/mcp"
    }
  }
}
```

然后重启 AI 助手。它会**自动发现** WebPilot 提供 79 个工具(点网页、抓数据、监控网络...),**自动用你的 Chrome** 来干活。

不需要碰任何 npm 脚本、不需要懂 JSON 协议。WebPilot 跑着就行。

---

## 截图

应用启动后看到 4 个标签页:

| 标签 | 功能 |
|---|---|
| 🌐 **浏览器** | 实时画面预览 + 元素选择器(像 DevTools) |
| 💬 **AI 助手** | 直接和 AI 聊天,流式输出,工具调用可视化 |
| 📋 **自动化** | 工作流编辑器 + 录制器 + 模板库 |
| 📊 **监控** | Activity Log + Network + Console(像 Chrome DevTools) |

> 完整截图见 [docs/screenshots/](docs/screenshots/)

---

## 常见问题

**端口被占了怎么办?**
→ 桌面右下角托盘(WebPilot 小图标)右键 → "修复"。它会**自动把被占用的端口迁移到 9228-9232**,你不用动。

**Chrome 没启?**
→ 双击桌面 "Chrome (WebPilot)"(装 WebPilot 时自动创建的快捷方式)。它会用 debug 端口 9222 启动 Chrome。

**看不到窗口?**
→ 看右下角托盘(WebPilot 小图标)。点它一下就能唤回窗口。也可以右键托盘 → "打开 WebPilot"。

**AI 助手连不上?**
→ 顶栏右上角应该显示绿色 "Claude Code" 之类的标识。如果是红色或没显示,按 <kbd>Ctrl</kbd>+<kbd>K</kbd> 调命令面板,搜"修复"。

**LLM 怎么配 API key?**
→ 顶栏 ⚙ → "LLM API" → 选厂商(OpenAI / Anthropic / DeepSeek / MiniMax / 智谱 / Ollama / ...)→ 粘贴 key → 保存。

---

## 给开发者

源码安装(git clone 仓库后):
```powershell
git clone https://github.com/webpilot/webpilot.git
cd webpilot
npm install
npm run build          # 构建 React GUI
npm run electron       # 开发模式(带热重载)
npm run dist           # 打 NSIS 安装包 (~91MB)
```

跑测试:
```bash
npm test               # 201 个 case
npm run check          # 后端语法检查
```

文档:
- [HANDOFF.md](HANDOFF.md) — 项目交接文档
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构图 + 模块划分
- [docs/CODE_STATUS.md](docs/CODE_STATUS.md) — 代码状态 / 待办
- [CONTRIBUTING.md](CONTRIBUTING.md) — 怎么贡献

---

## 谁在维护

给用户和好友用,MIT 协议,自由改自由发。

有问题 / 建议:[提个 issue](https://github.com/webpilot/webpilot/issues)

---

**版本:** v4.0.4 (2026-07-09) — 大而全版本 · 42 项更新