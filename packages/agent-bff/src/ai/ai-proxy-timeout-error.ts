export default class AiProxyTimeoutError extends Error {
  readonly cause?: unknown;

  constructor(cause?: unknown) {
    super('The Forest server did not respond in time');
    this.name = 'AiProxyTimeoutError';
    this.cause = cause;
  }
}
