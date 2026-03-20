/** @draft Types derived from the workflow-executor spec -- subject to change. */

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
  McpTask = 'mcp-task',
}

interface BaseStepDefinition {
  type: StepType;
  prompt?: string;
  aiConfigName?: string;
}

export interface ConditionStepDefinition extends BaseStepDefinition {
  type: StepType.Condition;
  options: [string, ...string[]];
}

export interface RecordTaskStepDefinition extends BaseStepDefinition {
  type: Exclude<StepType, StepType.Condition | StepType.McpTask>;
  automaticExecution?: boolean;
}

export interface McpTaskStepDefinition extends BaseStepDefinition {
  type: StepType.McpTask;
  mcpServerId?: string;
  automaticExecution?: boolean;
}

export type StepDefinition =
  | ConditionStepDefinition
  | RecordTaskStepDefinition
  | McpTaskStepDefinition;
