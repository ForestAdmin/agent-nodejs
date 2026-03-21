import type {
  LoadRelatedRecordStepExecutionData,
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
      default:
        return null;
    }
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
