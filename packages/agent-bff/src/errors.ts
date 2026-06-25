export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  if (err.message) return err.message;

  const { parent } = err as { parent?: unknown };
  if (parent instanceof Error && parent.message) return parent.message;

  const { cause } = err as { cause?: unknown };
  if (cause instanceof Error && cause.message) return cause.message;

  return err.name || 'Unknown error';
}
