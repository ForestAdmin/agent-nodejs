import type { SelectOptions } from './types';
import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

import HttpRequester from './http-requester';

export default class QuerySerializer {
  static serialize(query: SelectOptions, collectionName: string): Record<string, unknown> {
    if (!query) return {};

    return {
      ...query,
      ...query.filters,
      sort: QuerySerializer.formatSort(query.sort),
      filters: QuerySerializer.formatFilters(query.filters),
      'page[size]': query.pagination?.size,
      'page[number]': query.pagination?.number,
      ...QuerySerializer.formatProjection(collectionName, query.projection?.toString().split(',')),
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

  private static formatProjection(
    collectionName: string,
    fields: string[],
  ): Record<string, string[]> {
    if (!fields) return {};

    const projectionName = `fields[${HttpRequester.escapeUrlSlug(collectionName)}]`;
    const projection: Record<string, string[]> = {
      [projectionName]: [],
    };

    fields.forEach(field => {
      if (field.includes('@@@')) {
        const [relatedCollection, ...relatedField] = field.split('@@@');
        projection[projectionName].push(relatedCollection);
        const nestedProjection = this.formatProjection(relatedCollection, [
          relatedField.join('@@@'),
        ]);
        // Merge nested projection, combining arrays for the same key
        Object.entries(nestedProjection).forEach(([key, value]) => {
          if (projection[key]) {
            projection[key] = [...projection[key], ...value];
          } else {
            projection[key] = value;
          }
        });
      } else {
        projection[projectionName].push(field);
      }
    });

    return projection;
  }
}
