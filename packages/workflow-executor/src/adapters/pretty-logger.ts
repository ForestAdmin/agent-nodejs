import type { Logger } from '../ports/logger-port';

import pc from 'picocolors';

/**
 * Human-readable colorized logger for TTY/dev usage.
 *
 * Pair with ConsoleLogger for prod/pipe/container (JSON output).
 * The CLI auto-picks based on `process.stdout.isTTY` and the `--pretty` /
 * `--json` flags. Color is disabled automatically when `NO_COLOR` is set
 * (picocolors handles that).
 */
export default class PrettyLogger implements Logger {
  info(message: string, context: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.info(this.format(pc.cyan('info '), message, context));
  }

  error(message: string, context: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error(this.format(pc.red('error'), message, context));
  }

  private format(level: string, message: string, context: Record<string, unknown>): string {
    const timestamp = pc.dim(new Date().toISOString().substring(11, 19));
    const contextStr = this.formatContext(context);

    return contextStr
      ? `${timestamp} ${level} ${message} ${contextStr}`
      : `${timestamp} ${level} ${message}`;
  }

  private formatContext(context: Record<string, unknown>): string {
    const parts = Object.entries(context).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
    if (parts.length === 0) return '';

    return pc.dim(parts.join(' '));
  }
}
