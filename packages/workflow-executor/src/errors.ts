/* eslint-disable max-classes-per-file */

export abstract class WorkflowExecutorError extends Error {
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
  // Not readonly — allows standard Error.cause semantics without shadowing the built-in with a
  // stricter modifier that would prevent downstream code from re-assigning if needed.
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) this.cause = cause;
  }
}

export class NoRelationshipFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(`No relationship fields on record from collection "${collectionName}"`);
  }
}

export class RelatedRecordNotFoundError extends WorkflowExecutorError {
  constructor(collectionName: string, relationName: string) {
    super(
      `No related record found for relation "${relationName}" on collection "${collectionName}"`,
    );
  }
}

/** Thrown when the AI returns a response that violates expected constraints (bad index, empty selection, unknown identifier, etc.). */
export class InvalidAIResponseError extends WorkflowExecutorError {}

/** Thrown when a named relation is not found in the collection schema. */
export class RelationNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(`Relation "${name}" not found in collection "${collectionName}"`);
  }
}

/** Thrown when a named field is not found in the collection schema. */
export class FieldNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(`Field "${name}" not found in collection "${collectionName}"`);
  }
}

/** Thrown when a named action is not found in the collection schema. */
export class ActionNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(`Action "${name}" not found in collection "${collectionName}"`);
  }
}

/** Thrown when step execution state is invalid (missing execution record, missing pending data, etc.). */
export class StepStateError extends WorkflowExecutorError {}
