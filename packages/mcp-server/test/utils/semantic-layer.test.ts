import type { Logger } from '../../src/server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import nock from 'nock';

import ForestServerClientImpl from '../../src/http-client/mcp-http-client';
import { UNREACHABLE, readSemanticLayer } from '../../src/utils/semantic-layer';

describe('readSemanticLayer against the Forest API', () => {
  const forestServerUrl = 'https://forest.test';
  const client = new ForestServerClientImpl(
    { getSchema: jest.fn() },
    {
      listMcpEnabledWorkflows: jest.fn(),
      getMcpWorkflowById: jest.fn(),
      triggerMcpWorkflow: jest.fn(),
      getMcpWorkflowRun: jest.fn(),
    },
    forestServerUrl,
  );
  const logger: Logger = jest.fn();
  const request = {
    authInfo: { extra: { forestServerToken: 'caller-token', environmentId: 12345 } },
  } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

  const readOrders = () =>
    readSemanticLayer(request, logger, caller =>
      client.getSemanticLayerCollection({ ...caller, collectionName: 'orders' }),
    );

  afterEach(() => nock.cleanAll());

  it("reports the collection unreachable on the semantic layer's own not-found answer", async () => {
    nock(forestServerUrl)
      .get('/api/environments/12345/semantic-layer/collections/orders')
      .matchHeader('authorization', 'Bearer caller-token')
      .reply(404, { errors: [{ status: 404, detail: 'Element not found' }] });

    await expect(readOrders()).resolves.toBe(UNREACHABLE);
  });

  it('answers without descriptions on any other not-found answer', async () => {
    nock(forestServerUrl)
      .get('/api/environments/12345/semantic-layer/collections/orders')
      .reply(404, { errors: [{ status: 404, detail: 'Cannot GET this route' }] });

    await expect(readOrders()).resolves.toBeUndefined();
  });
});
