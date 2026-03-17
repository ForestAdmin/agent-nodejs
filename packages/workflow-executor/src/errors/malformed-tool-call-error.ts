import WorkflowExecutorError from './workflow-executor-error';

export default class MalformedToolCallError extends WorkflowExecutorError {
  readonly toolName: string;

  constructor(toolName: string, details: string) {
    super(`AI returned a malformed tool call for "${toolName}": ${details}`);
    this.toolName = toolName;
  }
}
