import type { errors } from 'openid-client';

// eslint-disable-next-line import/prefer-default-export
export class AuthenticationError extends Error {
  public readonly description: string;
  public readonly state: string;
  public readonly code: string;

  constructor(e: errors.OPError) {
    super(e.message);

    this.description = e.error_description;
    this.state = e.state;
    this.code = e.error;
    this.stack = e.stack;
  }
}
