// src/components/chat/message-bubble.tsx — Refined message bubble
import { lazy, Suspense, useState } from 'react';
import { Bot, User, Info, Copy, Quote, Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { StreamCursor } from './stream-cursor';
import { ToolCallList } from './tool-call-card';

const Markdown = lazy(() => import('./markdown').then(m => ({ default: m.Markdown })));

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  streaming?: boolean;
  onQuote?: (content: string) => void;
}

export function MessageBubble({ role, content, toolCalls, streaming, onQuote }: Props) {
  const [copied, setCopied] = useState(false);

  // System message: centered banner
  if (role === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
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
    <div className={cn('chat-msg', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn('chat-msg-avatar', isUser ? '' : '')}>
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        )}
      </div>

      {/* Body */}
      <div className="chat-msg-body">
        {/* Header */}
        <div className="chat-msg-header">
          <span className="chat-msg-role">{isUser ? '你' : 'AI 助手'}</span>
          <div className="chat-msg-actions">
            <button onClick={handleCopy} className="chat-msg-action" title="复制">
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </button>
            {onQuote && !isUser && content && (
              <button onClick={() => onQuote(content)} className="chat-msg-action" title="引用">
                <Quote className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="chat-msg-content">
          {isUser ? (
            <div className="user-msg">{content}</div>
          ) : (
            <>
              <Suspense fallback={<div className="whitespace-pre-wrap">{content}</div>}>
                <Markdown content={content} className="chat-markdown" />
              </Suspense>
              {showCursor && <StreamCursor visible />}
            </>
          )}
        </div>

        {/* Tool calls */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="mt-2">
            <ToolCallList calls={toolCalls} />
          </div>
        )}
      </div>
    </div>
  );
}
