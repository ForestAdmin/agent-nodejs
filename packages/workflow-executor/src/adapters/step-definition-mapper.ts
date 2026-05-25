import type {
  ServerTaskTypeEnum,
  ServerWorkflowCondition,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from './server-types';
import type { Logger } from '../ports/logger-port';
import type { ConditionStepDefinition, StepDefinition } from '../types/validated/step-definition';

import { ServerStepExecutionTypeEnum } from './server-types';
import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../errors';
import { StepExecutionMode, StepType } from '../types/validated/step-definition';

// Declares which execution modes are valid per step type and the fallback to use otherwise.
// Enforced at the adapter boundary so executors can assume the configured mode is supported.
const SUPPORTED_EXECUTION_MODES: Record<
  StepType,
  { supported: readonly StepExecutionMode[]; fallback: StepExecutionMode }
> = {
  [StepType.Condition]: {
    supported: [StepExecutionMode.Manual, StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.FullyAutomated,
  },
  [StepType.ReadRecord]: {
    supported: [StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.FullyAutomated,
  },
  [StepType.UpdateRecord]: {
    supported: [StepExecutionMode.AutomatedWithConfirmation, StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.AutomatedWithConfirmation,
  },
  [StepType.TriggerAction]: {
    supported: [StepExecutionMode.AutomatedWithConfirmation, StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.AutomatedWithConfirmation,
  },
  [StepType.LoadRelatedRecord]: {
    supported: [StepExecutionMode.AutomatedWithConfirmation, StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.AutomatedWithConfirmation,
  },
  [StepType.Mcp]: {
    supported: [StepExecutionMode.AutomatedWithConfirmation, StepExecutionMode.FullyAutomated],
    fallback: StepExecutionMode.AutomatedWithConfirmation,
  },
  [StepType.Guidance]: {
    supported: [StepExecutionMode.Manual],
    fallback: StepExecutionMode.Manual,
  },
};

const TASK_TYPE_TO_STEP_TYPE: Record<ServerTaskTypeEnum, StepType> = {
  'get-data': StepType.ReadRecord,
  'update-data': StepType.UpdateRecord,
  'trigger-action': StepType.TriggerAction,
  'load-related-record': StepType.LoadRelatedRecord,
  'mcp-server': StepType.Mcp,
  guideline: StepType.Guidance,
};

const EXECUTION_TYPE_TO_MODE: Record<ServerStepExecutionTypeEnum, StepExecutionMode> = {
  [ServerStepExecutionTypeEnum.Manual]: StepExecutionMode.Manual,
  [ServerStepExecutionTypeEnum.AutomatedWithConfirmation]:
    StepExecutionMode.AutomatedWithConfirmation,
  [ServerStepExecutionTypeEnum.FullyAutomated]: StepExecutionMode.FullyAutomated,
};

function toStepExecutionMode(
  executionType: ServerStepExecutionTypeEnum | undefined,
): StepExecutionMode | undefined {
  return EXECUTION_TYPE_TO_MODE[executionType] ?? null;
}

// Substitutes the step type's fallback when the configured mode is not supported, logging a
// warning. Returns undefined for legacy workflows that don't specify an executionType — executors
// already treat undefined as the fallback.
function normalizeExecutionType(
  stepType: StepType,
  executionType: StepExecutionMode | undefined,
  logger?: Logger,
): StepExecutionMode | undefined {
  if (executionType === undefined) return undefined;
  const { supported, fallback } = SUPPORTED_EXECUTION_MODES[stepType];
  if (supported.includes(executionType)) return executionType;

  logger?.warn(
    `Step type "${stepType}" received unsupported executionType=${executionType}; falling back to ${fallback}`,
    { stepType, configuredExecutionType: executionType, supportedExecutionTypes: supported },
  );

  return fallback;
}

function mapTask(task: ServerWorkflowTask, logger?: Logger): StepDefinition {
  const stepType = TASK_TYPE_TO_STEP_TYPE[task.taskType];

  if (!stepType) {
    throw new InvalidStepDefinitionError(`Unknown taskType: "${task.taskType}"`);
  }

  const executionType = normalizeExecutionType(
    stepType,
    toStepExecutionMode(task.executionType),
    logger,
  );
  const base: { prompt: string; executionType: StepExecutionMode } = {
    prompt: task.prompt,
    executionType,
  };

  switch (stepType) {
    case StepType.Mcp:
      return {
        ...base,
        type: StepType.Mcp,
        ...('mcpServerId' in task && { mcpServerId: task.mcpServerId }),
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

function mapCondition(
  condition: ServerWorkflowCondition,
  logger?: Logger,
): ConditionStepDefinition {
  const options = condition.outgoing
    .map(t => t.answer ?? t.buttonText)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  if (options.length < 2) {
    throw new InvalidStepDefinitionError(
      `Condition step requires at least 2 options, got ${options.length}`,
    );
  }

  const executionType = normalizeExecutionType(
    StepType.Condition,
    toStepExecutionMode(condition.executionType),
    logger,
  );

  return {
    type: StepType.Condition,
    prompt: condition.prompt,
    options,
    ...(executionType !== undefined && { executionType }),
  };
}

// Server uses `type:'task' + taskType` for non-condition steps and `outgoing[]` for conditions;
// executor uses flat StepDefinition with `options[]`. Unsupported server types
// (end/escalation/sub-workflow) throw UnsupportedStepTypeError.
export default function toStepDefinition(
  serverStep: ServerWorkflowStep,
  logger?: Logger,
): StepDefinition {
  switch (serverStep.type) {
    case 'task':
      return mapTask(serverStep, logger);
    case 'condition':
      return mapCondition(serverStep, logger);
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
