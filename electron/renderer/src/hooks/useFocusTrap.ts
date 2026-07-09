// src/hooks/useFocusTrap.ts — 焦点陷阱 Hook (弹窗内 Tab 焦点不逃逸)
import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // Store current focus
    previousFocus.current = document.activeElement as HTMLElement;

    // Focus first element
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: go to last if on first, else previous
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: go to first if on last, else next
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [isActive, getFocusableElements]);

  return containerRef;
}

// Panel transition directions
export type TransitionDirection = 'forward' | 'backward' | 'none';

export function usePanelTransition() {
  const directionRef = useRef<TransitionDirection>('none');

  const transitionTo = useCallback((direction: TransitionDirection) => {
    directionRef.current = direction;
  }, []);

  const getVariants = useCallback(() => ({
    initial: (direction: TransitionDirection) => ({
      opacity: 0,
      x: direction === 'forward' ? 20 : direction === 'backward' ? -20 : 0,
    }),
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    },
    exit: (direction: TransitionDirection) => ({
      opacity: 0,
      x: direction === 'forward' ? -20 : direction === 'backward' ? 20 : 0,
      transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
    }),
  }), []);

  return { direction: directionRef.current, transitionTo, getVariants };
}
