// src/components/chat/session-sidebar.tsx — 会话列表 (new button + scrollable list)
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

export interface ChatSession {
  id: string;
  title: string;
  messages: any[];
}

interface Props {
  sessions: ChatSession[];
  currentId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
}

export function SessionSidebar({ sessions, currentId, onNew, onSelect }: Props) {
  return (
    <div className="flex w-56 flex-col gap-2 border-r border-border p-2">
      <Button size="sm" onClick={onNew} className="w-full justify-start gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        新会话
      </Button>
      <div className="flex flex-col gap-0.5">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent',
              s.id === currentId ? 'bg-accent text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}