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

  private static formatFields(collectionName: string, fields: string[]): Record<string, string[]> {
    if (!fields) return {};

    const projectionName = `fields[${HttpRequester.escapeUrlSlug(collectionName)}]`;
    const projection: Record<string, string[]> = {
      [projectionName]: [],
    };

    fields.forEach(field => {
      // Skip empty or whitespace-only field names
      const trimmedField = field.trim();
      if (!trimmedField) return;

      if (trimmedField.includes('@@@')) {
        const separatorIndex = trimmedField.indexOf('@@@');
        const relatedCollection = trimmedField.substring(0, separatorIndex);
        const relatedField = trimmedField.substring(separatorIndex + 3);
        const trimmedRelation = relatedCollection.trim();
        const trimmedRelatedField = relatedField?.trim();

        // Validate: both relation name and field must be non-empty
        if (!trimmedRelation || !trimmedRelatedField) {
          // Skip malformed separators like "@@@field", "relation@@@", or "@@@"
          return;
        }

        // Avoid duplicate relation names in the projection array
        if (!projection[projectionName].includes(trimmedRelation)) {
          projection[projectionName].push(trimmedRelation);
        }

        // Add related field to its collection projection
        const relatedProjectionName = `fields[${HttpRequester.escapeUrlSlug(trimmedRelation)}]`;

        if (!projection[relatedProjectionName]) {
          projection[relatedProjectionName] = [];
        }

        if (!projection[relatedProjectionName].includes(trimmedRelatedField)) {
          projection[relatedProjectionName].push(trimmedRelatedField);
        }
      } else if (!projection[projectionName].includes(trimmedField)) {
        // Avoid duplicate field names
        projection[projectionName].push(trimmedField);
      }
    });

    return projection;
  }
}
