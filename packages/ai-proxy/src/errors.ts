/**
 * All custom AI errors extend HTTP-status error classes (BadRequestError, NotFoundError,
 * UnprocessableError) from datasource-toolkit. This allows the agent's error middleware
 * to map them to their natural HTTP status codes automatically.
 */

// eslint-disable-next-line max-classes-per-file
import {
  BadRequestError,
  NotFoundError,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

export class AIError extends UnprocessableError {
  constructor(message: string) {
    super(message);
    this.name = 'AIError';
  }
}

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

export class AIUnprocessableError extends UnprocessableError {
  readonly cause?: Error;

  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = 'AIUnprocessableError';
    if (options?.cause) this.cause = options.cause;
  }
}

export class AIProviderError extends AIUnprocessableError {
  readonly provider: string;

  constructor(provider: string, options?: { cause?: unknown; message?: string }) {
    const cause = options?.cause;
    const message =
      options?.message ??
      `Error while calling ${provider}: ${cause instanceof Error ? cause.message : JSON.stringify(cause) ?? 'unknown'}`;
    super(message, { cause: cause instanceof Error ? cause : undefined });
    this.name = 'AIProviderError';
    this.provider = provider;
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor(provider: string, options?: { cause?: unknown }) {
    super(provider, { ...options, message: `${provider} rate limit exceeded` });
    this.name = 'AIRateLimitError';
    this.baseBusinessErrorName = 'TooManyRequestsError';
    this.httpCode = 429;
  }
}

export class AIAuthenticationError extends AIProviderError {
  constructor(provider: string, options?: { cause?: unknown }) {
    super(provider, {
      ...options,
      message: `${provider} authentication failed: check your API key configuration`,
    });
    this.name = 'AIAuthenticationError';
    this.baseBusinessErrorName = 'UnauthorizedError';
    this.httpCode = 401;
  }
}

export class AINotConfiguredError extends AIError {
  constructor(message = 'AI is not configured') {
    super(message);
    this.name = 'AINotConfiguredError';
  }
}

export class AIToolUnprocessableError extends AIUnprocessableError {
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

export class McpError extends AIError {
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
