import type { AgentTransport } from '../../src/agent/agent-transport';
import type ReadModelStore from '../../src/read-model/read-model-store';

import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import ReadModel from '../../src/read-model/read-model';
import { collection, column, relation } from '../read-model/fixtures';

const TIMEZONE = 'America/New_York';
const OPERATORS = ['present', 'blank', 'equal', 'not_equal', 'in', 'like'];

const readModel = new ReadModel([
  collection('users', [
    column('id'),
    column('email'),
    relation('posts', 'HasMany', 'posts.id'),
    relation('tags', 'BelongsToMany', 'tags.slug'),
  ]),
  collection('posts', [column('id'), column('title')]),
  collection('tags', [{ ...column('slug'), isPrimaryKey: true }, column('label')]),
]);

const store = {
  getReadModel: async () => readModel,
  getCapabilities: async () => ({
    capabilities: {
      fields: ['id', 'email', 'title', 'slug', 'label'].map(name => ({
        name,
        type: 'String',
        operators: OPERATORS,
      })),
    },
    readModel,
  }),
} as unknown as ReadModelStore;

interface AgentRequest {
  method: string;
  path: string;
  query: Record<string, unknown>;
}

async function agentRequestOf(route: string, body: object): Promise<AgentRequest> {
  const received: AgentRequest[] = [];
  const transport: AgentTransport = {
    url: 'https://agent.example.com',
    dispatcher: {
      request: async ({ method, path, query }) => {
        received.push({
          method,
          path: decodeURIComponent(path),
          query: JSON.parse(JSON.stringify(query)),
        });

        return { status: 200, body: path.endsWith('/count') ? { count: 0 } : [] };
      },
    },
  };

  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = 'agent-jwt';
    await next();
  });
  app.use(
    createDataRoutesMiddleware({
      forestServerUrl: 'https://api.forestadmin.test',
      store,
      transport,
      logger: () => undefined,
    }),
  );

  const response = await request(app.callback()).post(route).send(body);

  expect(response.status).toBe(200);
  expect(received).toHaveLength(1);

  return received[0];
}

const EMAIL_PRESENT = { field: 'email', operator: 'Present' };
const EMAIL_PRESENT_WIRE = JSON.stringify({ field: 'email', operator: 'present', value: null });
const TITLE_PRESENT = { field: 'title', operator: 'Present' };
const TITLE_PRESENT_WIRE = JSON.stringify({ field: 'title', operator: 'present', value: null });

const USERS = '/forest/users';
const USER_POSTS = '/forest/users/7/relationships/posts';

type Case = [name: string, route: string, body: object, path: string, query: object];

const CASES: Case[] = [
  ['a plain list', '/agent/v1/users/list', {}, USERS, {}],
  [
    'a projection',
    '/agent/v1/users/list',
    { projection: ['id', 'email'] },
    USERS,
    { 'fields[users]': 'id,email' },
  ],
  [
    'an extended search',
    '/agent/v1/users/list',
    { search: 'ada', searchExtended: true },
    USERS,
    { search: 'ada', searchExtended: true },
  ],
  [
    'a search that is not extended',
    '/agent/v1/users/list',
    { search: 'ada', searchExtended: false },
    USERS,
    { search: 'ada' },
  ],
  ['a search alone', '/agent/v1/users/list', { search: 'ada' }, USERS, { search: 'ada' }],
  ['a padded search', '/agent/v1/users/list', { search: ' ada ' }, USERS, { search: 'ada' }],
  ['a blank search', '/agent/v1/users/list', { search: '  ' }, USERS, {}],
  ['an empty search', '/agent/v1/users/list', { search: '' }, USERS, {}],
  [
    'an extended flag without a search',
    '/agent/v1/users/list',
    { searchExtended: true },
    USERS,
    {},
  ],
  [
    'an extended flag with a blank search',
    '/agent/v1/users/list',
    { search: ' ', searchExtended: true },
    USERS,
    {},
  ],
  [
    'a filter and a search',
    '/agent/v1/users/list',
    { filter: EMAIL_PRESENT, search: 'ada' },
    USERS,
    { filters: EMAIL_PRESENT_WIRE, search: 'ada' },
  ],
  ['an empty filter', '/agent/v1/users/list', { filter: {} }, USERS, { filters: '{}' }],
  [
    'a filter branch',
    '/agent/v1/users/list',
    {
      filter: {
        aggregator: 'And',
        conditions: [EMAIL_PRESENT, { field: 'id', operator: 'NotEqual', value: 3 }],
      },
    },
    USERS,
    {
      filters: JSON.stringify({
        aggregator: 'and',
        conditions: [
          { field: 'email', operator: 'present', value: null },
          { field: 'id', operator: 'not_equal', value: 3 },
        ],
      }),
    },
  ],
  [
    'a sort',
    '/agent/v1/users/list',
    {
      sort: [
        { field: 'email', direction: 'desc' },
        { field: 'id', direction: 'asc' },
        { field: 'id' },
      ],
    },
    USERS,
    { sort: '-email,id,id' },
  ],
  [
    'a first page',
    '/agent/v1/users/list',
    { page: { limit: 20, offset: 0 } },
    USERS,
    { 'page[size]': 20, 'page[number]': 1 },
  ],
  [
    'a later page',
    '/agent/v1/users/list',
    { page: { limit: 20, offset: 40 } },
    USERS,
    { 'page[size]': 20, 'page[number]': 3 },
  ],
  [
    'every refinement at once',
    '/agent/v1/users/list',
    {
      filter: EMAIL_PRESENT,
      projection: ['id'],
      sort: [{ field: 'id', direction: 'desc' }],
      page: { limit: 5, offset: 5 },
      search: 'ada',
      searchExtended: true,
    },
    USERS,
    {
      filters: EMAIL_PRESENT_WIRE,
      'fields[users]': 'id',
      sort: '-id',
      'page[size]': 5,
      'page[number]': 2,
      search: 'ada',
      searchExtended: true,
    },
  ],
  ['a plain count', '/agent/v1/users/count', {}, `${USERS}/count`, {}],
  [
    'a filtered count',
    '/agent/v1/users/count',
    { filter: EMAIL_PRESENT },
    `${USERS}/count`,
    { filters: EMAIL_PRESENT_WIRE },
  ],
  [
    'a searched count',
    '/agent/v1/users/count',
    { search: 'ada', searchExtended: true },
    `${USERS}/count`,
    { search: 'ada', searchExtended: true },
  ],
  ['a blank searched count', '/agent/v1/users/count', { search: '  ' }, `${USERS}/count`, {}],
  [
    'a plain relation list',
    '/agent/v1/users/relations/posts/list',
    { parentId: '7' },
    USER_POSTS,
    {},
  ],
  [
    'a relation list with a numeric parent',
    '/agent/v1/users/relations/posts/list',
    { parentId: 7 },
    USER_POSTS,
    {},
  ],
  [
    'a relation list with a composite parent',
    '/agent/v1/users/relations/posts/list',
    { parentId: 'tenant-1|42' },
    '/forest/users/tenant-1|42/relationships/posts',
    {},
  ],
  [
    'a relation projection, filter and sort',
    '/agent/v1/users/relations/posts/list',
    {
      parentId: '7',
      projection: ['id', 'title'],
      filter: TITLE_PRESENT,
      sort: [{ field: 'title', direction: 'desc' }],
    },
    USER_POSTS,
    { 'fields[posts]': 'id,title', filters: TITLE_PRESENT_WIRE, sort: '-title' },
  ],
  [
    'a relation projection on a many-to-many target',
    '/agent/v1/users/relations/tags/list',
    { parentId: '7', projection: ['slug', 'label'] },
    '/forest/users/7/relationships/tags',
    { 'fields[tags]': 'slug,label' },
  ],
  [
    'a relation search and page',
    '/agent/v1/users/relations/posts/list',
    { parentId: '7', search: 'hello', searchExtended: true, page: { limit: 10, offset: 10 } },
    USER_POSTS,
    { search: 'hello', searchExtended: true, 'page[size]': 10, 'page[number]': 2 },
  ],
  [
    'a plain relation count',
    '/agent/v1/users/relations/posts/count',
    { parentId: '7' },
    `${USER_POSTS}/count`,
    {},
  ],
  [
    'a filtered relation count',
    '/agent/v1/users/relations/posts/count',
    { parentId: '7', filter: TITLE_PRESENT },
    `${USER_POSTS}/count`,
    { filters: TITLE_PRESENT_WIRE },
  ],
  [
    'a searched relation count',
    '/agent/v1/users/relations/posts/count',
    { parentId: '7', search: 'hello', searchExtended: true },
    `${USER_POSTS}/count`,
    { search: 'hello', searchExtended: true },
  ],
];

describe('data routes agent requests', () => {
  it.each(CASES)(
    'should ask the agent the same thing for %s',
    async (_, route, body, path, query) => {
      await expect(agentRequestOf(route, body)).resolves.toEqual({
        method: 'get',
        path,
        query: { timezone: TIMEZONE, ...query },
      });
    },
  );
});
