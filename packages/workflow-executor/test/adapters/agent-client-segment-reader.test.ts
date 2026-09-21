import type { ServerAutomatedSegmentDescriptor } from '../../src/adapters/server-types';
import type { ListSegmentRecordIdsQuery } from '../../src/ports/segment-reader-port';

import nock from 'nock';

import AgentClientSegmentReader from '../../src/adapters/agent-client-segment-reader';
import { AgentPortError } from '../../src/errors';

const AGENT_URL = 'https://agent.example.com';
const AUTH_SECRET = 'auth-secret';

const profile = {
  id: 99,
  email: 'bot@forestadmin.com',
  firstName: null,
  lastName: null,
  team: null,
  renderingId: 7,
  role: null,
  permissionLevel: null,
  tags: {},
};

function makeQuery(overrides: Partial<ListSegmentRecordIdsQuery> = {}): ListSegmentRecordIdsQuery {
  return {
    collectionName: 'orders',
    segment: { kind: 'smart', name: 'to-review' },
    primaryKeys: ['id'],
    user: profile,
    timezone: 'UTC',
    ...overrides,
  };
}

// The agent packs a composite primary key into the JSON:API resource id (`IdUtils.packId`), which
// is the id the orchestrator stores; the attributes carry the columns separately.
function jsonApi(records: { id: string; attributes?: Record<string, unknown> }[]) {
  return {
    data: records.map(({ id, attributes }) => ({
      type: 'orders',
      id,
      attributes: attributes ?? {},
    })),
  };
}

/** Intercepts the single list call and hands back both the query it carried and its result. */
function interceptList(records: { id: string; attributes?: Record<string, unknown> }[] = []) {
  const captured: { query?: Record<string, string> } = {};

  nock(AGENT_URL)
    .get('/forest/orders')
    .query(actual => {
      captured.query = actual as Record<string, string>;

      return true;
    })
    .reply(200, jsonApi(records));

  return captured;
}

describe('AgentClientSegmentReader', () => {
  let reader: AgentClientSegmentReader;

  beforeEach(() => {
    reader = new AgentClientSegmentReader({ agentUrl: AGENT_URL, authSecret: AUTH_SECRET });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('segment kinds', () => {
    it('should name a smart segment on the query', async () => {
      const captured = interceptList();

      await reader.listRecordIds(makeQuery());

      expect(captured.query).toMatchObject({ segment: 'to-review' });
      expect(captured.query).not.toHaveProperty('segmentQuery');
    });

    it('should send a SQL segment with its connection name', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'sql',
        query: 'SELECT id FROM orders WHERE status = 1',
        connectionName: 'primary',
      };

      await reader.listRecordIds(makeQuery({ segment }));

      expect(captured.query).toMatchObject({
        segmentQuery: 'SELECT id FROM orders WHERE status = 1',
        connectionName: 'primary',
      });
    });

    it('should omit the connection name a bare-SQL liana does not use', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'sql',
        query: 'SELECT id FROM orders',
        connectionName: null,
      };

      await reader.listRecordIds(makeQuery({ segment }));

      expect(captured.query).toMatchObject({ segmentQuery: 'SELECT id FROM orders' });
      // Sent empty, forest-rails would read it as a connection name it cannot resolve.
      expect(captured.query).not.toHaveProperty('connectionName');
    });

    it('should send a filter segment as the condition tree the agents parse', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'filter',
        conditionTree: { field: 'status', operator: 'equal', value: 'new' },
      };

      await reader.listRecordIds(makeQuery({ segment }));

      expect(JSON.parse(captured.query.filters)).toEqual({
        field: 'status',
        operator: 'equal',
        value: 'new',
      });
      expect(captured.query).not.toHaveProperty('segment');
    });

    it('should leave an already snake_cased operator untouched', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'filter',
        conditionTree: {
          aggregator: 'and',
          conditions: [{ field: 'createdAt', operator: 'previous_x_days', value: 30 }],
        },
      };

      await reader.listRecordIds(makeQuery({ segment }));

      expect(JSON.parse(captured.query.filters)).toEqual({
        aggregator: 'and',
        conditions: [{ field: 'createdAt', operator: 'previous_x_days', value: 30 }],
      });
    });
  });

  describe('restricting to known records', () => {
    it('should ask for a single-column key with one `in`', async () => {
      const captured = interceptList();

      await reader.listRecordIds(makeQuery({ recordIds: ['1', '2'] }));

      expect(JSON.parse(captured.query.filters)).toEqual({
        field: 'id',
        operator: 'in',
        value: ['1', '2'],
      });
    });

    it('should AND the record filter with a filter segment rather than replace it', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'filter',
        conditionTree: { field: 'status', operator: 'equal', value: 'new' },
      };

      await reader.listRecordIds(makeQuery({ segment, recordIds: ['1'] }));

      expect(JSON.parse(captured.query.filters)).toEqual({
        aggregator: 'and',
        conditions: [
          { field: 'status', operator: 'equal', value: 'new' },
          { field: 'id', operator: 'in', value: ['1'] },
        ],
      });
    });

    it('should carry the record filter next to a SQL segment', async () => {
      const captured = interceptList();
      const segment: ServerAutomatedSegmentDescriptor = {
        kind: 'sql',
        query: 'SELECT id FROM orders',
        connectionName: null,
      };

      await reader.listRecordIds(makeQuery({ segment, recordIds: ['1'] }));

      expect(captured.query).toMatchObject({ segmentQuery: 'SELECT id FROM orders' });
      expect(JSON.parse(captured.query.filters)).toEqual({
        field: 'id',
        operator: 'in',
        value: ['1'],
      });
    });

    it('should address a composite key one record at a time', async () => {
      const captured = interceptList();

      await reader.listRecordIds(
        makeQuery({ primaryKeys: ['tenantId', 'id'], recordIds: ['t1|1', 't2|9'] }),
      );

      expect(JSON.parse(captured.query.filters)).toEqual({
        aggregator: 'or',
        conditions: [
          {
            aggregator: 'and',
            conditions: [
              { field: 'tenantId', operator: 'equal', value: 't1' },
              { field: 'id', operator: 'equal', value: '1' },
            ],
          },
          {
            aggregator: 'and',
            conditions: [
              { field: 'tenantId', operator: 'equal', value: 't2' },
              { field: 'id', operator: 'equal', value: '9' },
            ],
          },
        ],
      });
    });
  });

  describe('request shape', () => {
    it('should read only the primary key fields', async () => {
      const captured = interceptList();

      await reader.listRecordIds(makeQuery({ primaryKeys: ['tenantId', 'id'] }));

      expect(captured.query['fields[orders]']).toBe('tenantId,id');
    });

    it('should send the project timezone the segment must be evaluated in', async () => {
      const captured = interceptList();

      await reader.listRecordIds(makeQuery({ timezone: 'America/New_York' }));

      expect(captured.query).toMatchObject({ timezone: 'America/New_York' });
    });

    it('should ask for the first page only, at the requested size', async () => {
      const captured = interceptList();

      await reader.listRecordIds(makeQuery({ pageSize: 22 }));

      expect(captured.query).toMatchObject({ 'page[size]': '22', 'page[number]': '1' });
    });

    it('should authenticate as the service account', async () => {
      let authorization: string | undefined;

      nock(AGENT_URL)
        .get('/forest/orders')
        .query(true)
        .reply(200, function handler(this: { req: { headers: Record<string, string> } }) {
          authorization = this.req.headers.authorization;

          return jsonApi([]);
        });

      await reader.listRecordIds(makeQuery());

      expect(authorization).toMatch(/^Bearer ey/);
    });
  });

  describe('results', () => {
    it('should return the record ids the agent answered', async () => {
      interceptList([{ id: '12' }, { id: '13' }]);

      await expect(reader.listRecordIds(makeQuery())).resolves.toEqual(['12', '13']);
    });

    it('should take a composite key from the packed resource id, not from the columns', async () => {
      // Rebuilding it from the attributes would yield "t1|t1|5": the deserializer overwrites the
      // `id` attribute with the resource id.
      interceptList([{ id: 't1|5', attributes: { tenantId: 't1', id: 5 } }]);

      await expect(
        reader.listRecordIds(makeQuery({ primaryKeys: ['tenantId', 'id'] })),
      ).resolves.toEqual(['t1|5']);
    });

    it('should refuse a record with no id rather than run against the wrong one', async () => {
      nock(AGENT_URL)
        .get('/forest/orders')
        .query(true)
        .reply(200, { data: [{ type: 'orders', attributes: { name: 'no id here' } }] });

      await expect(reader.listRecordIds(makeQuery())).rejects.toThrow(
        /returned a "orders" record with no id/,
      );
    });

    it('should report an agent failure as a port error', async () => {
      nock(AGENT_URL)
        .get('/forest/orders')
        .query(true)
        .reply(500, { errors: [{ detail: 'boom' }] });

      await expect(reader.listRecordIds(makeQuery())).rejects.toThrow(AgentPortError);
    });
  });
});
