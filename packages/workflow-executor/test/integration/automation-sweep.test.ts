import type { ClientRequest } from 'http';

import { ServerUtils } from '@forestadmin/forestadmin-client';
import jsonwebtoken from 'jsonwebtoken';
import nock from 'nock';

import AgentClientSegmentReader from '../../src/adapters/agent-client-segment-reader';
import ForestServerAutomationPort from '../../src/adapters/forest-server-automation-port';
import AutomationPoller from '../../src/automation/automation-poller';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { query: jest.fn() },
}));

const mockQuery = ServerUtils.query as jest.Mock;

const AGENT_URL = 'https://agent.example.com';
const AUTH_SECRET = 'auth-secret';
const ENV_SECRET = 'env-secret-123';
const FOREST_SERVER_URL = 'https://api.forestadmin.com';
const INSTANCE_ID = 'host-1-abcd';
const POLL_INTERVAL_S = 300;
const INBOXES_ROUTE = '/api/workflow-orchestrator/automated-inboxes';

const profile = {
  id: 99,
  email: 'bot@forestadmin.com',
  firstName: 'Bot',
  lastName: null,
  team: 'Ops',
  renderingId: 7,
  role: null,
  permissionLevel: 'admin',
  tags: { region: 'eu' },
};

const logContext = {
  inboxId: 'inbox-1',
  renderingId: 7,
  workflowId: 'wf-1',
  collectionName: 'orders',
};

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    inboxId: 'inbox-1',
    renderingId: 7,
    teamId: 3,
    workflowId: 'wf-1',
    collectionId: 'col-1',
    collectionName: 'orders',
    primaryKeys: ['id'],
    maxConcurrentRuns: 3,
    timezone: 'Europe/Paris',
    liana: 'forest-nodejs-agent',
    segment: { kind: 'smart', name: 'to-review' },
    serviceAccountProfile: profile,
    ...overrides,
  };
}

function liveAssignment(recordId: string, workflowRunId = 10) {
  return { recordId, state: 'doing', workflowRunId, runState: 'started' };
}

function doneAssignment(recordId: string, workflowRunId = 20) {
  return { recordId, state: 'done', workflowRunId, runState: 'finished' };
}

function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

interface Orchestrator {
  config: Record<string, unknown>;
  assignments?: unknown[];
  assignmentsError?: Error;
  syncResults?: { recordId: string; outcome: string }[];
}

function serveOrchestrator(orchestrator: Orchestrator): unknown[] {
  const syncBodies: unknown[] = [];

  mockQuery.mockImplementation(async (options, method, path, _headers, body) => {
    if (options.envSecret !== ENV_SECRET || options.forestServerUrl !== FOREST_SERVER_URL) {
      throw new Error(`Unexpected orchestrator options ${JSON.stringify(options)}`);
    }

    if (method === 'put' && path === `${INBOXES_ROUTE}/lease?instanceId=${INSTANCE_ID}`) {
      return { held: true };
    }

    if (method === 'get' && path === `${INBOXES_ROUTE}?instanceId=${INSTANCE_ID}`) {
      return { inboxes: [orchestrator.config] };
    }

    if (method === 'get' && path === `${INBOXES_ROUTE}/inbox-1/assignments`) {
      if (orchestrator.assignmentsError) throw orchestrator.assignmentsError;

      return { assignments: orchestrator.assignments ?? [] };
    }

    if (method === 'post' && path === `${INBOXES_ROUTE}/inbox-1/sync`) {
      syncBodies.push(wire(body));

      return { results: orchestrator.syncResults ?? [] };
    }

    throw new Error(`Unexpected orchestrator call ${method} ${path}`);
  });

  return syncBodies;
}

interface AgentRequest {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body?: unknown;
}

function records(...ids: string[]) {
  return { data: ids.map(id => ({ type: 'orders', id, attributes: {} })) };
}

function filtersOf(query: Record<string, string>): unknown {
  return query.filters === undefined ? undefined : JSON.parse(query.filters);
}

function capabilities(operators: string[]) {
  return {
    collections: [
      {
        name: 'orders',
        fields: [
          { name: 'status', type: 'String', operators: ['equal'] },
          { name: 'id', type: 'Number', operators },
        ],
      },
    ],
  };
}

function listQuery(overrides: Record<string, unknown>) {
  return {
    timezone: 'Europe/Paris',
    segment: 'to-review',
    searchExtended: 'false',
    'fields[orders]': 'id',
    ...overrides,
  };
}

describe('automation sweep, real poller over the real adapters', () => {
  let logger: jest.Mock;
  let agent: nock.Scope;
  let agentRequests: AgentRequest[];
  let authorizations: string[];

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockQuery.mockReset();
    logger = jest.fn();
    agentRequests = [];
    authorizations = [];
    agent = nock(AGENT_URL);
    agent.on('request', (req: ClientRequest & { headers: Record<string, string> }, _i, body) => {
      const url = new URL(req.path, AGENT_URL);
      const query: Record<string, unknown> = Object.fromEntries(url.searchParams);

      if (typeof query.filters === 'string') query.filters = JSON.parse(query.filters);

      agentRequests.push({
        method: req.method,
        path: url.pathname,
        query,
        ...(body ? { body: JSON.parse(body) } : {}),
      });
      authorizations.push(req.headers.authorization);
    });
  });

  afterEach(() => {
    nock.cleanAll();
    jest.useRealTimers();
  });

  async function sweepOnce(): Promise<void> {
    const poller = new AutomationPoller({
      automationPort: new ForestServerAutomationPort({
        envSecret: ENV_SECRET,
        forestServerUrl: FOREST_SERVER_URL,
        logger,
      }),
      segmentReaderPort: new AgentClientSegmentReader({
        agentUrl: AGENT_URL,
        authSecret: AUTH_SECRET,
      }),
      pollingIntervalS: POLL_INTERVAL_S,
      instanceId: INSTANCE_ID,
      logger,
      stopTimeoutS: 30,
    });

    poller.start();
    await jest.advanceTimersByTimeAsync(0);
    await poller.stop();
  }

  function onList(
    match: (filters: unknown) => boolean,
    status: number,
    body: unknown,
  ): nock.Interceptor {
    const interceptor = agent
      .get('/forest/orders')
      .query(query => match(filtersOf(query as never)));
    interceptor.reply(status, body as nock.Body);

    return interceptor;
  }

  function onCapabilities(operators: string[]): void {
    agent.post('/forest/_internal/capabilities').query(true).reply(200, capabilities(operators));
  }

  const isNotIn = (filters: unknown) => (filters as { operator?: string })?.operator === 'not_in';
  const isMembership = (filters: unknown) =>
    (filters as { operator?: string; aggregator?: string })?.operator === 'in' ||
    (filters as { aggregator?: string })?.aggregator === 'or';
  const isUnfiltered = (filters: unknown) => filters === undefined;

  describe('read failures reported to the orchestrator', () => {
    it('should sync agent-forbidden with its status when the agent answers 403 on the candidate read', async () => {
      const syncBodies = serveOrchestrator({ config: makeConfig() });
      onList(isUnfiltered, 403, { errors: [{ detail: 'Forbidden for this rendering' }] });

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '3', 'page[number]': '1' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([
        {
          closed: [],
          candidates: [],
          readFailure: { reason: 'agent-forbidden', httpStatus: 403 },
        },
      ]);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        {
          ...logContext,
          requestedPageSize: 3,
          notIn: false,
          error: 'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 403',
          httpStatus: 403,
          agentError: 'Forbidden for this rendering',
        },
      );
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 0,
        reconciled: 0,
        candidates: 0,
        candidatePageSize: undefined,
        candidatePagesRead: undefined,
        paddedPageReason: undefined,
        readFailure: 'agent-forbidden',
        outcomes: {},
      });
    });

    it('should sync agent-unreachable without a status when the connection is refused', async () => {
      const syncBodies = serveOrchestrator({ config: makeConfig() });
      agent
        .get('/forest/orders')
        .query(true)
        .replyWithError(
          Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:443'), { code: 'ECONNREFUSED' }),
        );

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(syncBodies).toStrictEqual([
        { closed: [], candidates: [], readFailure: { reason: 'agent-unreachable' } },
      ]);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        {
          ...logContext,
          requestedPageSize: 3,
          notIn: false,
          error: 'Agent port "listSegmentRecordIds" failed: connect ECONNREFUSED 10.0.0.1:443',
          httpStatus: undefined,
          agentError: undefined,
        },
      );
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 0,
        reconciled: 0,
        candidates: 0,
        candidatePageSize: undefined,
        candidatePagesRead: undefined,
        paddedPageReason: undefined,
        readFailure: 'agent-unreachable',
        outcomes: {},
      });
    });
  });

  describe('the inbox dispatch order', () => {
    const assignments = [liveAssignment('1', 11), liveAssignment('2', 12)];
    const sort = [
      { field: 'created_at', ascending: false },
      { field: 'customer.name', ascending: true },
    ];

    function onSortedList(sortParam: string, status: number, body: unknown): void {
      agent
        .get('/forest/orders')
        .query(query => (query as Record<string, string>).sort === sortParam)
        .reply(status, body as nock.Body);
    }

    it('should read the not_in page in the inbox order', async () => {
      const syncBodies = serveOrchestrator({ config: makeConfig({ sort }), assignments });
      onCapabilities(['equal', 'in', 'not_in']);
      onSortedList('-created_at,customer.name', 200, records('5', '3'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests.slice(1)).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({
            'page[size]': '3',
            'page[number]': '1',
            sort: '-created_at,customer.name',
            filters: { field: 'id', operator: 'not_in', value: ['1', '2'] },
          }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['5', '3'] }]);
    });

    it('should pad in the inbox order then by key, and by key alone once the agent refuses the sort', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({ sort, liana: 'forest-rails' }),
        assignments,
      });
      onSortedList('-created_at,customer.name,id', 403, {
        errors: [{ detail: 'Forbidden on customer' }],
      });
      onSortedList('id', 200, records('1', '2', '3'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({
            'page[size]': '5',
            'page[number]': '1',
            sort: '-created_at,customer.name,id',
          }),
        },
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '5', 'page[number]': '1', sort: 'id' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['3'] }]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'The agent rejected the inbox sort, reading candidates without it',
        {
          ...logContext,
          requestedPageSize: 5,
          pageNumber: 1,
          paddedPageReason: 'unknown-liana',
          notIn: false,
          sort: [...sort, { field: 'id', ascending: true }],
          error: 'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 403',
          httpStatus: 403,
          agentError: 'Forbidden on customer',
        },
      );
    });

    it('should pad a single page in the inbox order alone for an agent that sorts on one field', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({
          sort: [{ field: 'created_at', ascending: false }],
          liana: 'forest-express-sequelize',
        }),
        assignments,
      });
      onSortedList('-created_at', 200, records('1', '2', '7', '3', '4'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '5', 'page[number]': '1', sort: '-created_at' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['7', '3', '4'] }]);
    });
  });

  describe('the not_in candidate read', () => {
    const assignments = [liveAssignment('1', 11), liveAssignment('2', 12)];

    it('should pad the page when the agent refuses not_in with a 400, and sync what the padding found', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig(),
        assignments,
        syncResults: [
          { recordId: '3', outcome: 'started' },
          { recordId: '4', outcome: 'started' },
        ],
      });
      onCapabilities(['equal', 'in', 'not_in']);
      onList(isNotIn, 400, { errors: [{ detail: 'Unsupported operator not_in' }] });
      onList(isUnfiltered, 200, records('1', '2', '3', '4'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'POST',
          path: '/forest/_internal/capabilities',
          query: { timezone: 'Europe/Paris' },
          body: { collectionNames: ['orders'] },
        },
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({
            'page[size]': '3',
            'page[number]': '1',
            filters: { field: 'id', operator: 'not_in', value: ['1', '2'] },
          }),
        },
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '5', 'page[number]': '1', sort: 'id' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['3', '4'] }]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'The not_in candidate read failed, padding the page instead',
        {
          ...logContext,
          requestedPageSize: 3,
          notIn: true,
          error: 'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 400',
          httpStatus: 400,
          agentError: 'Unsupported operator not_in',
        },
      );
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 2,
        reconciled: 0,
        candidates: 2,
        candidatePageSize: 5,
        candidatePagesRead: 1,
        paddedPageReason: 'not-in-refused',
        readFailure: undefined,
        outcomes: { started: 2 },
      });
    });

    it('should not pad the page when the agent throttles the not_in read with a 429', async () => {
      const syncBodies = serveOrchestrator({ config: makeConfig(), assignments });
      onCapabilities(['equal', 'in', 'not_in']);
      onList(isNotIn, 429, { errors: [{ detail: 'Too many requests' }] });

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests.map(({ method, path }) => `${method} ${path}`)).toEqual([
        'POST /forest/_internal/capabilities',
        'GET /forest/orders',
      ]);
      expect(syncBodies).toStrictEqual([
        {
          closed: [],
          candidates: [],
          readFailure: { reason: 'segment-read-failed', httpStatus: 429 },
        },
      ]);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Could not read new candidates of an automated inbox',
        {
          ...logContext,
          requestedPageSize: 3,
          notIn: true,
          error: 'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 429',
          httpStatus: 429,
          agentError: 'Too many requests',
        },
      );
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 2,
        reconciled: 0,
        candidates: 0,
        candidatePageSize: undefined,
        candidatePagesRead: undefined,
        paddedPageReason: undefined,
        readFailure: 'segment-read-failed',
        outcomes: {},
      });
    });
  });

  describe('the padded candidate read', () => {
    it('should pad without asking the capabilities of a liana it does not know', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({ liana: 'forest-rails' }),
        assignments: [liveAssignment('1')],
      });
      onList(isUnfiltered, 200, records('1', '7'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '4', 'page[number]': '1', sort: 'id' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['7'] }]);
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 1,
        reconciled: 0,
        candidates: 1,
        candidatePageSize: 4,
        candidatePagesRead: 1,
        paddedPageReason: 'unknown-liana',
        readFailure: undefined,
        outcomes: {},
      });
    });

    it('should pad a composite key with no known record, in one unsorted page', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({ primaryKeys: ['tenantId', 'id'] }),
      });
      onList(isUnfiltered, 200, records('t1|1', 't1|2'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({
            'fields[orders]': 'tenantId,id',
            'page[size]': '3',
            'page[number]': '1',
          }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['t1|1', 't1|2'] }]);
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 0,
        reconciled: 0,
        candidates: 2,
        candidatePageSize: 3,
        candidatePagesRead: 1,
        paddedPageReason: 'composite-key',
        readFailure: undefined,
        outcomes: {},
      });
    });

    it('should ask the membership of known composite ids as one AND branch per packed id', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({ primaryKeys: ['tenantId', 'id'] }),
        assignments: [doneAssignment('t1|1', 21), doneAssignment('t2|9', 22)],
      });
      onList(isMembership, 200, records('t1|1'));
      onList(isUnfiltered, 200, records('t1|1', 't2|9', 't3|4'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toHaveLength(2);
      expect(agentRequests).toEqual(
        expect.arrayContaining([
          {
            method: 'GET',
            path: '/forest/orders',
            query: listQuery({
              'fields[orders]': 'tenantId,id',
              'page[size]': '2',
              'page[number]': '1',
              filters: {
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
              },
            }),
          },
          {
            method: 'GET',
            path: '/forest/orders',
            query: listQuery({
              'fields[orders]': 'tenantId,id',
              'page[size]': '5',
              'page[number]': '1',
            }),
          },
        ]),
      );
      expect(syncBodies).toStrictEqual([
        {
          closed: [
            { recordId: 't1|1', stillInSegment: true },
            { recordId: 't2|9', stillInSegment: false },
          ],
          candidates: ['t3|4'],
        },
      ]);
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 2,
        reconciled: 2,
        candidates: 1,
        candidatePageSize: 5,
        candidatePagesRead: 1,
        paddedPageReason: 'composite-key',
        readFailure: undefined,
        outcomes: {},
      });
    });

    it('should pad without asking the capabilities once more than 150 records are known', async () => {
      const knownIds = Array.from({ length: 151 }, (_, index) => String(index + 1));
      const syncBodies = serveOrchestrator({
        config: makeConfig(),
        assignments: knownIds.map(recordId => liveAssignment(recordId)),
      });
      onList(isUnfiltered, 200, records(...knownIds, '152', '153'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toEqual([
        {
          method: 'GET',
          path: '/forest/orders',
          query: listQuery({ 'page[size]': '154', 'page[number]': '1', sort: 'id' }),
        },
      ]);
      expect(syncBodies).toStrictEqual([{ closed: [], candidates: ['152', '153'] }]);
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 151,
        reconciled: 0,
        candidates: 2,
        candidatePageSize: 154,
        candidatePagesRead: 1,
        paddedPageReason: 'too-many-known-records',
        readFailure: undefined,
        outcomes: {},
      });
    });
  });

  describe('timezone', () => {
    it.each([
      ['no timezone', null],
      ['a zone the agent would reject', 'Mars/Olympus_Mons'],
    ])('should read the agent in UTC when the inbox carries %s', async (_case, timezone) => {
      const syncBodies = serveOrchestrator({
        config: makeConfig({ timezone }),
        assignments: [doneAssignment('1')],
      });
      onCapabilities(['equal', 'in', 'not_in']);
      onList(isMembership, 200, records());
      onList(isNotIn, 200, records('8'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toHaveLength(3);
      expect(agentRequests.map(({ query }) => query.timezone)).toEqual(['UTC', 'UTC', 'UTC']);
      expect(syncBodies).toStrictEqual([
        { closed: [{ recordId: '1', stillInSegment: false }], candidates: ['8'] },
      ]);
    });
  });

  describe('reconciliation', () => {
    it('should report each done record as still or no longer in the segment, as the service account', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig(),
        assignments: [doneAssignment('1', 21), doneAssignment('2', 22), liveAssignment('3', 23)],
      });
      onCapabilities(['equal', 'in', 'not_in']);
      onList(isMembership, 200, records('1'));
      onList(isNotIn, 200, records('5'));

      await sweepOnce();

      expect(nock.isDone()).toBe(true);
      expect(agentRequests).toHaveLength(3);
      expect(agentRequests).toEqual(
        expect.arrayContaining([
          {
            method: 'GET',
            path: '/forest/orders',
            query: listQuery({
              'page[size]': '2',
              'page[number]': '1',
              filters: { field: 'id', operator: 'in', value: ['1', '2'] },
            }),
          },
          {
            method: 'GET',
            path: '/forest/orders',
            query: listQuery({
              'page[size]': '3',
              'page[number]': '1',
              filters: { field: 'id', operator: 'not_in', value: ['1', '2', '3'] },
            }),
          },
        ]),
      );
      expect(syncBodies).toStrictEqual([
        {
          closed: [
            { recordId: '1', stillInSegment: true },
            { recordId: '2', stillInSegment: false },
          ],
          candidates: ['5'],
        },
      ]);
      expect(logger).toHaveBeenCalledWith('Info', 'Automated inbox polled', {
        ...logContext,
        assignments: 3,
        reconciled: 2,
        candidates: 1,
        candidatePageSize: 3,
        candidatePagesRead: undefined,
        paddedPageReason: undefined,
        readFailure: undefined,
        outcomes: {},
      });

      const tokens = authorizations.map(header => header.replace(/^Bearer /, ''));
      const claims = tokens.map(token => jsonwebtoken.verify(token, AUTH_SECRET) as never);

      expect(tokens).toHaveLength(3);
      claims.forEach(({ iat, exp }: { iat: number; exp: number }) => expect(exp - iat).toBe(300));
      expect(claims).toEqual(
        Array(3).fill({
          id: 99,
          email: 'bot@forestadmin.com',
          firstName: 'Bot',
          lastName: '',
          team: 'Ops',
          renderingId: 7,
          role: '',
          permissionLevel: 'admin',
          tags: [{ key: 'region', value: 'eu' }],
          first_name: 'Bot',
          last_name: '',
          rendering_id: '7',
          permission_level: 'admin',
          scope: 'step-execution',
          iat: expect.any(Number),
          exp: expect.any(Number),
        }),
      );
    });
  });

  describe('an inbox the orchestrator stopped serving', () => {
    it('should drop the inbox for this cycle when its assignments route answers 404', async () => {
      const syncBodies = serveOrchestrator({
        config: makeConfig(),
        assignmentsError: httpError(404, 'Inbox not found'),
      });

      await sweepOnce();

      expect(agentRequests).toEqual([]);
      expect(syncBodies).toEqual([]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Automated inbox listed this cycle but its route answered 404, dropping it for this cycle',
        {
          ...logContext,
          operation: 'listAutomatedInboxAssignments',
          detail: 'Inbox not found',
        },
      );
      expect(logger).not.toHaveBeenCalledWith('Info', 'Automated inbox polled', expect.anything());
      expect(logger).not.toHaveBeenCalledWith(
        'Error',
        'Automated inbox poll failed',
        expect.anything(),
      );
    });
  });
});
