export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function messageOf(value: unknown): string | undefined {
  return value instanceof Error && value.message ? value.message : undefined;
}

export function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const { parent, cause } = err as { parent?: unknown; cause?: unknown };

  return err.message || messageOf(parent) || messageOf(cause) || err.name || 'Unknown error';
}
