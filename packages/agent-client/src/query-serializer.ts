import type { SelectOptions } from './types';
import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

import toWireFilter from './filter-wire-format';
import HttpRequester from './http-requester';

export default class QuerySerializer {
  static serialize(query: SelectOptions, collectionName: string): Record<string, unknown> {
    if (!query) return {};

    const {
      fields,
      sort,
      filters,
      shouldSearchInRelation,
      pagination,
      search,
      segmentQuery,
      connectionName,
    } = query;

    return {
      search,
      segmentQuery,
      connectionName,
      sort: QuerySerializer.formatSort(sort),
      filters: QuerySerializer.formatFilters(filters),
      searchExtended: !!shouldSearchInRelation,
      'page[size]': pagination?.size,
      'page[number]': pagination?.number,
      ...(fields?.length ? QuerySerializer.formatFields(collectionName, fields) : {}),
    };
  }

  private static formatSort(sort: PlainSortClause): string {
    if (!sort) return undefined;

    return sort.ascending ? sort.field : `-${sort.field}`;
  }

  private static formatFilters(filters: PlainFilter['conditionTree']): string {
    if (!filters) return undefined;

    return JSON.stringify(toWireFilter(filters));
  }

  private static formatFields(collectionName: string, fields: string[]): Record<string, string> {
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

    // Join per type (`fields[users]=id,name`): an array would serialize as repeated params,
    // which Ruby (Rack) agents collapse to the last value only — dropping every field but one.
    return Object.fromEntries(
      Object.entries(projection).map(([key, values]) => [key, values.join(',')]),
    );
  }
}
