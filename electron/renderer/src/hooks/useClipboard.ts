// src/hooks/useClipboard.ts — 剪贴板 Hook
import { useState, useCallback } from 'react';

export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copy = useCallback(async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), timeout);
      return true;
    } catch (err) {
      setError(err as Error);
      setCopied(false);
      return false;
    }
  }, [timeout]);

  return { copy, copied, error };
}
