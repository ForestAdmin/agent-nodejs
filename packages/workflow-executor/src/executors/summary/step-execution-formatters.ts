import type {
  GuidanceStepExecutionData,
  LoadRelatedRecordStepExecutionData,
  McpStepExecutionData,
  StepExecutionData,
} from '../../types/step-execution-data';

export default class StepExecutionFormatters {
  // Returns null when no custom format is defined for the step type or when execution data
  // doesn't satisfy formatter preconditions — caller falls back to generic Input:/Output:.
  static format(execution: StepExecutionData): string | null {
    switch (execution.type) {
      case 'load-related-record':
        return StepExecutionFormatters.formatLoadRelatedRecord(execution);
      case 'mcp':
        return StepExecutionFormatters.formatMcp(execution as McpStepExecutionData);
      case 'guidance':
        return StepExecutionFormatters.formatGuidance(execution as GuidanceStepExecutionData);
      default:
        return null;
    }
  }

  private static formatMcp(execution: McpStepExecutionData): string | null {
    const { executionResult } = execution;
    if (!executionResult) return null;
    if ('skipped' in executionResult) return null;

    if (executionResult.formattedResponse) {
      return `  Result: ${executionResult.formattedResponse}`;
    }

    const toolName = execution.executionParams?.name ?? 'unknown tool';

    return `  Executed: ${toolName} (result not summarized)`;
  }

  private static formatGuidance(execution: GuidanceStepExecutionData): string | null {
    if (!execution.executionResult) return null;

    return `  The user provided the following input: "${execution.executionResult.userInput}"`;
  }

  private static formatLoadRelatedRecord(
    execution: LoadRelatedRecordStepExecutionData,
  ): string | null {
    const { executionResult } = execution;

    if (!executionResult) return null; // pending phase — no result yet
    if ('skipped' in executionResult) return null; // user skipped — generic fallback

    const { selectedRecordRef } = execution;
    const { relation, record } = executionResult;
    const sourceId = selectedRecordRef.recordId.join(', ');
    const recordId = record.recordId.join(', ');

    return `  Loaded: ${selectedRecordRef.collectionName} #${sourceId} → [${relation.displayName}] → ${record.collectionName} #${recordId} (step ${record.stepIndex})`;
  }
}
