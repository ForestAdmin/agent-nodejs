import type { ZendeskClient } from './client';
import type { CustomFieldEntry, CustomFieldMapping } from './types';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import OrganizationCollection from './collections/organization-collection';
import TicketCollection from './collections/ticket-collection';
import UserCollection from './collections/user-collection';
import { CustomFieldsIntrospector } from './schema/custom-fields-introspector';

export const COLLECTION_NAMES = {
  ticket: 'zendesk_ticket',
  user: 'zendesk_user',
  organization: 'zendesk_organization',
} as const;

function buildCustomFieldMapping(
  ticketFields: CustomFieldEntry[],
  userFields: CustomFieldEntry[],
  organizationFields: CustomFieldEntry[],
): CustomFieldMapping {
  const mapping: CustomFieldMapping = new Map();

  for (const field of ticketFields) {
    mapping.set(field.columnName, `custom_field_${field.zendeskId}`);
  }

  for (const field of [...userFields, ...organizationFields]) {
    if (field.zendeskKey && !mapping.has(field.columnName)) {
      mapping.set(field.columnName, field.zendeskKey);
    }
  }

  return mapping;
}

export default class ZendeskDataSource extends BaseDataSource {
  readonly client: ZendeskClient;
  readonly customFieldMapping: CustomFieldMapping;

  static async create(client: ZendeskClient, logger?: Logger): Promise<ZendeskDataSource> {
    const introspector = new CustomFieldsIntrospector(client, logger);
    const [ticketFields, userFields, organizationFields] = await Promise.all([
      introspector.ticketCustomFields(),
      introspector.userCustomFields(),
      introspector.organizationCustomFields(),
    ]);

    return new ZendeskDataSource(client, ticketFields, userFields, organizationFields, logger);
  }

  private constructor(
    client: ZendeskClient,
    ticketFields: CustomFieldEntry[],
    userFields: CustomFieldEntry[],
    organizationFields: CustomFieldEntry[],
    logger?: Logger,
  ) {
    super();
    this.client = client;
    this.customFieldMapping = buildCustomFieldMapping(ticketFields, userFields, organizationFields);

    this.addCollection(new TicketCollection(this, client, ticketFields, logger));
    this.addCollection(new UserCollection(this, client, userFields, logger));
    this.addCollection(new OrganizationCollection(this, client, organizationFields, logger));
  }
}
