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
  constructor(message: string) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIUnprocessableError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnprocessableError';
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

export class AIToolNotFoundError extends AIError {
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
