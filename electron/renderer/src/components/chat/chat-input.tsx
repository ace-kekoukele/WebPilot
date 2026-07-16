// src/components/chat/chat-input.tsx — Refined chat input
// Textarea + @tool autocomplete + provider select + send
import { useEffect, useState } from 'react';
import { Send, AlertTriangle, X, CornerDownLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

export interface ChatTool {
  name: string;
  description?: string;
}

interface Props {
  tools: ChatTool[];
  busy: boolean;
  hasActiveProvider: boolean;
  providers: Array<{ id: string; name: string }>;
  activeProvider: string | null;
  onProviderChange: (id: string | null) => void;
  onSend: (text: string) => void;
  quoteContent?: string | null;
  onClearQuote?: () => void;
  initialDraft?: string | null;
}

export function ChatInput({
  tools,
  busy,
  hasActiveProvider,
  providers,
  activeProvider,
  onProviderChange,
  onSend,
  quoteContent,
  onClearQuote,
  initialDraft,
}: Props) {
  const [input, setInput] = useState('');
  const [caretPos, setCaretPos] = useState(0);
  const [atPopover, setAtPopover] = useState(false);
  const [atQuery, setAtQuery] = useState('');

  // Initial draft from template
  useEffect(() => {
    if (initialDraft) setInput(initialDraft);
  }, [initialDraft]);

  const matches = tools
    .filter(t => t.name?.toLowerCase().includes(atQuery.toLowerCase()))
    .slice(0, 8);

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput('');
  };

  return (
    <div className="chat-input-area">
      <div className="chat-input-inner">
        {/* Quote banner */}
        {quoteContent && onClearQuote && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">引用:</span>
            <span className="line-clamp-1 flex-1 truncate italic text-muted-foreground">
              "{quoteContent}"
            </span>
            <button onClick={onClearQuote} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={e => {
              const val = e.target.value;
              setInput(val);
              const pos = e.target.selectionStart;
              setCaretPos(pos);
              const before = val.slice(0, pos);
              const atIdx = before.lastIndexOf('@');
              if (atIdx >= 0 && !before.slice(atIdx).includes(' ')) {
                setAtQuery(before.slice(atIdx + 1));
                setAtPopover(true);
              } else {
                setAtPopover(false);
              }
            }}
            onKeyDown={e => {
              if (atPopover && e.key === 'Escape') {
                setAtPopover(false);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息... Enter 发送 · Shift+Enter 换行 · @ 引用工具"
            rows={2}
            disabled={busy}
            className="chat-input-textarea"
          />

          {/* @ tool autocomplete popover */}
          {atPopover && (
            <div className="absolute bottom-full left-0 z-50 mb-1 max-h-60 w-72 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
              {matches.length > 0 ? (
                matches.map(t => (
                  <button
                    key={t.name}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      const pos = caretPos;
                      const before = input.slice(0, pos);
                      const atIdx = before.lastIndexOf('@');
                      const after = input.slice(pos);
                      const inserted = t.name + ' ';
                      setInput(before.slice(0, atIdx) + inserted + after);
                      setAtPopover(false);
                      setAtQuery('');
                    }}
                  >
                    <span className="font-mono font-medium text-primary">@{t.name}</span>
                    <span className="truncate text-muted-foreground">{t.description}</span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">无匹配工具</p>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-2">
          <select
            value={activeProvider || ''}
            onChange={e => onProviderChange(e.target.value || null)}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{hasActiveProvider ? '当前 LLM' : '未配置 LLM'}</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {!hasActiveProvider && (
            <span className="inline-flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="h-3 w-3" />
              未配置
            </span>
          )}

          <div className="flex-1" />

          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <CornerDownLeft className="h-3 w-3" />
            Enter 发送
          </span>

          <Button
            size="sm"
            onClick={handleSend}
            disabled={busy || !input.trim()}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {busy ? '生成中...' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  );
}
