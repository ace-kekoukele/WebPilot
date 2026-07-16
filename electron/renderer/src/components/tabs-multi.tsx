// src/components/tabs-multi.tsx — 多层级 Tabs 组件 (支持嵌套 + 拖拽排序)
import { useState, useRef, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { X, GripVertical } from 'lucide-react';
import { cn } from '../lib/cn';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  closable?: boolean;
  disabled?: boolean;
  content: React.ReactNode;
}

interface TabsMultiProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabReorder?: (tabs: Tab[]) => void;
}

export function TabsMulti({
  tabs: initialTabs,
  defaultTab,
  onTabChange,
  onTabClose,
  onTabReorder,
}: TabsMultiProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || initialTabs[0]?.id);
  const [tabs, setTabs] = useState(initialTabs);

  const handleTabChange = useCallback((id: string) => {
    setActiveTab(id);
    onTabChange?.(id);
  }, [onTabChange]);

  const handleTabClose = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTab === id && newTabs.length > 0) {
      setActiveTab(newTabs[0].id);
    }
    onTabClose?.(id);
  }, [tabs, activeTab, onTabClose]);

  const handleReorder = useCallback((newTabs: Tab[]) => {
    setTabs(newTabs);
    onTabReorder?.(newTabs);
  }, [onTabReorder]);

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex h-full flex-col">
      <Reorder.Group
        axis="x"
        values={tabs}
        onReorder={handleReorder}
        className="flex items-center gap-1 border-b border-border bg-muted/30 px-2"
      >
        {tabs.map((tab) => (
          <Reorder.Item
            key={tab.id}
            value={tab}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm transition-colors',
              'hover:bg-accent/50',
              activeTab === tab.id && 'border-primary bg-background text-foreground',
              tab.disabled && 'cursor-not-allowed opacity-50'
            )}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
          >
            <GripVertical className="h-3 w-3 flex-shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span className="truncate max-w-[120px]">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-medium text-primary">
                {tab.badge}
              </span>
            )}
            {tab.closable !== false && (
              <button
                onClick={(e) => handleTabClose(tab.id, e)}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <div className="flex-1 overflow-auto p-4">
        {activeContent}
      </div>
    </div>
  );
}
