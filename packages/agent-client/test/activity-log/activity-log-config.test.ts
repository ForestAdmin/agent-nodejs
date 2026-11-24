import type HttpRequester from '../../src/http-requester';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import { drainActivityLogs, withActivityLog } from '../../src/activity-log/with-activity-log';
import { ActivityLogSource } from '../../src/forest-server';
import { createRemoteAgentClient } from '../../src/index';

const queryWithBearerToken = jest.spyOn(ServerUtils, 'queryWithBearerToken');
const SERVER_URL = 'https://api.forestadmin.com';
const ACTIVITY_LOG = { id: 'log-1', attributes: { index: 'idx' } };

function clientWith(activityLog: Parameters<typeof createRemoteAgentClient>[0]['activityLog']) {
  const httpRequester = {
    query: jest.fn().mockResolvedValue([]),
    stream: jest.fn(),
  } as unknown as HttpRequester;

  return createRemoteAgentClient({
    url: 'https://agent.example.com',
    httpRequester,
    forestServer: {
      serverUrl: SERVER_URL,
      serverToken: async () => 'resolved-token',
      renderingId: 42,
    },
    activityLog,
  });
}

describe('activity log built from the Forest server connection', () => {
  afterAll(() => queryWithBearerToken.mockRestore());

  beforeEach(() => {
    queryWithBearerToken.mockReset();
    queryWithBearerToken.mockResolvedValue({ data: ACTIVITY_LOG });
  });

  afterEach(async () => {
    await drainActivityLogs();
  });

  it('writes the entry by collection name under the declared source', async () => {
    await clientWith({ source: ActivityLogSource.MCP }).collection('users').list();
    await drainActivityLogs();

    expect(queryWithBearerToken).toHaveBeenNthCalledWith(1, {
      forestServerUrl: SERVER_URL,
      method: 'post',
      path: '/api/activity-logs-requests/mcp',
      bearerToken: 'resolved-token',
      headers: { 'Forest-Application-Source': 'MCP' },
      body: expect.objectContaining({
        action: 'index',
        renderingId: '42',
        collectionModelName: 'users',
      }),
    });
    expect(queryWithBearerToken).toHaveBeenNthCalledWith(2, {
      forestServerUrl: SERVER_URL,
      method: 'patch',
      path: '/api/activity-logs-requests/idx/log-1/status',
      bearerToken: 'resolved-token',
      headers: { 'Forest-Application-Source': 'MCP' },
      body: { status: 'completed' },
    });
  });

  it('writes the entry by collection id with its workflow when collectionIdOf is given', async () => {
    const workflow = { runId: 'run-1', name: 'Triage', stepName: 'Read' };

    await clientWith({
      source: ActivityLogSource.WorkflowExecutor,
      workflow,
      collectionIdOf: async () => 'col-7',
    })
      .collection('users')
      .list();

    expect(queryWithBearerToken).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/activity-logs-requests',
        headers: { 'Forest-Application-Source': 'WorkflowExecutor' },
        body: {
          data: expect.objectContaining({
            attributes: expect.objectContaining({ action: 'index', workflow }),
            relationships: {
              rendering: { data: { id: '42', type: 'renderings' } },
              collection: { data: { id: 'col-7', type: 'collections' } },
            },
          }),
        },
      }),
    );
  });

  it('writes an entry around an operation that never reaches the agent', async () => {
    const result = await withActivityLog(
      {
        forestServer: { serverUrl: SERVER_URL, serverToken: 'plain-token', renderingId: 42 },
        activityLog: { source: ActivityLogSource.BFF },
      },
      { action: 'triggerWorkflow', collectionName: 'users', recordIds: ['1'] },
      async () => 'started',
    );

    expect(result).toBe('started');
    expect(queryWithBearerToken).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/activity-logs-requests/mcp',
        bearerToken: 'plain-token',
        headers: { 'Forest-Application-Source': 'BFF' },
      }),
    );
  });

  it('blocks a write whose server token cannot be resolved, with the resolution failure as cause', async () => {
    const cause = new Error('session expired');
    const operation = jest.fn();

    const error = await withActivityLog(
      {
        forestServer: {
          serverUrl: SERVER_URL,
          serverToken: async () => {
            throw cause;
          },
          renderingId: 42,
        },
        activityLog: { source: ActivityLogSource.BFF },
      },
      { action: 'update', collectionName: 'users' },
      operation,
    ).catch(e => e);

    expect(error).toMatchObject({ name: 'ActivityLogBlockedError', reason: 'unavailable', cause });
    expect(operation).not.toHaveBeenCalled();
    expect(queryWithBearerToken).not.toHaveBeenCalled();
  });
});
