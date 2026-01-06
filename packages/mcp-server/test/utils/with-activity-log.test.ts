import type { ForestServerClient } from '../../src/http-client';
import type { Logger } from '../../src/server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createPendingActivityLog, {
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from '../../src/utils/activity-logs-creator';
import withActivityLog from '../../src/utils/with-activity-log';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/activity-logs-creator');

const mockCreatePendingActivityLog = createPendingActivityLog as jest.MockedFunction<
  typeof createPendingActivityLog
>;
const mockMarkActivityLogAsSucceeded = markActivityLogAsSucceeded as jest.MockedFunction<
  typeof markActivityLogAsSucceeded
>;
const mockMarkActivityLogAsFailed = markActivityLogAsFailed as jest.MockedFunction<
  typeof markActivityLogAsFailed
>;

describe('withActivityLog', () => {
  const mockLogger: Logger = jest.fn();
  let mockForestServerClient: jest.Mocked<ForestServerClient>;
  const mockRequest = {
    authInfo: {
      token: 'test-token',
      extra: {
        forestServerToken: 'forest-token',
        renderingId: '123',
      },
    },
  } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
  const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestServerClient = createMockForestServerClient();
    mockCreatePendingActivityLog.mockResolvedValue(mockActivityLog);
  });

  it('should create a pending activity log before executing the operation', async () => {
    const operation = jest.fn().mockResolvedValue({ result: 'success' });

    await withActivityLog({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      action: 'index',
      context: { collectionName: 'users' },
      logger: mockLogger,
      operation,
    });

    expect(mockCreatePendingActivityLog).toHaveBeenCalledWith(
      mockForestServerClient,
      mockRequest,
      'index',
      { collectionName: 'users' },
    );
    expect(mockCreatePendingActivityLog).toHaveBeenCalledBefore(operation);
  });

  it('should mark activity log as succeeded when operation succeeds', async () => {
    const operation = jest.fn().mockResolvedValue({ result: 'success' });

    await withActivityLog({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      action: 'create',
      context: { collectionName: 'users' },
      logger: mockLogger,
      operation,
    });

    expect(mockMarkActivityLogAsSucceeded).toHaveBeenCalledWith({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      activityLog: mockActivityLog,
      logger: mockLogger,
    });
  });

  it('should return the operation result on success', async () => {
    const expectedResult = { content: [{ type: 'text', text: 'data' }] };
    const operation = jest.fn().mockResolvedValue(expectedResult);

    const result = await withActivityLog({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      action: 'index',
      logger: mockLogger,
      operation,
    });

    expect(result).toEqual(expectedResult);
  });

  it('should mark activity log as failed when operation throws', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

    await expect(
      withActivityLog({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        action: 'update',
        context: { collectionName: 'users', recordId: 123 },
        logger: mockLogger,
        operation,
      }),
    ).rejects.toThrow('Operation failed');

    expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      activityLog: mockActivityLog,
      errorMessage: 'Operation failed',
      logger: mockLogger,
    });
  });

  it('should not call markActivityLogAsSucceeded when operation fails', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failed'));

    await expect(
      withActivityLog({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        action: 'delete',
        logger: mockLogger,
        operation,
      }),
    ).rejects.toThrow();

    expect(mockMarkActivityLogAsSucceeded).not.toHaveBeenCalled();
  });

  it('should parse agent error and use detail as error message', async () => {
    const errorPayload = {
      error: {
        status: 400,
        text: JSON.stringify({
          errors: [{ name: 'ValidationError', detail: 'Invalid field value' }],
        }),
      },
    };
    const operation = jest.fn().mockRejectedValue(new Error(JSON.stringify(errorPayload)));

    await expect(
      withActivityLog({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        action: 'create',
        logger: mockLogger,
        operation,
      }),
    ).rejects.toThrow('Invalid field value');

    expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      activityLog: mockActivityLog,
      errorMessage: 'Invalid field value',
      logger: mockLogger,
    });
  });

  it('should handle non-Error throws', async () => {
    const operation = jest.fn().mockRejectedValue('string error');

    // withActivityLog now always wraps errors in an Error object
    await expect(
      withActivityLog({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        action: 'index',
        logger: mockLogger,
        operation,
      }),
    ).rejects.toThrow('string error');

    expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      activityLog: mockActivityLog,
      errorMessage: 'string error',
      logger: mockLogger,
    });
  });

  it('should work without context parameter', async () => {
    const operation = jest.fn().mockResolvedValue({ result: 'success' });

    await withActivityLog({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      action: 'index',
      logger: mockLogger,
      operation,
    });

    expect(mockCreatePendingActivityLog).toHaveBeenCalledWith(
      mockForestServerClient,
      mockRequest,
      'index',
      undefined,
    );
  });

  it('should pass all context fields to createPendingActivityLog', async () => {
    const operation = jest.fn().mockResolvedValue({ result: 'success' });

    await withActivityLog({
      forestServerClient: mockForestServerClient,
      request: mockRequest,
      action: 'delete',
      context: {
        collectionName: 'orders',
        recordIds: [1, 2, 3],
        label: 'Bulk delete orders',
      },
      logger: mockLogger,
      operation,
    });

    expect(mockCreatePendingActivityLog).toHaveBeenCalledWith(
      mockForestServerClient,
      mockRequest,
      'delete',
      {
        collectionName: 'orders',
        recordIds: [1, 2, 3],
        label: 'Bulk delete orders',
      },
    );
  });

  describe('errorEnhancer', () => {
    it('should apply errorEnhancer to error message when provided', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Original error'));
      const errorEnhancer = jest.fn().mockResolvedValue('Enhanced error message');

      await expect(
        withActivityLog({
          forestServerClient: mockForestServerClient,
          request: mockRequest,
          action: 'index',
          logger: mockLogger,
          operation,
          errorEnhancer,
        }),
      ).rejects.toThrow('Enhanced error message');

      expect(errorEnhancer).toHaveBeenCalledWith('Original error', expect.any(Error));
      expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        activityLog: mockActivityLog,
        errorMessage: 'Enhanced error message',
        logger: mockLogger,
      });
    });

    it('should use original error message when errorEnhancer throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Original error'));
      const errorEnhancer = jest.fn().mockRejectedValue(new Error('Enhancement failed'));

      await expect(
        withActivityLog({
          forestServerClient: mockForestServerClient,
          request: mockRequest,
          action: 'index',
          logger: mockLogger,
          operation,
          errorEnhancer,
        }),
      ).rejects.toThrow('Original error');

      expect(mockMarkActivityLogAsFailed).toHaveBeenCalledWith({
        forestServerClient: mockForestServerClient,
        request: mockRequest,
        activityLog: mockActivityLog,
        errorMessage: 'Original error',
        logger: mockLogger,
      });
    });

    it('should pass parsed agent error detail to errorEnhancer', async () => {
      // parseAgentError expects an Error with a JSON message containing error details
      const errorPayload = {
        error: {
          status: 400,
          text: JSON.stringify({
            errors: [{ name: 'ValidationError', detail: 'Invalid field value' }],
          }),
        },
      };
      const agentError = new Error(JSON.stringify(errorPayload));
      const operation = jest.fn().mockRejectedValue(agentError);
      const errorEnhancer = jest.fn().mockImplementation(msg => Promise.resolve(`Context: ${msg}`));

      await expect(
        withActivityLog({
          forestServerClient: mockForestServerClient,
          request: mockRequest,
          action: 'index',
          logger: mockLogger,
          operation,
          errorEnhancer,
        }),
      ).rejects.toThrow('Context: Invalid field value');

      expect(errorEnhancer).toHaveBeenCalledWith('Invalid field value', agentError);
    });
  });
});
