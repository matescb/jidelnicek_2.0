import { ErrorCategory, ErrorSeverity } from '@/services/errorLogger';
import { TFunction } from 'i18next';

// Common error types
export enum ErrorType {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  OFFLINE_ERROR = 'OFFLINE_ERROR',
  
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // API errors
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  
  // Business logic errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  CONFLICT = 'CONFLICT',
  
  // UI errors
  RENDER_ERROR = 'RENDER_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  
  // Unknown
  UNKNOWN = 'UNKNOWN'
}

// Error classification helpers
export const classifyError = (error: Error): {
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
} => {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  // Network errors
  if (name === 'networkerror' || message.includes('network')) {
    return {
      type: ErrorType.NETWORK_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH
    };
  }
  
  if (message.includes('timeout')) {
    return {
      type: ErrorType.TIMEOUT_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  if (!navigator.onLine || message.includes('offline')) {
    return {
      type: ErrorType.OFFLINE_ERROR,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.LOW
    };
  }
  
  // Auth errors
  if (message.includes('401') || message.includes('unauthorized')) {
    return {
      type: ErrorType.UNAUTHORIZED,
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.HIGH
    };
  }
  
  if (message.includes('token') && message.includes('expired')) {
    return {
      type: ErrorType.TOKEN_EXPIRED,
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  if (message.includes('invalid') && (message.includes('credential') || message.includes('password'))) {
    return {
      type: ErrorType.INVALID_CREDENTIALS,
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.LOW
    };
  }
  
  // Permission errors
  if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
    return {
      type: ErrorType.INSUFFICIENT_PERMISSIONS,
      category: ErrorCategory.PERMISSION,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  // Validation errors
  if (name.includes('validation') || message.includes('validation')) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW
    };
  }
  
  if (message.includes('required') || message.includes('missing')) {
    return {
      type: ErrorType.MISSING_FIELD,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW
    };
  }
  
  if (message.includes('invalid') && (message.includes('format') || message.includes('type'))) {
    return {
      type: ErrorType.INVALID_FORMAT,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW
    };
  }
  
  // API errors
  if (message.includes('500') || message.includes('internal server')) {
    return {
      type: ErrorType.SERVER_ERROR,
      category: ErrorCategory.API,
      severity: ErrorSeverity.CRITICAL
    };
  }
  
  if (message.includes('404') || message.includes('not found')) {
    return {
      type: ErrorType.NOT_FOUND,
      category: ErrorCategory.API,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      type: ErrorType.RATE_LIMIT,
      category: ErrorCategory.API,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  if (message.includes('409') || message.includes('conflict')) {
    return {
      type: ErrorType.CONFLICT,
      category: ErrorCategory.BUSINESS_LOGIC,
      severity: ErrorSeverity.MEDIUM
    };
  }
  
  if (message.includes('locked')) {
    return {
      type: ErrorType.RESOURCE_LOCKED,
      category: ErrorCategory.BUSINESS_LOGIC,
      severity: ErrorSeverity.LOW
    };
  }
  
  // UI errors
  if (name.includes('react') || message.includes('component')) {
    return {
      type: ErrorType.COMPONENT_ERROR,
      category: ErrorCategory.UI,
      severity: ErrorSeverity.HIGH
    };
  }
  
  if (message.includes('render')) {
    return {
      type: ErrorType.RENDER_ERROR,
      category: ErrorCategory.UI,
      severity: ErrorSeverity.HIGH
    };
  }
  
  // Default
  return {
    type: ErrorType.UNKNOWN,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM
  };
};

// Stack trace parsing
export const parseStackTrace = (stack?: string): {
  frames: Array<{
    functionName?: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  }>;
  formatted: string;
} => {
  if (!stack) {
    return { frames: [], formatted: '' };
  }
  
  const frames = stack
    .split('\n')
    .slice(1) // Skip the error message
    .map(line => {
      const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          functionName: match[1],
          fileName: match[2],
          lineNumber: parseInt(match[3], 10),
          columnNumber: parseInt(match[4], 10)
        };
      }
      
      // Try alternative format
      const altMatch = line.match(/at\s+(.+):(\d+):(\d+)/);
      if (altMatch) {
        return {
          fileName: altMatch[1],
          lineNumber: parseInt(altMatch[2], 10),
          columnNumber: parseInt(altMatch[3], 10)
        };
      }
      
      return null;
    })
    .filter(Boolean) as Array<{
      functionName?: string;
      fileName?: string;
      lineNumber?: number;
      columnNumber?: number;
    }>;
  
  const formatted = frames
    .slice(0, 5) // Show only top 5 frames
    .map(frame => {
      const func = frame.functionName || '<anonymous>';
      const file = frame.fileName?.split('/').pop() || 'unknown';
      return `  at ${func} (${file}:${frame.lineNumber}:${frame.columnNumber})`;
    })
    .join('\n');
  
  return { frames, formatted };
};

// User-friendly error messages
export const getUserFriendlyMessage = (
  error: Error,
  t?: TFunction
): {
  title: string;
  message: string;
  action?: string;
} => {
  const { type } = classifyError(error);
  
  // If we have i18n, use it
  if (t) {
    const errorKey = `errors.${type.toLowerCase()}`;
    const hasTranslation = t(`${errorKey}.title`, { defaultValue: '' }) !== '';
    
    if (hasTranslation) {
      return {
        title: t(`${errorKey}.title`),
        message: t(`${errorKey}.message`),
        action: t(`${errorKey}.action`, { defaultValue: undefined })
      };
    }
  }
  
  // Fallback messages
  switch (type) {
    case ErrorType.NETWORK_ERROR:
      return {
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        action: 'Try refreshing the page'
      };
      
    case ErrorType.TIMEOUT_ERROR:
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. The server might be busy.',
        action: 'Please try again'
      };
      
    case ErrorType.OFFLINE_ERROR:
      return {
        title: 'You\'re Offline',
        message: 'You seem to be offline. Some features may not be available.',
        action: 'Check your connection'
      };
      
    case ErrorType.UNAUTHORIZED:
      return {
        title: 'Authentication Required',
        message: 'You need to log in to access this feature.',
        action: 'Log in'
      };
      
    case ErrorType.TOKEN_EXPIRED:
      return {
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        action: 'Log in again'
      };
      
    case ErrorType.INVALID_CREDENTIALS:
      return {
        title: 'Invalid Credentials',
        message: 'The email or password you entered is incorrect.',
        action: 'Try again'
      };
      
    case ErrorType.VALIDATION_ERROR:
      return {
        title: 'Validation Error',
        message: 'Please check your input and try again.',
        action: 'Review form'
      };
      
    case ErrorType.MISSING_FIELD:
      return {
        title: 'Missing Information',
        message: 'Please fill in all required fields.',
        action: 'Complete form'
      };
      
    case ErrorType.INVALID_FORMAT:
      return {
        title: 'Invalid Format',
        message: 'Please check the format of your input.',
        action: 'Fix format'
      };
      
    case ErrorType.SERVER_ERROR:
      return {
        title: 'Server Error',
        message: 'Something went wrong on our end. We\'re working to fix it.',
        action: 'Try again later'
      };
      
    case ErrorType.NOT_FOUND:
      return {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        action: 'Go back'
      };
      
    case ErrorType.RATE_LIMIT:
      return {
        title: 'Too Many Requests',
        message: 'You\'ve made too many requests. Please wait a moment.',
        action: 'Wait and retry'
      };
      
    case ErrorType.INSUFFICIENT_PERMISSIONS:
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to access this resource.',
        action: 'Request access'
      };
      
    case ErrorType.RESOURCE_LOCKED:
      return {
        title: 'Resource Locked',
        message: 'This resource is currently being edited by someone else.',
        action: 'Try again later'
      };
      
    case ErrorType.CONFLICT:
      return {
        title: 'Conflict Detected',
        message: 'Your changes conflict with recent updates.',
        action: 'Refresh and retry'
      };
      
    case ErrorType.RENDER_ERROR:
    case ErrorType.COMPONENT_ERROR:
      return {
        title: 'Display Error',
        message: 'We encountered an error displaying this content.',
        action: 'Refresh page'
      };
      
    default:
      return {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        action: 'Refresh page'
      };
  }
};

// Error formatting for developers
export const formatErrorForDevelopment = (error: Error): string => {
  const { type, category, severity } = classifyError(error);
  const { formatted } = parseStackTrace(error.stack);
  
  return `
[${severity.toUpperCase()}] ${type} (${category})
Message: ${error.message}
Name: ${error.name}

Stack Trace:
${formatted}
`.trim();
};

// Check if error is retryable
export const isRetryableError = (error: Error): boolean => {
  const { type } = classifyError(error);
  
  const retryableTypes = [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.OFFLINE_ERROR,
    ErrorType.SERVER_ERROR,
    ErrorType.RATE_LIMIT,
    ErrorType.TOKEN_EXPIRED
  ];
  
  return retryableTypes.includes(type);
};

// Extract API error details
export const extractApiErrorDetails = (error: any): {
  status?: number;
  statusText?: string;
  message?: string;
  code?: string;
  details?: any;
} => {
  // Handle fetch response errors
  if (error.response) {
    return {
      status: error.response.status,
      statusText: error.response.statusText,
      message: error.response.data?.message || error.message,
      code: error.response.data?.code,
      details: error.response.data
    };
  }
  
  // Handle standard errors with status
  if (error.status) {
    return {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      code: error.code
    };
  }
  
  // Default
  return {
    message: error.message || 'Unknown error'
  };
};

// Create error with metadata
export const createError = (
  message: string,
  type: ErrorType,
  metadata?: Record<string, any>
): Error => {
  const error = new Error(message);
  error.name = type;
  
  // Add metadata to error
  if (metadata) {
    Object.assign(error, metadata);
  }
  
  return error;
};

// Aggregate similar errors
export const aggregateErrors = (errors: Error[]): Map<string, {
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  sample: Error;
}> => {
  const aggregated = new Map<string, {
    count: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
    sample: Error;
  }>();
  
  errors.forEach(error => {
    const key = `${error.name}_${error.message}`;
    const existing = aggregated.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      aggregated.set(key, {
        count: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        sample: error
      });
    }
  });
  
  return aggregated;
};