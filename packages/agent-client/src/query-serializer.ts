import type { SelectOptions } from './types';
import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

import HttpRequester from './http-requester';

const MAX_RELATION_DEPTH = 10;

export default class QuerySerializer {
  static serialize(query: SelectOptions, collectionName: string): Record<string, unknown> {
    if (!query) return {};

    return {
      ...query,
      ...query.filters,
      sort: QuerySerializer.formatSort(query.sort),
      filters: QuerySerializer.formatFilters(query.filters),
      searchExtended: !!query.shouldSearchInRelation,
      'page[size]': query.pagination?.size,
      'page[number]': query.pagination?.number,
      ...(query.fields?.length ? QuerySerializer.formatFields(collectionName, query.fields) : {}),
    };
  }

  private static formatSort(sort: PlainSortClause): string {
    if (!sort) return undefined;

    return sort.ascending ? sort.field : `-${sort.field}`;
  }

  private static formatFilters(filters: PlainFilter['conditionTree']): string {
    if (!filters) return undefined;

    return JSON.stringify(filters);
  }

  private static formatFields(
    collectionName: string,
    fields: string[],
    depth = 0,
  ): Record<string, string[]> {
    if (!fields) return {};

    // Guard against unbounded recursion
    if (depth >= MAX_RELATION_DEPTH) {
      throw new Error(
        `Maximum relation depth of ${MAX_RELATION_DEPTH} exceeded. ` +
          'Check for circular relations or reduce nesting depth.',
      );
    }

    const projectionName = `fields[${HttpRequester.escapeUrlSlug(collectionName)}]`;
    const projection: Record<string, string[]> = {
      [projectionName]: [],
    };

    fields.forEach(field => {
      // Skip empty or whitespace-only field names
      const trimmedField = field.trim();
      if (!trimmedField) return;

      if (trimmedField.includes('@@@')) {
        const [relatedCollection, ...relatedFieldParts] = trimmedField.split('@@@');
        const trimmedRelation = relatedCollection.trim();
        const remainingField = relatedFieldParts.join('@@@').trim();

        // Validate: both relation name and field must be non-empty
        if (!trimmedRelation || !remainingField) {
          // Skip malformed separators like "@@@field", "relation@@@", or "@@@"
          return;
        }

        // Avoid duplicate relation names in the projection array
        if (!projection[projectionName].includes(trimmedRelation)) {
          projection[projectionName].push(trimmedRelation);
        }

        const nestedProjection = this.formatFields(trimmedRelation, [remainingField], depth + 1);
        // Merge nested projection, combining arrays for the same key
        Object.entries(nestedProjection).forEach(([key, value]) => {
          if (projection[key]) {
            // Avoid duplicates when merging
            value.forEach(v => {
              if (!projection[key].includes(v)) {
                projection[key].push(v);
              }
            });
          } else {
            projection[key] = value;
          }
        });
      } else if (!projection[projectionName].includes(trimmedField)) {
        // Avoid duplicate field names
        projection[projectionName].push(trimmedField);
      }
    });

    return projection;
  }
}
