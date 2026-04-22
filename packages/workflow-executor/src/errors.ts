/* eslint-disable max-classes-per-file */
import type { MalformedRunInfo } from './ports/workflow-port';
import type { z } from 'zod';

export function causeMessage(error: unknown): string | undefined {
  const { cause } = error as { cause?: unknown };

  return cause instanceof Error ? cause.message : undefined;
}

// Cascades through err.message → err.parent.message (Sequelize) → err.cause.message → err.name,
// so wrapped infra errors (SequelizeConnectionRefusedError has an empty .message) don't log as empty.
export function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  if (err.message) return err.message;

  const { parent } = err as { parent?: unknown };
  if (parent instanceof Error && parent.message) return parent.message;

  const { cause } = err as { cause?: unknown };
  if (cause instanceof Error && cause.message) return cause.message;

  return err.name || 'Unknown error';
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

export class UnsupportedActionFormError extends WorkflowExecutorError {
  constructor(actionDisplayName: string) {
    super(
      `Action "${actionDisplayName}" requires a form which is not supported by the executor`,
      'This action requires user input via a form, which is not yet supported in workflows.',
    );
  }
}

export class RunStorePortError extends WorkflowExecutorError {
  constructor(operation: string, cause: unknown) {
    super(
      `Run store "${operation}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      'The step state could not be accessed. Please retry.',
    );
    this.cause = cause;
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

export class InvalidAIResponseError extends WorkflowExecutorError {
  constructor(message: string) {
    super(message, "The AI made an unexpected choice. Try rephrasing the step's prompt.");
  }
}

export class RelationNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Relation "${name}" not found in collection "${collectionName}"`,
      "The AI selected a relation that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

export class FieldNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Field "${name}" not found in collection "${collectionName}"`,
      "The AI selected a field that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

export class ActionNotFoundError extends WorkflowExecutorError {
  constructor(name: string, collectionName: string) {
    super(
      `Action "${name}" not found in collection "${collectionName}"`,
      "The AI selected an action that doesn't exist on this record. Try rephrasing the step's prompt.",
    );
  }
}

export class StepStateError extends WorkflowExecutorError {
  constructor(message: string) {
    super(message, 'An unexpected error occurred while processing this step.');
  }
}

// Bubbles from base-step-executor, which converts it to a step error — no step runs without an audit log.
export class ActivityLogCreationError extends WorkflowExecutorError {
  constructor(cause: unknown) {
    super(
      'Failed to create activity log',
      'Could not record this step in the audit log. Please try again, or contact your administrator if the problem persists.',
    );
    this.cause = cause;
  }
}

export class StepTimeoutError extends WorkflowExecutorError {
  constructor(timeoutMs: number) {
    super(
      `Step execution exceeded timeout of ${timeoutMs}ms`,
      'The step took too long to complete. Please try again, or contact your administrator if the problem persists.',
    );
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

export class WorkflowPortError extends WorkflowExecutorError {
  constructor(operation: string, cause: unknown) {
    super(
      `Workflow port "${operation}" failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      'Failed to communicate with the workflow orchestrator. Please try again.',
    );
    this.cause = cause;
  }
}

export class AiModelPortError extends WorkflowExecutorError {
  constructor(operation: string, cause: unknown) {
    super(
      `AI model "${operation}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      'The AI service is unavailable. Please try again or contact your administrator.',
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

// Minimal mirror of ZodIssue — avoids importing Zod types into errors.ts.
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

// Boundary error — surfaces from Runner.start() and is caught at the CLI/HTTP layer, not by step executors.
export class AgentProbeError extends Error {
  // Manual `cause` assignment: Error accepts it natively since Node 16.9 but our TS target is ES2020.
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(`Agent probe failed: ${message}`);
    this.name = 'AgentProbeError';
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export class UnsupportedStepTypeError extends WorkflowExecutorError {
  constructor(stepType: string) {
    super(
      `Step type "${stepType}" is not supported by the executor`,
      'This step type is not yet supported.',
    );
  }
}

export class InvalidStepDefinitionError extends WorkflowExecutorError {
  constructor(detail: string) {
    super(
      `Invalid step definition: ${detail}`,
      'The workflow step configuration is invalid. Please check the workflow designer.',
    );
  }
}

// Thrown when zod validation fails on a domain object produced internally (e.g. by the
// run-to-pending-step mapper). Distinct from InvalidStepDefinitionError (which flags wire-format
// bugs coming from the orchestrator) so the two can be triaged separately in Sentry.
export class DomainValidationError extends WorkflowExecutorError {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(runId: number, zodError: z.ZodError) {
    const issues = zodError.issues.map(i => ({
      path: i.path.join('.') || '(root)',
      message: i.message,
    }));
    const summary = issues.map(i => `${i.path}: ${i.message}`).join('; ');

    super(
      `Run ${runId} mapper produced invalid PendingStepExecution — ${summary}`,
      'Internal validation error occurred while preparing the step. Please contact support.',
    );
    this.cause = zodError;
    this.issues = issues;
  }
}

// Carries MalformedRunInfo so the Runner can report the run without re-parsing the message.
export class MalformedRunError extends WorkflowExecutorError {
  readonly info: MalformedRunInfo;

  constructor(info: MalformedRunInfo) {
    super(info.technicalMessage, info.userMessage);
    this.info = info;
  }
}
