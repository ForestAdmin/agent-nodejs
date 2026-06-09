import type { ZendeskClient } from '../client';
import type { CustomFieldEntry, ZendeskRecord } from '../types';
import type {
  Caller,
  DataSource,
  Filter,
  Logger,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { COLLECTION_NAMES } from '../datasource';
import BaseZendeskCollection from './base-zendesk-collection';
import { embedComments, isCommentsRequested } from './ticket/comments-embedder';
import { embedRelations, findRequestedRelations } from './ticket/relation-embedder';
import { TICKET_SORTABLE, getTicketFieldSchemas } from './ticket/schema-definition';
import { serializeTicket } from './ticket/serializer';

const READ_ONLY_INPUTS = new Set([
  'id',
  'url',
  'created_at',
  'updated_at',
  'requester_email',
  'comments',
  'requester',
  'assignee',
  'organization',
]);

function collectIds(records: ZendeskRecord[], field: string): number[] {
  const ids: number[] = [];

  for (const record of records) {
    const value = record[field];
    if (typeof value === 'number') ids.push(value);
    else if (typeof value === 'string' && !Number.isNaN(Number(value))) ids.push(Number(value));
  }

  return Array.from(new Set(ids));
}

export default class TicketCollection extends BaseZendeskCollection {
  private readonly customFields: CustomFieldEntry[];

  constructor(
    datasource: DataSource,
    client: ZendeskClient,
    customFields: CustomFieldEntry[],
    logger?: Logger,
  ) {
    super(COLLECTION_NAMES.ticket, datasource, client, 'ticket', TICKET_SORTABLE, logger);
    this.customFields = customFields;

    this.addFields(getTicketFieldSchemas());
    this.addCustomFields(customFields);
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const tickets = await this.fetchRawTickets(filter);

    const needsEmail = projection.includes('requester_email');
    const emails = needsEmail
      ? await this.client.fetchUserEmails(collectIds(tickets, 'requester_id'))
      : new Map<number, string>();

    const records = tickets.map(ticket =>
      serializeTicket(ticket, emails, this.zendeskIdToColumnName),
    );

    const relations = findRequestedRelations(projection);

    if (relations.requester || relations.assignee || relations.organization) {
      await embedRelations(records, relations, this.client);
    }

    if (isCommentsRequested(projection)) {
      await embedComments(records, this.client);
    }

    return projection.apply(records);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const created: RecordData[] = [];

    for (const item of data) {
      // eslint-disable-next-line no-await-in-loop
      const raw = await this.client.createTicket(this.buildPayload(item, { onCreate: true }));
      created.push(serializeTicket(raw, new Map(), this.zendeskIdToColumnName));
    }

    return created;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const ids = await this.resolveIds(filter);
    const payload = this.buildPayload(patch, { onCreate: false });

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.updateTicket(id, payload);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const ids = await this.resolveIds(filter);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.deleteTicket(id);
    }
  }

  protected override async aggregateCount(caller: Caller, filter: Filter): Promise<number> {
    const ids = this.extractIdLookup(filter?.conditionTree);
    if (ids) return ids.length;

    return this.client.count('ticket', this.buildZendeskQuery(filter));
  }

  // ===== Helpers =====

  private async fetchRawTickets(filter: PaginatedFilter): Promise<ZendeskRecord[]> {
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const results = await Promise.all(ids.map(id => this.client.findTicket(id)));

      return results.filter((ticket): ticket is ZendeskRecord => ticket !== null);
    }

    const { page, perPage } = this.translatePage(filter?.page);
    const { sortBy, sortOrder } = this.translateSort(filter?.sort);

    return this.client.search('ticket', {
      query: this.buildZendeskQuery(filter),
      page,
      perPage,
      sortBy,
      sortOrder,
    });
  }

  private async resolveIds(filter: Filter): Promise<number[]> {
    const direct = this.extractIdLookup(filter?.conditionTree);
    if (direct) return direct;

    const records = await this.client.search('ticket', {
      query: this.buildZendeskQuery(filter),
      perPage: 100,
    });

    return records.map(record => Number(record.id)).filter(id => Number.isFinite(id));
  }

  private buildPayload(data: RecordData, { onCreate }: { onCreate: boolean }): ZendeskRecord {
    const payload: ZendeskRecord = {};
    const customFields: Array<{ id: number; value: unknown }> = [];

    for (const [key, value] of Object.entries(data)) {
      if (READ_ONLY_INPUTS.has(key)) {
        // ignore read-only inputs
      } else if (key === 'ticket_type') {
        payload.type = value;
      } else {
        const ticketCustomField = this.customFields.find(cf => cf.columnName === key);

        if (ticketCustomField) {
          customFields.push({ id: ticketCustomField.zendeskId, value });
        } else {
          payload[key] = value;
        }
      }
    }

    if (customFields.length > 0) payload.custom_fields = customFields;

    if (onCreate && typeof data.description === 'string') {
      payload.comment = { body: data.description };
    }

    return payload;
  }
}
