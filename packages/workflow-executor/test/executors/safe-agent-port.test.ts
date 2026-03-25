import type { AgentCallContext, AgentPort } from '../../src/ports/agent-port';

import { AgentPortError, StepStateError, WorkflowExecutorError } from '../../src/errors';
import SafeAgentPort from '../../src/executors/safe-agent-port';

const dummyContext: AgentCallContext = {
  user: {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    team: 'admin',
    renderingId: 1,
    role: 'admin',
    permissionLevel: 'admin',
    tags: {},
  },
  schemaCache: new Map(),
};

function makeMockPort(overrides: Partial<AgentPort> = {}): AgentPort {
  return {
    getRecord: jest
      .fn()
      .mockResolvedValue({ collectionName: 'customers', recordId: [1], values: {} }),
    updateRecord: jest
      .fn()
      .mockResolvedValue({ collectionName: 'customers', recordId: [1], values: {} }),
    getRelatedData: jest.fn().mockResolvedValue([]),
    executeAction: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AgentPort;
}

describe('SafeAgentPort', () => {
  describe('returns result when port call succeeds', () => {
    it('getRecord returns the port result', async () => {
      const expected = { collectionName: 'customers', recordId: [1], values: { email: 'a@b.com' } };
      const port = makeMockPort({ getRecord: jest.fn().mockResolvedValue(expected) });
      const safe = new SafeAgentPort(port);

      const result = await safe.getRecord({ collection: 'customers', id: [1] }, dummyContext);

      expect(result).toBe(expected);
    });

    it('updateRecord returns the port result', async () => {
      const expected = { collectionName: 'customers', recordId: [1], values: { status: 'active' } };
      const port = makeMockPort({ updateRecord: jest.fn().mockResolvedValue(expected) });
      const safe = new SafeAgentPort(port);

      const result = await safe.updateRecord(
        {
          collection: 'customers',
          id: [1],
          values: { status: 'active' },
        },
        dummyContext,
      );

      expect(result).toBe(expected);
    });

    it('getRelatedData returns the port result', async () => {
      const expected = [{ collectionName: 'orders', recordId: [10], values: {} }];
      const port = makeMockPort({ getRelatedData: jest.fn().mockResolvedValue(expected) });
      const safe = new SafeAgentPort(port);

      const result = await safe.getRelatedData(
        {
          collection: 'customers',
          id: [1],
          relation: 'orders',
          limit: 10,
        },
        dummyContext,
      );

      expect(result).toBe(expected);
    });

    it('executeAction returns the port result', async () => {
      const expected = { success: true };
      const port = makeMockPort({ executeAction: jest.fn().mockResolvedValue(expected) });
      const safe = new SafeAgentPort(port);

      const result = await safe.executeAction(
        { collection: 'customers', action: 'send-email' },
        dummyContext,
      );

      expect(result).toBe(expected);
    });
  });

  describe('wraps infra Error in AgentPortError', () => {
    it('wraps getRecord infra error with correct operation name', async () => {
      const port = makeMockPort({
        getRecord: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      const safe = new SafeAgentPort(port);

      await expect(
        safe.getRecord({ collection: 'customers', id: [1] }, dummyContext),
      ).rejects.toThrow(AgentPortError);
    });

    it('includes cause message in AgentPortError.message for getRecord', async () => {
      const port = makeMockPort({
        getRecord: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      const safe = new SafeAgentPort(port);

      await expect(
        safe.getRecord({ collection: 'customers', id: [1] }, dummyContext),
      ).rejects.toThrow('Agent port "getRecord" failed: DB connection lost');
    });

    it('wraps updateRecord infra error with correct operation name', async () => {
      const port = makeMockPort({
        updateRecord: jest.fn().mockRejectedValue(new Error('Timeout')),
      });
      const safe = new SafeAgentPort(port);

      await expect(
        safe.updateRecord({ collection: 'customers', id: [1], values: {} }, dummyContext),
      ).rejects.toThrow('Agent port "updateRecord" failed: Timeout');
    });

    it('wraps getRelatedData infra error with correct operation name', async () => {
      const port = makeMockPort({
        getRelatedData: jest.fn().mockRejectedValue(new Error('Network error')),
      });
      const safe = new SafeAgentPort(port);

      await expect(
        safe.getRelatedData(
          { collection: 'customers', id: [1], relation: 'orders', limit: 10 },
          dummyContext,
        ),
      ).rejects.toThrow('Agent port "getRelatedData" failed: Network error');
    });

    it('wraps executeAction infra error with correct operation name', async () => {
      const port = makeMockPort({
        executeAction: jest.fn().mockRejectedValue(new Error('Action failed')),
      });
      const safe = new SafeAgentPort(port);

      await expect(
        safe.executeAction({ collection: 'customers', action: 'send-email' }, dummyContext),
      ).rejects.toThrow('Agent port "executeAction" failed: Action failed');
    });

    it('sets cause on AgentPortError', async () => {
      const infraError = new Error('DB connection lost');
      const port = makeMockPort({ getRecord: jest.fn().mockRejectedValue(infraError) });
      const safe = new SafeAgentPort(port);

      let thrown: unknown;

      try {
        await safe.getRecord({ collection: 'customers', id: [1] }, dummyContext);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeInstanceOf(AgentPortError);
      expect((thrown as AgentPortError).cause).toBe(infraError);
    });
  });

  describe('does not re-wrap WorkflowExecutorError', () => {
    it('rethrows WorkflowExecutorError as-is from getRecord', async () => {
      const domainError = new StepStateError('invalid state');
      const port = makeMockPort({ getRecord: jest.fn().mockRejectedValue(domainError) });
      const safe = new SafeAgentPort(port);

      await expect(safe.getRecord({ collection: 'customers', id: [1] }, dummyContext)).rejects.toBe(
        domainError,
      );
    });

    it('rethrows WorkflowExecutorError subclass without wrapping in AgentPortError', async () => {
      const domainError = new StepStateError('invalid state');
      const port = makeMockPort({ executeAction: jest.fn().mockRejectedValue(domainError) });
      const safe = new SafeAgentPort(port);

      let thrown: unknown;

      try {
        await safe.executeAction({ collection: 'customers', action: 'send-email' }, dummyContext);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).toBeInstanceOf(WorkflowExecutorError);
      expect(thrown).not.toBeInstanceOf(AgentPortError);
      expect(thrown).toBe(domainError);
    });
  });
});
