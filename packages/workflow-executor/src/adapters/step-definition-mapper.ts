import type {
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { ConditionStepDefinition, StepDefinition } from '../types/validated/step-definition';
import type { z } from 'zod';

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

// A bare ZodError escaping this mapper is logged-and-dropped by the port's getAvailableRuns
// (only WorkflowExecutorError instances are reported as malformed), leaving the run silently
// re-fetched on every poll — wrap parse failures so the run is reported to the orchestrator.
function parseStepDefinition<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const detail = result.error.issues
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  throw new InvalidStepDefinitionError(detail);
}

function mapTask(task: ServerWorkflowTask): StepDefinition {
  // executionType is passed through as-is. Each schema applies its own `.default()` for a missing
  // value; schemas that accept `manual` (guidance, load-related, trigger-action) drop `.catch`
  // and reject an out-of-enum value rather than coercing it — server values are a 1:1 enum
  // mapping today.
  const base = { prompt: task.prompt, executionType: task.executionType, title: task.title };

  switch (task.taskType) {
    case ServerTaskTypeEnum.McpServer:
      return parseStepDefinition(McpStepDefinitionSchema, {
        ...base,
        type: StepType.Mcp,
        mcpServerId: task.mcpServerId,
      });
    case ServerTaskTypeEnum.Guideline:
      return parseStepDefinition(GuidanceStepDefinitionSchema, {
        ...base,
        type: StepType.Guidance,
      });
    case ServerTaskTypeEnum.GetData:
      return parseStepDefinition(ReadRecordStepDefinitionSchema, {
        ...base,
        type: StepType.ReadRecord,
        preRecordedArgs: task.preRecordedArgs,
      });
    case ServerTaskTypeEnum.UpdateData:
      return parseStepDefinition(UpdateRecordStepDefinitionSchema, {
        ...base,
        type: StepType.UpdateRecord,
        preRecordedArgs: task.preRecordedArgs,
      });
    case ServerTaskTypeEnum.TriggerAction:
      return parseStepDefinition(TriggerActionStepDefinitionSchema, {
        ...base,
        type: StepType.TriggerAction,
        preRecordedArgs: task.preRecordedArgs,
      });
    case ServerTaskTypeEnum.LoadRelatedRecord:
      return parseStepDefinition(LoadRelatedRecordStepDefinitionSchema, {
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

  return parseStepDefinition(ConditionStepDefinitionSchema, {
    type: StepType.Condition,
    prompt: condition.prompt,
    executionType: condition.executionType,
    title: condition.title,
    options,
    preRecordedArgs: condition.preRecordedArgs,
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
