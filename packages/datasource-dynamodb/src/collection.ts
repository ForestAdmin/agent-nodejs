import type { CollectionSettings, TableModel } from './types';
import type { AccessPath, KeyLookup } from './utils/access-path';
import type { Item, ReadBudget, ReadInput, ReadOperation } from './utils/executor';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  AggregateResult,
  Aggregation,
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeLeaf,
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
  ConditionTreeFactory,
  PaginatedFilter as PaginatedFilterClass,
  Projection as ProjectionClass,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { randomUUID } from 'crypto';

import { DynamoDBOperationError, OffsetTooDeepError, ScanDeniedError } from './errors';
import convertModelToFields from './schema/schema-converter';
import { planAccessPath, planKeyLookup } from './utils/access-path';
import StreamingAggregator from './utils/aggregator';
import { mapWithConcurrency } from './utils/concurrency';
import DynamoExecutor from './utils/executor';
import ExpressionBuilder, { splitCondition } from './utils/expression-builder';
import Serializer from './utils/serializer';
import compareRecords from './utils/sort';

/** What a parallel read splits into: the segments of a scan, or the partitions of a filter. */
type ReadUnit = { segment?: { index: number; total: number }; partition?: string | number };

type ReadPlan = { lookup?: KeyLookup; access?: AccessPath; residual?: ConditionTree };

function intersect(...trees: ConditionTree[]): ConditionTree | undefined {
  const present = trees.filter(Boolean);

  return present.length ? ConditionTreeFactory.intersect(...present) : undefined;
}

/** Values a single expression may carry before it is evaluated on the returned items instead. */
const MAX_PUSHED_LIST_VALUES = 200;
const LIST_OPERATORS = ['In', 'NotIn', 'IncludesAll', 'IncludesNone'];
/** Items below which a page read without any filter is too cheap to call a scan. */
const MAX_CHEAP_PAGE_ITEMS = 1000;
/** A scan warning is repeated at most this often. */
const WARN_INTERVAL_MS = 60000;
/** Charts remembered per collection, the oldest dropped first. */
const MAX_CACHED_CHARTS = 100;

const hasOversizedList = (leaf: ConditionTreeLeaf): boolean =>
  LIST_OPERATORS.includes(leaf.operator) &&
  Array.isArray(leaf.value) &&
  leaf.value.length > MAX_PUSHED_LIST_VALUES;

const copyOf = (rows: AggregateResult[]): AggregateResult[] =>
  rows.map(row => ({ ...row, group: { ...row.group } }));

const isEmptyKey = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

function describeFilter(tree?: ConditionTree): string {
  const parts = new Set<string>();
  tree?.forEachLeaf(leaf => parts.add(`${leaf.field} ${leaf.operator}`));

  return [...parts].join(', ');
}

function keyConditionExpression(
  builder: ExpressionBuilder,
  { partition, sort }: AccessPath['keyCondition'],
  partitionValue: string | number,
): string {
  const expressions = [
    `${builder.attribute(partition.attribute)} = ${builder.value(partitionValue)}`,
  ];

  if (sort) {
    const attribute = builder.attribute(sort.attribute);
    const comparisons = {
      Equal: '=',
      LessThan: '<',
      LessThanOrEqual: '<=',
      GreaterThan: '>',
      GreaterThanOrEqual: '>=',
    };

    if (sort.operator === 'StartsWith') {
      expressions.push(`begins_with(${attribute}, ${builder.value(sort.value)})`);
    } else if (sort.operator === 'Between') {
      const [lower, upper] = sort.value as unknown[];
      expressions.push(`${attribute} BETWEEN ${builder.value(lower)} AND ${builder.value(upper)}`);
    } else {
      expressions.push(`${attribute} ${comparisons[sort.operator]} ${builder.value(sort.value)}`);
    }
  }

  return expressions.join(' AND ');
}

export default class DynamoDBCollection extends BaseCollection {
  readonly model: TableModel;
  readonly executor: DynamoExecutor;
  readonly settings: CollectionSettings;
  private readonly logger: Logger;
  private readonly fieldNames: Set<string>;
  private readonly matchContext: Collection;
  private readonly warnedAt = new Map<string, number>();

  constructor(
    datasource: DataSource,
    model: TableModel,
    client: DynamoDBDocumentClient,
    logger: Logger,
    settings: CollectionSettings,
  ) {
    super(model.name, datasource, client);

    this.model = model;
    this.settings = settings;
    this.logger = logger;
    this.executor = new DynamoExecutor(client, model, settings, logger);

    this.addFields(convertModelToFields(model, logger));
    if (model.enableCount ?? true) this.enableCount();

    const entityAttribute = model.entity?.attribute;

    // The discriminator may be left out of the schema, and is still read to tell the entities apart.
    this.fieldNames = new Set([
      ...Object.keys(this.schema.fields),
      ...(entityAttribute !== undefined ? [entityAttribute] : []),
    ]);
    this.matchContext = {
      schema: {
        fields: {
          ...this.schema.fields,
          ...(entityAttribute && !this.schema.fields[entityAttribute]
            ? { [entityAttribute]: { type: 'Column', columnType: 'String' } }
            : {}),
        },
      },
    } as unknown as Collection;
  }

  invalidateCaches(): void {
    this.settings.paginationCache.invalidateTable(this.model.tableName);
    this.settings.chartCaches.get(this.model.tableName)?.clear();
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    try {
      return await this.executor.mapWrites(data, record => this.createOne(record));
    } catch (error) {
      throw this.wrap(error, 'create');
    } finally {
      // Also after a failure: the writes that went through must not stay hidden by a cache.
      this.invalidateCaches();
    }
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    try {
      return await this.listRecords(caller, filter, projection);
    } catch (error) {
      throw this.wrap(error, 'list');
    }
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    try {
      const entries: Array<[string, unknown]> = Object.entries(patch)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => [field, this.toStored(field, value)]);

      for (const [field] of entries) {
        if (field === this.model.entity?.attribute) {
          throw new ValidationError(
            `The attribute '${field}' tells which entity a record of '${this.name}' belongs to, ` +
              `so it cannot be updated`,
          );
        }
      }

      if (entries.length === 0) return;

      const keys = await this.resolveKeys(caller, filter);
      const keyNames = this.keyNames();

      // Forest sets a many-to-one relation by writing its foreign key, which is a key of the
      // record when the relation follows the table's own keys: writing the value it has is harmless.
      const changedKey = entries.find(
        ([field, value]) => keyNames.includes(field) && keys.some(key => key[field] !== value),
      );

      if (changedKey) {
        throw new ValidationError(
          `The key attribute '${changedKey[0]}' of '${this.name}' cannot be changed on an existing ` +
            `record, since DynamoDB keys are immutable: delete the record and create a new one instead`,
        );
      }

      const writable = entries.filter(([field]) => !keyNames.includes(field));

      if (writable.length === 0) return;

      await this.executor.mapWrites(keys, key => this.updateOne(key, writable));
    } catch (error) {
      throw this.wrap(error, 'update');
    } finally {
      this.invalidateCaches();
    }
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    try {
      const keys = await this.resolveKeys(caller, filter);

      if (keys.length === 0) return;

      await this.executor.batchDelete(keys);
    } catch (error) {
      throw this.wrap(error, 'delete');
    } finally {
      this.invalidateCaches();
    }
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    try {
      return await this.aggregateRecords(caller, filter, aggregation, limit);
    } catch (error) {
      throw this.wrap(error, 'aggregate');
    }
  }

  private wrap(error: Error & { isBusinessError?: boolean }, verb: string): Error {
    if (error?.isBusinessError && !(error instanceof DynamoDBOperationError)) return error;

    return new DynamoDBOperationError(
      `Failed to ${verb} records of '${this.name}': ${error.message}`,
      error,
    );
  }

  private keyNames(): string[] {
    return [this.model.partitionKey, this.model.sortKey].filter(Boolean).map(key => key.name);
  }

  /** The attributes a position in the table or index read is made of. */
  private positionAttributes(access?: AccessPath): string[] {
    return [...new Set([...this.keyNames(), ...(access?.keyAttributes ?? [])])];
  }

  private toRecord(item: Item): RecordData {
    return Serializer.flatten(item, this.fieldNames);
  }

  private matches(tree: ConditionTree, item: Item, timezone: string): boolean {
    return tree.match(this.toRecord(item), this.matchContext, timezone);
  }

  // ---- reads ------------------------------------------------------------------------------

  private plan(tree?: ConditionTree, sort?: Sort): ReadPlan {
    // DynamoDB compares a binary attribute to a binary, never to the base64 text Forest sends.
    const { pushable, residual } = splitCondition(tree, leaf => !this.isBinary(leaf.field));
    const lookup = planKeyLookup(this.model, pushable);

    if (lookup) return { lookup, residual: intersect(lookup.remaining, residual) };

    const access = planAccessPath(this.model, pushable, sort);

    if (!access.remaining) return { access, residual };

    // A Query filter cannot reference the key attributes it reads by, and an expression has a size
    // limit that a long list of values would exceed: both are applied on the returned items.
    const keys = new Set(access.kind === 'query' ? access.keyAttributes : []);
    const { pushable: filter, residual: moved } = splitCondition(
      access.remaining,
      leaf => !keys.has(leaf.field) && !hasOversizedList(leaf),
    );

    return { access: { ...access, remaining: filter }, residual: intersect(moved, residual) };
  }

  /** Gives back the DynamoDB type Forest cannot send: bytes for base64 text, a set for an array. */
  private toStored(field: string, value: unknown): unknown {
    if (this.isBinary(field) && typeof value === 'string') {
      return Uint8Array.from(Buffer.from(value, 'base64'));
    }

    if (this.model.schema[field]?.set && Array.isArray(value)) return new Set(value);

    return value;
  }

  private isBinary(field: string): boolean {
    return this.model.schema[field]?.type === 'binary';
  }

  private guardScan(plan: ReadPlan, tree?: ConditionTree): void {
    if (plan.access?.kind !== 'scan') return;

    const policy = this.model.scanPolicy ?? this.settings.scanPolicy;

    if (policy === 'allow') return;

    const filter = describeFilter(tree);
    const reason = `no key or index serves the filter${filter ? ` (${filter})` : ''}`;

    if (policy === 'deny') {
      throw new ScanDeniedError(
        `Scan on table '${this.model.tableName}' refused by scanPolicy 'deny': ${reason}`,
      );
    }

    const message = `Scan on table '${this.model.tableName}' for collection '${this.name}': ${reason}`;
    const now = this.settings.now();

    // The same scan is asked for again each time a page or a chart is displayed: say it once.
    if (now - (this.warnedAt.get(message) ?? -Infinity) < WARN_INTERVAL_MS) return;

    this.warnedAt.set(message, now);
    this.logger('Warn', message);
  }

  private buildReadInput(
    access: AccessPath,
    fields: string[],
    extra: Partial<ReadInput> = {},
    partitionValue?: string | number,
  ): ReadInput {
    const builder = new ExpressionBuilder();
    const input: ReadInput = {};

    if (access.kind === 'query') {
      input.IndexName = access.indexName;
      input.KeyConditionExpression = keyConditionExpression(
        builder,
        access.keyCondition,
        partitionValue ?? access.keyCondition.partition.value,
      );
      if (!access.scanIndexForward) input.ScanIndexForward = false;
    }

    if (access.remaining) input.FilterExpression = builder.condition(access.remaining);
    if (fields.length) input.ProjectionExpression = builder.projection(fields);

    return { ...input, ...builder.result(), ...extra } as ReadInput;
  }

  private projectionParams(fields: string[]): Partial<ReadInput> {
    if (!fields.length) return {};

    const builder = new ExpressionBuilder();

    return { ProjectionExpression: builder.projection(fields), ...builder.result() } as never;
  }

  /** Reads the items DynamoDB selects, as the batches it returns them in. */
  private async *readBatches(
    plan: ReadPlan,
    fields: string[],
    budget: ReadBudget,
    unit?: ReadUnit,
  ): AsyncGenerator<Item[]> {
    if (plan.lookup) {
      budget.charge(plan.lookup.keys.length, 'query');

      yield await this.executor.batchGet(plan.lookup.keys, this.projectionParams(fields) as never);

      return;
    }

    const partitions = plan.access.keyCondition?.partition.values;

    // A filter naming several partitions is one Query per partition, read one after the other.
    if (partitions && !unit) {
      for (const partition of partitions) {
        yield* this.readBatches(plan, fields, budget, { partition });
      }

      return;
    }

    const operation: ReadOperation = plan.access.kind;
    const input = this.buildReadInput(
      plan.access,
      fields,
      unit?.segment ? { Segment: unit.segment.index, TotalSegments: unit.segment.total } : {},
      unit?.partition,
    );

    for await (const page of this.executor.readPages(operation, input, budget)) yield page.items;
  }

  private async readAll(plan: ReadPlan, fields: string[], timezone: string): Promise<Item[]> {
    const items: Item[] = [];

    for await (const batch of this.readBatches(plan, fields, this.executor.newBudget())) {
      for (const item of batch) {
        if (!plan.residual || this.matches(plan.residual, item, timezone)) items.push(item);
      }
    }

    return items;
  }

  /** Resumes from the closest position already seen, since a page cannot be reached by offset. */
  private async readPage(
    plan: ReadPlan,
    fields: string[],
    skip: number,
    limit: number | undefined,
    timezone: string,
  ): Promise<Item[]> {
    const { access, residual } = plan;
    const cache = this.settings.paginationCache;
    const base = this.buildReadInput(access, fields);
    const hash = cache.hash({
      base,
      residual: residual?.toPlainObject(),
      timezone,
      table: this.model.tableName,
    });
    const cached = limit === undefined ? undefined : cache.findBestToken(hash, skip);
    let matched = cached?.offset ?? 0;
    let lastStored = matched;
    const unfiltered = !base.FilterExpression && !residual;
    const input: ReadInput = {
      ...base,
      ...(cached ? { ExclusiveStartKey: cached.startKey } : {}),
      ...(unfiltered && limit !== undefined ? { Limit: skip + limit - matched } : {}),
    };
    const collected: Item[] = [];

    for await (const page of this.executor.readPages(access.kind, input)) {
      for (const item of page.items) {
        if (!residual || this.matches(residual, item, timezone)) {
          if (matched >= skip) collected.push(item);
          matched += 1;

          if (limit !== undefined && collected.length >= limit) {
            cache.storeToken(hash, matched, this.positionOf(item, access), this.model.tableName);

            return collected;
          }
        }
      }

      if (page.lastKey && matched - lastStored >= cache.getCacheInterval()) {
        cache.storeToken(hash, matched, page.lastKey, this.model.tableName);
        lastStored = matched;
      }
    }

    return collected;
  }

  private positionOf(item: Item, access: AccessPath): Record<string, unknown> {
    return Object.fromEntries(
      this.positionAttributes(access)
        .filter(attribute => item[attribute] !== undefined)
        .map(attribute => [attribute, item[attribute]]),
    );
  }

  private async listRecords(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const sort = filter.sort?.length ? filter.sort : undefined;
    const skip = filter.page?.skip ?? 0;
    const limit = filter.page?.limit || undefined;
    const { maxOffset } = this.settings;

    if (skip > maxOffset) {
      throw new OffsetTooDeepError(
        `Offset ${skip} exceeds the maximum allowed offset of ${maxOffset}. ` +
          `Narrow the results with filters.`,
      );
    }

    const plan = this.plan(filter.conditionTree, sort);

    // Reading the first page of a collection without any filter costs one page, not a table.
    const isCheapPage =
      !filter.conditionTree &&
      !plan.residual &&
      !plan.access?.remaining &&
      (!sort || plan.access?.sortSatisfied) &&
      limit !== undefined &&
      skip + limit <= MAX_CHEAP_PAGE_ITEMS;

    if (!isCheapPage) this.guardScan(plan, filter.conditionTree);

    const { columns } = projection;
    const fields = [
      ...new Set([
        ...columns,
        ...(plan.residual?.projection ?? []).filter(field => !field.includes(':')),
        ...(sort ?? []).map(clause => clause.field),
        ...this.positionAttributes(plan.access),
      ]),
    ];

    const toResult = (item: Item) => {
      const record = this.toRecord(item);

      return Object.fromEntries(
        columns.filter(field => field in record).map(field => [field, record[field]]),
      );
    };

    const singlePartition = !plan.access?.keyCondition?.partition.values;

    if (!plan.lookup && singlePartition && (!sort || plan.access.sortSatisfied)) {
      return (await this.readPage(plan, fields, skip, limit, caller.timezone)).map(toResult);
    }

    let items = await this.readAll(plan, fields, caller.timezone);

    if (sort && !plan.access?.sortSatisfied) {
      const rows = items.map(item => ({ item, record: this.toRecord(item) }));
      rows.sort((a, b) => compareRecords(a.record, b.record, sort));
      items = rows.map(row => row.item);
    }

    return items.slice(skip, limit === undefined ? undefined : skip + limit).map(toResult);
  }

  private async resolveKeys(caller: Caller, filter: Filter): Promise<Item[]> {
    const plan = this.plan(filter.conditionTree);

    if (plan.lookup && !plan.residual) return plan.lookup.keys;

    const keyNames = this.keyNames();
    const records = await this.listRecords(
      caller,
      new PaginatedFilterClass({ conditionTree: filter.conditionTree }),
      new ProjectionClass(...keyNames),
    );

    return records.map(record => Object.fromEntries(keyNames.map(name => [name, record[name]])));
  }

  // ---- writes -----------------------------------------------------------------------------

  private async createOne(record: RecordData): Promise<RecordData> {
    const { partitionKey, sortKey, entity } = this.model;
    const created: RecordData = { ...record };

    if (isEmptyKey(created[partitionKey.name])) {
      if (partitionKey.type !== 'S') {
        throw new ValidationError(
          `The partition key '${partitionKey.name}' is required to create a record in '${this.name}'`,
        );
      }

      created[partitionKey.name] = randomUUID();
    }

    if (sortKey && isEmptyKey(created[sortKey.name])) {
      if (sortKey.type !== 'S') {
        throw new ValidationError(
          `The sort key '${sortKey.name}' is required to create a record in '${this.name}'`,
        );
      }

      created[sortKey.name] = `${entity?.sortKeyPrefix ?? ''}${randomUUID()}`;
    }

    if (
      entity?.sortKeyPrefix !== undefined &&
      !String(created[sortKey.name]).startsWith(entity.sortKeyPrefix)
    ) {
      throw new ValidationError(
        `The sort key '${sortKey.name}' of '${this.name}' must start with '${entity.sortKeyPrefix}'`,
      );
    }

    if (entity?.attribute !== undefined) {
      if (created[entity.attribute] !== undefined && created[entity.attribute] !== entity.value) {
        throw new ValidationError(
          `The attribute '${entity.attribute}' of '${this.name}' must be '${entity.value}'`,
        );
      }

      created[entity.attribute] = entity.value;
    }

    const item = Serializer.unflatten(
      Object.fromEntries(
        Object.entries(created).map(([field, value]) => [field, this.toStored(field, value)]),
      ),
    );

    const keyBuilder = new ExpressionBuilder('k', 'kv');

    try {
      await this.executor.put({
        Item: item,
        ConditionExpression: `attribute_not_exists(${keyBuilder.attribute(partitionKey.name)})`,
        ...keyBuilder.result(),
      });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new ValidationError(`A record with the same key already exists in '${this.name}'`);
      }

      throw error;
    }

    return created;
  }

  private async updateOne(key: Item, entries: Array<[string, unknown]>): Promise<void> {
    const builder = new ExpressionBuilder();
    const keyBuilder = new ExpressionBuilder('k', 'kv');
    const sets = entries.map(
      ([field, value]) => `${builder.attribute(field)} = ${builder.value(value)}`,
    );
    const condition = `attribute_exists(${keyBuilder.attribute(this.model.partitionKey.name)})`;

    try {
      await this.executor.update({
        Key: key,
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression: condition,
        ExpressionAttributeNames: { ...builder.names, ...keyBuilder.names },
        ExpressionAttributeValues: builder.values,
      });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') return;

      // A nested path can only be set under a map that already exists: merge client-side instead.
      if (error.name === 'ValidationException' && /document path/i.test(error.message)) {
        await this.replaceOne(key, entries);

        return;
      }

      throw error;
    }
  }

  private async replaceOne(key: Item, entries: Array<[string, unknown]>): Promise<void> {
    const existing = await this.executor.get(key);

    if (!existing) return;

    const keyBuilder = new ExpressionBuilder('k', 'kv');

    // Each entry replaces what is at its path, as a SET does: a map is not merged with the old one.
    for (const [field, value] of entries) {
      Serializer.setPath(existing, Serializer.toPathSegments(field), value);
    }

    try {
      await this.executor.put({
        Item: existing,
        ConditionExpression: `attribute_exists(${keyBuilder.attribute(
          this.model.partitionKey.name,
        )})`,
        ...keyBuilder.result(),
      });
    } catch (error) {
      if (error.name !== 'ConditionalCheckFailedException') throw error;
    }
  }

  // ---- aggregation ------------------------------------------------------------------------

  private async aggregateRecords(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const { timezone } = caller;
    const { paginationCache: cache, chartCacheTtlMs, now } = this.settings;
    const cacheKey = cache.hash({
      collection: this.name,
      filter: filter.conditionTree?.toPlainObject(),
      aggregation: {
        field: aggregation.field,
        operation: aggregation.operation,
        groups: aggregation.groups,
      },
      limit,
      timezone,
    });
    const charts = this.chartsOfTable();
    const cached = charts.get(cacheKey);

    if (cached && now() - cached.at < chartCacheTtlMs) return copyOf(cached.value);

    const value = await this.computeAggregation(filter, aggregation, limit, timezone);

    if (chartCacheTtlMs > 0) {
      // A copy: the caller may rename the groups it is given, which must not reach the cache.
      charts.delete(cacheKey);
      charts.set(cacheKey, { at: now(), value: copyOf(value) });

      if (charts.size > MAX_CACHED_CHARTS) charts.delete(charts.keys().next().value);
    }

    return value;
  }

  private chartsOfTable(): Map<string, { at: number; value: AggregateResult[] }> {
    const { chartCaches } = this.settings;
    let charts = chartCaches.get(this.model.tableName);

    if (!charts) {
      charts = new Map();
      chartCaches.set(this.model.tableName, charts);
    }

    return charts;
  }

  /** Reads the segments of a parallel scan at once; a failure stops the others from reading on. */
  private async inSegments<T>(
    budget: ReadBudget,
    segments: T[],
    read: (segment: T) => Promise<void>,
  ): Promise<void> {
    try {
      await mapWithConcurrency(segments, Math.max(this.settings.scanConcurrency, 1), read);
    } catch (error) {
      budget.abort();

      throw error;
    }
  }

  private async computeAggregation(
    filter: Filter,
    aggregation: Aggregation,
    limit: number | undefined,
    timezone: string,
  ): Promise<AggregateResult[]> {
    const plan = this.plan(filter.conditionTree);
    const isCount = aggregation.operation === 'Count' && !aggregation.field;
    const ungrouped = !aggregation.groups?.length;

    if (
      isCount &&
      ungrouped &&
      this.settings.approximateCount &&
      !filter.conditionTree &&
      !this.model.entity
    ) {
      return [{ value: await this.executor.describeItemCount(), group: {} }];
    }

    this.guardScan(plan, filter.conditionTree);

    const budget = this.executor.newBudget();
    const segments = plan.access?.kind === 'scan' ? Math.max(this.settings.scanConcurrency, 1) : 1;
    const partitions = plan.access?.keyCondition?.partition.values;

    const segmentsOf = (): Array<ReadUnit | undefined> => {
      if (partitions) return partitions.map(partition => ({ partition }));

      return segments > 1
        ? Array.from({ length: segments }, (_, index) => ({ segment: { index, total: segments } }))
        : [undefined];
    };

    if (isCount && ungrouped && !plan.lookup && !plan.residual) {
      let total = 0;

      await this.inSegments(budget, segmentsOf(), async unit => {
        const input = this.buildReadInput(
          plan.access,
          [],
          {
            Select: 'COUNT',
            ...(unit?.segment
              ? { Segment: unit.segment.index, TotalSegments: unit.segment.total }
              : {}),
          },
          unit?.partition,
        );

        for await (const page of this.executor.readPages(plan.access.kind, input, budget)) {
          total += page.count;
        }
      });

      return [{ value: total, group: {} }];
    }

    const fields = [
      ...new Set([
        ...aggregation.projection.filter(field => !field.includes(':')),
        ...(plan.residual?.projection ?? []).filter(field => !field.includes(':')),
      ]),
    ];
    const aggregator = new StreamingAggregator(aggregation, timezone);

    await this.inSegments(budget, segmentsOf(), async unit => {
      for await (const batch of this.readBatches(plan, fields, budget, unit)) {
        for (const item of batch) {
          if (!plan.residual || this.matches(plan.residual, item, timezone)) {
            aggregator.add(this.toRecord(item));
          }
        }
      }
    });

    return aggregator.result(limit);
  }
}
