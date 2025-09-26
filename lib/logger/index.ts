// Simple logger facade that wraps console methods with environment-based filtering
const isProduction = process.env.NODE_ENV === 'production';

// Simple logger facade that wraps console methods
export const logger = {
  // Debug only logs in development
  debug: isProduction ? (..._args: unknown[]) => {} : console.log,

  // Info, warn, error always log (using proper console methods)
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Context-aware logger for module identification
export const getLogger = (context: string) => ({
  debug: (...args: unknown[]) => logger.debug(`[${context}]`, ...args),
  info: (...args: unknown[]) => logger.info(`[${context}]`, ...args),
  warn: (...args: unknown[]) => logger.warn(`[${context}]`, ...args),
  error: (...args: unknown[]) => logger.error(`[${context}]`, ...args),
});

// Type definitions for TypeScript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LoggerFunction = (...args: unknown[]) => void;

export interface LoggerInstance {
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}
