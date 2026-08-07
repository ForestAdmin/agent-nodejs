import type { Logger, LoggerLevel } from '../ports/logger-port';

import { extractErrorMessage } from '../errors';

// ai-proxy hands the cause as an Error, the executor's logger expects a context object.
export type AiProxyLogger = (level: LoggerLevel, message: string, error?: Error) => void;

// An Error's own properties are non-enumerable, so forwarding it as the context would emit the line
// with the cause silently stripped — flatten it the way the rest of the executor logs causes.
export default function toAiProxyLogger(logger: Logger): AiProxyLogger {
  return (level, message, error) => {
    // ai-proxy logs from inside its catch blocks before recording the failure it caught, so a host
    // logger that throws here would abort a whole tool load instead of one server's.
    try {
      if (error === undefined || error === null) {
        logger(level, message);

        return;
      }

      const { cause } = error as { cause?: unknown };

      logger(level, message, {
        error: extractErrorMessage(error),
        cause: extractErrorMessage(cause),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } catch {
      // A broken logger must not become control flow.
    }
  };
}
