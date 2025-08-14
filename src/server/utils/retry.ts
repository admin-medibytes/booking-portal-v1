import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onRetry?: (error: Error, attempt: number) => void | Promise<void>;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  onRetry: () => {},
  shouldRetry: () => true,
};

/**
 * Calculate delay for exponential backoff with optional jitter
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const { initialDelay, maxDelay, backoffFactor, jitter } = options;
  
  let delay = Math.min(
    initialDelay * Math.pow(backoffFactor, attempt),
    maxDelay
  );
  
  if (jitter) {
    // Add random jitter between 0-30% of the delay
    const jitterAmount = Math.random() * 0.3 * delay;
    delay = Math.floor(delay + jitterAmount);
  }
  
  return delay;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Don't retry if this was the last attempt
      if (attempt === opts.maxAttempts - 1) {
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      
      logger.debug('Retrying after error', {
        attempt: attempt + 1,
        maxAttempts: opts.maxAttempts,
        delay,
        error: lastError.message,
      });
      
      // Call retry callback
      await opts.onRetry(lastError, attempt + 1);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Create a retry wrapper with preset options
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrides?: RetryOptions): Promise<T> => {
    return withRetry(fn, { ...defaultOptions, ...overrides });
  };
}

/**
 * Retry policies for common scenarios
 */
export const RetryPolicies = {
  // For database operations
  database: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      );
    },
  },
  
  // For external API calls
  externalApi: {
    maxAttempts: 4,
    initialDelay: 2000,
    maxDelay: 60000,
    shouldRetry: (error: Error) => {
      // Retry on network errors or 5xx status codes
      if ('status' in error) {
        const status = (error as { status?: number }).status;
        return status !== undefined && status >= 500 && status < 600;
      }
      return true;
    },
  },
  
  // For file operations
  fileOperation: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('ebusy') ||
        message.includes('eacces') ||
        message.includes('emfile')
      );
    },
  },
  
  // For AWS operations
  aws: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 20000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('throttl') ||
        message.includes('rate exceeded') ||
        message.includes('service unavailable') ||
        message.includes('timeout')
      );
    },
  },
};