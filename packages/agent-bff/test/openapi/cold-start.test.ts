import type { CapabilitiesFetcher } from '../../src/read-model/capabilities-cache';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { AgentHttpError, HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';

import { createHttpTransport } from '../../src/agent/agent-transport';
import collectUnfolding, { CAPABILITIES_CONCURRENCY } from '../../src/openapi/collect-unfolding';
import createAgentCapabilitiesFetcher from '../../src/read-model/agent-capabilities-fetcher';
import ReadModel from '../../src/read-model/read-model';

// AgentHttpError stays real: the synthesis branches on `instanceof` and on the status.
jest.mock('@forestadmin/agent-client', () => ({
  ...jest.requireActual('@forestadmin/agent-client'),
  createRemoteAgentClient: jest.fn(),
  HttpRequester: jest.fn(),
}));

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;
const mockedHttpRequester = jest.mocked(HttpRequester);

/**
 * What the first OpenAPI unfold costs in front of a legacy liana, at the size the fleet actually
 * reaches: the largest schema measured carries 269 collections and 6274 fields, and on a legacy
 * agent each collection costs one doomed capabilities POST plus one synthesis.
 *
 * The invariant that matters is not wall time — that only says how loaded the machine is. It is the
 * request count (one POST per collection, no retry) and the fan-out (bounded, but not serial). The
 * latency below is controlled so a serialised implementation cannot pass: at 10 collections in
 * flight, 269 requests of 10 ms cost about a tenth of what they would one after another.
 */
const COLLECTIONS = 269;
const LATENCY_MS = 10;
const LEGACY_META = { liana: 'forest-rails', liana_version: '9.15.8' };

function legacySchema(): ForestSchemaCollection[] {
  return Array.from({ length: COLLECTIONS }, (_, index) => ({
    name: `Api__Collection${index}`,
    fields: [
      { field: 'id', type: 'Number', isFilterable: true, isSortable: true },
      { field: 'label', type: 'String', isFilterable: true, isSortable: true },
      { field: 'createdAt', type: 'Date', isFilterable: true, isSortable: true },
    ],
  })) as unknown as ForestSchemaCollection[];
}

describe('the first OpenAPI unfold in front of a legacy liana', () => {
  const collections = legacySchema();
  const readModel = new ReadModel(collections);

  let inFlight = 0;
  let peakInFlight = 0;
  let capabilityCalls = 0;

  function coldStore(): ReadModelStore {
    return {
      getReadModel: async () => readModel,
      getSchemaSnapshot: async () => ({ collections, meta: LEGACY_META, revision: 1 }),
      getCapabilities: async (name: string, fetcher: CapabilitiesFetcher) => ({
        capabilities: await fetcher(name),
        readModel,
      }),
    } as unknown as ReadModelStore;
  }

  beforeEach(() => {
    inFlight = 0;
    peakInFlight = 0;
    capabilityCalls = 0;

    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(
      () => ({ query: jest.fn(), stream: jest.fn() } as unknown as HttpRequester),
    );

    // A legacy agent answers the capabilities route with a 404, after a controlled delay so the
    // fan-out is observable.
    createRemoteAgentClientMock.mockReset();
    createRemoteAgentClientMock.mockReturnValue({
      collection: () => ({
        capabilities: async () => {
          capabilityCalls += 1;
          inFlight += 1;
          peakInFlight = Math.max(peakInFlight, inFlight);

          await new Promise(resolve => {
            setTimeout(resolve, LATENCY_MS);
          });

          inFlight -= 1;

          throw new AgentHttpError(404, {}, 'Cannot POST /forest/_internal/capabilities');
        },
      }),
    });
  });

  async function unfold() {
    const store = coldStore();
    const started = Date.now();

    const unfolding = await collectUnfolding({
      readModel,
      store,
      capabilitiesFetcher: createAgentCapabilitiesFetcher({
        transport: createHttpTransport({ agentUrl: 'https://agent' }),
        token: 'tok',
        store,
        logger: () => undefined,
      }),
      logger: () => undefined,
    });

    return { unfolding, elapsed: Date.now() - started };
  }

  it('should ask the agent once per collection, with no retry behind it', async () => {
    await unfold();

    expect(capabilityCalls).toBe(COLLECTIONS);
  });

  it('should type every collection from the apimap rather than degrade it', async () => {
    const { unfolding } = await unfold();

    expect(unfolding.collections).toHaveLength(COLLECTIONS);
    expect(unfolding.collections.filter(entry => entry.fields.degraded !== null)).toEqual([]);
  });

  it('should fan the doomed requests out to the configured bound, not run them one by one', async () => {
    await unfold();

    expect(peakInFlight).toBeGreaterThan(1);
    expect(peakInFlight).toBeLessThanOrEqual(CAPABILITIES_CONCURRENCY);
  });

  // The assertion a serialised fan-out fails: 269 requests of 10 ms cost 2.7 s in sequence. Half of
  // that is loose enough to survive a busy machine and tight enough to catch the regression.
  it('should cost a fraction of what the same requests would cost in sequence', async () => {
    const { elapsed } = await unfold();
    const sequential = COLLECTIONS * LATENCY_MS;

    expect(elapsed).toBeLessThan(sequential / 2);
  });
});
