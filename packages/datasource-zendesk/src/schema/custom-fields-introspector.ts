import type { RawCustomFieldDefinition, ZendeskClient } from '../client';
import type { CustomFieldEntry } from '../types';
import type { ColumnSchema, Logger, Operator } from '@forestadmin/datasource-toolkit';

const STRING_OPS = new Set<Operator>(['Equal', 'NotEqual', 'In', 'NotIn', 'Present', 'Blank']);
const NUMBER_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'In',
  'NotIn',
  'Present',
  'Blank',
  'GreaterThan',
  'LessThan',
]);
const DATE_OPS = new Set<Operator>(['Equal', 'Before', 'After', 'Present', 'Blank']);
const BOOLEAN_OPS = new Set<Operator>(['Equal', 'NotEqual']);

type FieldKind = 'ticket' | 'user' | 'organization';

function column(columnType: ColumnSchema['columnType'], operators: Set<Operator>): ColumnSchema {
  return {
    type: 'Column',
    columnType,
    filterOperators: new Set(operators),
    isReadOnly: false,
    isSortable: false,
  };
}

function enumColumn(field: RawCustomFieldDefinition): ColumnSchema {
  const enumValues = (field.custom_field_options ?? [])
    .map(option => option.value)
    .filter(value => typeof value === 'string' && value.length > 0);

  if (enumValues.length === 0) return column('String', STRING_OPS);

  return { ...column('Enum', STRING_OPS), enumValues };
}

function toColumnSchema(field: RawCustomFieldDefinition): ColumnSchema | null {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'regexp':
    case 'partialcreditcard':
      return column('String', STRING_OPS);
    case 'integer':
    case 'decimal':
    case 'lookup':
      return column('Number', NUMBER_OPS);
    case 'date':
      return column('Dateonly', DATE_OPS);
    case 'checkbox':
      return column('Boolean', BOOLEAN_OPS);
    case 'multiselect':
      return { ...column('Json', new Set<Operator>()), isGroupable: false };
    case 'dropdown':
    case 'tagger':
      return enumColumn(field);

    default:
      return null;
  }
}

// eslint-disable-next-line import/prefer-default-export
export class CustomFieldsIntrospector {
  constructor(private readonly client: ZendeskClient, private readonly logger?: Logger) {}

  async ticketCustomFields(): Promise<CustomFieldEntry[]> {
    const fields = await this.client.fetchTicketFields();

    return fields
      .filter(field => field.active && field.removable)
      .map(field => this.toEntry(field, 'ticket'))
      .filter((entry): entry is CustomFieldEntry => entry !== null);
  }

  async userCustomFields(): Promise<CustomFieldEntry[]> {
    const fields = await this.client.fetchUserFields();

    return fields
      .filter(field => field.active)
      .map(field => this.toEntry(field, 'user'))
      .filter((entry): entry is CustomFieldEntry => entry !== null);
  }

  async organizationCustomFields(): Promise<CustomFieldEntry[]> {
    const fields = await this.client.fetchOrganizationFields();

    return fields
      .filter(field => field.active)
      .map(field => this.toEntry(field, 'organization'))
      .filter((entry): entry is CustomFieldEntry => entry !== null);
  }

  private toEntry(field: RawCustomFieldDefinition, kind: FieldKind): CustomFieldEntry | null {
    const schema = toColumnSchema(field);

    if (!schema) {
      this.logger?.(
        'Warn',
        `[datasource-zendesk] Skipping custom field ${field.id} (${field.type}): unsupported type`,
      );

      return null;
    }

    const columnName = kind === 'ticket' ? `custom_${field.id}` : field.key ?? `custom_${field.id}`;

    return {
      columnName,
      zendeskId: field.id,
      zendeskKey: field.key,
      schema,
    };
  }
}
