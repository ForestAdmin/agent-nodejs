import type { Logger, LoggerLevel } from '../ports/logger-port';

const ORDER: LoggerLevel[] = ['Debug', 'Info', 'Warn', 'Error'];

// Datadog sets a line's status from `status`, `severity` or `syslog` before `level`, so a context
// key with one of these names would override the level; the others would overwrite the line's own.
const RESERVED_KEYS = new Set(['level', 'message', 'timestamp', 'status', 'severity', 'syslog']);

function withoutReservedKeys(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) =>
      RESERVED_KEYS.has(key) ? [`context_${key}`, value] : [key, value],
    ),
  );
}

export default function createConsoleLogger(minLevel: LoggerLevel = 'Info'): Logger {
  const minIndex = ORDER.indexOf(minLevel);

  return (level, message, context) => {
    if (ORDER.indexOf(level) < minIndex) return;

    const payload = JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...withoutReservedKeys(context ?? {}),
    });

    if (level === 'Error') console.error(payload);
    else if (level === 'Warn') console.warn(payload);
    else console.info(payload);
  };
}
