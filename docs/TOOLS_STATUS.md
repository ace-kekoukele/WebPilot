# 工具状态清单

> 由 TOOL_STATUS.json 自动生成，请勿手动编辑。


## 状态定义

| 状态 | 含义 |
|------|------|
| ✅ complete | 完整实现，功能正常 |
| ⚠️ partial | 部分实现，核心功能可用 |
| 🔧 broken | 空壳或已损坏，需修复 |
| 🚧 experimental | 实验性，功能不稳定 |

## browser-action

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_action | ✅ complete | 页面交互: click / fill / type / hover |

## browser-animation

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_animation | ✅ complete | CSS 动画控制: 播放/暂停/速度/查询 |

## browser-audit

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_audit_full | ⚠️ partial | 基础 metrics 可获取，Audit.getAudits 增强功能未实现 |

## browser-audits

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_audits | ✅ complete | Performance/SEO/Accessibility 审计 (Chrome 150 Audits 域) |

## browser-ay

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_a11y | ✅ complete | 无障碍树查询 + 元素 a11y 属性 (Chrome 150 Accessibility 域) |

## browser-cache

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_cache_storage | ✅ complete | Cache Storage 管理: 列出 cache / entries / 删除 (Chrome 150 CacheS |

## browser-click

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_click | ✅ complete | selector + 坐标点击 + mousePressed/mouseReleased 完整实现 |

## browser-close

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_close_tab | ⚠️ partial | 关闭标签页 |

## browser-connect

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_connect | ⚠️ partial | 连接 Chrome CDP |

## browser-console

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_console | ✅ complete | Enable Console.log 监听 (CDP Console.enable) |
| browser_console_log | ✅ complete | Console 拦截 + 严重性过滤 (Chrome 150 Log 域) |
| browser_console_messages | ✅ complete | Runtime.getConsoleMessages 完整实现，daemon console-stream 已接入 |

## browser-cookies

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_cookies | ✅ complete | Browser-level Cookie 管理 (get/set/clear) |

## browser-css

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_css | ✅ complete | CSS 操作: getComputedStyle + stylesheet 读取 |
| browser_css_coverage | ✅ complete | CSS 覆盖率: 找出未使用的 CSS 规则 (Chrome 150 CSSCoverage) |

## browser-debugger

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_debugger | ✅ complete | Debugger.enable/setBreakpoint/list 完整实现 |
| browser_debugger_remove | ✅ complete | 移除断点 (alias of browser_debugger remove) |
| browser_debugger_resume | ⚠️ partial | Resume paused execution |
| browser_debugger_select_frame | ⚠️ partial | Debugger.setAsyncCallStackDepth + Page frame select |

## browser-dialog

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_dialog | ✅ complete | 预设置弹窗处理 (accept/dismiss/clear) — 弹窗后自动应用 |

## browser-disconnect

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_disconnect | ⚠️ partial | 断开 Chrome CDP 连接 |

## browser-doctor

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_doctor | ✅ complete | 健康检查: Chrome CDP + 版本 + Node |

## browser-dom

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_dom | ✅ complete | Document object model operations: querySelector, querySelect |
| browser_dom_breakpoint | ✅ complete | DOM 修改断点: 子树/属性/节点删除时暂停 (Chrome 150 DOMDebugger 增强) |
| browser_dom_snapshot | ✅ complete | DOMSnapshot.captureSnapshot 完整实现 |

## browser-drag

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_drag | ✅ complete | 拖拽 (mouse.move + drag) |

## browser-dump

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_dump_js | ✅ complete | 提取 window.* 全局 / inline scripts / 函数 (§3.5.1 前端逆向) |
| browser_dump_structure | ✅ complete | 提取页面结构 + 表单 + 链接 + meta + 入口点 (§3.5.1 前端逆向) |

## browser-emulation

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_emulation | ✅ complete | 设备/网络/UA 模拟 |

## browser-eval

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_eval | ✅ complete | 16 种 FORBIDDEN patterns 安全检查完整实现 |

## browser-extract

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_extract_apis | ⚠️ partial | 基础 metrics 可获取，Audit.getAudits 增强功能未实现 |

## browser-fetch

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_fetch | ✅ complete | enable/disable/list/intercept 四种 action 全部实现 |

## browser-fill

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_fill_form | ✅ complete | 批量填充多字段表单 |

## browser-headless

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_headless | ✅ complete | 新 Headless 模式控制: beginFrame/Screenshot (Chrome 150 HeadlessE |

## browser-health

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_health | ⚠️ partial | 检查 Chrome CDP 连接 + 列 tabs |

## browser-heap

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_heap | ✅ complete | Heap snapshot: snapshot/summary |
| browser_heap_retainers | ✅ complete | 查找指定节点的 retainers (简化: 基于 .heapsnapshot JSON) |
| browser_heap_retaining_paths | ✅ complete | 查找 GC root → nodeName 的保留路径 (简化) |
| browser_heap_summary | ✅ complete | 读取 .heapsnapshot 返回摘要 |

## browser-hover

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_hover | ⚠️ partial | Hover element via mouseMoved |

## browser-indexeddb

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_indexeddb | ✅ complete | IndexedDB 高级操作: list databases/stores/get all (Chrome 150 In |

## browser-install

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_install | ⚠️ partial | 插件安装状态 |

## browser-intercept

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_intercept | ✅ complete | Fetch 拦截 — 启用/禁用 拦截指定 URL pattern |

## browser-js

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_js_heap_node | ✅ complete | 找 JS 对象的 GC root + 引用链 (Chrome 150 HeapProfiler) |

## browser-layer

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_layer_tree | ✅ complete | 图层树查询: 合成层 + 性能调试 (Chrome 150 LayerTree 域) |

## browser-list

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_list_tabs | ⚠️ partial | 列出 Chrome 标签页 (alias of browser_tabs list) |

## browser-memory

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_memory | ✅ complete | 内存状态查询 + 压力模拟 (Chrome 150 Memory 域) |

## browser-navigate

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_navigate | ✅ complete | 重试 + waitForSelector + waitForNetworkIdle 全部实现 |

## browser-network

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_network | ✅ complete | daemon network-store 已接入，SSE 流式推送，详情/重放/拦截全实现 |
| browser_network_get | ⚠️ partial | 查 network request 详情 |

## browser-new

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_new_tab | ⚠️ partial | 创建新标签页 |

## browser-overlay

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_overlay | ✅ complete | DOM Overlay 控制: 高亮/查询布局 (Chrome 150 Overlay 域) |

## browser-performance

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_performance_metrics | ✅ complete | Performance.getMetrics 完整实现，含 FPS/Memory/Heap |

## browser-press

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_press_key | ✅ complete | 按单个键 (Enter/Tab/Escape/...) |

## browser-request

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_request_blocking | ✅ complete | 屏蔽 URL 模式 (Network.blockedUrls) (Chrome 150 Network 域增强) |
| browser_request_initiator | ⚠️ partial | 查 network request 的发起者信息 |

## browser-resize

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_resize | ✅ complete | 调整 viewport 大小 |

## browser-screencast

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_screencast | ✅ complete | screencastFrame 帧写入磁盘 + JPEG 编码完整实现 |

## browser-script

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_script | ✅ complete | 页面加载的脚本源码操作 (list/get/search) |

## browser-security

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_security | ✅ complete | 安全状态查询: HTTPS/证书/不安全内容 (Chrome 150 Security 域) |

## browser-service

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_service_worker | ✅ complete | Service Worker 管理: 列表/停止/取消注册 (Chrome 150) |

## browser-set

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_set_enabled | ⚠️ partial | 开启/关闭 browser-bridge 插件 |

## browser-setup

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_setup | ⚠️ partial | 初始化检查 (Chrome + port + tools) |

## browser-snapshot

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_snapshot | ✅ complete | 获取页面的 accessibility tree (accessibleName + role) |

## browser-state

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_state | ⚠️ partial | Bridge 内部状态 (connected/tabs/pending) |

## browser-storage

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_storage | ⚠️ partial | localStorage/ sessionStorage 可获取，IndexedDB 未实现 |

## browser-tabs

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_tabs | ✅ complete | 管理 Chrome 标签页: list / open / close |

## browser-target

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_target | ✅ complete | Target attach/detach/send-command (iframe / SW / OOP) |

## browser-tracing

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_tracing | ⚠️ partial | Page.startTrace/Page.endTrace 基础可用，远程 trace 传输未实现 |

## browser-type

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_type | ✅ complete | 延迟输入 + clear + pressEnter 完整实现 |

## browser-upload

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_upload | ✅ complete | 通过 <input type=file> 上传文件 |

## browser-wait

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_wait | ✅ complete | 轮询等待页面 JavaScript 条件为 true |
| browser_wait_for | ✅ complete | Wait for element by CSS selector / text content |

## browser-websocket

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_websocket | ✅ complete | WebSocketFrameReceived/Sent/Error 全局事件监听已实现 |

## browser-xhr

| 工具 | 状态 | 说明 |
|------|------|------|
| browser_xhr_break | ✅ complete | XHR/fetch 断点 (按 URL pattern) |
