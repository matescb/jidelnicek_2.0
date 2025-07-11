import { Location, NavigateFunction } from 'react-router-dom';

export interface NavigationContext {
  from: Location;
  to: Location;
  action: 'PUSH' | 'POP' | 'REPLACE';
  navigate: NavigateFunction;
  userId?: string;
  permissions?: string[];
  [key: string]: any;
}

export type MiddlewareResult = 
  | { allow: true }
  | { allow: false; redirect?: string; reason?: string };

export type NavigationMiddleware = (
  context: NavigationContext
) => Promise<MiddlewareResult> | MiddlewareResult;

export interface MiddlewareError {
  middleware: string;
  error: Error;
  context: NavigationContext;
}

export interface RouteGuardOptions {
  middleware?: NavigationMiddleware[];
  onError?: (error: MiddlewareError) => void;
  fallbackRoute?: string;
}

export interface UnsavedChangesOptions {
  message?: string;
  showSaveOption?: boolean;
  onSave?: () => Promise<void>;
  onDiscard?: () => void;
}

export interface RouteLogEntry {
  timestamp: number;
  from: string;
  to: string;
  action: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface NavigationBlocker {
  id: string;
  when: boolean | (() => boolean);
  message?: string;
  onBlock?: (context: NavigationContext) => void;
}

export interface MiddlewareChainOptions {
  stopOnFailure?: boolean;
  parallel?: boolean;
  timeout?: number;
}