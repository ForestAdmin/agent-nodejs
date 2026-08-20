import vm from 'vm';

import renderDocsPage from '../../src/docs/docs-page';
import { REDOC_THEME } from '../../src/docs/docs-theme';

const DOCUMENT_PATH = '/agent/openapi.json';
const BUNDLE_PATH = '/docs/redoc.standalone.js';
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
