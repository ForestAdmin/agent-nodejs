/**
 * All custom AI errors extend their matching HTTP-status error class from datasource-toolkit.
 * This allows the agent's error middleware to map them to their natural HTTP status codes.
 */

// eslint-disable-next-line max-classes-per-file
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

export class AIBadRequestError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'AIBadRequestError';
  }
}

export class AIModelNotSupportedError extends AIBadRequestError {
  constructor(model: string) {
    super(
      `Model '${model}' does not support tools. Please use a model that supports function calling.`,
    );
    this.name = 'AIModelNotSupportedError';
  }
}

export class AINotFoundError extends NotFoundError {
  constructor(message: string) {
    super(message);
    this.name = 'AINotFoundError';
  }
}

export class AIProviderError extends UnprocessableError {
  readonly provider: string;
  readonly cause?: Error;

  constructor(provider: string, options?: { cause?: Error }) {
    super(`Error while calling ${provider}: ${options?.cause?.message ?? 'unknown'}`);
    this.name = 'AIProviderError';
    this.provider = provider;
    if (options?.cause) this.cause = options.cause;
  }
}

export class AITooManyRequestsError extends TooManyRequestsError {
  readonly provider: string;
  readonly cause?: Error;

  constructor(provider: string, options?: { cause?: Error }) {
    super(`${provider} rate limit exceeded: ${options?.cause?.message ?? 'unknown reason'}`);
    this.name = 'AITooManyRequestsError';
    this.provider = provider;
    if (options?.cause) this.cause = options.cause;
  }
}

export class AIUnauthorizedError extends UnauthorizedError {
  readonly provider: string;
  readonly cause?: Error;

  constructor(provider: string, options?: { cause?: Error }) {
    super(
      `${provider} authentication failed: ${
        options?.cause?.message ?? 'check your API key configuration'
      }`,
    );
    this.name = 'AIUnauthorizedError';
    this.provider = provider;
    if (options?.cause) this.cause = options.cause;
  }
}

export class AIForbiddenError extends ForbiddenError {
  readonly provider: string;
  readonly cause?: Error;

  constructor(provider: string, options?: { cause?: Error }) {
    super(`${provider} access denied: ${options?.cause?.message ?? 'permission denied'}`);
    this.name = 'AIForbiddenError';
    this.provider = provider;
    if (options?.cause) this.cause = options.cause;
  }
}

export class AINotConfiguredError extends UnprocessableError {
  constructor(message = 'AI is not configured') {
    super(message);
    this.name = 'AINotConfiguredError';
  }
}

export class AIToolUnprocessableError extends UnprocessableError {
  constructor(message: string) {
    super(message);
    this.name = 'AIToolUnprocessableError';
  }
}

export class AIToolNotFoundError extends AINotFoundError {
  constructor(message: string) {
    super(message);
    this.name = 'AIToolNotFoundError';
  }
}

export class McpError extends UnprocessableError {
  constructor(message: string) {
    super(message);
    this.name = 'McpError';
  }
}

export class McpConnectionError extends McpError {
  constructor(message: string) {
    super(message);
    this.name = 'McpConnectionError';
  }
}

export class McpConflictError extends McpError {
  constructor(entityName: string) {
    super(`"${entityName}" already exists for your project`);
    this.name = 'McpConflictError';
  }
}

export class McpConfigError extends McpError {
  constructor(message: string) {
    super(message);
    this.name = 'McpConfigError';
  }
}
