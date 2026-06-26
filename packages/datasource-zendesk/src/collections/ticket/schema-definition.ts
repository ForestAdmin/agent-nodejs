import type { FieldSchema } from '@forestadmin/datasource-toolkit';

import { COLLECTION_NAMES } from '../../datasource';
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from '../../enums';
import { DATE_OPS, ID_OPS, NUMBER_OPS, STRING_OPS } from '../base-zendesk-collection';

export const TICKET_SORTABLE: Record<string, string> = {
  updated_at: 'updated_at',
  created_at: 'created_at',
  priority: 'priority',
  status: 'status',
  ticket_type: 'ticket_type',
};

export const TICKET_COMMENT_THREAD_SCHEMA = {
  id: 'Number',
  body: 'String',
  html_body: 'String',
  public: 'Boolean',
  author_email: 'String',
  author_name: 'String',
  created_at: 'Date',
} as const;

export function getTicketFieldSchemas(): Record<string, FieldSchema> {
  return {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
      isReadOnly: true,
      isSortable: false,
      filterOperators: new Set(ID_OPS),
    },
    subject: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(STRING_OPS),
    },
    description: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(),
    },
    status: {
      type: 'Column',
      columnType: 'Enum',
      enumValues: [...TICKET_STATUSES],
      isSortable: true,
      filterOperators: new Set(STRING_OPS),
    },
    priority: {
      type: 'Column',
      columnType: 'Enum',
      enumValues: [...TICKET_PRIORITIES],
      isSortable: true,
      filterOperators: new Set(STRING_OPS),
    },
    ticket_type: {
      type: 'Column',
      columnType: 'Enum',
      enumValues: [...TICKET_TYPES],
      isSortable: true,
      filterOperators: new Set(STRING_OPS),
    },
    requester_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    assignee_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    group_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    organization_id: {
      type: 'Column',
      columnType: 'Number',
      filterOperators: new Set(NUMBER_OPS),
    },
    external_id: {
      type: 'Column',
      columnType: 'String',
      filterOperators: new Set(STRING_OPS),
    },
    requester_email: {
      type: 'Column',
      columnType: 'String',
      isReadOnly: true,
      filterOperators: new Set(['Equal']),
    },
    tags: {
      type: 'Column',
      columnType: ['String'],
      filterOperators: new Set(),
    },
    url: {
      type: 'Column',
      columnType: 'String',
      isReadOnly: true,
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
    comments: {
      type: 'Column',
      columnType: [TICKET_COMMENT_THREAD_SCHEMA],
      isReadOnly: true,
      filterOperators: new Set(),
    },
    requester: {
      type: 'ManyToOne',
      foreignCollection: COLLECTION_NAMES.user,
      foreignKey: 'requester_id',
      foreignKeyTarget: 'id',
    },
    assignee: {
      type: 'ManyToOne',
      foreignCollection: COLLECTION_NAMES.user,
      foreignKey: 'assignee_id',
      foreignKeyTarget: 'id',
    },
    organization: {
      type: 'ManyToOne',
      foreignCollection: COLLECTION_NAMES.organization,
      foreignKey: 'organization_id',
      foreignKeyTarget: 'id',
    },
  };
}
