// src/components/help-overlay.tsx — 帮助 (4 个 React 组件 tab, shadcn Tabs + Dialog)
import { Keyboard, BookOpen, Wrench, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

interface Props { onClose: () => void; }

const KEYS = [
  ['Ctrl+K', '命令面板'],
  ['F1 / ?', '帮助'],
  ['Esc', '关闭弹窗'],
  ['Ctrl+1/2/3/4', '切换 4 个模式'],
  ['Ctrl+,', '设置'],
  ['Enter', '发送(在聊天)'],
  ['Shift+Enter', '换行(在聊天)'],
] as const;

const TEMPLATES = [
  ['网站逆向', '分析目标页面结构 + 抓 API'],
  ['批量抓表格', '列表 URL → 抓表格 → CSV'],
  ['登录 + 抓 Cookie', '登录并导出 cookie'],
  ['批量填表', 'CSV → 填表 → 提交'],
  ['监控变化', '轮询 URL, 变化时截图'],
] as const;

const REPAIR = [
  ['Chrome 不连', '桌面双击 "Chrome (WebPilot)" 启 Chrome. 或跑 chrome --remote-debugging-port=9222'],
  ['端口被占', 'daemon 启动时自动迁移到 9226+. 在 WebPilot 顶栏 🔌 看实际端口'],
  ['MCP 连不上', 'Claude Desktop 配置里 url 改成 http://127.0.0.1:{MCP 端口}/mcp'],
  ['LLM 不回答', '设置 → LLM API 配 key. 16 个厂商预设有'],
  ['Agent 检测不到', '本工具通过 passive listener 自动检测'],
] as const;

const FAQ = [
  ['Q: WebPilot 是 Electron 应用吗?', 'A: v4.0.3 是. 双击 WebPilot.exe 弹独立窗口'],
  ['Q: 支持哪些 Agent?', 'A: Claude Desktop / Cursor / Continue / MiniMax Code / Hermes'],
  ['Q: 为什么不自己起一个 Chrome?', 'A: 你已经在 Chrome 里登录好的网站直接复用'],
] as const;

export function HelpOverlay({ onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>WebPilot 帮助</DialogTitle>
          <DialogDescription>快捷键 / 模板 / 修复 / FAQ</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="keys" className="px-4 pb-4">
          <TabsList className="mb-3">
            <TabsTrigger value="keys" className="gap-1.5"><Keyboard className="h-3 w-3" />快捷键</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5"><BookOpen className="h-3 w-3" />模板</TabsTrigger>
            <TabsTrigger value="repair" className="gap-1.5"><Wrench className="h-3 w-3" />修复</TabsTrigger>
            <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="h-3 w-3" />FAQ</TabsTrigger>
          </TabsList>
          <TabsContent value="keys">
            <table className="w-full">
              <tbody>
                {KEYS.map(([k, d]) => (
                  <tr key={k} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-4"><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd></td>
                    <td className="py-1.5 text-muted-foreground">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
          <TabsContent value="templates">
            <div className="space-y-3">
              {TEMPLATES.map(([name, desc]) => (
                <div key={name}>
                  <h3 className="font-semibold text-foreground">{name}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="repair">
            <div className="space-y-3">
              {REPAIR.map(([k, v]) => (
                <div key={k}>
                  <h3 className="font-semibold text-foreground">{k}</h3>
                  <p className="text-xs text-muted-foreground">{v}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="faq">
            <div className="space-y-3">
              {FAQ.map(([q, a]) => (
                <div key={q}>
                  <h3 className="font-semibold text-foreground">{q}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{a}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}