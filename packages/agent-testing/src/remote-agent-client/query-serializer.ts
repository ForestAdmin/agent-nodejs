import type { SelectOptions } from './types';
import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

import HttpRequester from './http-requester';

export default class QuerySerializer {
  static serialize(query: SelectOptions, collectionName: string): Record<string, unknown> {
    if (!query) return {};

    const projectionName = `fields[${HttpRequester.escapeUrlSlug(collectionName)}]`;

    return {
      ...query,
      ...query.filters,
      sort: QuerySerializer.formatSort(query.sort),
      filters: QuerySerializer.formatFilters(query.filters),
      'page[size]': query.pagination?.size,
      'page[number]': query.pagination?.number,
      [projectionName]: query.projection?.toString(),
    };
  }

  private static formatSort(sort: PlainSortClause): string {
    if (!sort) return undefined;

    return sort.ascending ? sort.field : `-${sort.field}`;
  }

  private static formatFilters(filters: PlainFilter): string {
    if (!filters) return undefined;

    return JSON.stringify(filters.conditionTree);
  }
}
