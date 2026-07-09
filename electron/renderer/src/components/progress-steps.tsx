// src/components/progress-steps.tsx — 分步进度指示器 (向导/修复进度)
import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';
import { cn } from '../lib/cn';

export interface Step {
  id: string;
  title: string;
  description?: string;
  status?: 'pending' | 'active' | 'completed' | 'error';
  icon?: React.ReactNode;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep?: string;
  direction?: 'horizontal' | 'vertical';
  onStepClick?: (step: Step) => void;
}

export function ProgressSteps({
  steps,
  currentStep,
  direction = 'horizontal',
  onStepClick,
}: ProgressStepsProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'horizontal' && 'items-center gap-0',
        direction === 'vertical' && 'flex-col gap-4'
      )}
    >
      {steps.map((step, index) => {
        const status = step.status || (currentStep === step.id ? 'active' : 'pending');
        const isLast = index === steps.length - 1;
        const isCompleted = status === 'completed';
        const isActive = status === 'active';
        const isError = status === 'error';

        return (
          <div
            key={step.id}
            className={cn(
              'flex',
              direction === 'horizontal' && 'items-center',
              direction === 'vertical' && 'flex-row gap-3'
            )}
          >
            {/* Step indicator */}
            <button
              onClick={() => onStepClick?.(step)}
              disabled={!onStepClick}
              className={cn(
                'flex flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                direction === 'horizontal' && 'h-8 w-8',
                direction === 'vertical' && 'h-10 w-10',
                isCompleted && 'border-success bg-success text-success-foreground',
                isActive && 'border-primary bg-primary text-primary-foreground',
                isError && 'border-destructive bg-destructive text-destructive-foreground',
                !isCompleted && !isActive && !isError && 'border-muted-foreground/30 bg-muted text-muted-foreground'
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : isError ? (
                <span className="text-sm">✗</span>
              ) : isActive ? (
                step.icon || <Circle className="h-3 w-3 animate-pulse" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </button>

            {/* Step content (vertical only) */}
            {direction === 'vertical' && (
              <div className="flex flex-col">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-foreground',
                    !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="text-xs text-muted-foreground">{step.description}</span>
                )}
              </div>
            )}

            {/* Connector line */}
            {!isLast && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isCompleted ? 1 : 0 }}
                className={cn(
                  'bg-muted-foreground/30',
                  direction === 'horizontal' && 'mx-2 h-px w-12 flex-shrink-0',
                  direction === 'vertical' && 'absolute left-4 top-12 h-8 w-px -translate-y-6'
                )}
                style={{ transformOrigin: 'left' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inline progress bar variant
export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  variant = 'default',
}: {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const variantClass =
    variant === 'success'
      ? 'bg-success'
      : variant === 'warning'
      ? 'bg-warning'
      : variant === 'error'
      ? 'bg-destructive'
      : 'bg-primary';

  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercent && <span className="text-muted-foreground">{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={cn('h-full rounded-full', variantClass)}
        />
      </div>
    </div>
  );
}
