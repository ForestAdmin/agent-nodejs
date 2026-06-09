import type {
  CustomFieldEntry,
  SearchParams,
  ZendeskClientOptions,
  ZendeskRecord,
  ZendeskResource,
} from '../types';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { SuperAgentRequest } from 'superagent';

import superagent from 'superagent';

import { ZendeskApiError, ZendeskConfigurationError } from '../errors';

export const MAX_PER_PAGE = 100;
export const MAX_TOTAL_RESULTS = 1000;

const RESOURCE_PLURAL: Record<ZendeskResource, string> = {
  ticket: 'tickets',
  user: 'users',
  organization: 'organizations',
};

export type RawCustomFieldDefinition = {
  id: number;
  key?: string;
  title?: string;
  raw_title?: string;
  type: string;
  active?: boolean;
  removable?: boolean;
  custom_field_options?: Array<{ value: string; name?: string }>;
};

export type ZendeskClient = {
  search(type: ZendeskResource, params: SearchParams): Promise<ZendeskRecord[]>;
  count(type: ZendeskResource, query: string): Promise<number>;
  findTicket(id: number | string): Promise<ZendeskRecord | null>;
  findUser(id: number | string): Promise<ZendeskRecord | null>;
  findOrganization(id: number | string): Promise<ZendeskRecord | null>;
  fetchTicketsByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>>;
  fetchUsersByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>>;
  fetchOrganizationsByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>>;
  fetchUserEmails(ids: Array<number | string>): Promise<Map<number, string>>;
  fetchTicketComments(ticketId: number | string): Promise<ZendeskRecord[]>;
  fetchTicketFields(): Promise<RawCustomFieldDefinition[]>;
  fetchUserFields(): Promise<RawCustomFieldDefinition[]>;
  fetchOrganizationFields(): Promise<RawCustomFieldDefinition[]>;
  createTicket(attrs: ZendeskRecord): Promise<ZendeskRecord>;
  updateTicket(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord>;
  deleteTicket(id: number | string): Promise<void>;
  createUser(attrs: ZendeskRecord): Promise<ZendeskRecord>;
  updateUser(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord>;
  deleteUser(id: number | string): Promise<void>;
  createOrganization(attrs: ZendeskRecord): Promise<ZendeskRecord>;
  updateOrganization(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord>;
  deleteOrganization(id: number | string): Promise<void>;
  readonly baseUrl: string;
  /**
   * Best-effort wrapper that logs and returns the default if the action throws.
   * Used internally and exposed so embedders/plugins can degrade gracefully.
   */
  bestEffort<T>(operation: string, defaultValue: T, fn: () => Promise<T>): Promise<T>;
};

function composeQuery(type: ZendeskResource | null, query: string): string {
  const parts = [type ? `type:${type}` : null, (query ?? '').trim()].filter(Boolean) as string[];

  return parts.join(' ').trim();
}

function extractResource(
  body: ZendeskRecord,
  key: ZendeskResource,
  operation: string,
): ZendeskRecord {
  const resource = body[key];

  if (resource && typeof resource === 'object' && !Array.isArray(resource)) {
    return resource as ZendeskRecord;
  }

  throw new ZendeskApiError(
    operation,
    undefined,
    body,
    new Error(`Zendesk API returned an unexpected body shape (missing '${key}')`),
  );
}

function validate(options: ZendeskClientOptions): void {
  const missing: string[] = [];

  if (!options?.subdomain?.trim()) missing.push('subdomain');
  if (!options?.email?.trim()) missing.push('email');
  if (!options?.apiToken?.trim()) missing.push('apiToken');

  if (missing.length > 0) {
    throw new ZendeskConfigurationError(
      `Zendesk client is missing required configuration: ${missing.join(', ')}`,
    );
  }
}

export class ZendeskHttpClient implements ZendeskClient {
  readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly logger?: Logger;

  constructor(options: ZendeskClientOptions, logger?: Logger) {
    validate(options);
    this.baseUrl = `https://${options.subdomain}.zendesk.com/api/v2`;
    const credentials = Buffer.from(`${options.email}/token:${options.apiToken}`).toString(
      'base64',
    );
    this.authHeader = `Basic ${credentials}`;
    this.logger = logger;
  }

  async search(type: ZendeskResource, params: SearchParams): Promise<ZendeskRecord[]> {
    const query = composeQuery(type, params.query);
    const perPage = Math.min(params.perPage ?? MAX_PER_PAGE, MAX_PER_PAGE);

    return this.mustSucceed(`search(${type})`, async () => {
      const queryParams: Record<string, string | number> = {
        query,
        per_page: perPage,
        page: params.page ?? 1,
      };

      if (params.sortBy) queryParams.sort_by = params.sortBy;
      if (params.sortOrder) queryParams.sort_order = params.sortOrder;

      const body = await this.get('/search.json', queryParams);

      return Array.isArray(body.results) ? (body.results as ZendeskRecord[]) : [];
    });
  }

  async count(type: ZendeskResource, query: string): Promise<number> {
    return this.mustSucceed(`count(${type})`, async () => {
      const body = await this.get('/search/count.json', { query: composeQuery(type, query) });

      return typeof body.count === 'number' ? body.count : 0;
    });
  }

  findTicket(id: number | string): Promise<ZendeskRecord | null> {
    return this.findOne('ticket', id);
  }

  findUser(id: number | string): Promise<ZendeskRecord | null> {
    return this.findOne('user', id);
  }

  findOrganization(id: number | string): Promise<ZendeskRecord | null> {
    return this.findOne('organization', id);
  }

  fetchTicketsByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>> {
    return this.showMany('ticket', ids, (r: ZendeskRecord) => [Number(r.id), r]);
  }

  fetchUsersByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>> {
    return this.bestEffort('fetch_users_by_ids', new Map(), () =>
      this.showMany('user', ids, r => [Number(r.id), r]),
    );
  }

  fetchOrganizationsByIds(ids: Array<number | string>): Promise<Map<number, ZendeskRecord>> {
    return this.bestEffort('fetch_organizations_by_ids', new Map(), () =>
      this.showMany('organization', ids, r => [Number(r.id), r]),
    );
  }

  fetchUserEmails(ids: Array<number | string>): Promise<Map<number, string>> {
    return this.bestEffort('fetch_user_emails', new Map(), () =>
      this.showMany<string>('user', ids, r => [Number(r.id), String(r.email ?? '')]),
    );
  }

  async fetchTicketComments(ticketId: number | string): Promise<ZendeskRecord[]> {
    return this.mustSucceed(`fetch_ticket_comments(${ticketId})`, async () => {
      const body = await this.get(`/tickets/${encodeURIComponent(String(ticketId))}/comments.json`);

      return Array.isArray(body.comments) ? (body.comments as ZendeskRecord[]) : [];
    });
  }

  fetchTicketFields(): Promise<RawCustomFieldDefinition[]> {
    return this.fetchFields('ticket_fields');
  }

  fetchUserFields(): Promise<RawCustomFieldDefinition[]> {
    return this.fetchFields('user_fields');
  }

  fetchOrganizationFields(): Promise<RawCustomFieldDefinition[]> {
    return this.fetchFields('organization_fields');
  }

  createTicket(attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.createOne('ticket', attrs);
  }

  updateTicket(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.updateOne('ticket', id, attrs);
  }

  deleteTicket(id: number | string): Promise<void> {
    return this.deleteOne('ticket', id);
  }

  createUser(attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.createOne('user', attrs);
  }

  updateUser(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.updateOne('user', id, attrs);
  }

  deleteUser(id: number | string): Promise<void> {
    return this.deleteOne('user', id);
  }

  createOrganization(attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.createOne('organization', attrs);
  }

  updateOrganization(id: number | string, attrs: ZendeskRecord): Promise<ZendeskRecord> {
    return this.updateOne('organization', id, attrs);
  }

  deleteOrganization(id: number | string): Promise<void> {
    return this.deleteOne('organization', id);
  }

  async bestEffort<T>(operation: string, defaultValue: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger?.(
        'Warn',
        `[datasource-zendesk] ${operation} failed; degrading: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      return defaultValue;
    }
  }

  // ===== Internal helpers =====

  private async findOne(type: ZendeskResource, id: number | string): Promise<ZendeskRecord | null> {
    const plural = RESOURCE_PLURAL[type];
    const path = `/${plural}/${encodeURIComponent(String(id))}.json`;

    try {
      const body = await this.mustSucceed(`find(${plural}/${id})`, () => this.get(path));

      return (body[type] as ZendeskRecord) ?? null;
    } catch (err) {
      if (err instanceof ZendeskApiError && err.status === 404) return null;
      throw err;
    }
  }

  private async showMany<TValue>(
    type: ZendeskResource,
    ids: Array<number | string>,
    project: (record: ZendeskRecord) => [number, TValue],
  ): Promise<Map<number, TValue>> {
    const plural = RESOURCE_PLURAL[type];
    const uniqueIds = Array.from(new Set(ids.filter(id => id !== null && id !== undefined)));
    const result = new Map<number, TValue>();

    if (uniqueIds.length === 0) return result;

    for (let i = 0; i < uniqueIds.length; i += MAX_PER_PAGE) {
      const chunk = uniqueIds.slice(i, i + MAX_PER_PAGE);
      // eslint-disable-next-line no-await-in-loop
      const body = await this.mustSucceed(`fetch_${plural}_by_ids`, () =>
        this.get(`/${plural}/show_many.json`, { ids: chunk.join(',') }),
      );
      const records = Array.isArray(body[plural]) ? (body[plural] as ZendeskRecord[]) : [];

      for (const record of records) {
        const [key, value] = project(record);
        result.set(key, value);
      }
    }

    return result;
  }

  private async fetchFields(path: 'ticket_fields' | 'user_fields' | 'organization_fields') {
    return this.mustSucceed(`fetch_${path}`, async () => {
      const body = await this.get(`/${path}.json`);

      return Array.isArray(body[path]) ? (body[path] as RawCustomFieldDefinition[]) : [];
    });
  }

  private async createOne(type: ZendeskResource, attrs: ZendeskRecord): Promise<ZendeskRecord> {
    const plural = RESOURCE_PLURAL[type];

    return this.mustSucceed(`create(${plural})`, async () => {
      const body = await this.post(`/${plural}.json`, { [type]: attrs });

      return extractResource(body, type, `create(${plural})`);
    });
  }

  private async updateOne(
    type: ZendeskResource,
    id: number | string,
    attrs: ZendeskRecord,
  ): Promise<ZendeskRecord> {
    const plural = RESOURCE_PLURAL[type];

    return this.mustSucceed(`update(${plural}/${id})`, async () => {
      const body = await this.put(`/${plural}/${encodeURIComponent(String(id))}.json`, {
        [type]: attrs,
      });

      return extractResource(body, type, `update(${plural}/${id})`);
    });
  }

  private async deleteOne(type: ZendeskResource, id: number | string): Promise<void> {
    const plural = RESOURCE_PLURAL[type];

    await this.mustSucceed(`delete(${plural}/${id})`, async () => {
      await this.delete(`/${plural}/${encodeURIComponent(String(id))}.json`);

      return null;
    });
  }

  private async mustSucceed<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ZendeskApiError) throw err;
      const status = (err as { status?: number })?.status;
      const body = (err as { response?: { body?: unknown } })?.response?.body;
      throw new ZendeskApiError(operation, status, body, err as Error);
    }
  }

  private get(path: string, query?: Record<string, string | number>): Promise<ZendeskRecord> {
    const request = superagent.get(`${this.baseUrl}${path}`);
    if (query) request.query(query);

    return this.send(request);
  }

  private post(path: string, body: unknown): Promise<ZendeskRecord> {
    return this.send(superagent.post(`${this.baseUrl}${path}`).send(body as object));
  }

  private put(path: string, body: unknown): Promise<ZendeskRecord> {
    return this.send(superagent.put(`${this.baseUrl}${path}`).send(body as object));
  }

  private delete(path: string): Promise<ZendeskRecord> {
    return this.send(superagent.delete(`${this.baseUrl}${path}`));
  }

  private async send(request: SuperAgentRequest): Promise<ZendeskRecord> {
    const response = await request
      .set('Authorization', this.authHeader)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json');

    return (response.body ?? {}) as ZendeskRecord;
  }
}

export function createZendeskClient(options: ZendeskClientOptions, logger?: Logger): ZendeskClient {
  return new ZendeskHttpClient(options, logger);
}

// Re-export the type so consumers can import { CustomFieldEntry } from this module if desired.
export type { CustomFieldEntry };
