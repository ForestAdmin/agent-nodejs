import { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

export type BaseOptions = {
  filters?: PlainFilter; // Filters to apply to the query
  sort?: PlainSortClause; // Sort clause for the query
  search?: string; // Search term for the query
  projection?: string[]; // Fields to include in the response
};

export type ExportOptions = BaseOptions;

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
