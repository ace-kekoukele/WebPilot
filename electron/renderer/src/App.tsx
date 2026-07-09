// src/App.tsx — 主应用 (4 模式 Sidebar + TopBar + 主内容, framer-motion 模式切换动画)
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/sidebar';
import { TopBar } from './components/topbar';
import { BottomDrawer } from './components/bottom-drawer';
import { ToastContainer, useToasts } from './components/Toast';
import { CommandPalette } from './components/command-palette';
import { HelpOverlay } from './components/help-overlay';
import { SettingsOverlay } from './components/settings-overlay';
import { RepairDialog } from './components/repair-dialog';
import { Wizard } from './components/Wizard';
import { WhatsNewOverlay } from './components/whats-new-overlay';
import { BrowserPanel } from './panels/BrowserPanel';
import { ChatPanel } from './panels/ChatPanel';
import { AutomationPanel } from './panels/AutomationPanel';
import { MonitorPanel } from './panels/MonitorPanel';
import { useAppStore } from './store';
import { useTheme } from './components/theme-provider';
import { apiGet } from './lib/api';

type Mode = 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';

const WHATS_NEW_KEY = 'webpilot-seen-whats-new';
const CURRENT_VERSION = '4.0.3';

const MODE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const },
};

export function App() {
  const [mode, setMode] = useState<Mode>('browser');
  const { theme, toggle: toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState<boolean>(() => {
    return localStorage.getItem(WHATS_NEW_KEY) !== CURRENT_VERSION;
  });
  const store = useAppStore();
  const toasts = useToasts();
  const [tools, setTools] = useState<any[]>([]);

  const dismissWhatsNew = useCallback(() => {
    localStorage.setItem(WHATS_NEW_KEY, CURRENT_VERSION);
    setWhatsNewOpen(false);
  }, []);

  // 首启 — "What's new" 已在初始化 state 时检查,无需 useEffect

  // 启动时加载工具 + 健康检查
  useEffect(() => {
    Promise.all([
      apiGet('/api/health').then((h) => {
        store.setHealth(h);
        const ports = (h as any)?.ports;
        const defaults: any = { cdp: 9222, mcp: 9223, http: 9224, control: 9225 };
        if (ports) {
          const migrated: any[] = [];
          for (const k of Object.keys(defaults)) {
            if (ports[k] && ports[k] !== defaults[k]) {
              migrated.push({ name: k, from: defaults[k], to: ports[k] });
            }
          }
          if (migrated.length > 0) {
            toasts.push({
              kind: 'warn',
              title: '端口已自动迁移',
              description: migrated.map((m) => `${m.name}: ${m.from}→${m.to}`).join(', '),
              duration: 12000,
              actions: [{ label: '改回默认', onClick: () => setSettingsOpen(true) }],
            });
          }
        }
      }),
      apiGet('/api/tools/list').then((r) => setTools(r.tools || [])).catch(() => setTools([])),
      apiGet('/api/agents').then((r) => store.setAgents(r.agents || [])).catch(() => {}),
    ]).catch(() => {});

    const timer = setInterval(() => {
      apiGet('/api/health').then((h) => store.setHealth(h)).catch(() => {});
      apiGet('/api/agents').then((r) => store.setAgents(r.agents || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault(); setPaletteOpen((v) => !v); return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['1','2','3','4'].includes(e.key)) {
        e.preventDefault();
        const map: any = { '1': 'browser', '2': 'chat', '3': 'automation', '4': 'monitor' };
        setMode(map[e.key]);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault(); setSettingsOpen(true); return;
      }
      if (e.key === 'F1' || (e.key === '?' && !['INPUT','TEXTAREA'].includes((e.target as any)?.tagName))) {
        e.preventDefault(); setHelpOpen(true); return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openRepair = useCallback(() => setRepairOpen(true), []);

  return (
    <div className="app-root">
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenRepair={openRepair}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="layout">
        <Sidebar mode={mode} onChange={setMode} />
        <main className="main flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              {...MODE_TRANSITION}
              className="h-full overflow-y-auto"
            >
              {mode === 'browser' && <BrowserPanel tools={tools} />}
              {mode === 'chat' && <ChatPanel onToast={toasts.push} />}
              {mode === 'automation' && <AutomationPanel tools={tools} />}
              {mode === 'monitor' && <MonitorPanel />}
              {mode === 'wizard' && <Wizard onDone={() => setMode('browser')} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomDrawer open={drawerOpen} onToggle={() => setDrawerOpen((v) => !v)} onOpenRepair={openRepair} />

      {whatsNewOpen && <WhatsNewOverlay onClose={dismissWhatsNew} />}
      {paletteOpen && <CommandPalette tools={tools} onClose={() => setPaletteOpen(false)} onToast={toasts.push} onOpenRepair={openRepair} onOpenSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }} />}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
      {repairOpen && <RepairDialog onClose={() => setRepairOpen(false)} onToast={toasts.push} />}
      <ToastContainer toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}