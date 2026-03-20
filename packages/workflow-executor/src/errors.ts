/* eslint-disable max-classes-per-file */

export class WorkflowExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MissingToolCallError extends WorkflowExecutorError {
  constructor() {
    super('AI did not return a tool call');
  }
}

export class MalformedToolCallError extends WorkflowExecutorError {
  readonly toolName: string;

  constructor(toolName: string, details: string) {
    super(`AI returned a malformed tool call for "${toolName}": ${details}`);
    this.toolName = toolName;
  }
}

export class RecordNotFoundError extends WorkflowExecutorError {
  constructor(collectionName: string, recordId: string) {
    super(`Record not found: collection "${collectionName}", id "${recordId}"`);
  }
}

export class NoRecordsError extends WorkflowExecutorError {
  constructor() {
    super('No records available');
  }
}

export class NoReadableFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(`No readable fields on record from collection "${collectionName}"`);
  }
}

export class NoResolvedFieldsError extends WorkflowExecutorError {
  constructor(fieldNames: string[]) {
    super(`None of the requested fields could be resolved: ${fieldNames.join(', ')}`);
  }
}

export class NoWritableFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(`No writable fields on record from collection "${collectionName}"`);
  }
}

export class NoActionsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(`No actions available on collection "${collectionName}"`);
  }
}

/**
 * Thrown when a step's side effect succeeded (action/update/decision)
 * but the resulting state could not be persisted to the RunStore.
 */
export class StepPersistenceError extends WorkflowExecutorError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) this.cause = cause;
  }
}
