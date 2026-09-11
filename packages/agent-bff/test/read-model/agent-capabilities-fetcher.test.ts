import type { CapabilitiesFetcher } from '../../src/read-model/capabilities-cache';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { ForestSchemaCollection, ForestSchemaMeta } from '@forestadmin/forestadmin-client';

import { AgentHttpError, HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';

import { collection as collectionFixture, column } from './fixtures';
import { createHttpTransport } from '../../src/agent/agent-transport';
import collectUnfolding from '../../src/openapi/collect-unfolding';
import createAgentCapabilitiesFetcher from '../../src/read-model/agent-capabilities-fetcher';
import ReadModel from '../../src/read-model/read-model';

function transportTo(agentUrl: string, timeoutMs?: number) {
  return createHttpTransport({ agentUrl, timeoutMs });
}

// AgentHttpError stays real: the synthesis branches on `instanceof` and on the status, so an
// automocked constructor would make every 404 test vacuous.
jest.mock('@forestadmin/agent-client', () => ({
  ...jest.requireActual('@forestadmin/agent-client'),
  createRemoteAgentClient: jest.fn(),
  HttpRequester: jest.fn(),
}));

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;
const mockedHttpRequester = jest.mocked(HttpRequester);

const LEGACY_META = { liana: 'forest-express-sequelize', liana_version: '9.6.10' };

describe('createAgentCapabilitiesFetcher', () => {
  const query = jest.fn();
  const stream = jest.fn();
  const logger = jest.fn();

  const usersApimap = [
    {
      name: 'users',
      fields: [{ field: 'name', type: 'String', isFilterable: true, isSortable: true }],
    },
  ] as unknown as ForestSchemaCollection[];

  function storeServing(
    collections: ForestSchemaCollection[],
    meta: ForestSchemaMeta = LEGACY_META,
  ): ReadModelStore {
    return {
      getSchemaSnapshot: jest.fn().mockResolvedValue({ collections, meta, revision: 1 }),
    } as unknown as ReadModelStore;
  }

  function synthesisFrom(collections: ForestSchemaCollection[], meta?: ForestSchemaMeta) {
    return { store: storeServing(collections, meta), logger };
  }

  // A store whose snapshot changes between calls, so a test can show which one the decision reads.
  function storeServingInTurn(
    ...snapshots: { collections: ForestSchemaCollection[]; meta: ForestSchemaMeta }[]
  ): ReadModelStore {
    const getSchemaSnapshot = jest.fn();
    snapshots.forEach(snapshot =>
      getSchemaSnapshot.mockResolvedValueOnce({ ...snapshot, revision: 1 }),
    );

    return { getSchemaSnapshot } as unknown as ReadModelStore;
  }

  beforeEach(() => {
    query.mockReset();
    logger.mockReset();
    createRemoteAgentClientMock.mockReset();
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query, stream } as unknown as HttpRequester));
  });

  it('should build a client for the agent url/token and fetch capabilities per collection', async () => {
    const capabilities = jest.fn().mockResolvedValue({ fields: [{ name: 'email' }] });
    const collection = jest.fn().mockReturnValue({ capabilities });
    createRemoteAgentClientMock.mockReturnValue({ collection });

    const fetcher = createAgentCapabilitiesFetcher({
      transport: transportTo('https://agent'),
      token: 'tok',
      ...synthesisFrom([]),
    });
    const result = await fetcher('users');

    expect(HttpRequester).toHaveBeenCalledWith('tok', { url: 'https://agent' });
    expect(createRemoteAgentClientMock).toHaveBeenCalledWith({
      url: 'https://agent',
      token: 'tok',
      httpRequester: expect.objectContaining({ query: expect.any(Function) }),
    });
    expect(collection).toHaveBeenCalledWith('users');
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fields: [{ name: 'email' }] });
  });

  it('should reuse one client for a borrowed token, which cannot be renewed', async () => {
    const collection = jest
      .fn()
      .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) });
    createRemoteAgentClientMock.mockReturnValue({ collection });

    const fetcher = createAgentCapabilitiesFetcher({
      transport: transportTo('https://agent'),
      token: 'tok',
      ...synthesisFrom([]),
    });
    await fetcher('users');
    await fetcher('orders');

    expect(createRemoteAgentClientMock).toHaveBeenCalledTimes(1);
  });

  it('should sign a fresh token per fetch when given a factory, so a long fan-out cannot expire', async () => {
    const collection = jest
      .fn()
      .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) });
    createRemoteAgentClientMock.mockReturnValue({ collection });
    let minted = 0;

    const fetcher = createAgentCapabilitiesFetcher({
      transport: transportTo('https://agent'),
      token: () => {
        minted += 1;

        return `tok-${minted}`;
      },
      ...synthesisFrom([]),
    });
    await fetcher('users');
    await fetcher('orders');

    expect(minted).toBe(2);
    expect(createRemoteAgentClientMock.mock.calls.map(call => call[0].token)).toEqual([
      'tok-1',
      'tok-2',
    ]);
  });

  it('should inject an HttpRequester that applies the configured timeout', async () => {
    createRemoteAgentClientMock.mockReturnValue({
      collection: jest
        .fn()
        .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) }),
    });

    await createAgentCapabilitiesFetcher({
      transport: transportTo('https://agent', 2500),
      token: 'tok',
      ...synthesisFrom([]),
    })('users');

    const httpRequester = createRemoteAgentClientMock.mock.calls[0][0]
      .httpRequester as HttpRequester;
    await httpRequester.query({ method: 'get', path: '/forest/users/capabilities' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users/capabilities',
      maxTimeAllowed: 2500,
    });
  });

  describe('when the agent answers the capabilities route with a 404', () => {
    function fetcherRejectingWith(
      error: unknown,
      collections: ForestSchemaCollection[],
      meta?: ForestSchemaMeta,
    ) {
      createRemoteAgentClientMock.mockReturnValue({
        collection: jest.fn().mockReturnValue({
          capabilities: jest.fn().mockRejectedValue(error),
        }),
      });

      return createAgentCapabilitiesFetcher({
        transport: transportTo('https://agent'),
        token: 'tok',
        ...synthesisFrom(collections, meta),
      });
    }

    const notFound = () =>
      new AgentHttpError(404, {}, 'Cannot POST /forest/_internal/capabilities');

    it('should synthesize from the apimap when a legacy liana published the schema', async () => {
      const fetcher = fetcherRejectingWith(notFound(), usersApimap);

      const result = await fetcher('users');

      expect(result).toEqual({
        fields: [{ name: 'name', type: 'String', operators: expect.arrayContaining(['equal']) }],
      });
    });

    it('should name the liana and its version in the warning, so a stale agent is diagnosable', async () => {
      const fetcher = fetcherRejectingWith(notFound(), usersApimap, {
        liana: 'forest-rails',
        liana_version: '9.21.0',
      });

      await fetcher('users');

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.any(String),
        expect.objectContaining({
          agentUrl: 'https://agent',
          collection: 'users',
          liana: 'forest-rails',
          lianaVersion: '9.21.0',
        }),
      );
    });

    it.each(['forest-nodejs-agent', 'agent-ruby', 'agent-python', 'agent-php'])(
      'should rethrow rather than synthesize for %s, which does serve that route',
      async liana => {
        const fetcher = fetcherRejectingWith(notFound(), usersApimap, { liana });

        await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });
        expect(logger).toHaveBeenCalledWith(
          'Error',
          expect.any(String),
          expect.objectContaining({ liana }),
        );
      },
    );

    it('should rethrow for a liana name nobody has classified', async () => {
      const fetcher = fetcherRejectingWith(notFound(), usersApimap, { liana: 'forest-symfony' });

      await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });
    });

    it('should rethrow when the published schema carries no liana at all, and say so', async () => {
      const fetcher = fetcherRejectingWith(notFound(), usersApimap, {});

      await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });
      expect(logger).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
        expect.objectContaining({ liana: 'absent from the published schema' }),
      );
    });

    it('should rethrow when the schema does not know the collection, rather than invent a shape', async () => {
      const fetcher = fetcherRejectingWith(notFound(), []);

      await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });
      expect(logger).not.toHaveBeenCalled();
    });

    // Criterion 5. The OpenAPI document never sees the 404: `collect-unfolding` catches a failing
    // capabilities lookup and marks the collection degraded. So the liana decision shows up there as
    // a different document, not a different status — typed fields for a legacy liana, the degraded
    // marker for anything else.
    describe('the OpenAPI document built from the same fetcher', () => {
      function unfoldWith(meta: ForestSchemaMeta) {
        createRemoteAgentClientMock.mockReturnValue({
          collection: jest.fn().mockReturnValue({
            capabilities: jest.fn().mockRejectedValue(notFound()),
          }),
        });

        const readModel = new ReadModel([
          collectionFixture('users', [column('id'), column('name')]),
        ]);
        const store = storeServing(usersApimap, meta);

        return collectUnfolding({
          readModel,
          store: {
            ...store,
            getReadModel: async () => readModel,
            getCapabilities: async (name: string, fetcher: CapabilitiesFetcher) => ({
              capabilities: await fetcher(name),
              readModel,
            }),
          } as unknown as ReadModelStore,
          capabilitiesFetcher: createAgentCapabilitiesFetcher({
            transport: transportTo('https://agent'),
            token: 'tok',
            store,
            logger,
          }),
          logger,
        });
      }

      it('should type the fields when a legacy liana published the schema', async () => {
        const { collections } = await unfoldWith(LEGACY_META);

        expect(collections[0].fields.degraded).toBeNull();
        expect(collections[0].fields.projectable.map(field => field.name)).toEqual(['name']);
      });

      it('should keep the degraded marker for a liana that should have served the route', async () => {
        const { collections } = await unfoldWith({
          liana: 'forest-nodejs-agent',
          liana_version: '1.98.1',
        });

        expect(collections[0].fields.degraded).toBe('capabilities_unavailable');
      });
    });

    // Criterion 10. The rethrow path reads the snapshot before deciding, which the flag-gated
    // version did not: on a healthy cache that costs nothing, but on an expired entry whose refresh
    // keeps failing it is one extra attempt — bounded to one per call, never a retry loop.
    describe('what the rethrow path costs the schema cache', () => {
      function fetcherOver(store: ReadModelStore) {
        createRemoteAgentClientMock.mockReturnValue({
          collection: jest.fn().mockReturnValue({
            capabilities: jest.fn().mockRejectedValue(notFound()),
          }),
        });

        return createAgentCapabilitiesFetcher({
          transport: transportTo('https://agent'),
          token: 'tok',
          store,
          logger,
        });
      }

      it('should read the snapshot once per rethrown call', async () => {
        const getSchemaSnapshot = jest.fn().mockResolvedValue({
          collections: usersApimap,
          meta: { liana: 'forest-nodejs-agent' },
          revision: 1,
        });
        const fetcher = fetcherOver({ getSchemaSnapshot } as unknown as ReadModelStore);

        await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });

        expect(getSchemaSnapshot).toHaveBeenCalledTimes(1);
      });

      // The snapshot read sits inside the catch, so its own failure replaces the agent's 404. Both
      // are failures and the caller retries either way; what matters is that it stays one attempt.
      it('should surface the schema failure when the snapshot cannot be read on the 404 path', async () => {
        const getSchemaSnapshot = jest.fn().mockRejectedValue(new Error('schema unavailable'));
        const fetcher = fetcherOver({ getSchemaSnapshot } as unknown as ReadModelStore);

        await expect(fetcher('users')).rejects.toThrow('schema unavailable');
        expect(getSchemaSnapshot).toHaveBeenCalledTimes(1);
      });
    });

    it('should rethrow a non-404, so a real agent failure is never read as a legacy agent', async () => {
      const fetcher = fetcherRejectingWith(new AgentHttpError(500, {}, 'boom'), usersApimap);

      await expect(fetcher('users')).rejects.toMatchObject({ status: 500 });
    });

    // The decision is read from the snapshot on every call, not captured once. That is what bounds
    // a v1 -> v2 migration: the synthesis keeps engaging while the cached schema still names the
    // legacy liana, and stops on the first snapshot that names the new one.
    it('should follow the snapshot per call, synthesizing then rethrowing once the liana changes', async () => {
      createRemoteAgentClientMock.mockReturnValue({
        collection: jest.fn().mockReturnValue({
          capabilities: jest.fn().mockRejectedValue(notFound()),
        }),
      });

      const fetcher = createAgentCapabilitiesFetcher({
        transport: transportTo('https://agent'),
        token: 'tok',
        store: storeServingInTurn(
          { collections: usersApimap, meta: { liana: 'forest-rails', liana_version: '9.21.0' } },
          {
            collections: usersApimap,
            meta: { liana: 'forest-nodejs-agent', liana_version: '1.98.1' },
          },
        ),
        logger,
      });

      await expect(fetcher('users')).resolves.toEqual({
        fields: [{ name: 'name', type: 'String', operators: expect.arrayContaining(['equal']) }],
      });
      await expect(fetcher('users')).rejects.toMatchObject({ status: 404 });
    });
  });
});
