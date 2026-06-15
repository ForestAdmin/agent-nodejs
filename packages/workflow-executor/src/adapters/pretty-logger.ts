import type { Logger, LoggerLevel } from '../ports/logger-port';

import pc from 'picocolors';

const ORDER: LoggerLevel[] = ['Debug', 'Info', 'Warn', 'Error'];

const LABEL: Record<LoggerLevel, string> = {
  Debug: pc.blue('debug'),
  Info: pc.cyan('info '),
  Warn: pc.yellow('warn '),
  Error: pc.red('error'),
};

function formatContext(context: Record<string, unknown>): string {
  const parts = Object.entries(context).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  if (parts.length === 0) return '';

  return pc.dim(parts.join(' '));
}

function format(level: LoggerLevel, message: string, context: Record<string, unknown>): string {
  const timestamp = pc.dim(new Date().toISOString().substring(11, 19));
  const contextStr = formatContext(context);

  return contextStr
    ? `${timestamp} ${LABEL[level]} ${message} ${contextStr}`
    : `${timestamp} ${LABEL[level]} ${message}`;
}

// Colorized logger for TTY/dev. Pair with ConsoleLogger for piped output.
// CLI auto-picks via process.stdout.isTTY + --pretty/--json flags. NO_COLOR is honored.
export default function createPrettyLogger(minLevel: LoggerLevel = 'Info'): Logger {
  const minIndex = ORDER.indexOf(minLevel);

  return (level, message, context) => {
    if (ORDER.indexOf(level) < minIndex) return;

    const line = format(level, message, context ?? {});

    if (level === 'Error') console.error(line);
    else if (level === 'Warn') console.warn(line);
    else console.info(line);
  };
}
