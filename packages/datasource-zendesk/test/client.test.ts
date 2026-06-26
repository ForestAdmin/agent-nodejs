import nock from 'nock';

import { MAX_PER_PAGE, ZendeskHttpClient, createZendeskClient } from '../src/client';
import { ZendeskApiError, ZendeskConfigurationError } from '../src/errors';

const BASE_URL = 'https://acme.zendesk.com/api/v2';

const OPTIONS = {
  subdomain: 'acme',
  email: 'jane@acme.com',
  apiToken: 'tk_123',
};

const AUTH_HEADER =
  // base64('jane@acme.com/token:tk_123')
  `Basic ${Buffer.from('jane@acme.com/token:tk_123').toString('base64')}`;

beforeEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.restore();
});

describe('createZendeskClient', () => {
  it('throws ZendeskConfigurationError when subdomain is missing', () => {
    expect(() => createZendeskClient({ ...OPTIONS, subdomain: '' })).toThrow(
      ZendeskConfigurationError,
    );
  });

  it('throws ZendeskConfigurationError when email is missing', () => {
    expect(() => createZendeskClient({ ...OPTIONS, email: '' })).toThrow(ZendeskConfigurationError);
  });

  it('throws ZendeskConfigurationError when apiToken is missing', () => {
    expect(() => createZendeskClient({ ...OPTIONS, apiToken: '' })).toThrow(
      ZendeskConfigurationError,
    );
  });

  it('exposes the base URL derived from the subdomain', () => {
    const client = createZendeskClient(OPTIONS);

    expect(client.baseUrl).toBe(BASE_URL);
  });
});

describe('ZendeskHttpClient.search', () => {
  it('calls the search endpoint with prefixed type and returns results array', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .matchHeader('authorization', AUTH_HEADER)
      .get('/search.json')
      .query({ query: 'type:ticket status:open', per_page: 100, page: 1 })
      .reply(200, { results: [{ id: 1 }, { id: 2 }] });

    const result = await client.search('ticket', { query: 'status:open' });

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('caps perPage to MAX_PER_PAGE', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .get('/search.json')
      .query(actual => Number(actual.per_page) === MAX_PER_PAGE)
      .reply(200, { results: [] });

    await client.search('ticket', { query: '', perPage: 500 });

    expect(nock.isDone()).toBe(true);
  });

  it('forwards sortBy and sortOrder when provided', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .get('/search.json')
      .query(actual => actual.sort_by === 'created_at' && actual.sort_order === 'desc')
      .reply(200, { results: [] });

    await client.search('ticket', { query: '', sortBy: 'created_at', sortOrder: 'desc' });

    expect(nock.isDone()).toBe(true);
  });
});

describe('ZendeskHttpClient.count', () => {
  it('returns the numeric count from the search/count endpoint', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .get('/search/count.json')
      .query({ query: 'type:ticket status:open' })
      .reply(200, { count: 42 });

    expect(await client.count('ticket', 'status:open')).toBe(42);
  });

  it('returns 0 when the body has no count', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL).get('/search/count.json').query(true).reply(200, {});

    expect(await client.count('ticket', '')).toBe(0);
  });
});

describe('ZendeskHttpClient.findTicket', () => {
  it('returns the ticket payload on success', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .get('/tickets/123.json')
      .reply(200, { ticket: { id: 123, subject: 'hi' } });

    expect(await client.findTicket(123)).toEqual({ id: 123, subject: 'hi' });
  });

  it('returns null when the API responds 404', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL).get('/tickets/404.json').reply(404, { error: 'RecordNotFound' });

    expect(await client.findTicket(404)).toBeNull();
  });

  it('throws ZendeskApiError on a 500', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL).get('/tickets/1.json').reply(500, { error: 'Internal' });

    await expect(client.findTicket(1)).rejects.toThrow(ZendeskApiError);
  });
});

describe('ZendeskHttpClient.fetchTicketsByIds', () => {
  it('chunks ids by MAX_PER_PAGE and merges results', async () => {
    const client = new ZendeskHttpClient(OPTIONS);
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);

    nock(BASE_URL)
      .get('/tickets/show_many.json')
      .query(actual => {
        const list = String(actual.ids).split(',');

        return list.length === 100 && list[0] === '1';
      })
      .reply(200, {
        tickets: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, subject: 'a' })),
      });

    nock(BASE_URL)
      .get('/tickets/show_many.json')
      .query(actual => {
        const list = String(actual.ids).split(',');

        return list.length === 50 && list[0] === '101';
      })
      .reply(200, {
        tickets: Array.from({ length: 50 }, (_, i) => ({ id: 101 + i, subject: 'b' })),
      });

    const map = await client.fetchTicketsByIds(ids);

    expect(map.size).toBe(150);
    expect(map.get(1)).toEqual({ id: 1, subject: 'a' });
    expect(map.get(150)).toEqual({ id: 150, subject: 'b' });
  });

  it('returns an empty map when called with no ids', async () => {
    const client = new ZendeskHttpClient(OPTIONS);
    const map = await client.fetchTicketsByIds([]);

    expect(map.size).toBe(0);
  });
});

describe('ZendeskHttpClient.fetchUserEmails', () => {
  it('returns a map of id -> email and degrades to empty map on failure', async () => {
    const warn = jest.fn();
    const client = new ZendeskHttpClient(OPTIONS, (level, message) => warn(level, message));

    nock(BASE_URL).get('/users/show_many.json').query(true).reply(500, { error: 'Boom' });

    const map = await client.fetchUserEmails([1, 2]);

    expect(map.size).toBe(0);
    expect(warn).toHaveBeenCalledWith('Warn', expect.stringContaining('fetch_user_emails'));
  });
});

describe('ZendeskHttpClient.createTicket', () => {
  it('returns the created resource from the wrapped response', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .post('/tickets.json', { ticket: { subject: 'hi' } })
      .reply(201, { ticket: { id: 5, subject: 'hi' } });

    const result = await client.createTicket({ subject: 'hi' });

    expect(result).toEqual({ id: 5, subject: 'hi' });
  });

  it('throws ZendeskApiError when the body is missing the expected envelope', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL).post('/tickets.json').reply(201, { unexpected: true });

    await expect(client.createTicket({})).rejects.toThrow(ZendeskApiError);
  });
});

describe('ZendeskHttpClient.updateTicket', () => {
  it('PUTs the ticket envelope and returns the updated resource', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .put('/tickets/9.json', { ticket: { status: 'solved' } })
      .reply(200, { ticket: { id: 9, status: 'solved' } });

    const result = await client.updateTicket(9, { status: 'solved' });

    expect(result).toEqual({ id: 9, status: 'solved' });
  });
});

describe('ZendeskHttpClient.deleteTicket', () => {
  it('DELETEs the ticket without raising', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL).delete('/tickets/9.json').reply(204);

    await expect(client.deleteTicket(9)).resolves.toBeUndefined();
  });
});

describe('ZendeskHttpClient.fetchTicketFields', () => {
  it('returns the ticket_fields array', async () => {
    const client = new ZendeskHttpClient(OPTIONS);

    nock(BASE_URL)
      .get('/ticket_fields.json')
      .reply(200, {
        ticket_fields: [{ id: 1, type: 'text' }],
      });

    const fields = await client.fetchTicketFields();

    expect(fields).toEqual([{ id: 1, type: 'text' }]);
  });
});
