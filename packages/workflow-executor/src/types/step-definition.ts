/** @draft Types derived from the workflow-executor spec -- subject to change. */

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
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
  type: Exclude<StepType, StepType.Condition>;
  automaticCompletion?: boolean;
  allowedTools?: string[];
}

export type StepDefinition = ConditionStepDefinition | RecordTaskStepDefinition;
