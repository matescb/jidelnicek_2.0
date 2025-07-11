import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { RouteLogEntry } from './types';

interface RouteLoggerProps {
  onLog?: (entry: RouteLogEntry) => void;
  enableConsoleLog?: boolean;
  enableLocalStorage?: boolean;
  localStorageKey?: string;
  maxEntries?: number;
  includeMetadata?: (location: Location) => Record<string, any>;
  children?: React.ReactNode;
}

export const RouteLogger: React.FC<RouteLoggerProps> = ({
  onLog,
  enableConsoleLog = process.env.NODE_ENV === 'development',
  enableLocalStorage = false,
  localStorageKey = 'route-history',
  maxEntries = 100,
  includeMetadata,
  children,
}) => {
  const location = useLocation();
  const [logs, setLogs] = useState<RouteLogEntry[]>([]);
  const previousLocationRef = useRef<Location | null>(null);
  const navigationStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const timestamp = Date.now();
    const duration = previousLocationRef.current
      ? timestamp - navigationStartRef.current
      : undefined;

    const logEntry: RouteLogEntry = {
      timestamp,
      from: previousLocationRef.current?.pathname || '',
      to: location.pathname,
      action: location.state?.action || 'PUSH',
      duration,
      metadata: includeMetadata?.(location),
    };

    // Update logs state
    setLogs((prevLogs) => {
      const newLogs = [...prevLogs, logEntry].slice(-maxEntries);
      
      // Save to localStorage if enabled
      if (enableLocalStorage) {
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(newLogs));
        } catch (error) {
          console.error('Failed to save route logs to localStorage:', error);
        }
      }
      
      return newLogs;
    });

    // Console logging
    if (enableConsoleLog) {
      console.group(`Route Navigation: ${logEntry.from} → ${logEntry.to}`);
      console.log('Timestamp:', new Date(timestamp).toISOString());
      console.log('Action:', logEntry.action);
      if (duration) {
        console.log('Duration:', `${duration}ms`);
      }
      if (logEntry.metadata) {
        console.log('Metadata:', logEntry.metadata);
      }
      console.groupEnd();
    }

    // Custom log handler
    if (onLog) {
      onLog(logEntry);
    }

    // Update refs for next navigation
    previousLocationRef.current = location;
    navigationStartRef.current = timestamp;
  }, [location, enableConsoleLog, enableLocalStorage, localStorageKey, maxEntries, includeMetadata, onLog]);

  // Load logs from localStorage on mount
  useEffect(() => {
    if (enableLocalStorage) {
      try {
        const savedLogs = localStorage.getItem(localStorageKey);
        if (savedLogs) {
          setLogs(JSON.parse(savedLogs));
        }
      } catch (error) {
        console.error('Failed to load route logs from localStorage:', error);
      }
    }
  }, [enableLocalStorage, localStorageKey]);

  return <>{children}</>;
};

// Hook to access route logs
export const useRouteLogs = (localStorageKey: string = 'route-history') => {
  const [logs, setLogs] = useState<RouteLogEntry[]>([]);

  useEffect(() => {
    const loadLogs = () => {
      try {
        const savedLogs = localStorage.getItem(localStorageKey);
        if (savedLogs) {
          setLogs(JSON.parse(savedLogs));
        }
      } catch (error) {
        console.error('Failed to load route logs:', error);
      }
    };

    loadLogs();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === localStorageKey) {
        loadLogs();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [localStorageKey]);

  const clearLogs = () => {
    setLogs([]);
    try {
      localStorage.removeItem(localStorageKey);
    } catch (error) {
      console.error('Failed to clear route logs:', error);
    }
  };

  const getNavigationPatterns = () => {
    const patterns: Record<string, number> = {};
    
    logs.forEach((log) => {
      const pattern = `${log.from} → ${log.to}`;
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });

    return Object.entries(patterns)
      .sort(([, a], [, b]) => b - a)
      .map(([pattern, count]) => ({ pattern, count }));
  };

  const getAverageNavigationTime = (from?: string, to?: string) => {
    const relevantLogs = logs.filter((log) => {
      if (from && log.from !== from) return false;
      if (to && log.to !== to) return false;
      return log.duration !== undefined;
    });

    if (relevantLogs.length === 0) return null;

    const totalDuration = relevantLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
    return totalDuration / relevantLogs.length;
  };

  const getMostVisitedRoutes = (limit: number = 10) => {
    const routeCounts: Record<string, number> = {};
    
    logs.forEach((log) => {
      routeCounts[log.to] = (routeCounts[log.to] || 0) + 1;
    });

    return Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([route, visits]) => ({ route, visits }));
  };

  return {
    logs,
    clearLogs,
    getNavigationPatterns,
    getAverageNavigationTime,
    getMostVisitedRoutes,
  };
};

// Performance monitoring component
interface RoutePerformanceMonitorProps {
  threshold?: number;
  onSlowNavigation?: (entry: RouteLogEntry) => void;
  children?: React.ReactNode;
}

export const RoutePerformanceMonitor: React.FC<RoutePerformanceMonitorProps> = ({
  threshold = 1000,
  onSlowNavigation,
  children,
}) => {
  const handleLog = (entry: RouteLogEntry) => {
    if (entry.duration && entry.duration > threshold) {
      console.warn(
        `Slow navigation detected: ${entry.from} → ${entry.to} took ${entry.duration}ms`
      );
      
      if (onSlowNavigation) {
        onSlowNavigation(entry);
      }
    }
  };

  return (
    <RouteLogger
      onLog={handleLog}
      enableConsoleLog={false}
      includeMetadata={(location) => ({
        search: location.search,
        hash: location.hash,
        state: location.state,
      })}
    >
      {children}
    </RouteLogger>
  );
};