/**
 * OingAI WeCom Plugin - Logger Utilities
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PREFIX = '[OingAI-WeCom]';

/**
 * 简单日志工具
 */
export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    console.debug(`${LOG_PREFIX} [DEBUG] ${message}`, ...args);
  },

  info: (message: string, ...args: unknown[]): void => {
    console.info(`${LOG_PREFIX} [INFO] ${message}`, ...args);
  },

  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`${LOG_PREFIX} [WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: unknown[]): void => {
    console.error(`${LOG_PREFIX} [ERROR] ${message}`, ...args);
  },
};