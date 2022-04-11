/** Logger Level */
export type LoggerLevel = 'info' | 'warn' | 'error';

const LOGGER_PREFIX = {
  info: '\x1b[34minfo:\x1b[0m',
  warn: '\x1b[33mwarning:\x1b[0m',
  error: '\x1b[31merror:\x1b[0m',
};

/** Logger */
export type Logger = (level: LoggerLevel, message: unknown) => void;

export default (level: LoggerLevel, message: unknown) =>
  console.error(LOGGER_PREFIX[level], message);
