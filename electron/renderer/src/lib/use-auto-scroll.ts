// src/lib/use-auto-scroll.ts — 新消息自动滚到底 (替代 scrollIntoView)
import { useEffect, useRef } from 'react';

export function useAutoScroll<T extends HTMLElement>(deps: any[]) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}