import type {
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { ConditionStepDefinition, StepDefinition } from '../types/validated/step-definition';

import { ServerTaskTypeEnum } from './server-types';
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

function mapTask(task: ServerWorkflowTask): StepDefinition {
  // executionType is passed through as-is; each schema's .default().catch() handles
  // missing or unsupported values without requiring an explicit mapping here.
  const base = { prompt: task.prompt, executionType: task.executionType, title: task.title };

  switch (task.taskType) {
    case ServerTaskTypeEnum.McpServer:
      return McpStepDefinitionSchema.parse({
        ...base,
        type: StepType.Mcp,
        mcpServerId: task.mcpServerId,
      });
    case ServerTaskTypeEnum.Guideline:
      return GuidanceStepDefinitionSchema.parse({ ...base, type: StepType.Guidance });
    case ServerTaskTypeEnum.GetData:
      return ReadRecordStepDefinitionSchema.parse({ ...base, type: StepType.ReadRecord });
    case ServerTaskTypeEnum.UpdateData:
      return UpdateRecordStepDefinitionSchema.parse({ ...base, type: StepType.UpdateRecord });
    case ServerTaskTypeEnum.TriggerAction:
      return TriggerActionStepDefinitionSchema.parse({
        ...base,
        type: StepType.TriggerAction,
        preRecordedArgs: task.preRecordedArgs,
      });
    case ServerTaskTypeEnum.LoadRelatedRecord:
      return LoadRelatedRecordStepDefinitionSchema.parse({
        ...base,
        type: StepType.LoadRelatedRecord,
        preRecordedArgs: task.preRecordedArgs,
      });
    default:
      throw new InvalidStepDefinitionError(
        `Unknown taskType: "${(task as { taskType: string }).taskType}"`,
      );
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
    title: condition.title,
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
