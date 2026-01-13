import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

export type BaseOptions = {
  filters?: PlainFilter['conditionTree']; // Filters to apply to the query
  sort?: PlainSortClause; // Sort clause for the query
  search?: string; // Search term for the query
  fields?: string[]; // Fields to include in the response
  shouldSearchInRelation?: boolean; // Whether to search also on related collections
};

export type ExportOptions = BaseOptions & {
  projection?: string[]; // Fields to export
};

export type LiveQueryOptions = {
  connectionName: string;
  query: string;
};

export type SegmentOptions = BaseOptions & {
  liveQuerySegment?: {
    connectionName: string;
    query: string;
  }; // Optional live query segment
};

export type SelectOptions = BaseOptions & {
  pagination?: {
    size?: number; // number of items per page
    number?: number; // current page number
  };
};
