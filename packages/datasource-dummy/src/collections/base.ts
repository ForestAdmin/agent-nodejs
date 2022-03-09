import {
  ActionResult,
  ActionResultType,
  ActionScope,
  AggregateResult,
  Aggregation,
  BaseCollection,
  DataSource,
  FieldSchema,
  FieldTypes,
  Filter,
  Operator,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class BaseDummyCollection extends BaseCollection {
  private static supportedOperators = new Set([
    Operator.Blank,
    Operator.Contains,
    Operator.StartsWith,
    Operator.EndsWith,
    Operator.LessThan,
    Operator.Equal,
    Operator.GreaterThan,
    Operator.In,
    Operator.IncludesAll,
    Operator.ShorterThan,
    Operator.LongerThan,
    Operator.Present,
    Operator.NotContains,
    Operator.NotEqual,
    Operator.NotIn,
  ]);

  protected records: RecordData[] = [];

  constructor(datasource: DataSource, name: string, fields: Record<string, FieldSchema>) {
    super(name, datasource);
    this.addFields(fields);
    this.addAction('Mark as Live', { scope: ActionScope.Bulk, staticForm: true });

    // filters/sort is supported
    for (const schema of Object.values(this.schema.fields)) {
      if (schema.type === FieldTypes.Column) {
        schema.filterOperators = BaseDummyCollection.supportedOperators;
        schema.isSortable = true;
      }
    }
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    const records = [];

    for (const datum of data) {
      const maxId = this.records.reduce((id, r) => (id < r.id ? (r.id as number) : id), 1);
      const record = { id: maxId + 1, ...datum };

      this.records.push(record);
      records.push(record);
    }

    return records;
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    let result: RecordData[] = this.records.slice();
    if (filter?.conditionTree) result = filter.conditionTree.apply(result, this, filter.timezone);
    if (filter?.sort) result = filter.sort.apply(result);
    if (filter?.page) result = filter.page.apply(result);

    return projection.apply(result);
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    let target: RecordData[] = this.records.slice();
    if (filter?.conditionTree) target = filter.conditionTree.apply(target, this, filter.timezone);

    for (const record of target) Object.assign(record, patch);
  }

  async delete(filter: Filter): Promise<void> {
    let target: RecordData[] = this.records.slice();
    if (filter?.conditionTree) target = filter.conditionTree.apply(target, this, filter.timezone);

    for (const record of target) this.records.splice(this.records.indexOf(record), 1);
  }

  async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const result = await this.list(filter, aggregation.projection);

    let aggregationResults = aggregation.apply(result, filter.timezone);

    aggregationResults = aggregationResults.sort(
      ({ value: a }, { value: b }) => (b as number) - (a as number),
    );

    return limit ? aggregationResults.slice(0, limit) : aggregationResults;
  }

  override async execute(): Promise<ActionResult> {
    return {
      type: ActionResultType.Success,
      message: 'Record set as active',
      format: 'text',
      invalidated: new Set(),
    };
  }
}
