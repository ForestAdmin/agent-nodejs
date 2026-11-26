import {
  ActionOutcomeUnknownError,
  ActionValuesNotExecutableError,
  ActivityLogBlockedError,
  AgentHttpError,
  AgentTimeoutError,
} from '@forestadmin/agent-client';
import { ForbiddenError, HttpError } from '@forestadmin/forestadmin-client';

import toToolError, { AUDIT_UNAVAILABLE_MESSAGE } from '../../src/utils/tool-error';

describe('toToolError', () => {
  const logger = jest.fn();

  beforeEach(() => {
    logger.mockReset();
  });

  describe('when the operation was blocked by its activity log', () => {
    it.each([
      ['a server failure', new HttpError('Forest is in maintenance for a few minutes.', 503)],
      ['a rejected request', new HttpError('collectionModelName is required', 400)],
    ])('should say the operation was not performed, with the reason of %s', async (_, cause) => {
      await expect(
        toToolError(new ActivityLogBlockedError('unavailable', cause), { logger }),
      ).resolves.toEqual(
        new Error(
          `The activity log could not be written, so the operation was not performed: ${cause.message}`,
        ),
      );
    });

    it.each([
      ['a 401 rejection', new HttpError('Unauthorized', 401)],
      ['a 403 rejection', new ForbiddenError('Forbidden')],
    ])('should say the operation was not performed, with %s', async (_label, cause) => {
      await expect(
        toToolError(new ActivityLogBlockedError('notAuthorized', cause), { logger }),
      ).resolves.toEqual(
        new Error(
          `The activity log could not be written, so the operation was not performed: ${cause.message}`,
        ),
      );
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
    it('should list the fields that keep an action from running', async () => {
      const error = new ActionValuesNotExecutableError(
        ['reason'],
        [{ field: 'amount', expected: 'a number' }],
      );

      await expect(toToolError(error, { logger })).resolves.toEqual(
        new Error(
          'The action cannot run: required fields left empty: reason; invalid values: amount ' +
            '(expected a number).',
        ),
      );
    });

    it('should say an action that got no answer may have run', async () => {
      const error = new ActionOutcomeUnknownError(new AgentTimeoutError('Timeout', 30_000));

      await expect(toToolError(error, { logger })).resolves.toEqual(
        new Error(
          'The action was sent but the agent gave no answer, so it may have run. Check whether ' +
            'it did before running it again.',
        ),
      );
    });

    it.each([
      [
        'a refused connection',
        Object.assign(new Error('connect ECONNREFUSED 10.0.0.4:3310'), { code: 'ECONNREFUSED' }),
        'The agent could not be reached.',
      ],
      [
        'a timeout',
        new AgentTimeoutError('Timeout of 10000ms exceeded', 10_000),
        'The agent did not answer in time.',
      ],
    ])('should name %s without its host', async (_label, cause, message) => {
      await expect(toToolError(cause, { logger })).resolves.toEqual(new Error(message));
    });

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
