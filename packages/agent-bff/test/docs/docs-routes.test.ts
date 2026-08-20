import type { Logger } from '../../src/ports/logger-port';

import Koa from 'koa';
import path from 'path';
import request from 'supertest';

import createDocsRoutes, { DOCS_BUNDLE_PATH, DOCS_PATH } from '../../src/docs/docs-routes';
import { REDOC_THEME } from '../../src/docs/docs-theme';

const DOCUMENT_PATH = '/agent/openapi.json';

const noopLogger: Logger = () => undefined;

function buildApp(enabled: boolean, { sentinel = true }: { sentinel?: boolean } = {}): Koa {
  const app = new Koa();
  app.silent = true;
  app.use(createDocsRoutes({ enabled, documentPath: DOCUMENT_PATH, logger: noopLogger }));

  // Terminal sentinel: only reached when the middleware passes the request through via next().
  if (sentinel) {
    app.use(async ctx => {
      ctx.status = 418;
      ctx.body = { passthrough: true };
    });
  }

  return app;
}

describe('docs routes', () => {
  describe('when the viewer page is requested without credentials', () => {
    it('should serve it, since a browser sends no header when it navigates', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect({ status: response.status, type: response.type }).toEqual({
        status: 200,
        type: 'text/html',
      });
    });

    it('should carry no schema, so a public page cannot leak the gated document', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).not.toMatch(/"paths"|"components"|"openapi"/);
    });

    it('should point the reader at the gated document and ask for a key', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).toContain(JSON.stringify(DOCUMENT_PATH));
      expect(response.text).toContain('X-Forest-Bff-Key');
    });

    it('should carry no form, since a default submit would put the key in the URL', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).not.toContain('<form');
    });

    it('should request nothing off-origin, since a page holding a key must not talk to a CDN', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).not.toMatch(/https?:\/\/|\/\/fonts\./);
    });

    it('should carry the Forest theme, so the viewer is not stock Redoc', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).toContain(JSON.stringify(REDOC_THEME.sidebar.activeTextColor));
      expect(response.text).toContain(REDOC_THEME.typography.fontFamily);
    });

    it('should carry its favicon inline, since an icon file would be a request off this page', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.text).toContain('rel="icon" href="data:image/svg+xml,');
    });

    it('should never be cached, since the page is the entry point to a credential prompt', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_PATH);

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('when the viewer bundle is requested without credentials', () => {
    it('should serve it as a script, since the page cannot render without it', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_BUNDLE_PATH);

      expect({ status: response.status, type: response.type }).toEqual({
        status: 200,
        type: 'application/javascript',
      });
    });

    it('should serve the Redoc bundle itself', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_BUNDLE_PATH);

      expect(response.text).toContain('Redoc');
    });

    it('should be cacheable, since it is a versioned third-party asset and not a credential path', async () => {
      const response = await request(buildApp(true).callback()).get(DOCS_BUNDLE_PATH);

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });
  });

  describe('when the bundle resolved at boot but cannot be read', () => {
    function buildUnreadableBundleApp(logs: string[]): Koa {
      const app = new Koa();
      app.silent = true;
      app.use(
        createDocsRoutes({
          enabled: true,
          documentPath: DOCUMENT_PATH,
          logger: (_level, message) => logs.push(message),
          resolveBundlePath: () => path.join(__dirname, 'no-such-bundle.js'),
        }),
      );
      app.use(async ctx => {
        ctx.status = 418;
      });

      return app;
    }

    it('should fall through rather than answer a bare 500, since no error middleware covers it', async () => {
      const response = await request(buildUnreadableBundleApp([]).callback()).get(DOCS_BUNDLE_PATH);

      expect(response.status).toBe(418);
    });

    it('should say which file it could not read', async () => {
      const logs: string[] = [];

      await request(buildUnreadableBundleApp(logs).callback()).get(DOCS_BUNDLE_PATH);

      expect(logs).toEqual([
        `API documentation bundle unreadable: ${path.join(__dirname, 'no-such-bundle.js')}`,
      ]);
    });
  });

  describe('when the OpenAPI document is disabled', () => {
    it('should fall through rather than throw, since no error middleware covers these routes', async () => {
      const app = buildApp(false).callback();
      const page = await request(app).get(DOCS_PATH);
      const bundle = await request(app).get(DOCS_BUNDLE_PATH);

      expect([page.status, bundle.status]).toEqual([418, 418]);
    });

    it('should leave both routes answering 404, so nothing advertises a page it does not serve', async () => {
      const app = buildApp(false, { sentinel: false }).callback();
      const page = await request(app).get(DOCS_PATH);
      const bundle = await request(app).get(DOCS_BUNDLE_PATH);

      expect([page.status, bundle.status]).toEqual([404, 404]);
    });
  });

  describe('when the install has no Redoc bundle', () => {
    function buildBundlelessApp(logger: Logger): Koa {
      const app = new Koa();
      app.silent = true;
      app.use(
        createDocsRoutes({
          enabled: true,
          documentPath: DOCUMENT_PATH,
          logger,
          resolveBundlePath: () => undefined,
        }),
      );

      return app;
    }

    it('should serve neither route, since a page without its viewer renders nothing', async () => {
      const app = buildBundlelessApp(noopLogger).callback();
      const page = await request(app).get(DOCS_PATH);
      const bundle = await request(app).get(DOCS_BUNDLE_PATH);

      expect([page.status, bundle.status]).toEqual([404, 404]);
    });

    it('should say why at boot, since a silent 404 looks like a disabled flag', async () => {
      const logs: string[] = [];

      buildBundlelessApp((_level, message) => {
        logs.push(message);
      });

      expect(logs).toEqual([
        'API documentation page disabled: redoc.standalone.js is missing from this install',
      ]);
    });
  });

  describe('when the path or the method is not the viewer', () => {
    it('should pass a non-docs path through', async () => {
      const response = await request(buildApp(true).callback()).get('/health');

      expect(response.status).toBe(418);
    });

    it('should pass a write on the viewer path through, since it only serves reads', async () => {
      const response = await request(buildApp(true).callback()).post(DOCS_PATH);

      expect(response.status).toBe(418);
    });
  });
});
