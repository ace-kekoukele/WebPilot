// src/components/context-menu.tsx — 右键菜单 (用于 Tab/工具项等)
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  action?: () => void;
  submenu?: MenuItem[];
}

interface ContextMenuProps {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    // Adjust position if menu goes off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let newX = x;
      let newY = y;
      if (x + rect.width > vw) newX = vw - rect.width - 8;
      if (y + rect.height > vh) newY = vh - rect.height - 8;
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.separator) return;
    item.action?.();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ left: position.x, top: position.y }}
        className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-popover shadow-lg"
      >
        <div className="py-1">
          {items.map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                  item.disabled
                    ? 'cursor-not-allowed text-muted-foreground opacity-50'
                    : item.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'hover:bg-accent'
                }`}
              >
                {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-muted-foreground">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      </motion.div>
    </>
  );
}

// Hook for context menu
export function useContextMenu() {
  const [menu, setMenu] = useState<{ items: MenuItem[]; x: number; y: number } | null>(null);

  const showMenu = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    setMenu({ items, x: e.clientX, y: e.clientY });
  };

  const hideMenu = () => setMenu(null);

  const ContextMenuComponent = menu ? (
    <ContextMenu
      items={menu.items}
      x={menu.x}
      y={menu.y}
      onClose={hideMenu}
    />
  ) : null;

  return { showMenu, hideMenu, ContextMenuComponent };
}
