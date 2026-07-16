// src/components/chat/session-sidebar.tsx — Refined session list
import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, MessageSquare } from 'lucide-react';
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
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function SessionSidebar({ sessions, currentId, onNew, onSelect, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startRename = (s: ChatSession) => {
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <span className="chat-sidebar-title">会话</span>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onNew} title="新建会话">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="chat-session-list">
          {sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无会话</p>
          ) : (
            sessions.map(s => {
              const isActive = s.id === currentId;
              const isEditing = s.id === editingId;

              return (
                <div
                  key={s.id}
                  className={cn(
                    'group relative rounded-md transition-colors',
                    isActive ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-1 py-0.5">
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmRename();
                          if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                        }}
                        className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                        autoFocus
                      />
                      <button onClick={confirmRename} className="flex h-5 w-5 items-center justify-center rounded text-success hover:bg-success/10">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => { setEditingId(null); setEditTitle(''); }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelect(s.id)}
                        className="chat-session w-full text-left"
                      >
                        <MessageSquare className={cn('chat-session-icon h-3 w-3', isActive && 'text-primary')} />
                        <span className="truncate">{s.title}</span>
                      </button>
                      {/* Hover actions */}
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={e => { e.stopPropagation(); startRename(s); }}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="重命名"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="删除"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
