// src/components/chat/message-bubble.tsx — 单条消息气泡 (头像 + markdown + tool-call + stream cursor + 操作)
import { lazy, Suspense } from 'react';
import { Bot, User, Info, Copy, Quote, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { StreamCursor } from './stream-cursor';
import { ToolCallList } from './tool-call-card';

// react-markdown lazy 加载 — Chat tab 才付钱
const Markdown = lazy(() => import('./markdown').then((m) => ({ default: m.Markdown })));

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  streaming?: boolean;
  onQuote?: (content: string) => void;
}

export function MessageBubble({ role, content, toolCalls, streaming, onQuote }: Props) {
  const [copied, setCopied] = useState(false);

  if (role === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';
  const showCursor = !!streaming && !isUser;

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={cn('group flex gap-2.5 px-1 py-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-secondary text-secondary-foreground' : 'bg-primary/15 text-primary',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('flex min-w-0 max-w-[85%] flex-col', isUser ? 'items-end' : 'items-start')}>
        <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{isUser ? '你' : 'AI'}</span>
          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={handleCopy} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="复制">
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </button>
            {onQuote && !isUser && (
              <button onClick={() => onQuote(content)} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title="引用">
                <Quote className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-card-foreground',
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          ) : (
            <>
              <Suspense fallback={<div className="whitespace-pre-wrap">{content}</div>}>
                <Markdown content={content} className="chat-markdown" />
              </Suspense>
              {showCursor && <StreamCursor visible />}
            </>
          )}
        </div>
        {toolCalls && toolCalls.length > 0 && <ToolCallList calls={toolCalls} />}
      </div>
    </div>
  );
}