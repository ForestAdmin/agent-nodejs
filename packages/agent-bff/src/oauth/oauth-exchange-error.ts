export default class OAuthExchangeError extends Error {
  readonly error: string;
  readonly reason?: string;

  constructor(error: string, description: string, reason?: string) {
    super(description);
    this.name = 'OAuthExchangeError';
    this.error = error;
    this.reason = reason;
  }
}
