import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

export type ZendeskClientOptions = {
  subdomain: string;
  email: string;
  apiToken: string;
};

export type ZendeskResource = 'ticket' | 'user' | 'organization';

export type SearchParams = {
  query: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ZendeskRecord = Record<string, unknown>;

export type CustomFieldEntry = {
  columnName: string;
  zendeskId: number;
  zendeskKey?: string;
  schema: ColumnSchema;
};

export type CustomFieldMapping = Map<string, string>;
