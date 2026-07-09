// src/components/whats-new-overlay.tsx — "What's new in 4.0.4" 首启弹层 (shadcn Dialog)
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface Props { onClose: () => void; }

const FEATURES = [
  { title: '崩溃不白屏', desc: 'ErrorBoundary 兜底:报错 → 错误卡 + Copy stack trace + 重启,daemon 同步上报' },
  { title: 'daemon 自动重启', desc: '后台崩了 → 3 秒自动拉起 + 系统通知(最多 3 次/进程)' },
  { title: '21 个工具直调', desc: 'Ctrl+K 命令面板:20 高频工具动态表单填参真执行 + 1 个浏览器命令' },
  { title: '监控全活', desc: '工作日志 + 网络抓包 + Chrome console 实时流(SSE 推送)' },
  { title: '浏览器面板 +3 按钮', desc: '截图 · DOM 快照 · 元素选择器,4 个 tab 可切换' },
  { title: '自动模式 5 模板', desc: '点击 → 跳聊天 + prompt 已填好,直接回车开跑' },
  { title: '录制器接 Chrome', desc: '录你在浏览器里的操作 → 可回放脚本' },
  { title: '聊天持久化', desc: 'localStorage 保留历史,刷新不丢,上次会话自动恢复' },
  { title: '主题加 system 模式', desc: '跟随 Windows 深浅色自动切' },
  { title: 'IPC 通道全通', desc: '托盘 / 菜单 / 快捷键全部能触发主进程动作' },
];

export function WhatsNewOverlay({ onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle>WebPilot v4.0.4 — 大而全</DialogTitle>
          </div>
          <DialogDescription>本版本 42 项更新</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-2 text-sm">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-1">
              <h3 className="font-medium text-foreground">· {f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
