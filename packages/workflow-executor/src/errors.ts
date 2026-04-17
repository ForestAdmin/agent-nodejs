/* eslint-disable max-classes-per-file */

export function causeMessage(error: unknown): string | undefined {
  const { cause } = error as { cause?: unknown };

  return cause instanceof Error ? cause.message : undefined;
}

export abstract class WorkflowExecutorError extends Error {
  readonly userMessage: string;
  cause?: unknown;

  constructor(message: string, userMessage?: string) {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = userMessage ?? message;
  }
}

export class MissingToolCallError extends WorkflowExecutorError {
  constructor() {
    super(
      'AI did not return a tool call',
      "The AI couldn't decide what to do. Try rephrasing the step's prompt.",
    );
  }
}

export class MalformedToolCallError extends WorkflowExecutorError {
  readonly toolName: string;

  constructor(toolName: string, details: string) {
    super(
      `AI returned a malformed tool call for "${toolName}": ${details}`,
      "The AI returned an unexpected response. Try rephrasing the step's prompt.",
    );
    this.toolName = toolName;
  }
}

export class RecordNotFoundError extends WorkflowExecutorError {
  constructor(collectionName: string, recordId: string) {
    super(
      `Record not found: collection "${collectionName}", id "${recordId}"`,
      'The record no longer exists. It may have been deleted.',
    );
  }
}

export class NoRecordsError extends WorkflowExecutorError {
  constructor() {
    super('No records available');
  }
}

export class NoReadableFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(
      `No readable fields on record from collection "${collectionName}"`,
      'This record type has no readable fields configured in Forest Admin.',
    );
  }
}

export class NoResolvedFieldsError extends WorkflowExecutorError {
  constructor(fieldNames: string[]) {
    super(
      `None of the requested fields could be resolved: ${fieldNames.join(', ')}`,
      "The AI selected fields that don't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

export class NoWritableFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(
      `No writable fields on record from collection "${collectionName}"`,
      'This record type has no editable fields configured in Forest Admin.',
    );
  }
}

export class NoActionsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(
      `No actions available on collection "${collectionName}"`,
      'No actions are available on this record.',
    );
  }
}

/**
 * Thrown when a step's side effect succeeded (action/update/decision)
 * but the resulting state could not be persisted to the RunStore.
 */
export class StepPersistenceError extends WorkflowExecutorError {
  constructor(message: string, cause?: unknown) {
    super(message, 'The step result could not be saved. Please retry.');
    if (cause !== undefined) this.cause = cause;
  }
}

export class NoRelationshipFieldsError extends WorkflowExecutorError {
  constructor(collectionName: string) {
    super(
      `No relationship fields on record from collection "${collectionName}"`,
      'This record type has no relations configured in Forest Admin.',
    );
  }
}

export class RelatedRecordNotFoundError extends WorkflowExecutorError {
  constructor(collectionName: string, relationName: string) {
    super(
      `No related record found for relation "${relationName}" on collection "${collectionName}"`,
      'The related record could not be found. It may have been deleted.',
    );
  }
}

/** Thrown when the AI returns a response that violates expected constraints (bad index, empty selection, unknown identifier, etc.). */
export class InvalidAIResponseError extends WorkflowExecutorError {
  constructor(message: string) {
    super(message, "The AI made an unexpected choice. Try rephrasing the step's prompt.");
  }
}

/** Thrown when a named relation is not found in the collection schema. */
export class RelationNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Relation "${name}" not found in collection "${collectionName}"`,
      "The AI selected a relation that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

/** Thrown when a named field is not found in the collection schema. */
export class FieldNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Field "${name}" not found in collection "${collectionName}"`,
      "The AI selected a field that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

/** Thrown when a named action is not found in the collection schema. */
export class ActionNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Action "${name}" not found in collection "${collectionName}"`,
      "The AI selected an action that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

/** Thrown when step execution state is invalid (missing execution record, missing pending data, etc.). */
export class StepStateError extends WorkflowExecutorError {
  constructor(message: string) {
    super(message, 'An unexpected error occurred while processing this step.');
  }
}

export class NoMcpToolsError extends WorkflowExecutorError {
  constructor() {
    super('No MCP tools available', 'No tools are available to execute this step.');
  }
}

export class McpToolNotFoundError extends WorkflowExecutorError {
  constructor(name: string) {
    super(
      `MCP tool "${name}" not found`,
      "The AI selected a tool that doesn't exist. Try rephrasing the step's prompt.",
    );
  }
}

export class AgentPortError extends WorkflowExecutorError {
  constructor(operation: string, cause: unknown) {
    super(
      `Agent port "${operation}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      'An error occurred while accessing your data. Please try again.',
    );
    this.cause = cause;
  }
}

export class McpToolInvocationError extends WorkflowExecutorError {
  constructor(toolName: string, cause: unknown) {
    super(
      `MCP tool "${toolName}" invocation failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      'The tool failed to execute. Please try again or contact your administrator.',
    );
    this.cause = cause;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class RunNotFoundError extends Error {
  cause?: unknown;

  constructor(runId: string, cause?: unknown) {
    super(`Run "${runId}" not found or unavailable`);
    this.name = 'RunNotFoundError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class UserMismatchError extends Error {
  constructor(runId: string) {
    super(`User not authorized for run "${runId}"`);
    this.name = 'UserMismatchError';
  }
}

export class PendingDataNotFoundError extends Error {
  constructor(runId: string, stepIndex: number) {
    super(`Step ${stepIndex} in run "${runId}" not found or has no pending data`);
    this.name = 'PendingDataNotFoundError';
  }
}

/** Minimal mirror of ZodIssue — avoids importing Zod types into errors.ts. */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export class InvalidPendingDataError extends WorkflowExecutorError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super('Invalid pending data', 'The request body is invalid.');
    this.issues = issues;
  }
}

export class InvalidPreRecordedArgsError extends WorkflowExecutorError {
  constructor(detail: string) {
    super(`Invalid pre-recorded args: ${detail}`, 'The pre-configured step parameters are invalid');
  }
}

/** Thrown when a server step type has no executor equivalent (e.g. 'end', 'escalation'). */
export class UnsupportedStepTypeError extends WorkflowExecutorError {
  constructor(stepType: string) {
    super(
      `Step type "${stepType}" is not supported by the executor`,
      'This step type is not yet supported.',
    );
  }
}

/** Thrown when a server step definition is malformed (unknown taskType, missing required fields, etc.). */
export class InvalidStepDefinitionError extends WorkflowExecutorError {
  constructor(detail: string) {
    super(
      `Invalid step definition: ${detail}`,
      'The workflow step configuration is invalid. Please check the workflow designer.',
    );
  }
}
