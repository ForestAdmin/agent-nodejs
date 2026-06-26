/* eslint-disable max-classes-per-file */
import { BusinessError, ValidationError } from '@forestadmin/datasource-toolkit';

export class ZendeskConfigurationError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'ZendeskConfigurationError';
  }
}

export class ZendeskApiError extends BusinessError {
  readonly operation: string;
  readonly status?: number;
  readonly body?: unknown;

  constructor(operation: string, status: number | undefined, body: unknown, cause?: Error) {
    const reason = status ? `HTTP ${status}` : cause?.message ?? 'unknown error';
    super(`Zendesk API call failed (${operation}): ${reason}`);
    this.name = 'ZendeskApiError';
    this.operation = operation;
    this.status = status;
    this.body = body;
  }
}

export class UnsupportedOperatorError extends BusinessError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedOperatorError';
  }
}
