import type {
  ServerTaskType,
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { ConditionStepDefinition, StepDefinition } from '../types/step-definition';

import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../errors';
import { StepType } from '../types/step-definition';

const TASK_TYPE_TO_STEP_TYPE: Record<ServerTaskType, StepType> = {
  'get-data': StepType.ReadRecord,
  'update-data': StepType.UpdateRecord,
  'trigger-action': StepType.TriggerAction,
  'load-related-record': StepType.LoadRelatedRecord,
  'mcp-server': StepType.Mcp,
  guideline: StepType.Guidance,
};

/**
 * Convert a server-formatted workflow step into the flat executor StepDefinition.
 *
 * - Server uses `type: 'task'` + `taskType` discriminator for all non-condition steps.
 * - Server uses `outgoing[]` transitions for conditions; executor uses `options: string[]`.
 * - Some server step types (`end`, `escalation`, `start/close-sub-workflow`) have no
 *   executor equivalent yet and throw `UnsupportedStepTypeError`.
 */
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

function mapTask(task: ServerWorkflowTask): StepDefinition {
  const stepType = TASK_TYPE_TO_STEP_TYPE[task.taskType];

  if (!stepType) {
    throw new InvalidStepDefinitionError(`Unknown taskType: "${task.taskType}"`);
  }

  const base: { prompt: string; automaticExecution?: boolean } = { prompt: task.prompt };
  if (task.automaticExecution !== undefined) base.automaticExecution = task.automaticExecution;

  switch (stepType) {
    case StepType.Mcp:
      return { ...base, type: StepType.Mcp, ...(task.mcpServerId && { mcpServerId: task.mcpServerId }) };
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
    options: options as [string, ...string[]],
  };
}
