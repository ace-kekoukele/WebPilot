// src/components/chat/markdown.tsx — react-markdown + remark-gfm + rehype-sanitize (lazy load)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface Props { content: string; className?: string; }

export function Markdown({ content, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>
          ),
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          code: ({ className, children, ...rest }) => (
            <code className={`rounded bg-muted px-1 py-0.5 font-mono text-[12px] ${className || ''}`} {...rest}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-auto rounded-md bg-muted p-2 font-mono text-[12px]">{children}</pre>
          ),
          h1: ({ children }) => <h1 className="mt-2 mb-1 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 mb-1 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1.5 mb-1 text-sm font-medium">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
          ),
          table: ({ children }) => <table className="my-2 w-full text-xs">{children}</table>,
          th: ({ children }) => <th className="border-b border-border bg-muted/40 px-2 py-1 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}