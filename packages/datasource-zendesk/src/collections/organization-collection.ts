import type { ZendeskClient } from '../client';
import type { CustomFieldEntry, ZendeskRecord } from '../types';
import type {
  Caller,
  DataSource,
  FieldSchema,
  Filter,
  Logger,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { COLLECTION_NAMES } from '../datasource';
import { DATE_OPS, NUMBER_OPS, STRING_OPS } from './base-zendesk-collection';
import SearchableCollection from './searchable-collection';
import { serializeOrganization } from './ticket/serializer';

const SORTABLE: Record<string, string> = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  name: 'name',
};

const READ_ONLY_INPUTS = new Set(['id', 'created_at', 'updated_at']);

function getOrganizationFieldSchemas(): Record<string, FieldSchema> {
  return {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
      isReadOnly: true,
      filterOperators: new Set(NUMBER_OPS),
    },
    name: {
      type: 'Column',
      columnType: 'String',
      isSortable: true,
      filterOperators: new Set(STRING_OPS),
    },
    domain_names: {
      type: 'Column',
      columnType: ['String'],
      filterOperators: new Set(),
    },
    details: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(),
    },
    notes: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(),
    },
    group_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    shared_tickets: {
      type: 'Column',
      columnType: 'Boolean',
      filterOperators: new Set(),
    },
    created_at: {
      type: 'Column',
      columnType: 'Date',
      isReadOnly: true,
      isSortable: true,
      filterOperators: new Set(DATE_OPS),
    },
    updated_at: {
      type: 'Column',
      columnType: 'Date',
      isReadOnly: true,
      isSortable: true,
      filterOperators: new Set(DATE_OPS),
    },
    users: {
      type: 'OneToMany',
      foreignCollection: COLLECTION_NAMES.user,
      originKey: 'organization_id',
      originKeyTarget: 'id',
    },
    tickets: {
      type: 'OneToMany',
      foreignCollection: COLLECTION_NAMES.ticket,
      originKey: 'organization_id',
      originKeyTarget: 'id',
    },
  };
}

export default class OrganizationCollection extends SearchableCollection {
  private readonly customFields: CustomFieldEntry[];

  constructor(
    datasource: DataSource,
    client: ZendeskClient,
    customFields: CustomFieldEntry[],
    logger?: Logger,
  ) {
    super(COLLECTION_NAMES.organization, datasource, client, 'organization', SORTABLE, logger);
    this.customFields = customFields;

    this.addFields(getOrganizationFieldSchemas());
    this.addCustomFields(customFields);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const created: RecordData[] = [];

    for (const item of data) {
      // eslint-disable-next-line no-await-in-loop
      const raw = await this.client.createOrganization(this.buildPayload(item));
      created.push(serializeOrganization(raw));
    }

    return created;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const ids = await this.resolveIds(filter);
    const payload = this.buildPayload(patch);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.updateOrganization(id, payload);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const ids = await this.resolveIds(filter);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.deleteOrganization(id);
    }
  }

  protected override findOne(id: number | string): Promise<ZendeskRecord | null> {
    return this.client.findOrganization(id);
  }

  protected override serializeRecord(record: ZendeskRecord): RecordData {
    return serializeOrganization(record);
  }

  private buildPayload(data: RecordData): ZendeskRecord {
    const payload: ZendeskRecord = {};
    const organizationFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (READ_ONLY_INPUTS.has(key) || key === 'users' || key === 'tickets') {
        // ignored
      } else {
        const customField = this.customFields.find(cf => cf.columnName === key);

        if (customField?.zendeskKey) {
          organizationFields[customField.zendeskKey] = value;
        } else {
          payload[key] = value;
        }
      }
    }

    if (Object.keys(organizationFields).length > 0) {
      payload.organization_fields = organizationFields;
    }

    return payload;
  }
}
