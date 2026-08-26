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
  // FullyAutomated, which would hand the decision to the AI. `deterministic` is one such unknown
  // value now that it is gone from the wire contract.
  it.each(['not-a-mode', 'deterministic', 'whatever'])(
    'rejects the unknown executionType "%s" instead of coercing it',
    executionType => {
      expect(ConditionStepDefinitionSchema.safeParse({ ...base, executionType }).success).toBe(
        false,
      );
    },
  );

  it('rejects the removed "deterministic" mode even when preRecordedArgs are present', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'deterministic',
      preRecordedArgs: {
        optionConditions: [
          {
            option: 'Yes',
            aggregator: 'and',
            conditions: [{ sourceStepId: 'get-data-1', fieldName: 'amount', operator: 'present' }],
          },
        ],
        fallbackOption: 'No',
      },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(!result.success && result.error.issues)).toContain('executionType');
  });
});

describe('ConditionStepDefinitionSchema deterministic conditions', () => {
  const base = { type: StepType.Condition as const, options: ['High value', 'Fallback'] };
  const preRecordedArgs = {
    optionConditions: [
      {
        option: 'High value',
        aggregator: 'and',
        conditions: [
          { sourceStepId: 'get-data-1', fieldName: 'amount', operator: 'greater_than', value: 100 },
        ],
      },
    ],
    fallbackOption: 'Fallback',
  };

  // A deterministic gateway publishes with `aiDecision` stripped, so it reaches the executor as
  // `manual` + preRecordedArgs: the args carry the mode, the executionType does not.
  it('accepts manual with preRecordedArgs and round-trips them', () => {
    const parsed = ConditionStepDefinitionSchema.parse({
      ...base,
      executionType: 'manual',
      preRecordedArgs,
    });

    expect(parsed.executionType).toBe(StepExecutionMode.Manual);
    expect(parsed.preRecordedArgs).toEqual(preRecordedArgs);
  });

  it('accepts preRecordedArgs with no executionType at all', () => {
    const parsed = ConditionStepDefinitionSchema.parse({ ...base, preRecordedArgs });

    expect(parsed.executionType).toBe(StepExecutionMode.FullyAutomated);
    expect(parsed.preRecordedArgs).toEqual(preRecordedArgs);
  });

  // The `value` is supplied on purpose: without it the value-less-operator refinement would
  // reject the condition anyway, and the test would pass without pinning the operator enum.
  it('rejects an unknown operator at the schema boundary', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: {
        ...preRecordedArgs,
        optionConditions: [
          {
            option: 'High value',
            aggregator: 'and',
            conditions: [
              { sourceStepId: 'get-data-1', fieldName: 'amount', operator: 'ilike', value: '%x%' },
            ],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(!result.success && result.error.issues)).toContain('operator');
  });

  it('rejects preRecordedArgs missing fallbackOption', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: { optionConditions: preRecordedArgs.optionConditions },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an option with an unknown aggregator', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: {
        ...preRecordedArgs,
        optionConditions: [{ ...preRecordedArgs.optionConditions[0], aggregator: 'xor' }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an option with zero conditions', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: {
        ...preRecordedArgs,
        optionConditions: [{ option: 'High value', aggregator: 'and', conditions: [] }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects preRecordedArgs with zero optionConditions', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: { ...preRecordedArgs, optionConditions: [] },
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(!result.success && result.error.issues)).toContain('optionConditions');
  });

  it.each(['equal', 'not_equal', 'greater_than', 'in', 'contains'])(
    'rejects a "%s" condition with no value',
    operator => {
      const result = ConditionStepDefinitionSchema.safeParse({
        ...base,
        executionType: 'manual',
        preRecordedArgs: {
          ...preRecordedArgs,
          optionConditions: [
            {
              option: 'High value',
              aggregator: 'and',
              conditions: [{ sourceStepId: 'get-data-1', fieldName: 'amount', operator }],
            },
          ],
        },
      });

      expect(result.success).toBe(false);
    },
  );

  it('accepts a value-less condition for present/blank operators', () => {
    const result = ConditionStepDefinitionSchema.safeParse({
      ...base,
      executionType: 'manual',
      preRecordedArgs: {
        ...preRecordedArgs,
        optionConditions: [
          {
            option: 'High value',
            aggregator: 'or',
            conditions: [{ sourceStepId: 'get-data-1', fieldName: 'amount', operator: 'present' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('still accepts a condition with no preRecordedArgs at all', () => {
    expect(
      ConditionStepDefinitionSchema.safeParse({ ...base, executionType: 'fully-automated' })
        .success,
    ).toBe(true);
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
