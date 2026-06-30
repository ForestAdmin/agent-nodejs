export default class OAuthExchangeError extends Error {
  readonly error: string;

  constructor(error: string, description: string) {
    super(description);
    this.name = 'OAuthExchangeError';
    this.error = error;
  }
}
