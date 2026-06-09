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
import { USER_ROLES } from '../enums';
import { DATE_OPS, NUMBER_OPS, STRING_OPS } from './base-zendesk-collection';
import SearchableCollection from './searchable-collection';
import { serializeUser } from './ticket/serializer';

const SORTABLE: Record<string, string> = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  name: 'name',
};

const READ_ONLY_INPUTS = new Set(['id', 'created_at', 'updated_at']);

function getUserFieldSchemas(): Record<string, FieldSchema> {
  return {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
      isReadOnly: true,
      isSortable: false,
      filterOperators: new Set(NUMBER_OPS),
    },
    email: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(STRING_OPS),
    },
    name: {
      type: 'Column',
      columnType: 'String',
      isSortable: true,
      filterOperators: new Set(STRING_OPS),
    },
    role: {
      type: 'Column',
      columnType: 'Enum',
      enumValues: [...USER_ROLES],
      filterOperators: new Set(STRING_OPS),
    },
    phone: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(STRING_OPS),
    },
    organization_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    time_zone: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(),
    },
    locale: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(),
    },
    verified: {
      type: 'Column',
      columnType: 'Boolean',
      filterOperators: new Set(STRING_OPS),
    },
    suspended: {
      type: 'Column',
      columnType: 'Boolean',
      filterOperators: new Set(STRING_OPS),
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
    organization: {
      type: 'ManyToOne',
      foreignCollection: COLLECTION_NAMES.organization,
      foreignKey: 'organization_id',
      foreignKeyTarget: 'id',
    },
    requested_tickets: {
      type: 'OneToMany',
      foreignCollection: COLLECTION_NAMES.ticket,
      originKey: 'requester_id',
      originKeyTarget: 'id',
    },
  };
}

export default class UserCollection extends SearchableCollection {
  private readonly customFields: CustomFieldEntry[];

  constructor(
    datasource: DataSource,
    client: ZendeskClient,
    customFields: CustomFieldEntry[],
    logger?: Logger,
  ) {
    super(COLLECTION_NAMES.user, datasource, client, 'user', SORTABLE, logger);
    this.customFields = customFields;

    this.addFields(getUserFieldSchemas());
    this.addCustomFields(customFields);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const created: RecordData[] = [];

    for (const item of data) {
      // eslint-disable-next-line no-await-in-loop
      const raw = await this.client.createUser(this.buildPayload(item));
      created.push(serializeUser(raw));
    }

    return created;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const ids = await this.resolveIds(filter);
    const payload = this.buildPayload(patch);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.updateUser(id, payload);
    }
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const ids = await this.resolveIds(filter);

    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await this.client.deleteUser(id);
    }
  }

  protected override findOne(id: number | string): Promise<ZendeskRecord | null> {
    return this.client.findUser(id);
  }

  protected override serializeRecord(record: ZendeskRecord): RecordData {
    return serializeUser(record);
  }

  private buildPayload(data: RecordData): ZendeskRecord {
    const payload: ZendeskRecord = {};
    const userFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (READ_ONLY_INPUTS.has(key) || key === 'requested_tickets' || key === 'organization') {
        // ignored
      } else {
        const customField = this.customFields.find(cf => cf.columnName === key);

        if (customField?.zendeskKey) {
          userFields[customField.zendeskKey] = value;
        } else {
          payload[key] = value;
        }
      }
    }

    if (Object.keys(userFields).length > 0) payload.user_fields = userFields;

    return payload;
  }
}
