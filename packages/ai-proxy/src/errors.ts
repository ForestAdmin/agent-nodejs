/**
 * All custom AI errors extend BusinessError subclasses from datasource-toolkit.
 * Each error maps to its natural HTTP status via the agent's error middleware.
 *
 * Hierarchy:
 * - AIError (extends UnprocessableError → 422)
 *   - AINotConfiguredError
 *   - McpError
 *     - McpConnectionError, McpConflictError, McpConfigError
 * - AIBadRequestError (extends BadRequestError → 400)
 *   - AIModelNotSupportedError
 * - AINotFoundError (extends NotFoundError → 404)
 *   - AIToolNotFoundError
 * - AIUnprocessableError (extends UnprocessableError → 422)
 *   - OpenAIUnprocessableError, AIToolUnprocessableError
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
  constructor(message: string) {
    super(message);
    this.name = 'AIUnprocessableError';
  }
}

export class AINotConfiguredError extends AIError {
  constructor(message = 'AI is not configured') {
    super(message);
    this.name = 'AINotConfiguredError';
  }
}

export class OpenAIUnprocessableError extends AIUnprocessableError {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class AIToolUnprocessableError extends AIUnprocessableError {
  constructor(message: string) {
    super(message);
    this.name = 'AIToolError';
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
