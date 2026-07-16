// src/lib/fonts.ts — 预加载字体定义 (供 index.html preload + main.tsx import)
export const FONT_FAMILIES = {
  inter: 'Inter Variable',
  notoSC: 'Noto Sans SC',
} as const;

export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const FONT_STACK = `${FONT_FAMILIES.inter}, ${FONT_FAMILIES.notoSC}, system-ui, -apple-system, "Segoe UI", sans-serif`;