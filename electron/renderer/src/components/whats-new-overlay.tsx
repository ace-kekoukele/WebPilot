// src/components/whats-new-overlay.tsx — "What's new in 4.0.3" 首启弹层
// P4 会用 Radix Dialog 重写;P1 先用 framer-motion 简单实现
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface Props { onClose: () => void; }

const FEATURES = [
  { title: 'Mac 级工业设计', desc: 'shadcn/ui 设计 token,Inter Variable + Noto Sans SC 自托管字体,framer-motion 180ms 过渡动画' },
  { title: '聊天升级', desc: 'markdown 渲染 + 流式光标 + 工具调用卡片 (类似 ChatGPT 桌面版体验)' },
  { title: '快捷键系统', desc: 'Ctrl+K 命令面板 · Ctrl+1/2/3/4 切模式 · F1 帮助 · Ctrl+, 设置' },
  { title: '即将发布:Electron 桌面端', desc: 'v4.0.3.1 提供 WebPilot Setup .exe 安装包,双击图标就能用' },
];

export function WhatsNewOverlay({ onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="What's new in WebPilot v4.0.3"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">WebPilot v4.0.3</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto p-5 text-sm">
            <p className="text-muted-foreground">本版本主要变化:</p>
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-1">
                <h3 className="font-medium text-foreground">· {f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border px-4 py-3">
            <Button size="sm" onClick={onClose}>知道了</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}