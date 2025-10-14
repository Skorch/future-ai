import chalk from 'chalk';

// Simple logger facade that wraps console methods with environment-based filtering
const isProduction = process.env.NODE_ENV === 'production';

// Chalk theme for consistent styling across the logger
const theme = {
  // Log levels
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red.bold,

  // Components
  context: chalk.cyan.bold,
  timestamp: chalk.dim,

  // Severity indicators
  success: chalk.green.bold,
  critical: chalk.bgRed.white.bold,

  // Data types for structured logging
  string: chalk.green,
  number: chalk.magenta,
  boolean: chalk.yellow,
  null: chalk.gray.italic,
  key: chalk.blue,
};

// Format timestamp for logs
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().split('T')[1].replace('Z', '');
};

// Enhanced logger with chalk theme
export const logger = {
  // Debug only logs in development with gray text
  debug: isProduction
    ? (..._args: unknown[]) => {}
    : (...args: unknown[]) => {
        console.log(theme.debug(`[${getTimestamp()}]`), ...args);
      },

  // Info logs with blue color
  info: (...args: unknown[]) => {
    console.info(theme.info(`[${getTimestamp()}]`), ...args);
  },

  // Warn logs with yellow color
  warn: (...args: unknown[]) => {
    console.warn(theme.warn(`[${getTimestamp()}]`), ...args);
  },

  // Error logs with bold red color
  error: (...args: unknown[]) => {
    console.error(theme.error(`[${getTimestamp()}]`), ...args);
  },

  // Success logs with green color
  success: (...args: unknown[]) => {
    console.log(theme.success(`[${getTimestamp()}]`), '✓', ...args);
  },

  // Critical logs with red background (for catastrophic failures)
  critical: (...args: unknown[]) => {
    console.error(theme.critical(`[${getTimestamp()}] CRITICAL`), ...args);
  },
};

// Context-aware logger for module identification with colored context
export const getLogger = (context: string) => ({
  debug: (...args: unknown[]) =>
    logger.debug(theme.context(`[${context}]`), ...args),
  info: (...args: unknown[]) =>
    logger.info(theme.context(`[${context}]`), ...args),
  warn: (...args: unknown[]) =>
    logger.warn(theme.context(`[${context}]`), ...args),
  error: (...args: unknown[]) =>
    logger.error(theme.context(`[${context}]`), ...args),
  success: (...args: unknown[]) =>
    logger.success(theme.context(`[${context}]`), ...args),
  critical: (...args: unknown[]) =>
    logger.critical(theme.context(`[${context}]`), ...args),
});

// Type definitions for TypeScript
export type LogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'success'
  | 'critical';
export type LoggerFunction = (...args: unknown[]) => void;

export interface LoggerInstance {
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  success: LoggerFunction;
  critical: LoggerFunction;
}

// Export theme for use in other modules that want consistent styling
export { theme as loggerTheme };
