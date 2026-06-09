import type { ZendeskRecord } from '../../types';
import type { RecordData } from '@forestadmin/datasource-toolkit';

const TICKET_BASE_FIELDS = [
  'id',
  'subject',
  'description',
  'status',
  'priority',
  'requester_id',
  'assignee_id',
  'group_id',
  'organization_id',
  'external_id',
  'tags',
  'url',
  'created_at',
  'updated_at',
];

/**
 * Map a raw Zendesk ticket payload to the Forest column layout exposed by TicketCollection.
 *
 * - Zendesk's `type` field is renamed `ticket_type` to avoid collision with the JS keyword.
 * - Custom fields (`custom_fields: [{ id, value }]`) are flattened to columns named via the
 *   `customFieldIdToColumnName` map. Unknown custom field ids are silently ignored.
 * - `requester_email` is provided by the caller through `emails` because the raw ticket
 *   payload only carries `requester_id`.
 */
export function serializeTicket(
  ticket: ZendeskRecord,
  emails: Map<number, string>,
  customFieldIdToColumnName: Map<number, string>,
): RecordData {
  const record: RecordData = {};

  for (const key of TICKET_BASE_FIELDS) {
    if (ticket[key] !== undefined) record[key] = ticket[key] as RecordData[string];
  }

  record.ticket_type = (ticket.type as RecordData[string]) ?? null;

  const requesterId = ticket.requester_id;

  if (typeof requesterId === 'number' && emails.has(requesterId)) {
    record.requester_email = emails.get(requesterId);
  } else {
    record.requester_email = null;
  }

  const rawCustomFields = Array.isArray(ticket.custom_fields)
    ? (ticket.custom_fields as Array<{ id: number; value: unknown }>)
    : [];

  for (const entry of rawCustomFields) {
    const columnName = customFieldIdToColumnName.get(entry.id);
    if (columnName) record[columnName] = entry.value as RecordData[string];
  }

  return record;
}

export function serializeUser(user: ZendeskRecord): RecordData {
  const record: RecordData = {
    id: user.id as RecordData[string],
    email: user.email as RecordData[string],
    name: user.name as RecordData[string],
    role: user.role as RecordData[string],
    phone: user.phone as RecordData[string],
    organization_id: user.organization_id as RecordData[string],
    time_zone: user.time_zone as RecordData[string],
    locale: user.locale as RecordData[string],
    verified: user.verified as RecordData[string],
    suspended: user.suspended as RecordData[string],
    created_at: user.created_at as RecordData[string],
    updated_at: user.updated_at as RecordData[string],
  };

  const userFields = (user.user_fields ?? {}) as Record<string, unknown>;

  for (const [key, value] of Object.entries(userFields)) {
    if (record[key] === undefined) record[key] = value as RecordData[string];
  }

  return record;
}

export function serializeOrganization(organization: ZendeskRecord): RecordData {
  const record: RecordData = {
    id: organization.id as RecordData[string],
    name: organization.name as RecordData[string],
    domain_names: organization.domain_names as RecordData[string],
    details: organization.details as RecordData[string],
    notes: organization.notes as RecordData[string],
    group_id: organization.group_id as RecordData[string],
    shared_tickets: organization.shared_tickets as RecordData[string],
    created_at: organization.created_at as RecordData[string],
    updated_at: organization.updated_at as RecordData[string],
  };

  const orgFields = (organization.organization_fields ?? {}) as Record<string, unknown>;

  for (const [key, value] of Object.entries(orgFields)) {
    if (record[key] === undefined) record[key] = value as RecordData[string];
  }

  return record;
}
