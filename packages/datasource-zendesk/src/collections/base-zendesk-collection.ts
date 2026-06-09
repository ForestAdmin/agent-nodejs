import type { ZendeskClient } from '../client';
import type ZendeskDataSource from '../datasource';
import type { CustomFieldEntry, ZendeskResource } from '../types';
import type {
  AggregateResult,
  Aggregation,
  AggregationCapabilities,
  Caller,
  ConditionTree,
  DataSource,
  Filter,
  Logger,
  Operator,
  Page,
  PaginatedFilter,
  Projection,
  RecordData,
  Sort,
} from '@forestadmin/datasource-toolkit';

import {
  BaseCollection,
  ConditionTreeBranch,
  ConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

import { MAX_TOTAL_RESULTS } from '../client';
import { UnsupportedOperatorError } from '../errors';
import { translateConditionTree } from '../query/condition-tree-translator';

export const STRING_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'In',
  'NotIn',
  'Present',
  'Blank',
]);
export const NUMBER_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'In',
  'NotIn',
  'Present',
  'Blank',
  'GreaterThan',
  'LessThan',
]);
export const DATE_OPS = new Set<Operator>(['Equal', 'Before', 'After', 'Present', 'Blank']);

export type TranslatedPage = { page: number; perPage: number };

export default abstract class BaseZendeskCollection extends BaseCollection {
  protected readonly client: ZendeskClient;
  protected readonly resource: ZendeskResource;
  protected readonly sortableFields: Record<string, string>;
  protected readonly logger?: Logger;
  protected readonly zendeskIdToColumnName: Map<number, string>;

  constructor(
    name: string,
    datasource: DataSource,
    client: ZendeskClient,
    resource: ZendeskResource,
    sortableFields: Record<string, string>,
    logger?: Logger,
  ) {
    super(name, datasource, client);
    this.client = client;
    this.resource = resource;
    this.sortableFields = sortableFields;
    this.logger = logger;
    this.zendeskIdToColumnName = new Map();

    // Zendesk Search only supports counting search results — disallow grouped aggregates.
    const capabilities: AggregationCapabilities = {
      supportGroups: false,
      supportedDateOperations: new Set(),
    };
    this.setAggregationCapabilities(capabilities);
    this.enableCount();
  }

  // ===== Public API (BaseCollection) =====

  abstract override create(caller: Caller, data: RecordData[]): Promise<RecordData[]>;

  abstract override list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]>;

  abstract override update(caller: Caller, filter: Filter, patch: RecordData): Promise<void>;

  abstract override delete(caller: Caller, filter: Filter): Promise<void>;

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    if (aggregation.operation !== 'Count' || aggregation.field || aggregation.groups?.length) {
      throw new UnsupportedOperatorError(
        `Zendesk only supports the 'Count' aggregation without field/groups (got ${aggregation.operation}).`,
      );
    }

    const count = await this.aggregateCount(caller, filter);
    const results: AggregateResult[] = count > 0 ? [{ value: count, group: {} }] : [];

    return typeof limit === 'number' ? results.slice(0, limit) : results;
  }

  // ===== Helpers used by subclasses =====

  protected abstract aggregateCount(caller: Caller, filter: Filter): Promise<number>;

  protected addCustomFields(customFields: CustomFieldEntry[]): void {
    for (const entry of customFields) {
      if (this.schema.fields[entry.columnName] !== undefined) {
        this.logger?.(
          'Warn',
          `[datasource-zendesk] Custom field '${entry.columnName}' collides with a native field on '${this.name}'; skipping.`,
        );
      } else {
        this.addField(entry.columnName, entry.schema);
        this.zendeskIdToColumnName.set(entry.zendeskId, entry.columnName);
      }
    }
  }

  protected translateSort(sort: Sort | undefined): {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } {
    if (!sort || sort.length === 0) return {};

    const [first] = sort;
    const zendeskField = this.sortableFields[first.field];
    if (!zendeskField) return {};

    return { sortBy: zendeskField, sortOrder: first.ascending ? 'asc' : 'desc' };
  }

  protected translatePage(page: Page | undefined): TranslatedPage {
    const skip = page?.skip ?? 0;
    const limit = page?.limit ?? 100;

    if (skip + limit > MAX_TOTAL_RESULTS) {
      throw new UnsupportedOperatorError(
        `Zendesk Search caps results at ${MAX_TOTAL_RESULTS}. Requested skip+limit=${
          skip + limit
        }.`,
      );
    }

    const perPage = Math.max(1, Math.min(limit, 100));
    const pageNumber = Math.floor(skip / perPage) + 1;

    return { page: pageNumber, perPage };
  }

  protected buildZendeskQuery(filter: Filter | PaginatedFilter | undefined): string {
    if (!filter) return '';

    const fromTree = translateConditionTree(filter.conditionTree, {
      resource: this.resource,
      customFieldMapping: (this.dataSource as ZendeskDataSource).customFieldMapping,
    });
    const search = (filter.search ?? '').toString().trim();

    return [fromTree, search]
      .filter(part => part.length > 0)
      .join(' ')
      .trim();
  }

  /**
   * Returns the list of primary-key values if the condition tree is an exact `id`
   * lookup (Equal N or In [N1, N2, ...]), otherwise null. Lets `list/update/delete`
   * bypass the Search API and hit the resource endpoint directly.
   */
  protected extractIdLookup(tree: ConditionTree | undefined): number[] | null {
    if (!tree) return null;

    if (tree instanceof ConditionTreeLeaf && tree.field === 'id') {
      if (tree.operator === 'Equal' && tree.value !== null && tree.value !== undefined) {
        return [Number(tree.value)];
      }

      if (tree.operator === 'In' && Array.isArray(tree.value) && tree.value.length > 0) {
        return tree.value.map(v => Number(v));
      }
    }

    if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
      for (const condition of tree.conditions) {
        const ids = this.extractIdLookup(condition);
        if (ids) return ids;
      }
    }

    return null;
  }
}
