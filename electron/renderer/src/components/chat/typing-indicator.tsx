// src/components/chat/typing-indicator.tsx — 3 点脉冲 (AI 思考中)
import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 text-muted-foreground" aria-label="AI 正在思考">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-current"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}