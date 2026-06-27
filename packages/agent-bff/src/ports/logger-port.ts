export type LoggerLevel = 'Debug' | 'Info' | 'Warn' | 'Error';

export type Logger = (
  level: LoggerLevel,
  message: string,
  context?: Record<string, unknown>,
) => void;
