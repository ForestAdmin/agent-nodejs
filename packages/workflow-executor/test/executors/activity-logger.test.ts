import type { AuditTarget } from '../../src/executors/activity-logger';
import type { StepUser } from '../../src/types/execution-context';

import { NoRecordsError } from '../../src/errors';
import ActivityLogger from '../../src/executors/activity-logger';

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

describe('ActivityLogger', () => {
  describe('run', () => {
    it('stamps renderingId and emits pending → succeeded around the operation', async () => {
      const port = makeActivityLogPort();
      const logger = new ActivityLogger(port, makeUser());

      const result = await logger.run(TARGET, async () => 'done');

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

    it('runs beforeCall between createPending and the operation', async () => {
      const order: string[] = [];
      const port = makeActivityLogPort();
      (port.createPending as jest.Mock).mockImplementation(async () => {
        order.push('createPending');

        return { id: 'log-1', index: '0' };
      });
      const logger = new ActivityLogger(port, makeUser());

      await logger.run(
        TARGET,
        async () => {
          order.push('operation');

          return 'x';
        },
        {
          beforeCall: async () => {
            order.push('beforeCall');
          },
        },
      );

      expect(order).toEqual(['createPending', 'beforeCall', 'operation']);
    });

    it('does not run beforeCall or the operation when createPending throws', async () => {
      const port = makeActivityLogPort();
      (port.createPending as jest.Mock).mockRejectedValue(new Error('audit down'));
      const beforeCall = jest.fn().mockResolvedValue(undefined);
      const operation = jest.fn().mockResolvedValue('x');
      const logger = new ActivityLogger(port, makeUser());

      await expect(logger.run(TARGET, operation, { beforeCall })).rejects.toThrow('audit down');
      expect(beforeCall).not.toHaveBeenCalled();
      expect(operation).not.toHaveBeenCalled();
    });

    it('marks failed and rethrows when beforeCall throws — the operation never runs', async () => {
      const port = makeActivityLogPort();
      const operation = jest.fn().mockResolvedValue('x');
      const logger = new ActivityLogger(port, makeUser());

      await expect(
        logger.run(TARGET, operation, {
          beforeCall: async () => {
            throw new Error('marker save failed');
          },
        }),
      ).rejects.toThrow('marker save failed');

      expect(operation).not.toHaveBeenCalled();
      expect(port.markFailed).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(port.markSucceeded).not.toHaveBeenCalled();
    });

    it('marks failed (not succeeded) and rethrows the original error', async () => {
      const port = makeActivityLogPort();
      const logger = new ActivityLogger(port, makeUser());

      await expect(
        logger.run(TARGET, async () => {
          throw new NoRecordsError();
        }),
      ).rejects.toBeInstanceOf(NoRecordsError);

      expect(port.markFailed).toHaveBeenCalledWith({ id: 'log-1', index: '0' });
      expect(port.markSucceeded).not.toHaveBeenCalled();
    });
  });
});
