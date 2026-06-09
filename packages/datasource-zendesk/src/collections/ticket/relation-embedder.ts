import type { ZendeskClient } from '../../client';
import type { Projection, RecordData } from '@forestadmin/datasource-toolkit';

import { serializeOrganization, serializeUser } from './serializer';

const RELATION_NAMES = new Set(['requester', 'assignee', 'organization']);

export type RelationKeys = {
  requester: boolean;
  assignee: boolean;
  organization: boolean;
};

function pushIfNumber(target: number[], value: unknown): void {
  if (typeof value === 'number') {
    target.push(value);
  } else if (typeof value === 'string' && value.length > 0 && !Number.isNaN(Number(value))) {
    target.push(Number(value));
  }
}

function unique(values: number[]): number[] {
  return Array.from(new Set(values));
}

export function findRequestedRelations(projection: Projection): RelationKeys {
  const requested: RelationKeys = { requester: false, assignee: false, organization: false };

  for (const path of projection) {
    const index = path.indexOf(':');

    if (index !== -1) {
      const relation = path.substring(0, index);
      if (RELATION_NAMES.has(relation)) requested[relation as keyof RelationKeys] = true;
    }
  }

  return requested;
}

export async function embedRelations(
  records: RecordData[],
  relations: RelationKeys,
  client: ZendeskClient,
): Promise<void> {
  if (records.length === 0) return;

  const userIds: Array<number> = [];
  const orgIds: Array<number> = [];

  for (const record of records) {
    if (relations.requester) pushIfNumber(userIds, record.requester_id);
    if (relations.assignee) pushIfNumber(userIds, record.assignee_id);
    if (relations.organization) pushIfNumber(orgIds, record.organization_id);
  }

  const [usersById, orgsById] = await Promise.all([
    userIds.length > 0 ? client.fetchUsersByIds(unique(userIds)) : Promise.resolve(new Map()),
    orgIds.length > 0 ? client.fetchOrganizationsByIds(unique(orgIds)) : Promise.resolve(new Map()),
  ]);

  for (const record of records) {
    if (relations.requester) {
      const raw = usersById.get(Number(record.requester_id));
      record.requester = raw ? serializeUser(raw) : null;
    }

    if (relations.assignee) {
      const raw = usersById.get(Number(record.assignee_id));
      record.assignee = raw ? serializeUser(raw) : null;
    }

    if (relations.organization) {
      const raw = orgsById.get(Number(record.organization_id));
      record.organization = raw ? serializeOrganization(raw) : null;
    }
  }
}
