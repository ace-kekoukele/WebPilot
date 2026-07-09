// src/components/whats-new-overlay.tsx — "What's new in 4.0.3" 首启弹层 (shadcn Dialog)
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface Props { onClose: () => void; }

const FEATURES = [
  { title: 'Mac 级工业设计', desc: 'shadcn/ui 设计 token, Inter Variable + Noto Sans SC 自托管字体, framer-motion 180ms 过渡' },
  { title: '聊天升级', desc: 'markdown 渲染 + 流式光标 + 工具调用卡片 (ChatGPT 桌面版体验)' },
  { title: '快捷键系统', desc: 'Ctrl+K 命令面板 · Ctrl+1/2/3/4 切模式 · F1 帮助 · Ctrl+, 设置' },
  { title: '即将发布: Electron 桌面端', desc: 'v4.0.3.1 提供 WebPilot Setup .exe 安装包' },
];

export function WhatsNewOverlay({ onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle>WebPilot v4.0.3</DialogTitle>
          </div>
          <DialogDescription>本版本主要变化</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-2 text-sm">
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