import type AiProxyClient from '../../src/ai/ai-proxy-client';
import type { CustomerModel } from '../../src/ai/customer-model-query';
import type { AiProxyResponse } from '../../src/ai/ai-proxy-client';

import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import RealAiProxyClient, { AiProxyTimeoutError } from '../../src/ai/ai-proxy-client';
import createAiRoutesMiddleware, { AI_QUERY_ROUTE } from '../../src/ai/ai-routes-middleware';
import { AI_BODY_LIMIT } from '../../src/http/body-limit';
import createErrorMiddleware from '../../src/http/error-middleware';
import EnvironmentFetchError from '../../src/oauth/environment-fetch-error';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';
import { restoreFetchAfterEach, stubFetch } from '../helpers/fetch-stub';

const SESSION_ID = 'session-id';
const USER_ID = 5;

const sessionTokens = createSessionTokenCodec(
  createTokenCipher(Buffer.alloc(32, 3).toString('base64')),
  { now: () => Date.now(), sessionTtlSeconds: 3600, logger: () => undefined },
);

function freshAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'saas' }, 'irrelevant-for-decode', { expiresIn: '1h' });
}

interface AppContext {
  saasAccessToken?: string | null;
  authMode?: 'oauth' | 'api-key';
  renderingId?: string;
  environmentId?: number;
  resolveEnvironmentId?: () => Promise<number>;
  customerModel?: CustomerModel;
}

function buildApp(
  client: AiProxyClient,
  {
    saasAccessToken = freshAccessToken(),
    authMode = 'oauth',
    renderingId = '42',
    environmentId = 7,
    resolveEnvironmentId = async () => environmentId,
    customerModel,
  }: AppContext,
) {
  const logger = jest.fn();
  const app = new Koa();

  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(bodyParser({ jsonLimit: AI_BODY_LIMIT, enableTypes: ['json'] }));
  app.use(async (ctx, next) => {
    ctx.state.authMode = authMode;

    if (authMode === 'oauth') {
      ctx.state.principal = {
        sid: SESSION_ID,
        id: USER_ID,
        rendering_id: renderingId,
        server_access:
          saasAccessToken === null
            ? undefined
            : sessionTokens.sealServerAccess(
                { sid: SESSION_ID, userId: USER_ID, renderingId: Number(renderingId) },
                saasAccessToken,
              ),
      };
    }

    await next();
  });
  app.use(
    createAiRoutesMiddleware({
      client,
      sessionTokens,
      resolveEnvironmentId,
      customerModel,
      logger,
    }),
  );

  return { app, logger };
}

function makeApp({ query = jest.fn(), ...context }: AppContext & { query?: jest.Mock } = {}) {
  return { ...buildApp({ query } as unknown as AiProxyClient, context), query };
}

function makeAppWithClient(client: AiProxyClient, context: AppContext = {}) {
  return buildApp(client, context);
}

function jsonResponse(status: number, body: unknown): AiProxyResponse {
  return { status, body, isJson: true };
}

describe('createAiRoutesMiddleware', () => {
  restoreFetchAfterEach();

  describe('when the path or method does not match', () => {
    it('should fall through without calling the upstream', async () => {
      const { app, query } = makeApp();

      await request(app.callback()).get(AI_QUERY_ROUTE).expect(404);

      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the caller authenticated with an API key', () => {
    it('should refuse with 403 oauth_required and never reach the upstream', async () => {
      const { app, query } = makeApp({ authMode: 'api-key' });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('oauth_required');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the access token carries no Forest server access', () => {
    it('should answer 401 session_expired and never reach the upstream', async () => {
      const { app, query } = makeApp({ saasAccessToken: null });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('session_expired');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the sealed Forest server access expired', () => {
    it('should answer 401 session_expired so the client refreshes', async () => {
      const expired = jsonwebtoken.sign({ scope: 'saas' }, 'irrelevant', { expiresIn: '-1s' });
      const { app, query } = makeApp({ saasAccessToken: expired });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('session_expired');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the session carries no usable rendering', () => {
    it('should answer 401 rather than send a bogus forest-rendering-id upstream', async () => {
      const { app, query } = makeApp({ renderingId: '0' });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the Forest server refuses the environment id read', () => {
    it('should answer 502 environment_unresolved and never contact the AI proxy', async () => {
      const { app, query } = makeApp({
        resolveEnvironmentId: async () => {
          throw EnvironmentFetchError.fromStatus(401, 'Unauthorized');
        },
      });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(502);
      expect(response.body.error.type).toBe('environment_unresolved');
      expect(query).not.toHaveBeenCalled();
    });

    it('should log at Error naming the environment read, not the AI query', async () => {
      const { app, logger } = makeApp({
        resolveEnvironmentId: async () => {
          throw EnvironmentFetchError.fromStatus(401, 'Unauthorized');
        },
      });

      await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(logger).toHaveBeenCalledWith(
        'Error',
        'AI query refused: the Forest environment id could not be resolved',
        { cause: 'EnvironmentFetchError: Failed to fetch environment: 401 Unauthorized' },
      );
    });
  });

  describe('when the environment id read times out', () => {
    it('should answer 504 upstream_timeout rather than a network error', async () => {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      const { app, query } = makeApp({
        resolveEnvironmentId: async () => {
          throw timeout;
        },
      });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(504);
      expect(response.body.error.type).toBe('upstream_timeout');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the session is valid', () => {
    it('should forward the session access token, not the incoming Authorization header', async () => {
      const saasAccessToken = freshAccessToken();
      const query = jest.fn().mockResolvedValue(jsonResponse(200, { choices: [] }));
      const { app } = makeApp({ query, saasAccessToken });

      await request(app.callback())
        .post(AI_QUERY_ROUTE)
        .set('Authorization', 'Bearer incoming-bff-access-token')
        .send({ messages: [] });

      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ saasAccessToken, renderingId: 42, environmentId: 7 }),
      );
    });

    it('should keep the deployment ai-name on the outgoing url whatever the caller asks for', async () => {
      const upstream = stubFetch({
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ choices: [] }),
      });
      const client = new RealAiProxyClient({
        forestServerUrl: 'https://api.forestadmin.com',
        timeoutMs: 5_000,
      });
      const { app } = makeAppWithClient(client);

      const response = await request(app.callback())
        .post(`${AI_QUERY_ROUTE}?ai-name=caller-chosen`)
        .send({ messages: [] });

      expect(response.status).toBe(200);
      expect(upstream.mock.calls[0][0]).toBe(
        'https://api.forestadmin.com/api/ai-proxy/ai-query?ai-name=zendesk',
      );
    });

    it('should relay the request body unchanged', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(200, {}));
      const { app } = makeApp({ query });
      const body = { messages: [{ role: 'user', content: 'hi' }], tools: [] };

      await request(app.callback()).post(AI_QUERY_ROUTE).send(body);

      expect(query).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    it('should relay the upstream 200 body unchanged', async () => {
      const upstream = { choices: [{ message: { content: 'answer' } }] };
      const query = jest.fn().mockResolvedValue(jsonResponse(200, upstream));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual(upstream);
    });

    it('should relay a JSON null body as null, instead of collapsing the status to 204', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(200, null));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(200);
      expect(response.text).toBe('null');
      expect(response.type).toBe('application/json');
    });

    it('should relay a bare JSON string as valid JSON, not as a raw text body', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(200, 'answer'));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(200);
      expect(response.text).toBe('"answer"');
      expect(response.type).toBe('application/json');
    });

    it('should relay a JSON 4xx with its status and body, so the upstream contract survives', async () => {
      const upstream = { errors: [{ detail: 'Missing required body parameter: messages' }] };
      const query = jest.fn().mockResolvedValue(jsonResponse(400, upstream));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({});

      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual(upstream);
    });
  });

  describe('when the upstream fails', () => {
    it('should keep a non-JSON 4xx status but replace its body, so no infrastructure HTML reaches the iframe', async () => {
      const query = jest.fn().mockResolvedValue({ status: 429, body: undefined, isJson: false });
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(429);
      expect(response.body.error.type).toBe('upstream_error');
      expect(response.type).toBe('application/json');
    });

    it('should keep a 5xx status but replace its body', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(503, { internal: 'topology' }));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('upstream_error');
      expect(JSON.stringify(response.body)).not.toContain('topology');
    });

    it('should log why an upstream body could not be parsed, instead of only that it was not json', async () => {
      const query = jest.fn().mockResolvedValue({
        status: 200,
        body: undefined,
        isJson: false,
        unparseableBodyError: new SyntaxError('Unexpected end of JSON input'),
      });
      const { app, logger } = makeApp({ query });

      await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'AI proxy upstream body withheld; client message is generic',
        {
          httpStatus: 200,
          isJson: false,
          cause: expect.stringContaining('Unexpected end of JSON input'),
        },
      );
    });

    it('should stop walking the cause chain past its depth bound', async () => {
      const deepest = new Error('level-five-must-not-appear');
      const chain = [4, 3, 2, 1].reduce<Error>(
        (cause, level) => Object.assign(new Error(`level-${level}`), { cause }),
        deepest,
      );
      const query = jest.fn().mockRejectedValue(chain);
      const { app, logger } = makeApp({ query });

      await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      const [, , context] = logger.mock.calls.find(
        ([, message]) => message === 'AI query failed against the Forest server',
      ) as [string, string, { cause: string }];

      expect(context.cause).toContain('level-4');
      expect(context.cause).not.toContain('level-five-must-not-appear');
    });

    it('should clamp an oversized upstream cause instead of logging it whole', async () => {
      const query = jest.fn().mockRejectedValue(new Error('x'.repeat(5_000)));
      const { app, logger } = makeApp({ query });

      await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      const [, , context] = logger.mock.calls.find(
        ([, message]) => message === 'AI query failed against the Forest server',
      ) as [string, string, { cause: string }];

      expect(context.cause.length).toBeLessThan(1_000);
      expect(context.cause).toContain('…');
    });

    it('should answer 504 when the upstream times out', async () => {
      const query = jest.fn().mockRejectedValue(new AiProxyTimeoutError());
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(504);
      expect(response.body.error.type).toBe('upstream_timeout');
    });

    it('should log the abort reason behind a 504, not only the bff wrapper message', async () => {
      const abort = Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      });
      const query = jest.fn().mockRejectedValue(new AiProxyTimeoutError(abort));
      const { app, logger } = makeApp({ query });

      await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(logger).toHaveBeenCalledWith('Warn', 'AI query failed against the Forest server', {
        cause: expect.stringContaining('aborted due to timeout'),
      });
    });

    it('should answer 502 when the upstream is unreachable', async () => {
      const query = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(502);
      expect(JSON.stringify(response.body)).not.toContain('10.0.0.1');
    });
  });
});

describe("createAiRoutesMiddleware with the customer's model", () => {
  const BODY = {
    messages: [
      { role: 'system', content: 'You suggest actions.' },
      { role: 'user', content: 'Ticket: refund please' },
    ],
    tools: [],
  };

  function aiMessage(content: string) {
    return { id: 'msg_1', content, tool_calls: [], invalid_tool_calls: [], additional_kwargs: {} };
  }

  function makeCustomerApp(
    invoke: jest.Mock = jest.fn().mockResolvedValue(aiMessage('{"summary":"refund"}')),
    context: AppContext = {},
    timeoutMs = 1000,
  ) {
    const query = jest.fn();
    const customerModel: CustomerModel = {
      model: { invoke } as unknown as CustomerModel['model'],
      modelName: 'claude-sonnet',
      timeoutMs,
    };

    return { ...makeApp({ query, customerModel, ...context }), invoke, query };
  }

  describe('when the model answers', () => {
    it('should answer in the OpenAI shape the Zendesk app reads', async () => {
      const { app } = makeCustomerApp();

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message).toMatchObject({
        role: 'assistant',
        content: '{"summary":"refund"}',
      });
    });

    it("should never contact Forest's AI server", async () => {
      const { app, query } = makeCustomerApp();

      await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(query).not.toHaveBeenCalled();
    });

    it('should send the system and user messages to the model, with a timeout signal', async () => {
      const { app, invoke } = makeCustomerApp();

      await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      const [messages, options] = invoke.mock.calls[0];
      expect(messages.map((m: { content: string }) => m.content)).toEqual([
        'You suggest actions.',
        'Ticket: refund please',
      ]);
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('should merge several system messages into one, which Anthropic and Bedrock require', async () => {
      const { app, invoke } = makeCustomerApp();

      await request(app.callback())
        .post(AI_QUERY_ROUTE)
        .send({
          messages: [
            { role: 'system', content: 'A' },
            { role: 'user', content: 'question' },
            { role: 'system', content: 'B' },
          ],
        });

      expect(invoke.mock.calls[0][0].map((m: { content: string }) => m.content)).toEqual([
        'A\n\nB',
        'question',
      ]);
    });
  });

  describe('when the request is not one the model path serves', () => {
    it('should refuse tools with 400, since the model is called without them', async () => {
      const { app, invoke } = makeCustomerApp();

      const response = await request(app.callback())
        .post(AI_QUERY_ROUTE)
        .send({ ...BODY, tools: [{ type: 'function', function: { name: 'x' } }] });

      expect(response.status).toBe(400);
      expect(invoke).not.toHaveBeenCalled();
    });

    it.each([
      ['no messages', {}],
      ['an empty message list', { messages: [] }],
      ['a message without content', { messages: [{ role: 'user' }] }],
      ['an unknown role', { messages: [{ role: 'tool', content: 'x' }] }],
    ])('should refuse %s with 400', async (_label, body) => {
      const { app, invoke } = makeCustomerApp();

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(body);

      expect(response.status).toBe(400);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should still require an OAuth session', async () => {
      const { app, invoke } = makeCustomerApp(undefined, { authMode: 'api-key' });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(403);
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('when the model fails', () => {
    it("should answer 500 upstream_error and never fall back to Forest's AI server", async () => {
      const { app, query } = makeCustomerApp(jest.fn().mockRejectedValue(new Error('boom')));

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(500);
      expect(response.body.error.type).toBe('upstream_error');
      expect(query).not.toHaveBeenCalled();
    });

    it('should not relay a provider 401, which the app would read as an expired Forest session', async () => {
      const providerError = Object.assign(new Error('invalid x-api-key'), { status: 401 });
      const { app } = makeCustomerApp(jest.fn().mockRejectedValue(providerError));

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(500);
    });

    it('should not name the Forest server in its message', async () => {
      const { app } = makeCustomerApp(jest.fn().mockRejectedValue(new Error('boom')));

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(JSON.stringify(response.body)).not.toMatch(/Forest/);
    });

    it('should log the failure against the AI provider with its cause', async () => {
      const { app, logger } = makeCustomerApp(jest.fn().mockRejectedValue(new Error('boom')));

      await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(logger).toHaveBeenCalledWith('Warn', 'AI query failed against the AI provider', {
        cause: 'Error: boom',
      });
    });

    // Bedrock's and OpenAI's clients reject an aborted call with an AbortError, never a TimeoutError.
    function abortedOnSignal() {
      return jest.fn(
        (_messages: unknown, { signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('Request aborted'), { name: 'AbortError' })),
            );
          }),
      );
    }

    it('should answer 504 upstream_timeout when the model is still answering after timeoutMs', async () => {
      const { app } = makeCustomerApp(abortedOnSignal(), {}, 20);

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(504);
      expect(response.body.error.type).toBe('upstream_timeout');
    });

    it('should answer 500 upstream_error for an AbortError raised before the timeout', async () => {
      const aborted = Object.assign(new Error('Request aborted'), { name: 'AbortError' });
      const { app } = makeCustomerApp(jest.fn().mockRejectedValue(aborted));

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send(BODY);

      expect(response.status).toBe(500);
      expect(response.body.error.type).toBe('upstream_error');
    });
  });
});
