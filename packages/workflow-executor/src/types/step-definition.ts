/** @draft Types derived from the workflow-executor spec -- subject to change. */

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
  Mcp = 'mcp',
}

interface BaseStepDefinition {
  type: StepType;
  prompt?: string;
  aiConfigName?: string;
}

interface BaseRecordStepDefinition extends BaseStepDefinition {
  automaticExecution?: boolean;
}

export interface ConditionStepDefinition extends BaseStepDefinition {
  type: StepType.Condition;
  options: [string, ...string[]];
}

export interface ReadRecordStepDefinition extends BaseRecordStepDefinition {
  type: StepType.ReadRecord;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    /** Display names of the fields to read */
    fieldDisplayNames?: string[];
  };
}

export interface UpdateRecordStepDefinition extends BaseRecordStepDefinition {
  type: StepType.UpdateRecord;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    /** Display name of the field to update */
    fieldDisplayName?: string;
    value?: string;
  };
}

export interface TriggerActionStepDefinition extends BaseRecordStepDefinition {
  type: StepType.TriggerAction;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    /** Display name of the action to trigger */
    actionDisplayName?: string;
  };
}

export interface LoadRelatedRecordStepDefinition extends BaseRecordStepDefinition {
  type: StepType.LoadRelatedRecord;
  preRecordedArgs?: {
    selectedRecordStepIndex?: number;
    /** Display name of the relation to follow */
    relationDisplayName?: string;
    selectedRecordIndex?: number;
  };
}


export interface McpStepDefinition extends BaseStepDefinition {
  type: StepType.Mcp;
  mcpServerId?: string;
  automaticExecution?: boolean;
}

export type RecordStepDefinition =
  | ReadRecordStepDefinition
  | UpdateRecordStepDefinition
  | TriggerActionStepDefinition
  | LoadRelatedRecordStepDefinition;


export type StepDefinition = ConditionStepDefinition | RecordStepDefinition | McpStepDefinition;
