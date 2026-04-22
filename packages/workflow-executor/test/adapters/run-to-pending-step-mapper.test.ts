import type {
  ServerHydratedWorkflowRun,
  ServerStepHistory,
  ServerUserProfile,
} from '../../src/adapters/server-types';

import toPendingStepExecution from '../../src/adapters/run-to-pending-step-mapper';
import { InvalidStepDefinitionError } from '../../src/errors';
import { StepType } from '../../src/types/step-definition';

function makeStepHistory(overrides: Partial<ServerStepHistory> = {}): ServerStepHistory {
  return {
    stepName: 'step-a',
    stepIndex: 0,
    done: false,
    stepDefinition: {
      type: 'task',
      taskType: 'get-data',
      title: 'Task',
      prompt: 'prompt',
      outgoing: { stepId: 'next', buttonText: null },
    },
    ...overrides,
  };
}

function makeRun(overrides: Partial<ServerHydratedWorkflowRun> = {}): ServerHydratedWorkflowRun {
  return {
    id: 42,
    collectionId: '11',
    collectionName: 'customers',
    selectedRecordId: '123',
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

describe('toPendingStepExecution', () => {
  it('should map a run with a pending step to a PendingStepExecution', () => {
    const run = makeRun();

    const result = toPendingStepExecution(run);

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
      stepDefinition: { type: StepType.ReadRecord, prompt: 'prompt' },
      previousSteps: [],
      user: expect.objectContaining({ id: 7, email: 'alban@forestadmin.com' }),
    });
  });

  it('should stringify the numeric run id', () => {
    const run = makeRun({ id: 999 });

    const result = toPendingStepExecution(run);

    expect(result?.runId).toBe('999');
  });

  it('should wrap selectedRecordId in an array for baseRecordRef', () => {
    const run = makeRun({ selectedRecordId: 'rec-abc' });

    const result = toPendingStepExecution(run);

    expect(result?.baseRecordRef.recordId).toEqual(['rec-abc']);
  });

  it('should return null when all steps are done', () => {
    const run = makeRun({
      workflowHistory: [
        makeStepHistory({ stepIndex: 0, done: true }),
        makeStepHistory({ stepIndex: 1, done: true }),
      ],
    });

    expect(toPendingStepExecution(run)).toBeNull();
  });

  it('should return null when all steps are done or cancelled', () => {
    const run = makeRun({
      workflowHistory: [
        makeStepHistory({ stepIndex: 0, done: true }),
        makeStepHistory({ stepIndex: 1, done: false, cancelled: true }),
      ],
    });

    expect(toPendingStepExecution(run)).toBeNull();
  });

  it('should return null when workflowHistory is empty', () => {
    const run = makeRun({ workflowHistory: [] });

    expect(toPendingStepExecution(run)).toBeNull();
  });

  it('should pick the first non-done, non-cancelled step as pending', () => {
    const run = makeRun({
      workflowHistory: [
        makeStepHistory({ stepName: 's0', stepIndex: 0, done: true }),
        makeStepHistory({ stepName: 's1', stepIndex: 1, done: false, cancelled: true }),
        makeStepHistory({ stepName: 's2', stepIndex: 2, done: false }),
        makeStepHistory({ stepName: 's3', stepIndex: 3, done: false }),
      ],
    });

    const result = toPendingStepExecution(run);

    expect(result?.stepId).toBe('s2');
    expect(result?.stepIndex).toBe(2);
  });

  describe('previousSteps', () => {
    it('should include done steps preceding the pending step', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({
            stepName: 's0',
            stepIndex: 0,
            done: true,
            context: { status: 'success' },
            stepDefinition: {
              type: 'task',
              taskType: 'update-data',
              title: 't',
              prompt: 'p',
              outgoing: { stepId: 'x', buttonText: null },
            },
          }),
          makeStepHistory({
            stepName: 's1',
            stepIndex: 1,
            done: true,
            context: { status: 'success', selectedOption: 'Yes' },
            stepDefinition: {
              type: 'condition',
              title: 'c',
              prompt: 'p',
              outgoing: [
                { stepId: 'a', buttonText: null, answer: 'Yes' },
                { stepId: 'b', buttonText: null, answer: 'No' },
              ],
            },
          }),
          makeStepHistory({ stepName: 's2', stepIndex: 2, done: false }),
        ],
      });

      const result = toPendingStepExecution(run);

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
            stepDefinition: {
              type: 'task',
              taskType: 'update-data',
              title: 't',
              prompt: 'p',
              outgoing: { stepId: 'x', buttonText: null },
            },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toPendingStepExecution(run);

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

      const result = toPendingStepExecution(run);

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

      const result = toPendingStepExecution(run);

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
            stepDefinition: {
              type: 'task',
              taskType: 'guideline',
              title: 'Guide',
              prompt: 'Please review',
              outgoing: { stepId: 'next', buttonText: null },
            },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toPendingStepExecution(run);

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
            stepDefinition: {
              type: 'task',
              taskType: 'guideline',
              title: 'Guide',
              prompt: 'Please review',
              outgoing: { stepId: 'next', buttonText: null },
            },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toPendingStepExecution(run);

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
            stepDefinition: {
              type: 'task',
              taskType: 'mcp-server',
              title: 'MCP',
              prompt: 'Run tool',
              mcpServerId: 'srv-1',
              outgoing: { stepId: 'next', buttonText: null },
            },
          }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: false }),
        ],
      });

      const result = toPendingStepExecution(run);

      expect(result?.previousSteps[0].stepOutcome).toEqual({
        type: 'mcp',
        stepId: 's0',
        stepIndex: 0,
        status: 'success',
      });
    });

    it('should not include done steps that are after the pending step', () => {
      const run = makeRun({
        workflowHistory: [
          makeStepHistory({ stepName: 's0', stepIndex: 0, done: false }),
          makeStepHistory({ stepName: 's1', stepIndex: 1, done: true }),
        ],
      });

      const result = toPendingStepExecution(run);

      expect(result?.stepId).toBe('s0');
      expect(result?.previousSteps).toHaveLength(0);
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

      const result = toPendingStepExecution(run);

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

    it('should throw InvalidStepDefinitionError when userProfile is undefined', () => {
      const run = makeRun({ userProfile: undefined });

      expect(() => toPendingStepExecution(run)).toThrow(InvalidStepDefinitionError);
      expect(() => toPendingStepExecution(run)).toThrow(
        'Run 42 has no userProfile — cannot build StepUser',
      );
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

      expect(() => toPendingStepExecution(run)).toThrow(InvalidStepDefinitionError);
      expect(() => toPendingStepExecution(run)).toThrow(/renderingId/);
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

      const result = toPendingStepExecution(run);

      expect(result?.user.renderingId).toBe(0);
    });
  });

  describe('error cases', () => {
    it('should throw InvalidStepDefinitionError when collectionName is null', () => {
      const run = makeRun({ collectionName: null });

      expect(() => toPendingStepExecution(run)).toThrow(InvalidStepDefinitionError);
      expect(() => toPendingStepExecution(run)).toThrow(
        'Run 42 has no collectionName — cannot build baseRecordRef',
      );
    });

    it('should throw InvalidStepDefinitionError when collectionId is empty', () => {
      const run = makeRun({ collectionId: '' });

      expect(() => toPendingStepExecution(run)).toThrow(InvalidStepDefinitionError);
      expect(() => toPendingStepExecution(run)).toThrow(
        'Run 42 has no collectionId — cannot build baseRecordRef',
      );
    });

    it('should propagate mapper errors from toStepDefinition', () => {
      const run = makeRun({
        workflowHistory: [makeStepHistory({ stepDefinition: { type: 'end', title: 'End' } })],
      });

      expect(() => toPendingStepExecution(run)).toThrow();
    });
  });
});
