import type { AddressInfo } from 'net';

import http from 'http';

import { AIToolUnprocessableError } from '../../src/errors';
import fetchWithoutRedirect from '../../src/integrations/fetch-without-redirect';
import createExecuteQueryTool from '../../src/integrations/snowflake/tools/execute-query';
import createGetTicketTool from '../../src/integrations/zendesk/tools/get-ticket';

function listen(server: http.Server): Promise<string> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

describe('fetchWithoutRedirect', () => {
  const internalHits: string[] = [];
  const internal = http.createServer((req, res) => {
    internalHits.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ secret: 'internal' }));
  });
  let internalUrl: string;

  let redirectStatus: number;
  const redirecting = http.createServer((req, res) => {
    res.writeHead(redirectStatus, { location: `${internalUrl}/latest/meta-data/` });
    res.end();
  });
  let redirectingUrl: string;

  const plain = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ticket: { id: 1 } }));
  });
  let plainUrl: string;

  beforeAll(async () => {
    [internalUrl, redirectingUrl, plainUrl] = await Promise.all(
      [internal, redirecting, plain].map(listen),
    );
  });

  afterAll(() => {
    [internal, redirecting, plain].forEach(server => server.close());
  });

  beforeEach(() => {
    internalHits.length = 0;
  });

  it('should return the response when the host does not redirect', async () => {
    const response = await fetchWithoutRedirect(`${plainUrl}/tickets/1.json`, {});

    expect(await response.json()).toEqual({ ticket: { id: 1 } });
  });

  it.each([301, 302, 303, 307, 308])(
    'should refuse a %i redirect without requesting its target',
    async status => {
      redirectStatus = status;

      await expect(fetchWithoutRedirect(`${redirectingUrl}/tickets/1.json`, {})).rejects.toThrow(
        new AIToolUnprocessableError(
          `Refused to follow a redirect (HTTP ${status}) from ${redirectingUrl}`,
        ),
      );
      expect(internalHits).toEqual([]);
    },
  );

  it('should keep a Zendesk tool from returning what a redirect points to', async () => {
    redirectStatus = 302;
    const tool = createGetTicketTool({ Authorization: 'Basic abc' }, redirectingUrl);

    await expect(tool.invoke({ ticket_id: 1 })).rejects.toThrow(AIToolUnprocessableError);
    expect(internalHits).toEqual([]);
  });

  it('should keep a Snowflake tool from replaying its query to what a redirect points to', async () => {
    redirectStatus = 307;
    const tool = createExecuteQueryTool({ Authorization: 'Bearer abc' }, redirectingUrl, {
      accountIdentifier: 'acme',
      programmaticAccessToken: 'token',
    });

    await expect(tool.invoke({ statement: 'SELECT 1' })).rejects.toThrow(AIToolUnprocessableError);
    expect(internalHits).toEqual([]);
  });
});
