import type { Logger } from '../ports/logger-port';

export default class ConsoleLogger implements Logger {
  info(message: string, context: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...context }),
    );
  }

  error(message: string, context: Record<string, unknown>): void {
    console.error(
      JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...context }),
    );
  }
}
