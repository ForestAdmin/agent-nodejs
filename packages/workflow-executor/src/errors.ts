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
