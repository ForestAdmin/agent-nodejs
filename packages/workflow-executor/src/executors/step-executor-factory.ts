import type BaseStepExecutor from './base-step-executor';
import type { ExecutionContext, PendingStepExecution } from '../types/execution';
import type {
  ConditionStepDefinition,
  McpTaskStepDefinition,
  RecordTaskStepDefinition,
} from '../types/step-definition';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import { StepStateError } from '../errors';
import ConditionStepExecutor from './condition-step-executor';
import LoadRelatedRecordStepExecutor from './load-related-record-step-executor';
import McpTaskStepExecutor from './mcp-task-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { StepType } from '../types/step-definition';

export default class StepExecutorFactory {
  static async create(
    step: PendingStepExecution,
    context: ExecutionContext,
    loadTools: () => Promise<RemoteTool[]>,
  ): Promise<BaseStepExecutor> {
    switch (step.stepDefinition.type) {
      case StepType.Condition:
        return new ConditionStepExecutor(context as ExecutionContext<ConditionStepDefinition>);
      case StepType.ReadRecord:
        return new ReadRecordStepExecutor(context as ExecutionContext<RecordTaskStepDefinition>);
      case StepType.UpdateRecord:
        return new UpdateRecordStepExecutor(context as ExecutionContext<RecordTaskStepDefinition>);
      case StepType.TriggerAction:
        return new TriggerRecordActionStepExecutor(
          context as ExecutionContext<RecordTaskStepDefinition>,
        );
      case StepType.LoadRelatedRecord:
        return new LoadRelatedRecordStepExecutor(
          context as ExecutionContext<RecordTaskStepDefinition>,
        );
      case StepType.McpTask:
        return new McpTaskStepExecutor(
          context as ExecutionContext<McpTaskStepDefinition>,
          await loadTools(),
        );
      default:
        throw new StepStateError(
          `Unknown step type: ${(step.stepDefinition as { type: string }).type}`,
        );
    }
  }
}
