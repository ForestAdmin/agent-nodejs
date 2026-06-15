import type { AuditTarget } from '../../src/executors/activity-log';
import type { StepUser } from '../../src/types/execution-context';

import { NoRecordsError } from '../../src/errors';
import ActivityLog from '../../src/executors/activity-log';

function makeUser(): StepUser {
  return {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    team: 'admin',
    renderingId: 1,
    role: 'admin',
    permissionLevel: 'admin',
    tags: {},
  } as StepUser;
}

function makeActivityLogPort() {
  return {
    createPending: jest.fn().mockResolvedValue({ id: 'log-1', index: '0' }),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

const TARGET: AuditTarget = {
  action: 'action',
  type: 'write',
  label: 'my-mcp-server',
  collectionId: 'col-1',
  recordId: [7],
};

describe('ActivityLog', () => {
  describe('track', () => {
    it('stamps renderingId and emits pending → succeeded around the operation', async () => {
      const port = makeActivityLogPort();
      const activityLog = new ActivityLog(port, makeUser());

      const result = await activityLog.track(TARGET, { operation: async () => 'done' });

      expect(result).toBe('done');
      expect(port.createPending).toHaveBeenCalledWith({
        renderingId: 1,
        action: 'action',
        type: 'write',
        label: 'my-mcp-server',
        collectionId: 'col-1',
        recordId: [7],
      });
      expect(port.markSucceeded).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(port.markFailed).not.toHaveBeenCalled();
    });

    it('does not run the operation when createPending throws', async () => {
      const port = makeActivityLogPort();
      (port.createPending as jest.Mock).mockRejectedValue(new Error('audit down'));
      const operation = jest.fn().mockResolvedValue('x');
      const activityLog = new ActivityLog(port, makeUser());

      await expect(activityLog.track(TARGET, { operation })).rejects.toThrow('audit down');
      expect(operation).not.toHaveBeenCalled();
    });

    it('marks failed (not succeeded) and rethrows the original error', async () => {
      const port = makeActivityLogPort();
      const activityLog = new ActivityLog(port, makeUser());

      await expect(
        activityLog.track(TARGET, {
          operation: async () => {
            throw new NoRecordsError();
          },
        }),
      ).rejects.toBeInstanceOf(NoRecordsError);

      expect(port.markFailed).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(port.markSucceeded).not.toHaveBeenCalled();
    });
  });
});
