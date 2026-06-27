import type { Logger, LoggerLevel } from '../ports/logger-port';

const ORDER: LoggerLevel[] = ['Debug', 'Info', 'Warn', 'Error'];

export default function createConsoleLogger(minLevel: LoggerLevel = 'Info'): Logger {
  const minIndex = ORDER.indexOf(minLevel);

  return (level, message, context) => {
    if (ORDER.indexOf(level) < minIndex) return;

    const payload = JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context ?? {}),
    });

    if (level === 'Error') console.error(payload);
    else if (level === 'Warn') console.warn(payload);
    else console.info(payload);
  };
}
