import vm from 'vm';

import renderDocsPage from '../../src/docs/docs-page';
import { REDOC_THEME } from '../../src/docs/docs-theme';

const DOCUMENT_PATH = '/agent/openapi.json';
const BUNDLE_PATH = '/docs/redoc.standalone.js';
const ORIGIN = 'https://bff.example.com';
const ELEMENT_IDS = ['unlock', 'key', 'load', 'error', 'redoc'];

interface FakeElement {
  style: Record<string, string>;
  value: string;
  textContent: string;
  attributes: Record<string, string>;
  listeners: Record<string, ((event?: unknown) => void)[]>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, handler: (event?: unknown) => void): void;
}

interface PendingResponse {
  resolve(response: { ok: boolean; status: number; body: unknown }): void;
  resolveText(response: { ok: boolean; status: number; text: string }): void;
  reject(error: Error): void;
}

function createElement(): FakeElement {
  return {
    style: {},
    value: '',
    textContent: '',
    attributes: {},
    listeners: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    addEventListener(type, handler) {
      this.listeners[type] = [...(this.listeners[type] ?? []), handler];
    },
  };
}

function extractInlineScript(html: string): string {
  return html.split('<script>')[1].split('</script>')[0];
}

function runPage() {
  const elements = new Map(ELEMENT_IDS.map(id => [id, createElement()]));
  const pending: PendingResponse[] = [];
  const redocInit = jest.fn();

  const sandbox = {
    JSON,
    Promise,
    Object,
    Error,
    window: { location: { origin: ORIGIN } },
    document: { getElementById: (id: string) => elements.get(id) ?? null },
    Redoc: { init: redocInit },
    fetch: () =>
      new Promise((resolveFetch, rejectFetch) => {
        pending.push({
          resolve({ ok, status, body }) {
            resolveFetch({ ok, status, text: () => Promise.resolve(JSON.stringify(body)) });
          },
          resolveText({ ok, status, text }) {
            resolveFetch({ ok, status, text: () => Promise.resolve(text) });
          },
          reject: rejectFetch,
        });
      }),
  };

  vm.createContext(sandbox);
  vm.runInContext(extractInlineScript(renderDocsPage(DOCUMENT_PATH, BUNDLE_PATH)), sandbox);

  const errorBox = elements.get('error') as FakeElement;

  return {
    redocInit,
    pending,
    errorShown: () => errorBox.attributes['data-shown'] !== undefined,
    errorText: () => errorBox.textContent,
    promptHidden: () => (elements.get('unlock') as FakeElement).style.display === 'none',
    submit(key: string) {
      const input = elements.get('key') as FakeElement;
      input.value = key;
      (elements.get('load') as FakeElement).listeners.click[0]();
    },
    // setImmediate, not nextTick: the fetch chain is three promise hops deep, and the nextTick queue
    // runs BEFORE the microtask queue, so a single tick can resolve while continuations are pending.
    flush: () =>
      new Promise(resolve => {
        setImmediate(resolve);
      }),
  };
}

const API_KEY_SPEC = {
  components: {
    securitySchemes: {
      bffApiKey: { type: 'apiKey', in: 'header', name: 'X-Forest-Bff-Key' },
      bffSession: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      ListRequest_orders: { type: 'object', properties: { page: { type: 'object' } } },
      RelationListRequest: {
        allOf: [
          { $ref: '#/components/schemas/ListRequest_orders' },
          {
            type: 'object',
            properties: { parentId: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
            required: ['parentId'],
          },
        ],
      },
      ActionRequest: {
        type: 'object',
        properties: {
          recordIds: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
          values: { type: 'object' },
        },
        required: ['recordIds'],
      },
    },
  },
  paths: {
    '/agent/v1/My%20Coll/list': {
      post: {
        security: [{ bffApiKey: [] }],
        responses: { 200: {} },
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ListRequest_orders' } },
          },
        },
      },
    },
    '/agent/v1/My%20Coll/relations/orders/list': {
      post: {
        security: [{ bffApiKey: [] }],
        responses: { 200: {} },
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RelationListRequest' } },
          },
        },
      },
    },
    '/agent/v1/My%20Coll/actions/Mark%2Fdone/execute': {
      post: {
        security: [{ bffSession: [] }],
        responses: { 200: {} },
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ActionRequest' } },
          },
        },
      },
    },
  },
};

describe('docs page script', () => {
  describe('when a submission is abandoned for another one', () => {
    it('should ignore the abandoned error, since it did not come from the key on screen', async () => {
      const page = runPage();

      page.submit('mistyped-key');
      page.submit('good-key');

      page.pending[1].resolve({ ok: true, status: 200, body: { openapi: '3.1.0' } });
      await page.flush();

      page.pending[0].resolve({
        ok: false,
        status: 401,
        body: { error: { type: 'unauthorized', message: 'no' } },
      });
      await page.flush();

      expect({ shown: page.errorShown(), renders: page.redocInit.mock.calls.length }).toEqual({
        shown: false,
        renders: 1,
      });
    });

    it('should render the document of the last submission, whatever order the answers arrive in', async () => {
      const page = runPage();

      page.submit('first-key');
      page.submit('second-key');

      page.pending[1].resolve({ ok: true, status: 200, body: { info: { title: 'second' } } });
      await page.flush();

      page.pending[0].resolve({ ok: true, status: 200, body: { info: { title: 'first' } } });
      await page.flush();

      expect(page.redocInit).toHaveBeenCalledTimes(1);
      expect(page.redocInit.mock.calls[0][0]).toEqual({ info: { title: 'second' } });
    });

    it('should ignore an abandoned network failure, since the current attempt may still succeed', async () => {
      const page = runPage();

      page.submit('first-key');
      page.submit('second-key');

      page.pending[0].reject(new Error('connection reset'));
      await page.flush();

      expect(page.errorShown()).toBe(false);

      page.pending[1].resolve({ ok: true, status: 200, body: { openapi: '3.1.0' } });
      await page.flush();

      expect(page.redocInit).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a single submission answers', () => {
    it('should hand the document to Redoc with the theme and an untrusted spec', async () => {
      const page = runPage();

      page.submit('good-key');
      page.pending[0].resolve({ ok: true, status: 200, body: { openapi: '3.1.0' } });
      await page.flush();

      expect(page.redocInit).toHaveBeenCalledWith(
        { openapi: '3.1.0' },
        { hideDownloadButton: true, untrustedSpec: true, theme: REDOC_THEME },
        expect.anything(),
      );
      expect(page.promptHidden()).toBe(true);
    });

    it('should report the BFF error type rather than a generic failure', async () => {
      const page = runPage();

      page.submit('revoked-key');
      page.pending[0].resolve({
        ok: false,
        status: 401,
        body: { error: { type: 'unauthorized', message: 'Key revoked' } },
      });
      await page.flush();

      expect(page.errorText()).toBe('The BFF answered 401 unauthorized: Key revoked');
      expect(page.redocInit).not.toHaveBeenCalled();
    });

    it('should refuse an unparsable body, since a 200 that is not JSON is not a document', async () => {
      const page = runPage();

      page.submit('good-key');
      page.pending[0].resolveText({ ok: true, status: 200, text: '<html>gateway</html>' });
      await page.flush();

      expect(page.redocInit).not.toHaveBeenCalled();
      expect(page.errorText()).toBe(
        'The BFF answered 200 unreadable_response: <html>gateway</html>',
      );
    });

    it('should keep the prompt on screen when the key is empty, since nothing was sent', () => {
      const page = runPage();

      page.submit('   ');

      expect({ shown: page.errorShown(), requests: page.pending.length }).toEqual({
        shown: true,
        requests: 0,
      });
    });
  });
});

describe('the code samples the docs page injects', () => {
  async function render(spec: unknown, key = 'the-secret-key') {
    const page = runPage();

    page.submit(key);
    page.pending[0].resolve({ ok: true, status: 200, body: spec });
    await page.flush();

    const rendered = page.redocInit.mock.calls[0]?.[0] as {
      paths: Record<string, { post: { 'x-codeSamples'?: { lang: string; source: string }[] } }>;
    };

    return {
      rendered,
      samplesOf: (path: string) => rendered.paths[path].post['x-codeSamples'] ?? [],
      sourceOf: (path: string, lang: string) =>
        (rendered.paths[path].post['x-codeSamples'] ?? []).find(sample => sample.lang === lang)
          ?.source ?? '',
      allSources: () =>
        Object.values(rendered.paths).flatMap(item =>
          (item.post['x-codeSamples'] ?? []).map(sample => sample.source),
        ),
    };
  }

  const LIST = '/agent/v1/My%20Coll/list';
  const RELATION = '/agent/v1/My%20Coll/relations/orders/list';
  const ACTION = '/agent/v1/My%20Coll/actions/Mark%2Fdone/execute';

  it('should offer the three languages on every operation', async () => {
    const page = await render(API_KEY_SPEC);

    [LIST, RELATION, ACTION].forEach(path => {
      expect(page.samplesOf(path).map(sample => sample.lang)).toEqual([
        'cURL',
        'JavaScript',
        'Ruby',
      ]);
    });
  });

  it('should build a curl command on the real origin, keeping the path encoded as served', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(RELATION, 'cURL')).toBe(
      [
        `curl -X POST '${ORIGIN}/agent/v1/My%20Coll/relations/orders/list' \\`,
        "  -H 'X-Forest-Bff-Key: $BFF_KEY' \\",
        "  -H 'X-Forest-Timezone: UTC' \\",
        "  -H 'Content-Type: application/json' \\",
        `  -d '{"parentId":"<parentId>"}'`,
      ].join('\n'),
    );
  });

  it('should send only what the request schema requires, flattening the relation allOf', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(LIST, 'cURL')).toContain(`-d '{}'`);
    expect(page.sourceOf(RELATION, 'cURL')).toContain(`-d '{"parentId":"<parentId>"}'`);
    expect(page.sourceOf(ACTION, 'cURL')).toContain(`-d '{"recordIds":["<recordIds>"]}'`);
  });

  it('should carry the timezone header, which the BFF answers 400 without', async () => {
    const page = await render(API_KEY_SPEC);

    page.allSources().forEach(source => expect(source).toContain('X-Forest-Timezone'));
  });

  it('should take the auth header from the scheme the operation names', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(ACTION, 'cURL')).toContain("-H 'Authorization: Bearer $BFF_KEY'");
    expect(page.sourceOf(ACTION, 'cURL')).not.toContain('X-Forest-Bff-Key');
  });

  it('should read the key from the environment in node, not inline it', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(RELATION, 'JavaScript')).toBe(
      [
        `const response = await fetch('${ORIGIN}/agent/v1/My%20Coll/relations/orders/list', {`,
        "  method: 'POST',",
        '  headers: {',
        "    'X-Forest-Bff-Key': process.env.BFF_KEY,",
        "    'X-Forest-Timezone': 'UTC',",
        "    'Content-Type': 'application/json',",
        '  },',
        '  body: JSON.stringify({"parentId":"<parentId>"}),',
        '});',
        '',
        "if (!response.ok) throw new Error(response.status + ' ' + (await response.text()));",
        '',
        'console.log(await response.json());',
      ].join('\n'),
    );
  });

  it('should read the key from the environment in ruby, interpolating a bearer prefix', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(RELATION, 'Ruby')).toContain(
      "request['X-Forest-Bff-Key'] = ENV.fetch('BFF_KEY')",
    );
    expect(page.sourceOf(ACTION, 'Ruby')).toContain(
      `request['Authorization'] = "Bearer #{ENV.fetch('BFF_KEY')}"`,
    );
    expect(page.sourceOf(RELATION, 'Ruby')).toContain('request = Net::HTTP::Post.new(uri)');
  });

  it('should never carry the key the reader typed, whatever the language', async () => {
    const page = await render(API_KEY_SPEC, 'fbff_deadbeef_cafe');

    page.allSources().forEach(source => expect(source).not.toContain('fbff_deadbeef_cafe'));
  });

  it('should still render a document whose schema references itself', async () => {
    const page = await render({
      components: {
        schemas: {
          Loop: {
            type: 'object',
            properties: { self: { $ref: '#/components/schemas/Loop' } },
            required: ['self'],
          },
        },
      },
      paths: {
        '/agent/v1/loop/list': {
          post: {
            responses: { 200: {} },
            requestBody: {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Loop' } } },
            },
          },
        },
      },
    });

    expect(page.rendered.paths['/agent/v1/loop/list'].post['x-codeSamples']).toHaveLength(3);
  });

  it('should replace a path template with the placeholder notation the bodies use', async () => {
    const page = await render({
      components: {
        parameters: {
          Collection: {
            name: 'collection',
            in: 'path',
            schema: { type: 'string' },
          },
        },
      },
      paths: {
        '/agent/v1/{collection}/actions/{action}/execute': {
          post: {
            responses: { 200: {} },
            parameters: [
              { $ref: '#/components/parameters/Collection' },
              { name: 'action', in: 'path', schema: { type: 'string' } },
              { name: 'X-Forest-Timezone', in: 'header', schema: { type: 'string' } },
            ],
          },
        },
      },
    });

    const curl = page.sourceOf('/agent/v1/{collection}/actions/{action}/execute', 'cURL');

    expect(curl).toContain(`'${ORIGIN}/agent/v1/<collection>/actions/<action>/execute'`);
    expect(curl).not.toContain('{collection}');
  });

  it('should leave an unfolded path alone, since its segments are already the real names', async () => {
    const page = await render(API_KEY_SPEC);

    expect(page.sourceOf(LIST, 'cURL')).toContain(`'${ORIGIN}/agent/v1/My%20Coll/list'`);
  });

  it('should leave a document with no path untouched rather than fail to render', async () => {
    const page = await render({ openapi: '3.1.0' });

    expect(page.rendered).toEqual({ openapi: '3.1.0' });
  });
});
