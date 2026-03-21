export interface Logger {
  error(message: string, context: Record<string, unknown>): void;
}
