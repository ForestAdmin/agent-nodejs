export default class AiProxyTimeoutError extends Error {
  constructor() {
    super('The Forest server did not respond in time');
    this.name = 'AiProxyTimeoutError';
  }
}
