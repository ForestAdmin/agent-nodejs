import {
  LoadRelatedRecordStepDefinitionSchema,
  StepExecutionMode,
  StepType,
} from '../../src/types/validated/step-definition';

describe('LoadRelatedRecordStepDefinitionSchema executionType', () => {
  const base = { type: StepType.LoadRelatedRecord as const };

  it('parses each valid execution mode to its own value', () => {
    expect(
      LoadRelatedRecordStepDefinitionSchema.parse({ ...base, executionType: 'manual' })
        .executionType,
    ).toBe(StepExecutionMode.Manual);
    expect(
      LoadRelatedRecordStepDefinitionSchema.parse({
        ...base,
        executionType: 'automated-with-confirmation',
      }).executionType,
    ).toBe(StepExecutionMode.AutomatedWithConfirmation);
    expect(
      LoadRelatedRecordStepDefinitionSchema.parse({ ...base, executionType: 'fully-automated' })
        .executionType,
    ).toBe(StepExecutionMode.FullyAutomated);
  });

  it('defaults a missing executionType to AutomatedWithConfirmation', () => {
    expect(LoadRelatedRecordStepDefinitionSchema.parse(base).executionType).toBe(
      StepExecutionMode.AutomatedWithConfirmation,
    );
  });

  // No `.catch` on the enum: an invalid value must be rejected, not silently coerced to
  // AutomatedWithConfirmation (which would turn AI prefill back on for a `manual` typo).
  it('rejects an invalid executionType instead of coercing it', () => {
    const result = LoadRelatedRecordStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'not-a-mode',
    });

    expect(result.success).toBe(false);
  });
});
