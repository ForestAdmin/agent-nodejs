/* eslint-disable max-classes-per-file */
import type { errors } from 'openid-client';

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

export class ForbiddenError extends Error {}

export class NotFoundError extends Error {}
