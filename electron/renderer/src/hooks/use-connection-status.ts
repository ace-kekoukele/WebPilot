// src/hooks/use-connection-status.ts — daemon 连接状态监控
import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

export interface ConnectionStatus {
  connected: boolean;
  cdpConnected: boolean;
  version: string;
  toolCount: number;
  uptime: number;
  lastChecked: number;
  error?: string;
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    cdpConnected: false,
    version: '',
    toolCount: 0,
    uptime: 0,
    lastChecked: 0,
  });

  const check = useCallback(async () => {
    try {
      const h = await apiGet('/api/health');
      setStatus({
        connected: true,
        cdpConnected: !!h.cdpConnected,
        version: h.version || '',
        toolCount: h.toolCount || 0,
        uptime: h.uptime || 0,
        lastChecked: Date.now(),
        error: undefined,
      });
    } catch (e: any) {
      setStatus(prev => ({
        ...prev,
        connected: false,
        cdpConnected: false,
        lastChecked: Date.now(),
        error: e.message || '连接失败',
      }));
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [check]);

  return status;
}
