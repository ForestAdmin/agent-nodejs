import type {
  LoadRelatedRecordStepExecutionData,
  McpTaskStepExecutionData,
  StepExecutionData,
} from '../../types/step-execution-data';

/**
 * Stateless utility class — all methods are static.
 * Provides type-specific formatting for step execution results.
 * Add one private static method per step type that needs a non-generic display format,
 * and dispatch from `format`.
 */
export default class StepExecutionFormatters {
  /**
   * Returns the full output line (indent + label + content) for the given execution, or null when:
   * - No custom format is defined for this step type (switch default) — caller uses generic fallback, or
   * - The execution data does not satisfy the formatter's preconditions (e.g. skipped/incomplete).
   * In both cases, `StepSummaryBuilder` renders the generic Input:/Output: fallback.
   */
  static format(execution: StepExecutionData): string | null {
    switch (execution.type) {
      case 'load-related-record':
        return StepExecutionFormatters.formatLoadRelatedRecord(execution);
      case 'mcp-task':
        return StepExecutionFormatters.formatMcpTask(execution as McpTaskStepExecutionData);
      default:
        return null;
    }
  }

  private static formatMcpTask(execution: McpTaskStepExecutionData): string | null {
    const { executionResult } = execution;
    if (!executionResult) return null;
    if ('skipped' in executionResult) return null;

    if (executionResult.formattedResponse) {
      return `  Result: ${executionResult.formattedResponse}`;
    }

    const toolName = execution.executionParams?.name ?? 'unknown tool';

    return `  Executed: ${toolName} (result not summarized)`;
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
