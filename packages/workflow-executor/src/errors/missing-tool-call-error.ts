import WorkflowExecutorError from './workflow-executor-error';

export default class MissingToolCallError extends WorkflowExecutorError {
  constructor() {
    super('AI did not return a tool call');
  }
}
