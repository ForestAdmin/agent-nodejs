import type { SelectOptions } from './types';
import type { PlainFilter, PlainSortClause } from '@forestadmin/datasource-toolkit';

import HttpRequester from './http-requester';

export default class QuerySerializer {
  static serialize(query: SelectOptions, collectionName: string): Record<string, unknown> {
    if (!query) return {};

    const { fields, sort, filters, shouldSearchInRelation, pagination, search } = query;
    const extra = query as Record<string, unknown>;

    return {
      search,
      sort: QuerySerializer.formatSort(sort),
      filters: QuerySerializer.formatFilters(filters),
      searchExtended: !!shouldSearchInRelation,
      'page[size]': pagination?.size,
      'page[number]': pagination?.number,
      ...(fields?.length ? QuerySerializer.formatFields(collectionName, fields) : {}),
      // Extra params passed by Segment (segmentQuery, connectionName)
      ...(extra.segmentQuery !== undefined && { segmentQuery: extra.segmentQuery }),
      ...(extra.connectionName !== undefined && { connectionName: extra.connectionName }),
    };
  }

  private static formatSort(sort: PlainSortClause): string {
    if (!sort) return undefined;

    return sort.ascending ? sort.field : `-${sort.field}`;
  }

  /**
   * Serialize filters to JSON with snake_case operators and aggregators.
   *
   * Internally, operators use PascalCase (e.g. `Equal`, `GreaterThan`) to match
   * the datasource-toolkit convention. However, HTTP backends expect snake_case:
   * - Ruby (forest_liana): requires `equal`, `greater_than`, etc.
   * - Node (@forestadmin/agent): accepts snake_case via ConditionTreeParser.toPascalCase()
   *
   * Converting to snake_case here ensures compatibility with both backends.
   */
  private static formatFilters(filters: PlainFilter['conditionTree']): string {
    if (!filters) return undefined;

    return JSON.stringify(QuerySerializer.toSnakeCaseOperators(filters));
  }

  /**
   * Recursively walk the condition tree and convert operators/aggregators to snake_case.
   */
  private static toSnakeCaseOperators(node: unknown): unknown {
    if (!node || typeof node !== 'object') return node;

    const obj = node as Record<string, unknown>;

    if ('operator' in obj) {
      return {
        ...obj,
        operator: QuerySerializer.toSnakeCase(obj.operator as string),
      };
    }

    if ('aggregator' in obj && Array.isArray(obj.conditions)) {
      return {
        aggregator: (obj.aggregator as string).toLowerCase(),
        conditions: obj.conditions.map(c => QuerySerializer.toSnakeCaseOperators(c)),
      };
    }

    return obj;
  }

  /**
   * Convert PascalCase to snake_case.
   * Two passes handle different patterns:
   * - Pass 1: lowercase→uppercase boundaries (e.g. `greaterThan` → `greater_Than`)
   * - Pass 2: uppercase sequences (e.g. `IContains` → `I_Contains`, `PreviousXDays` → `PreviousX_Days`)
   */
  private static toSnakeCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
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
