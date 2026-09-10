import type { AgentDispatchRequest, AgentDispatcher } from '../src/agent/in-process-transport';

import request from 'supertest';

import buildBff from '../src/build-bff';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';
import { collection, column } from './read-model/fixtures';
import { parseConfig } from '../src/config/env-config';
import { issueBffAccessToken } from '../src/oauth/bff-token';

const fetchSchema = jest.fn();

jest.mock('../src/read-model/forest-schema-client', () => ({
  __esModule: true,
  default: class {
    fetchSchema = fetchSchema;
  },
}));

const AUTH_SECRET = 'auth-secret';

// No AGENT_URL on purpose: that is what an embedded deployment's config looks like, and it is what
// tells the in-process transport apart from the HTTP one through the public surface.
const EMBEDDED_ENV = {
  FOREST_AUTH_SECRET: AUTH_SECRET,
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
} satisfies NodeJS.ProcessEnv;

function sessionToken(): string {
  return issueBffAccessToken({
    sid: 'session-1',
    user: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      permissionLevel: 'admin',
      renderingId: 1,
      role: 'admin',
      tags: {},
    },
    renderingId: 1,
    authSecret: AUTH_SECRET,
    expiresInSeconds: 3600,
  });
}

/** Answers the two calls a list goes through: the capabilities probe, then the records. */
function agentDispatcher(): jest.Mocked<AgentDispatcher> {
  return {
    request: jest.fn(async ({ path }: AgentDispatchRequest) => {
      if (path.endsWith('/_internal/capabilities')) {
        return {
          status: 200,
          body: {
            collections: [
              {
                name: 'books',
                fields: [
                  { name: 'id', type: 'Number', operators: ['equal'] },
                  { name: 'title', type: 'String', operators: ['equal', 'like'] },
                ],
              },
            ],
          },
        };
      }

      return {
        status: 200,
        body: { data: [{ type: 'books', id: '1', attributes: { title: 'Foundation' } }] },
      };
    }),
  } as unknown as jest.Mocked<AgentDispatcher>;
}

async function buildEmbedded(dispatcher?: AgentDispatcher, env: NodeJS.ProcessEnv = EMBEDDED_ENV) {
  return buildBff({ config: parseConfig(env), logger: () => undefined, dispatcher });
}

function list(callback: Parameters<typeof request>[0]) {
  return request(callback)
    .post('/agent/v1/books/list')
    .set('Authorization', `Bearer ${sessionToken()}`)
    .set('X-Forest-Timezone', 'Europe/Paris')
    .send({ projection: ['id', 'title'] });
}

describe('buildBff with an in-process dispatcher', () => {
  restoreFetchAfterEach();

  beforeEach(() => {
    stubEnvironmentIdFetch();
    fetchSchema.mockReset();
    fetchSchema.mockResolvedValue([collection('books', [column('id'), column('title')])]);
  });

  it('should serve the records the dispatcher returns, without opening a socket', async () => {
    const dispatcher = agentDispatcher();
    const { callback } = await buildEmbedded(dispatcher);

    const response = await list(callback);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: '1',
        title: 'Foundation',
        __forest: { collection: 'books', primaryKey: { id: '1' } },
      },
    ]);
    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        path: '/forest/books',
        headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer .+/) }),
      }),
    );
  });

  it('should hand the configured agent timeout to every dispatched call', async () => {
    const dispatcher = agentDispatcher();
    const { callback } = await buildEmbedded(dispatcher, {
      ...EMBEDDED_ENV,
      BFF_AGENT_TIMEOUT_MS: '2500',
    });

    await list(callback);

    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/forest/books', timeoutMs: 2500 }),
    );
  });

  describe('when neither a dispatcher nor an AGENT_URL is given', () => {
    it('should fall back to the stub instead of mounting a data edge', async () => {
      const { callback } = await buildEmbedded(undefined);

      const response = await list(callback);

      expect(response.status).toBe(501);
      expect(response.body.error).toMatchObject({ type: 'not_implemented' });
    });
  });

  describe('/health', () => {
    it('should report ok on a config with no AGENT_URL, since the agent is in-process', async () => {
      const { callback } = await buildEmbedded(agentDispatcher());

      const response = await request(callback).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok' });
    });

    it('should report degraded without an auth secret, dispatcher or not', async () => {
      const { callback } = await buildEmbedded(agentDispatcher(), {
        ...EMBEDDED_ENV,
        FOREST_AUTH_SECRET: undefined,
      });

      const response = await request(callback).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ status: 'degraded' });
    });
  });
});
