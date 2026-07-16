// src/components/whats-new-overlay.tsx — "What's new" 首启弹层 (shadcn Dialog)
import { Sparkles, Keyboard, Zap, Globe, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface Props { onClose: () => void; }

const VERSION = '4.0.4';

const FEATURES = [
  { icon: Zap, title: '崩溃不白屏', desc: 'ErrorBoundary 兜底:报错 → 错误卡 + Copy stack trace + 重启' },
  { icon: Zap, title: 'daemon 自动重启', desc: '后台崩了 → 3 秒自动拉起 + 系统通知' },
  { icon: Keyboard, title: '21 个工具直调', desc: 'Ctrl+K 命令面板:搜索工具 + 动态表单填参真执行' },
  { icon: Globe, title: '浏览器面板增强', desc: '截图 · DOM 快照 · 元素选择器 · Tab 搜索/多选' },
  { icon: Zap, title: '监控全活', desc: '工作日志 + 网络抓包 + Chrome console 实时流(SSE)' },
  { icon: MessageSquare, title: '聊天增强', desc: '引用回复 · 消息复制 · @工具补全 · 历史持久化' },
  { icon: Keyboard, title: '快捷键指南', desc: 'Ctrl+1-4 切换模式 · Ctrl+K 命令面板 · @ 工具补全' },
  { icon: Zap, title: '配置导出/导入', desc: '设置可导出 JSON 备份,下次一键导入' },
  { icon: Zap, title: '主题跟随系统', desc: '自动跟随 Windows 深浅色' },
  { icon: Zap, title: 'IPC 通道全通', desc: '托盘 / 菜单 / 快捷键全部能触发主进程动作' },
];

const QUICK_TIPS = [
  ['Ctrl+K', '打开命令面板,搜索工具'],
  ['Ctrl+1/2/3/4', '快速切换模式'],
  ['@', '在聊天里输入工具名补全'],
  ['点击 AI 回复', '引用到输入框'],
];

export function WhatsNewOverlay({ onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle>WebPilot v{VERSION} — 大而全</DialogTitle>
          </div>
          <DialogDescription>本次更新 {FEATURES.length} 项新功能</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-2 text-sm">
          {/* 功能列表 */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <f.icon className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* 快捷键提示 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">快速上手</h4>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_TIPS.map(([k, d]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
                  <span className="text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>开始使用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
