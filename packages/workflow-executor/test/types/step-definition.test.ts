import {
  ConditionStepDefinitionSchema,
  GuidanceStepDefinitionSchema,
  LoadRelatedRecordStepDefinitionSchema,
  StepExecutionMode,
  StepType,
} from '../../src/types/validated/step-definition';

describe('ConditionStepDefinitionSchema executionType', () => {
  const base = { type: StepType.Condition as const, options: ['Yes', 'No'] };

  it('parses each valid execution mode to its own value', () => {
    expect(
      ConditionStepDefinitionSchema.parse({ ...base, executionType: 'manual' }).executionType,
    ).toBe(StepExecutionMode.Manual);
    expect(
      ConditionStepDefinitionSchema.parse({ ...base, executionType: 'fully-automated' })
        .executionType,
    ).toBe(StepExecutionMode.FullyAutomated);
  });

  it('defaults a missing executionType to FullyAutomated', () => {
    expect(ConditionStepDefinitionSchema.parse(base).executionType).toBe(
      StepExecutionMode.FullyAutomated,
    );
  });

  // No `.catch` on the enum: an unknown value must be rejected, not silently coerced to
  // FullyAutomated (which would let the AI decide in place of a future deterministic mode).
  it('rejects an invalid executionType instead of coercing it', () => {
    expect(
      ConditionStepDefinitionSchema.safeParse({ ...base, executionType: 'deterministic' }).success,
    ).toBe(false);
    expect(
      ConditionStepDefinitionSchema.safeParse({ ...base, executionType: 'not-a-mode' }).success,
    ).toBe(false);
  });
});

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

describe('GuidanceStepDefinitionSchema executionType', () => {
  const base = { type: StepType.Guidance as const };

  it('parses each valid execution mode to its own value', () => {
    expect(
      GuidanceStepDefinitionSchema.parse({ ...base, executionType: 'manual' }).executionType,
    ).toBe(StepExecutionMode.Manual);
    expect(
      GuidanceStepDefinitionSchema.parse({ ...base, executionType: 'automated-with-confirmation' })
        .executionType,
    ).toBe(StepExecutionMode.AutomatedWithConfirmation);
    expect(
      GuidanceStepDefinitionSchema.parse({ ...base, executionType: 'fully-automated' })
        .executionType,
    ).toBe(StepExecutionMode.FullyAutomated);
  });

  it('defaults a missing executionType to Manual', () => {
    expect(GuidanceStepDefinitionSchema.parse(base).executionType).toBe(StepExecutionMode.Manual);
  });

  it('rejects an invalid executionType instead of coercing it', () => {
    expect(
      GuidanceStepDefinitionSchema.safeParse({ ...base, executionType: 'not-a-mode' }).success,
    ).toBe(false);
  });
});
