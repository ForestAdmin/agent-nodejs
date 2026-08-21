import type {
  AggregateResult,
  Aggregation,
  Caller,
  DataSource,
  FieldSchema,
  Filter,
  Operator,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { BaseCollection } from '@forestadmin/datasource-toolkit';

// The search decorator prefers IContains on a String column and only falls back to Contains then
// Equal, so a fixture omitting it would exercise a case-sensitive path production does not take.
const OPERATORS = new Set<Operator>([
  'IContains',
  'Contains',
  'Equal',
  'NotEqual',
  'In',
  'Present',
]);

/**
 * A read-only in-memory collection: enough to let the agent's own search decorator build a real
 * condition tree and apply it. `searchable` stays false, as on any datasource with no native
 * search, which is the path the decorator implements itself.
 */
export default class InMemoryCollection extends BaseCollection {
  private readonly records: RecordData[];

  constructor(
    datasource: DataSource,
    name: string,
    fields: Record<string, FieldSchema>,
    records: RecordData[],
  ) {
    super(name, datasource);
    this.records = records;
    this.addFields(fields);
    this.enableCount();

    for (const schema of Object.values(this.schema.fields)) {
      if (schema.type === 'Column') schema.filterOperators = OPERATORS;
    }
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    let result = this.records.slice();
    if (filter?.conditionTree) result = filter.conditionTree.apply(result, this, caller.timezone);
    if (filter?.page) result = filter.page.apply(result);

    return projection.apply(result);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    return aggregation.apply(
      await this.list(caller, filter as PaginatedFilter, aggregation.projection),
      caller.timezone,
      limit,
    );
  }

  async create(): Promise<RecordData[]> {
    throw new Error('The search fixture is read-only');
  }

  async update(): Promise<void> {
    throw new Error('The search fixture is read-only');
  }

  async delete(): Promise<void> {
    throw new Error('The search fixture is read-only');
  }
}
