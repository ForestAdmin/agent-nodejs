import type { Logger, LoggerLevel } from '../ports/logger-port';

import { extractErrorMessage } from '../errors';

// ai-proxy hands the cause as an Error, the executor's logger expects a context object.
export type AiProxyLogger = (level: LoggerLevel, message: string, error?: Error) => void;

// An Error's own properties are non-enumerable, so forwarding it as the context would emit the line
// with the cause silently stripped — flatten it the way the rest of the executor logs causes.
export default function toAiProxyLogger(logger: Logger): AiProxyLogger {
  return (level, message, error) => {
    if (error === undefined || error === null) return logger(level, message);

    return logger(level, message, {
      error: extractErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  };
}
