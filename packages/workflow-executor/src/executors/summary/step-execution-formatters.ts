import type {
  GuidanceStepExecutionData,
  LoadRelatedRecordStepExecutionData,
  McpStepExecutionData,
  StepExecutionData,
  TriggerRecordActionStepExecutionData,
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
      case 'trigger-action':
        return StepExecutionFormatters.formatTriggerAction(
          execution as TriggerRecordActionStepExecutionData,
        );
      default:
        return null;
    }
  }

  // Audit/context summary for a Trigger Action (PRD-513). Critically distinguishes an executed
  // action from one merely submitted for approval — downstream AI steps must NOT treat a
  // pending-approval action as if it ran.
  private static formatTriggerAction(
    execution: TriggerRecordActionStepExecutionData,
  ): string | null {
    const { executionResult } = execution;
    if (!executionResult || 'skipped' in executionResult) return null;

    const action = execution.executionParams?.displayName ?? 'the action';
    const submitter = executionResult.submittedBy === 'ai' ? 'AI' : 'the user';

    if (executionResult.submissionOutcome === 'pending-approval') {
      return `  Submitted action "${action}" for approval (by ${submitter}). It is AWAITING APPROVAL and has NOT been executed — no result is available yet.`;
    }

    const lines = [`  Triggered action "${action}" (submitted by ${submitter}).`];
    const aiFilled = executionResult.aiFilledValues;

    if (aiFilled?.length) {
      lines.push(`  AI pre-filled: ${aiFilled.map(v => v.field).join(', ')}.`);

      // Human-edited fields = those whose submitted value differs from the AI prefill (AI-assisted).
      const submitted = executionResult.submittedValues;

      if (submitted) {
        const aiMap = Object.fromEntries(aiFilled.map(v => [v.field, v.value]));
        const edited = Object.keys(submitted).filter(
          field => JSON.stringify(submitted[field]) !== JSON.stringify(aiMap[field]),
        );

        if (edited.length) lines.push(`  Edited by the user before submitting: ${edited.join(', ')}.`);
      }
    }

    return lines.join('\n');
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
    if (!execution.executionResult?.userInput) return null;

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
