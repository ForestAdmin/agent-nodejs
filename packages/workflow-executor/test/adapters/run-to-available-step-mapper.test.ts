import type {
  ServerHydratedWorkflowRun,
  ServerStepHistory,
  ServerUserProfile,
  ServerWorkflowCondition,
  ServerWorkflowTask,
} from '../../src/adapters/server-types';

import { z } from 'zod';

import toAvailableStepExecution from '../../src/adapters/run-to-available-step-mapper';
import {
  ServerStepExecutionTypeEnum,
  ServerStepTypeEnum,
  ServerTaskTypeEnum,
} from '../../src/adapters/server-types';
import { DomainValidationError, InvalidStepDefinitionError } from '../../src/errors';
import { StepType } from '../../src/types/validated/step-definition';

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

beforeEach(() => {
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
});

function makeTaskStepDef(
  overrides: Partial<ServerWorkflowTask> & {
    taskType?: ServerTaskTypeEnum | string;
  } = {},
): ServerWorkflowTask {
  return {
    type: ServerStepTypeEnum.Task,
    taskType: ServerTaskTypeEnum.GetData,
    title: 'Task',
    prompt: 'prompt',
    executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
    automaticCompletion: false,
    outgoing: [{ stepId: 'next', buttonText: null }],
    ...overrides,
  } as ServerWorkflowTask;
}

function makeConditionStepDef(
  overrides: Partial<ServerWorkflowCondition> = {},
): ServerWorkflowCondition {
  return {
    type: ServerStepTypeEnum.Condition,
    title: 'Decide',
    prompt: 'p',
    executionType: ServerStepExecutionTypeEnum.FullyAutomated,
    automaticCompletion: false,
    outgoing: [
      { stepId: 'a', buttonText: null, answer: 'Yes' },
      { stepId: 'b', buttonText: null, answer: 'No' },
    ],
    ...overrides,
  };
}

function makeStepHistory(overrides: Partial<ServerStepHistory> = {}): ServerStepHistory {
  return {
    stepName: 'step-a',
    stepIndex: 0,
    done: false,
    stepDefinition: makeTaskStepDef(),
    ...overrides,
  };
}

function makeRun(overrides: Partial<ServerHydratedWorkflowRun> = {}): ServerHydratedWorkflowRun {
  return {
    id: 42,
    workflowId: 'wf-1',
    collectionId: '11',
    collectionName: 'customers',
    selectedRecordId: '123',
    bpmnVersion: '1.0',
    userId: 7,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    renderingId: 3,
    runState: 'started',
    workflowHistory: [makeStepHistory()],
    userProfile: {
      id: 7,
      email: 'alban@forestadmin.com',
      firstName: 'Alban',
      lastName: 'Bertolini',
      team: 'team-a',
      renderingId: 3,
      role: 'admin',
      permissionLevel: 'admin',
      tags: { env: 'prod' },
      serverToken: 'test-forest-token',
    },
    ...overrides,
  };
}

describe('toAvailableStepExecution', () => {
  it('should map a run with a available step to a AvailableStepExecution', () => {
    const run = makeRun();

    const result = toAvailableStepExecution(run, logger);

    expect(result).toEqual({
      runId: '42',
      stepId: 'step-a',
      stepIndex: 0,
      collectionId: '11',
      baseRecordRef: {
        collectionName: 'customers',
        recordId: ['123'],
        stepIndex: 0,
      },
      stepDefinition: {
        type: StepType.ReadRecord,
        prompt: 'prompt',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      },
      previousSteps: [],
      user: expect.objectContaining({ id: 7, email: 'alban@forestadmin.com' }),
    });
  });

  it('should stringify the numeric run id', () => {
    const run = makeRun({ id: 999 });

    const result = toAvailableStepExecution(run, logger);

    expect(result?.runId).toBe('999');
  });

  it('should wrap selectedRecordId in an array for baseRecordRef', () => {
    const run = makeRun({ selectedRecordId: 'rec-abc' });

    const result = toAvailableStepExecution(run, logger);

    expect(result?.baseRecordRef.recordId).toEqual(['rec-abc']);
  });

  it('should return null when workflowHistory is empty', () => {
    const run = makeRun({ workflowHistory: [] });

    expect(toAvailableStepExecution(run, logger)).toBeNull();
  });

  it('picks the last step — orchestrator is the source of truth for which step to execute', () => {
    const run = makeRun({
      workflowHistory: [
        makeStepHistory({ stepName: 's0', stepIndex: 0, done: true }),
        makeStepHistory({ stepName: 's1', stepIndex: 1, done: true }),
        makeStepHistory({ stepName: 's2', stepIndex: 2, done: false }),
      ],
    });

    const result = toAvailableStepExecution(run, logger);

    expect(result?.stepId).toBe('s2');
    expect(result?.stepIndex).toBe(2);
  });

  it('should forward executionType from the server to the guidance step definition', () => {
    const run = makeRun({
      workflowHistory: [
        makeStepHistory({
          stepDefinition: makeTaskStepDef({
            taskType: ServerTaskTypeEnum.Guideline,
            title: 'guidance',
            prompt: 'follow the guide',
            executionType: ServerStepExecutionTypeEnum.Manual,
          }),
        }),
      ],
    });

    const result = toAvailableStepExecution(run, logger);

    expect(result?.stepDefinition).toEqual({
      type: StepType.Guidance,
      prompt: 'follow the guide',
      executionType: ServerStepExecutionTypeEnum.Manual,
    });
  });

  describe('previousSteps', () => {
    it('should include done steps preceding the available step', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'success' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.UpdateData,
              title: 't',
            }),
          }),
          makeStepHistory({
            stepName: 's1',
            stepIndex: 1,
            done: true,
            context: { status: 'success', selectedOption: 'Yes' },
            stepDefinition: makeConditionStepDef({ title: 'c' }),
          }),
          makeStepHistory({ stepName: 's2', stepIndex: 2, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps).toHaveLength(2);
      expect(result?.previousSteps[1].stepOutcome).toEqual({
        type: 'condition',
        status: 'success',
        selectedOption: 'Yes',
        stepId: 's1',
        stepIndex: 1,
      });
    });

    it('should default to success status when context is empty (legacy frontend data)', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { legacyData: 'from-frontend' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.UpdateData,
              title: 't',
            }),
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'record',
        stepId: 's0',
        stepIndex: 0,
        status: 'success',
      });
    });

    it('should not leak arbitrary context fields into the step outcome', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: {
              status: 'success',
              aiReasoning: 'SECRET',
              clientData: { foo: 'bar' },
            },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).not.toHaveProperty('aiReasoning');
      expect(result?.previousSteps[0].stepOutcome).not.toHaveProperty('clientData');
    });

    it('should propagate error status and message', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'error', error: 'Something failed' },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'record',
        stepId: 's0',
        stepIndex: 0,
        status: 'error',
        error: 'Something failed',
      });
    });

    it('should map guidance step outcome with success status', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'success' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.Guideline,
              title: 'Guide',
              prompt: 'Please review',
            }),
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'guidance',
        stepId: 's0',
        stepIndex: 0,
        status: 'success',
      });
    });

    it('should map guidance step outcome with error status', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'error', error: 'Guide failed' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.Guideline,
              title: 'Guide',
              prompt: 'Please review',
            }),
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'guidance',
        stepId: 's0',
        stepIndex: 0,
        status: 'error',
        error: 'Guide failed',
      });
    });

    it('should map mcp step outcome', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'success' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.McpServer,
              title: 'MCP',
              prompt: 'Run tool',
              mcpServerId: 'srv-1',
            }),
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'mcp',
        stepId: 's0',
        stepIndex: 0,
        status: 'success',
      });
    });

    it('should not include the pending step itself in previousSteps', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({ stepName: 's0', stepIndex: 0, done: true }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.stepId).toBe('s1');
      expect(result?.previousSteps).toHaveLength(1);
      expect(result?.previousSteps[0].stepOutcome.stepId).toBe('s0');
    });

    it.each([
      [
        'start-sub-workflow',
        {
          type: ServerStepTypeEnum.StartSubWorkflow,
          title: 't',
          prompt: 'p',
          executionType: ServerStepExecutionTypeEnum.Manual,
          automaticCompletion: false,
          outgoing: [{ stepId: 'x', buttonText: null }],
          workflowId: 'wf-2',
        },
      ],
      [
        'close-sub-workflow',
        {
          type: ServerStepTypeEnum.CloseSubWorkflow,
          title: 'Close',
          executionType: ServerStepExecutionTypeEnum.Manual,
          automaticCompletion: false,
          outgoing: [{ stepId: 'x', buttonText: null }],
          parentWorkflowId: null,
        },
      ],
      [
        'end',
        {
          type: ServerStepTypeEnum.End,
          title: 'End',
          executionType: ServerStepExecutionTypeEnum.Manual,
          automaticCompletion: false,
          outgoing: [],
        },
      ],
      [
        'escalation',
        {
          type: ServerStepTypeEnum.Escalation,
          title: 'Escalation',
          prompt: 'p',
          executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
          automaticCompletion: false,
          outgoing: [{ stepId: 'x', buttonText: null }],
          inboxId: null,
        },
      ],
    ])('should silently skip %s steps in history and not throw', (_, subWorkflowStep) => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            stepDefinition: subWorkflowStep as never,
          }),
          makeStepHistory({
            stepName: 's1',
            stepIndex: 1,
            done: true,
            context: { status: 'success' },
            stepDefinition: makeTaskStepDef({
              taskType: ServerTaskTypeEnum.Guideline,
              title: 't',
            }),
          }),
          makeStepHistory({ stepName: 's2', stepIndex: 2, done: false }),
        ],
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.stepId).toBe('s2');
      expect(result?.previousSteps).toHaveLength(1);
      expect(result?.previousSteps[0].stepDefinition.type).toBe(StepType.Guidance);
    });

    it('should propagate InvalidStepDefinitionError thrown by a done history step with unknown taskType', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            stepDefinition: makeTaskStepDef({
              taskType: 'unknown-future-type' as ServerTaskTypeEnum,
              title: 't',
            }),
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      expect(() => toAvailableStepExecution(run, logger)).toThrow(InvalidStepDefinitionError);
    });
  });

  describe('user mapping', () => {
    it('should map server userProfile to StepUser with null → empty string', () => {
      const profile: ServerUserProfile = {
        id: 5,
        email: 'nulls@test.com',
        firstName: null,
        lastName: null,
        team: null,
        renderingId: 2,
        role: null,
        permissionLevel: null,
        tags: {},
        serverToken: 'test-forest-token',
      };
      const run = makeRun({ userProfile: profile });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.user).toEqual({
        id: 5,
        email: 'nulls@test.com',
        firstName: '',
        lastName: '',
        team: '',
        renderingId: 2,
        role: '',
        permissionLevel: '',
        tags: {},
      });
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['NaN', Number.NaN],
      ['string', '3' as unknown as number],
    ])('should throw InvalidStepDefinitionError when renderingId is %s', (_label, badValue) => {
      const run = makeRun({
        userProfile: {
          id: 7,
          email: 'alban@forestadmin.com',
          firstName: 'Alban',
          lastName: 'Bertolini',
          team: 'team-a',
          renderingId: badValue as unknown as number,
          role: 'admin',
          permissionLevel: 'admin',
          tags: {},
          serverToken: 'test-forest-token',
        },
      });

      expect(() => toAvailableStepExecution(run, logger)).toThrow(InvalidStepDefinitionError);
      expect(() => toAvailableStepExecution(run, logger)).toThrow(/renderingId/);
    });

    it('should accept renderingId = 0 (valid finite number)', () => {
      const run = makeRun({
        userProfile: {
          id: 7,
          email: 'alban@forestadmin.com',
          firstName: 'Alban',
          lastName: 'Bertolini',
          team: 'team-a',
          renderingId: 0,
          role: 'admin',
          permissionLevel: 'admin',
          tags: {},
          serverToken: 'test-forest-token',
        },
      });

      const result = toAvailableStepExecution(run, logger);

      expect(result?.user.renderingId).toBe(0);
    });
  });

  describe('error cases', () => {
    it('should throw InvalidStepDefinitionError when collectionName is null', () => {
      const run = makeRun({ collectionName: null });

      expect(() => toAvailableStepExecution(run, logger)).toThrow(InvalidStepDefinitionError);
      expect(() => toAvailableStepExecution(run, logger)).toThrow(
        'Run 42 has no collectionName — cannot build baseRecordRef',
      );
    });

    it('should throw InvalidStepDefinitionError when collectionId is empty', () => {
      const run = makeRun({ collectionId: '' });

      expect(() => toAvailableStepExecution(run, logger)).toThrow(InvalidStepDefinitionError);
      expect(() => toAvailableStepExecution(run, logger)).toThrow(
        'Run 42 has no collectionId — cannot build baseRecordRef',
      );
    });

    it('should propagate mapper errors from toStepDefinition', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepDefinition: {
              type: ServerStepTypeEnum.End,
              title: 'End',
              executionType: ServerStepExecutionTypeEnum.Manual,
              automaticCompletion: false,
              outgoing: [],
            },
          }),
        ],
      });

      expect(() => toAvailableStepExecution(run, logger)).toThrow();
    });

    it('should throw DomainValidationError when the mapper output violates a zod invariant (empty stepId)', () => {
      // Wire guards don't validate pending.stepName, but AvailableStepExecutionSchema requires
      // stepId.min(1). This exercises the actual parse path in the mapper.
      const run = makeRun({
        workflowHistory: [makeStepHistory({ stepName: '' })],
      });

      let caught: unknown;

      try {
        toAvailableStepExecution(run, logger);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(DomainValidationError);
      const domainErr = caught as DomainValidationError;
      expect(domainErr.issues.some(i => i.path === 'stepId')).toBe(true);
      expect(domainErr.userMessage).toMatch(/Internal validation error/);
    });

    it('should throw DomainValidationError when renderingId is not an integer (zod catches what wire finite check misses)', () => {
      // profile.renderingId = 0.5 passes toStepUser's finite() guard but fails zod's int() check.
      const run = makeRun({
        userProfile: {
          id: 7,
          email: 'a@b.c',
          firstName: 'A',
          lastName: 'B',
          team: 't',
          renderingId: 0.5,
          role: 'admin',
          permissionLevel: 'admin',
          tags: {},
          serverToken: 'tok',
        },
      });

      expect(() => toAvailableStepExecution(run, logger)).toThrow(DomainValidationError);
    });

    it('should structure DomainValidationError.issues as { path, message } objects', () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          path: ['runId'],
          message: 'Expected string, received number',
          expected: 'string',
          input: 42,
        },
        {
          code: 'custom',
          path: ['user', 'renderingId'],
          message: 'Number must be finite',
          input: Number.POSITIVE_INFINITY,
        },
      ]);
      const err = new DomainValidationError(42, zodError);

      expect(err.issues).toHaveLength(2);
      expect(err.issues[0]).toEqual({ path: 'runId', message: 'Expected string, received number' });
      expect(err.issues[1]).toEqual({
        path: 'user.renderingId',
        message: 'Number must be finite',
      });
      expect(err.message).toContain('runId: Expected string, received number');
      expect(err.userMessage).toMatch(/Internal validation error/);
    });
  });
});
