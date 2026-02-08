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
