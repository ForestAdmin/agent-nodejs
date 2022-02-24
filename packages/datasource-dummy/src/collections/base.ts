import {
  ActionSchemaScope,
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
import MarkAsLiveAction from '../actions/mark-as-live';

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

  private records: RecordData[];

  constructor(
    datasource: DataSource,
    name: string,
    fields: Record<string, FieldSchema>,
    records: RecordData[],
  ) {
    super(name, datasource);
    this.addFields(fields);
    this.addAction(
      'Mark as Live',
      { scope: ActionSchemaScope.Bulk, staticForm: true },
      new MarkAsLiveAction(),
    );
    this.records = records;

    // filters/sort is supported
    for (const schema of Object.values(this.schema.fields)) {
      if (schema.type === FieldTypes.Column) {
        schema.filterOperators = BaseDummyCollection.supportedOperators;
        schema.isSortable = true;
      }
    }
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return data;
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    let result: RecordData[] = this.records.slice();
    if (filter?.conditionTree) result = filter.conditionTree.apply(result, this, filter.timezone);
    if (filter?.sort) result = filter.sort.apply(result);
    if (filter?.page) result = filter.page.apply(result);

    return projection.apply(result);
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    void filter;
    void patch;
  }

  async delete(filter: Filter): Promise<void> {
    void filter;
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
}
