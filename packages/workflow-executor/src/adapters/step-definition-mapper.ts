import type {
  ServerTaskTypeEnum,
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { ConditionStepDefinition, StepDefinition } from '../types/validated/step-definition';

import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../errors';
import {
  ConditionStepDefinitionSchema,
  GuidanceStepDefinitionSchema,
  LoadRelatedRecordStepDefinitionSchema,
  McpStepDefinitionSchema,
  ReadRecordStepDefinitionSchema,
  StepType,
  TriggerActionStepDefinitionSchema,
  UpdateRecordStepDefinitionSchema,
} from '../types/validated/step-definition';

const TASK_TYPE_TO_STEP_TYPE: Record<ServerTaskTypeEnum, StepType> = {
  'get-data': StepType.ReadRecord,
  'update-data': StepType.UpdateRecord,
  'trigger-action': StepType.TriggerAction,
  'load-related-record': StepType.LoadRelatedRecord,
  'mcp-server': StepType.Mcp,
  guideline: StepType.Guidance,
};

function mapTask(task: ServerWorkflowTask): StepDefinition {
  const stepType = TASK_TYPE_TO_STEP_TYPE[task.taskType];

  if (!stepType) {
    throw new InvalidStepDefinitionError(`Unknown taskType: "${task.taskType}"`);
  }

  // executionType is passed through as-is; each schema's .default().catch() handles
  // missing or unsupported values without requiring an explicit mapping here.
  const base = { prompt: task.prompt, executionType: task.executionType };

  switch (stepType) {
    case StepType.Mcp:
      return McpStepDefinitionSchema.parse({
        ...base,
        type: StepType.Mcp,
        ...('mcpServerId' in task && { mcpServerId: task.mcpServerId }),
      });
    case StepType.Guidance:
      return GuidanceStepDefinitionSchema.parse({ ...base, type: StepType.Guidance });
    case StepType.ReadRecord:
      return ReadRecordStepDefinitionSchema.parse({ ...base, type: StepType.ReadRecord });
    case StepType.UpdateRecord:
      return UpdateRecordStepDefinitionSchema.parse({ ...base, type: StepType.UpdateRecord });
    case StepType.TriggerAction:
      return TriggerActionStepDefinitionSchema.parse({ ...base, type: StepType.TriggerAction });
    case StepType.LoadRelatedRecord:
      return LoadRelatedRecordStepDefinitionSchema.parse({
        ...base,
        type: StepType.LoadRelatedRecord,
      });
    default:
      throw new InvalidStepDefinitionError(`Unmapped step type: "${stepType}"`);
  }
}

function mapCondition(condition: ServerWorkflowCondition): ConditionStepDefinition {
  const options = condition.outgoing
    .map(t => t.answer ?? t.buttonText)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  if (options.length < 2) {
    throw new InvalidStepDefinitionError(
      `Condition step requires at least 2 options, got ${options.length}`,
    );
  }

  return ConditionStepDefinitionSchema.parse({
    type: StepType.Condition,
    prompt: condition.prompt,
    executionType: condition.executionType,
    options,
  });
}

// Server uses `type:'task' + taskType` for non-condition steps and `outgoing[]` for conditions;
// executor uses flat StepDefinition with `options[]`. Unsupported server types
// (end/escalation/sub-workflow) throw UnsupportedStepTypeError.
export default function toStepDefinition(serverStep: ServerWorkflowStep): StepDefinition {
  switch (serverStep.type) {
    case 'task':
      return mapTask(serverStep);
    case 'condition':
      return mapCondition(serverStep);
    case 'end':
    case 'escalation':
    case 'start-sub-workflow':
    case 'close-sub-workflow':
      throw new UnsupportedStepTypeError(serverStep.type);
    default:
      throw new InvalidStepDefinitionError(
        `Unknown server step type: "${(serverStep as { type: string }).type}"`,
      );
  }
}
