// src/components/theme-provider.tsx — 6 行手写 ThemeProvider + system 模式
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: 'dark' | 'light';
  rawTheme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'webpilot-theme';

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [rawTheme, setRawTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
  });

  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => getSystemTheme());

  // 监听系统主题变化
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const theme: 'dark' | 'light' = rawTheme === 'system' ? systemTheme : rawTheme;

  useEffect(() => {
    document.documentElement.dataset.themeMode = theme;
    localStorage.setItem(STORAGE_KEY, rawTheme);
  }, [theme, rawTheme]);

  const value: ThemeContextValue = {
    theme,
    rawTheme,
    setTheme: setRawTheme,
    toggle: () => setRawTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
