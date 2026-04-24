import type {
  ServerTaskType,
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { ConditionStepDefinition, StepDefinition } from '../types/validated/step-definition';

import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../errors';
import { StepType } from '../types/validated/step-definition';

const TASK_TYPE_TO_STEP_TYPE: Record<ServerTaskType, StepType> = {
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

  const base: { prompt: string; automaticExecution?: boolean } = { prompt: task.prompt };
  if (task.automaticExecution !== undefined) base.automaticExecution = task.automaticExecution;

  switch (stepType) {
    case StepType.Mcp:
      return {
        ...base,
        type: StepType.Mcp,
        ...(task.mcpServerId !== undefined && { mcpServerId: task.mcpServerId }),
      };
    case StepType.Guidance:
      return { ...base, type: StepType.Guidance };
    case StepType.ReadRecord:
      return { ...base, type: StepType.ReadRecord };
    case StepType.UpdateRecord:
      return { ...base, type: StepType.UpdateRecord };
    case StepType.TriggerAction:
      return { ...base, type: StepType.TriggerAction };
    case StepType.LoadRelatedRecord:
      return { ...base, type: StepType.LoadRelatedRecord };
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

  return {
    type: StepType.Condition,
    prompt: condition.prompt,
    options,
  };
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
