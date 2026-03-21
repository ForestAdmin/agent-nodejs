import type { Logger } from '../ports/logger-port';

export default class ConsoleLogger implements Logger {
  error(message: string, context: Record<string, unknown>): void {
    console.error(
      JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...context }),
    );
  }
}
