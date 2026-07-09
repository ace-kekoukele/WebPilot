// src/components/loading-overlay.tsx — 全屏加载遮罩 (用于页面级操作)
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  variant?: 'full' | 'inline';
}

export function LoadingOverlay({ loading, message, variant = 'full' }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`flex items-center justify-center ${
            variant === 'full' ? 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm' : 'absolute inset-0 z-10'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            {message && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm text-muted-foreground"
              >
                {message}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Skeleton loading for cards
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="grid gap-2 border-b border-border px-3 py-2">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-muted"
          style={{ width: `${60 + Math.random() * 40}%` }}
        />
      ))}
    </div>
  );
}
