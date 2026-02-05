/**
 * -------------------------------------
 * -------------------------------------
 * -------------------------------------
 * All custom errors must extend the AIError class.
 * This inheritance is crucial for proper error translation
 * and consistent handling throughout the system.
 * -------------------------------------
 * -------------------------------------
 * -------------------------------------
 */

// eslint-disable-next-line max-classes-per-file
export class AIError extends Error {
  readonly status: number;

  constructor(message: string, status = 422) {
    if (status < 100 || status > 599) {
      throw new RangeError(`Invalid HTTP status code: ${status}`);
    }

    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}

export class AIBadRequestError extends AIError {
  constructor(message: string) {
    super(message, 400);
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

export class AINotFoundError extends AIError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'AINotFoundError';
  }
}

export class AIUnprocessableError extends AIError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'AIUnprocessableError';
  }
}

export class AINotConfiguredError extends AIError {
  constructor(message = 'AI is not configured') {
    super(message, 422);
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
