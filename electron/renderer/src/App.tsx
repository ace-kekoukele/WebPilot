// src/App.tsx — WebPilot v4.0.4 Redesign
// Clean architecture: Sidebar nav + TopBar + panel switching + overlays
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, RefreshCw, Wrench } from 'lucide-react';
import { Sidebar } from './components/sidebar';
import { TopBar } from './components/topbar';
import { BottomDrawer } from './components/bottom-drawer';
import { pushToast } from './components/Toast';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
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
import { store } from './store';
import { useTheme } from './components/theme-provider';
import { useConnectionStatus } from './hooks/use-connection-status';
import { apiGet } from './lib/api';

type Mode = 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';

const WHATS_NEW_KEY = 'webpilot-seen-whats-new';
const CURRENT_VERSION = '4.0.4';

const panelTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const },
};

export function App() {
  const [mode, setMode] = useState<Mode>('browser');
  const { theme, toggle: toggleTheme } = useTheme();

  // Overlay states
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState<boolean>(() => {
    return localStorage.getItem(WHATS_NEW_KEY) !== CURRENT_VERSION;
  });
  const dismissWhatsNew = useCallback(() => {
    localStorage.setItem(WHATS_NEW_KEY, CURRENT_VERSION);
    setWhatsNewOpen(false);
  }, []);

  const [tools, setTools] = useState<any[]>([]);

  // Connection monitoring
  const connStatus = useConnectionStatus();
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    if (!connStatus.connected && connStatus.lastChecked > 0) {
      setWasDisconnected(true);
    }
    if (connStatus.connected && wasDisconnected) {
      setWasDisconnected(false);
      pushToast({ kind: 'success', title: 'Daemon 已重新连接' });
    }
  }, [connStatus.connected, connStatus.lastChecked]);

  // Initialization: health + tools + agents
  useEffect(() => {
    const init = async () => {
      try {
        const h = await apiGet('/api/health');
        store.setHealth(h);
        const ports = (h as any)?.ports;
        const defaults: Record<string, number> = { cdp: 9222, mcp: 9223, http: 9224, control: 9225 };
        if (ports) {
          const migrated: Array<{ name: string; from: number; to: number }> = [];
          for (const k of Object.keys(defaults)) {
            if (ports[k] && ports[k] !== defaults[k]) {
              migrated.push({ name: k, from: defaults[k], to: ports[k] });
            }
          }
          if (migrated.length > 0) {
            pushToast({
              kind: 'warn',
              title: '端口已自动迁移',
              description: migrated.map(m => `${m.name}: ${m.from}→${m.to}`).join(', '),
              duration: 12000,
              actions: [{ label: '改回默认', onClick: () => setSettingsOpen(true) }],
            });
          }
        }
      } catch {
        console.warn('[WebPilot] Initial health check failed');
      }

      try {
        const r = await apiGet('/api/tools/list');
        setTools(r.tools || []);
      } catch {
        setTools([]);
      }

      try {
        const r = await apiGet('/api/agents');
        store.setAgents(r.agents || []);
      } catch {
        // agents endpoint may not exist
      }
    };

    init();

    const timer = setInterval(() => {
      apiGet('/api/health').then(h => store.setHealth(h)).catch(() => {});
      apiGet('/api/agents').then(r => store.setAgents(r.agents || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        setPaletteOpen(v => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, Mode> = { '1': 'browser', '2': 'chat', '3': 'automation', '4': 'monitor' };
        setMode(map[e.key]);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (e.key === 'F1' || (e.key === '?' && !isInput)) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // IPC menu/tray commands
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onMenuCommand) return;
    const off = api.onMenuCommand((cmd: string) => {
      switch (cmd) {
        case 'openSettings': setSettingsOpen(true); break;
        case 'openRepair': setRepairOpen(true); break;
        case 'openHelp': setHelpOpen(true); break;
        case 'openPalette': setPaletteOpen(v => !v); break;
      }
    });
    return off;
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

      {/* Connection lost banner */}
      {!connStatus.connected && connStatus.lastChecked > 0 && (
        <div className="flex items-center justify-between bg-destructive/8 border-b border-destructive/15 px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs text-destructive">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Daemon 未连接 — {connStatus.error || '请检查 WebPilot 服务是否运行'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => pushToast({ kind: 'info', title: '正在重试连接...' })}
            >
              <RefreshCw className="h-3 w-3" /> 重试
            </Button>
            <Button size="sm" variant="outline" className="h-6 gap-1 text-xs" onClick={openRepair}>
              <Wrench className="h-3 w-3" /> 一键修复
            </Button>
          </div>
        </div>
      )}

      <div className="layout">
        <Sidebar mode={mode} onChange={setMode} />
        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              {...panelTransition}
              className="mode-panel"
            >
              {mode === 'browser' && <BrowserPanel tools={tools} />}
              {mode === 'chat' && <ChatPanel onToast={pushToast} />}
              {mode === 'automation' && <AutomationPanel tools={tools} onSwitchMode={setMode} />}
              {mode === 'monitor' && <MonitorPanel />}
              {mode === 'wizard' && <Wizard onDone={() => setMode('browser')} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomDrawer
        open={drawerOpen}
        onToggle={() => setDrawerOpen(v => !v)}
        onOpenRepair={openRepair}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Overlays */}
      {whatsNewOpen && <WhatsNewOverlay onClose={dismissWhatsNew} />}
      {paletteOpen && (
        <CommandPalette
          tools={tools}
          onClose={() => setPaletteOpen(false)}
          onToast={pushToast}
          onOpenRepair={openRepair}
          onOpenSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }}
          onOpenHelp={() => { setPaletteOpen(false); setHelpOpen(true); }}
        />
      )}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
      {repairOpen && <RepairDialog onClose={() => setRepairOpen(false)} onToast={pushToast} />}
      <Toaster />
    </div>
  );
}
