import { ActivityLogBlockedError, AgentHttpError } from '@forestadmin/agent-client';
import { ForbiddenError, HttpError } from '@forestadmin/forestadmin-client';

import toToolError, { AUDIT_UNAVAILABLE_MESSAGE } from '../../src/utils/tool-error';

describe('toToolError', () => {
  const logger = jest.fn();

  beforeEach(() => {
    logger.mockReset();
  });

  describe('when the operation was blocked by its activity log', () => {
    it('should keep the server reason when it is meant to be read', async () => {
      const cause = new HttpError('collectionModelName is required', 400);

      await expect(
        toToolError(new ActivityLogBlockedError('unavailable', cause), { logger }),
      ).resolves.toBe(cause);
    });

    it.each([
      ['a 401 rejection', new HttpError('Unauthorized', 401)],
      ['a 403 rejection', new ForbiddenError('Forbidden')],
    ])('should propagate %s as is', async (_label, cause) => {
      await expect(
        toToolError(new ActivityLogBlockedError('notAuthorized', cause), { logger }),
      ).resolves.toBe(cause);
    });

    it.each([
      ['a transport failure', new Error('connect ECONNREFUSED 10.0.0.4:5432')],
      [
        'a timeout',
        new HttpError('Timeout of 10000ms exceeded on https://api.forestadmin.com/liana', 408),
      ],
    ])('should replace %s with a sanitized message', async (_label, cause) => {
      const error = await toToolError(new ActivityLogBlockedError('unavailable', cause), {
        logger,
      });

      expect(error).toEqual(new Error(AUDIT_UNAVAILABLE_MESSAGE));
    });

    it('should say the audit store dropped the write when the server stored nothing', async () => {
      await expect(
        toToolError(new ActivityLogBlockedError('dropped'), { logger }),
      ).resolves.toEqual(
        new Error(
          'Failed to create activity log: the server returned no activity log id. ' +
            'Blocking the operation to preserve the audit trail.',
        ),
      );
    });
  });

  describe('when the operation itself failed', () => {
    it('should use the agent error detail as the message', async () => {
      const error = new AgentHttpError(400, { errors: [{ detail: 'Invalid sort' }] });

      await expect(toToolError(error, { logger })).resolves.toEqual(
        new Error('Invalid sort (HTTP 400)'),
      );
    });

    it('should handle a non-Error throw', async () => {
      await expect(toToolError('boom', { logger })).resolves.toEqual(new Error('boom'));
    });

    it('should pass the parsed detail and the original error to the enhancer', async () => {
      const error = new AgentHttpError(400, { errors: [{ detail: 'Invalid sort' }] });
      const errorEnhancer = jest.fn(async () => 'Sortable fields are: id');

      await expect(toToolError(error, { logger, errorEnhancer })).resolves.toEqual(
        new Error('Sortable fields are: id'),
      );
      expect(errorEnhancer).toHaveBeenCalledWith('Invalid sort (HTTP 400)', error);
    });

    it('should keep the parsed message when the enhancer throws', async () => {
      const errorEnhancer = jest.fn(async () => {
        throw new Error('schema unavailable');
      });

      await expect(
        toToolError(new Error('agent down'), { logger, errorEnhancer }),
      ).resolves.toEqual(new Error('agent down'));
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Error enhancement failed (using original error message): schema unavailable',
      );
    });
  });
});
