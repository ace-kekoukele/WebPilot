// src/components/chat/stream-cursor.tsx — 流式输出末尾闪烁光标
import { motion } from 'framer-motion';

interface Props {
  visible: boolean;
}

export function StreamCursor({ visible }: Props) {
  if (!visible) return null;
  return (
    <motion.span
      className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 rounded-sm bg-current align-middle"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  );
}