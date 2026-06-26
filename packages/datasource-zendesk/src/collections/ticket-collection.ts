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
    const ids = this.extractIdLookup(filter?.conditionTree);
    const tickets = ids ? await this.fetchRecordsByIds(ids) : await this.searchRecords(filter);

    const needsEmail =
      projection.includes('requester_email') ||
      (ids !== null && this.filtersOnRequesterEmail(filter));
    const emails = needsEmail
      ? await this.client.fetchUserEmails(collectIds(tickets, 'requester_id'))
      : new Map<number, string>();

    let records = tickets.map(ticket =>
      serializeTicket(ticket, emails, this.zendeskIdToColumnName),
    );

    // The id-lookup path bypassed Zendesk Search, so honor the filter, sort and pagination here.
    if (ids) records = this.refine(records, filter, caller.timezone);

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
    const ids = await this.resolveIds(filter, caller.timezone);
    const payload = this.buildPayload(patch, { onCreate: false });

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.updateTicket(id, payload);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const ids = await this.resolveIds(filter, caller.timezone);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.deleteTicket(id);
    }
  }

  protected override findOne(id: number | string): Promise<ZendeskRecord | null> {
    return this.client.findTicket(id);
  }

  protected override serializeRecord(record: ZendeskRecord): RecordData {
    return serializeTicket(record, new Map(), this.zendeskIdToColumnName);
  }

  // Resolve requester_email so scope/segment conditions on it are honored when filtering in memory.
  protected override async serializeForFilter(records: ZendeskRecord[]): Promise<RecordData[]> {
    const emails = await this.client.fetchUserEmails(collectIds(records, 'requester_id'));

    return records.map(record => serializeTicket(record, emails, this.zendeskIdToColumnName));
  }

  // ===== Helpers =====

  private filtersOnRequesterEmail(filter: PaginatedFilter | undefined): boolean {
    return filter?.conditionTree?.someLeaf(leaf => leaf.field === 'requester_email') ?? false;
  }

  private buildPayload(data: RecordData, { onCreate }: { onCreate: boolean }): ZendeskRecord {
    const payload: ZendeskRecord = {};
    const customFields: Array<{ id: number; value: unknown }> = [];

    for (const [key, value] of Object.entries(data)) {
      if (READ_ONLY_INPUTS.has(key)) {
        // ignore read-only inputs
      } else if (key === 'description') {
        // Zendesk derives `description` from the first comment; it can only be set at creation.
        if (onCreate) {
          payload.description = value;
        } else {
          this.logger?.(
            'Warn',
            `[datasource-zendesk] 'description' cannot be edited after creation; ignoring it.`,
          );
        }
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
