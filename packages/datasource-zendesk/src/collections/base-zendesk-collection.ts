import type { ZendeskClient } from '../client';
import type ZendeskDataSource from '../datasource';
import type { CustomFieldEntry, ZendeskRecord, ZendeskResource } from '../types';
import type {
  AggregateResult,
  Aggregation,
  AggregationCapabilities,
  Caller,
  ConditionTree,
  DataSource,
  Filter,
  Logger,
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

import { MAX_PER_PAGE, MAX_TOTAL_RESULTS } from '../client';
import { UnsupportedOperatorError } from '../errors';
import { translateConditionTree } from '../query/condition-tree-translator';

export { BOOLEAN_OPS, DATE_OPS, ID_OPS, NUMBER_OPS, STRING_OPS } from '../query/operators';

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

  // ===== Resource access implemented by the concrete collections =====

  /** Fetch a single resource by primary key, or null when it does not exist (404). */
  protected abstract findOne(id: number | string): Promise<ZendeskRecord | null>;

  /** Convert a raw Zendesk payload into the Forest column layout this collection exposes. */
  protected abstract serializeRecord(record: ZendeskRecord): RecordData;

  // ===== Helpers used by subclasses =====

  /**
   * Count the records matching the filter. An exact id-lookup is resolved by fetching the
   * referenced records and re-applying the full condition tree in memory, so that non-existent
   * ids and sibling conditions (scope/segment) are honored rather than blindly trusted.
   */
  protected async aggregateCount(caller: Caller, filter: Filter): Promise<number> {
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const records = await this.serializeForFilter(await this.fetchRecordsByIds(ids));
      const matching = filter?.conditionTree
        ? filter.conditionTree.apply(records, this, caller.timezone)
        : records;

      return matching.length;
    }

    return this.client.count(this.resource, this.buildZendeskQuery(filter));
  }

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

  // Zendesk Search is page-based; a window not aligned to a page boundary is satisfied by
  // fetching the covering pages and slicing in memory rather than snapping to a boundary.
  protected async searchRecords(filter: PaginatedFilter | undefined): Promise<ZendeskRecord[]> {
    const skip = filter?.page?.skip ?? 0;
    const limit = filter?.page?.limit ?? MAX_PER_PAGE;

    if (skip + limit > MAX_TOTAL_RESULTS) {
      throw new UnsupportedOperatorError(
        `Zendesk Search caps results at ${MAX_TOTAL_RESULTS}. Requested skip+limit=${
          skip + limit
        }.`,
      );
    }

    const perPage = Math.max(1, Math.min(limit, MAX_PER_PAGE));
    const firstPage = Math.floor(skip / perPage) + 1;
    const offset = skip - (firstPage - 1) * perPage;
    const pageCount = Math.max(1, Math.ceil((offset + limit) / perPage));
    const { sortBy, sortOrder } = this.translateSort(filter?.sort);
    const query = this.buildZendeskQuery(filter);

    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_unused, index) =>
        this.client.search(this.resource, {
          query,
          page: firstPage + index,
          perPage,
          sortBy,
          sortOrder,
        }),
      ),
    );

    const records = pages.flat();

    return offset === 0 && pageCount === 1 ? records : records.slice(offset, offset + limit);
  }

  // Drops ids that no longer exist (findOne returns null on 404).
  protected async fetchRecordsByIds(ids: number[]): Promise<ZendeskRecord[]> {
    const results = await Promise.all(ids.map(id => this.findOne(id)));

    return results.filter((record): record is ZendeskRecord => record !== null);
  }

  // Overridable so collections can resolve derived columns before in-memory filtering.
  protected async serializeForFilter(records: ZendeskRecord[]): Promise<RecordData[]> {
    return records.map(record => this.serializeRecord(record));
  }

  // Re-apply the filter, sort and pagination in memory (used on the id-lookup path, which
  // bypasses the Search API and therefore never had them applied server-side).
  protected refine(
    records: RecordData[],
    filter: PaginatedFilter | undefined,
    timezone: string,
  ): RecordData[] {
    let result = records;

    if (filter?.conditionTree) result = filter.conditionTree.apply(result, this, timezone);
    if (filter?.sort) result = filter.sort.apply(result);
    if (filter?.page) result = filter.page.apply(result);

    return result;
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

  /**
   * Resolve the primary keys targeted by update/delete. A pure id-lookup is authoritative; an
   * id-lookup combined with other conditions (scope/segment) is re-checked in memory so we never
   * mutate a record outside the caller's perimeter. Otherwise every matching page is collected.
   */
  protected async resolveIds(filter: Filter | undefined, timezone: string): Promise<number[]> {
    const ids = this.extractIdLookup(filter?.conditionTree);

    if (ids) {
      const onlyIds = filter?.conditionTree?.everyLeaf(leaf => leaf.field === 'id') ?? true;
      if (onlyIds) return ids;

      const records = await this.serializeForFilter(await this.fetchRecordsByIds(ids));

      return filter.conditionTree
        .apply(records, this, timezone)
        .map(record => Number(record.id))
        .filter(id => Number.isFinite(id));
    }

    return this.searchAllIds(filter);
  }

  // Page through every matching result up to the Zendesk Search cap, warning if it is exceeded
  // rather than silently affecting only the first page.
  private async searchAllIds(filter: Filter | undefined): Promise<number[]> {
    const query = this.buildZendeskQuery(filter);
    const maxPages = Math.ceil(MAX_TOTAL_RESULTS / MAX_PER_PAGE);
    const ids: number[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const records = await this.client.search(this.resource, {
        query,
        page,
        perPage: MAX_PER_PAGE,
      });

      for (const record of records) {
        const id = Number(record.id);
        if (Number.isFinite(id)) ids.push(id);
      }

      if (records.length < MAX_PER_PAGE) return ids;
    }

    this.logger?.(
      'Warn',
      `[datasource-zendesk] A bulk operation on '${this.name}' matched more than ${MAX_TOTAL_RESULTS} records; Zendesk Search only returns the first ${MAX_TOTAL_RESULTS}, so the rest are left untouched.`,
    );

    return ids;
  }
}
