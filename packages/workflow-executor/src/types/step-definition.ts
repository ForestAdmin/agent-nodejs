/** @draft Types derived from the workflow-executor spec -- subject to change. */

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
}

interface BaseStepDefinition {
  id: string;
  type: StepType;
  aiConfigName?: string;
}

export interface ConditionStepDefinition extends BaseStepDefinition {
  type: StepType.Condition;
  options: string[];
  prompt?: string;
}

export interface AiTaskStepDefinition extends BaseStepDefinition {
  type:
    | StepType.ReadRecord
    | StepType.UpdateRecord
    | StepType.TriggerAction
    | StepType.LoadRelatedRecord;
  recordSourceStepId?: string;
  prompt?: string;
  automaticCompletion?: boolean;
  allowedTools?: string[];
  remoteToolsSourceId?: string;
}

export type StepDefinition = ConditionStepDefinition | AiTaskStepDefinition;

/**
 * Coarse categorization of steps. StepType has 5 fine-grained values;
 * StepCategory collapses the 4 non-condition types into 'ai-task'.
 * Used as discriminant in StepHistory and StepExecutionData.
 */
export type StepCategory = 'condition' | 'ai-task';
