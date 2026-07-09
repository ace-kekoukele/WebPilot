// src/App.tsx — 主应用 (4 模式 Sidebar + TopBar + 主内容)
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { BottomDrawer } from './components/BottomDrawer';
import { ToastContainer, useToasts } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { HelpOverlay } from './components/HelpOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import { RepairDialog } from './components/RepairDialog';
import { Wizard } from './components/Wizard';
import { BrowserPanel } from './panels/BrowserPanel';
import { ChatPanel } from './panels/ChatPanel';
import { AutomationPanel } from './panels/AutomationPanel';
import { MonitorPanel } from './panels/MonitorPanel';
import { useAppStore } from './store';
import { apiGet } from './lib/api';

type Mode = 'browser' | 'chat' | 'automation' | 'monitor' | 'wizard';

export function App() {
  const [mode, setMode] = useState<Mode>('browser');
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('webpilot-theme') as 'dark' | 'light') || 'dark'
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const store = useAppStore();
  const toasts = useToasts();
  const [tools, setTools] = useState<any[]>([]);

  // 设置主题属性
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('webpilot-theme', theme);
  }, [theme]);

  // 启动时加载工具 + 健康检查
  useEffect(() => {
    Promise.all([
      apiGet('/api/health').then((h) => {
        store.setHealth(h);
        // 端口迁移提醒 (v4.0 重点: 让用户看见实际端口)
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

    // 5s 轮询
    const timer = setInterval(() => {
      apiGet('/api/health').then((h) => store.setHealth(h)).catch(() => {});
      apiGet('/api/agents').then((r) => store.setAgents(r.agents || [])).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K — 命令面板
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault(); setPaletteOpen((v) => !v); return;
      }
      // Ctrl+1/2/3/4 — 模式
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['1','2','3','4'].includes(e.key)) {
        e.preventDefault();
        const map: any = { '1': 'browser', '2': 'chat', '3': 'automation', '4': 'monitor' };
        setMode(map[e.key]);
        return;
      }
      // Ctrl+, — 设置
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault(); setSettingsOpen(true); return;
      }
      // F1 — 帮助
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
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenRepair={openRepair}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="layout">
        <Sidebar mode={mode} onChange={setMode} />
        <main className="main">
          {mode === 'browser' && <BrowserPanel tools={tools} />}
          {mode === 'chat' && <ChatPanel onToast={toasts.push} />}
          {mode === 'automation' && <AutomationPanel tools={tools} />}
          {mode === 'monitor' && <MonitorPanel />}
          {mode === 'wizard' && <Wizard onDone={() => setMode('browser')} />}
        </main>
      </div>
      <BottomDrawer open={drawerOpen} onToggle={() => setDrawerOpen((v) => !v)} onOpenRepair={openRepair} />

      {paletteOpen && <CommandPalette tools={tools} onClose={() => setPaletteOpen(false)} onToast={toasts.push} onOpenRepair={openRepair} onOpenSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }} />}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
      {repairOpen && <RepairDialog onClose={() => setRepairOpen(false)} onToast={toasts.push} />}
      <ToastContainer toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}
