export default class SchemaUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(cause?: unknown) {
    super('The agent schema is unavailable');
    this.name = 'SchemaUnavailableError';
    this.cause = cause;
  }
}
