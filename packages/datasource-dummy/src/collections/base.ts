import {
  ActionResult,
  AggregateResult,
  Aggregation,
  BaseCollection,
  DataSource,
  FieldSchema,
  Filter,
  Operator,
  PaginatedFilter,
  Projection,
  QueryRecipient,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class BaseDummyCollection extends BaseCollection {
  private static supportedOperators = new Set<Operator>([
    'Blank',
    'Contains',
    'StartsWith',
    'EndsWith',
    'LessThan',
    'Equal',
    'GreaterThan',
    'In',
    'IncludesAll',
    'ShorterThan',
    'LongerThan',
    'Present',
    'NotContains',
    'NotEqual',
    'NotIn',
  ]);

  protected records: RecordData[] = [];

  constructor(datasource: DataSource, name: string, fields: Record<string, FieldSchema>) {
    super(name, datasource);
    this.addFields(fields);
    this.addAction('Mark as Live', { scope: 'Bulk', staticForm: true });

    // filters/sort is supported
    for (const schema of Object.values(this.schema.fields)) {
      if (schema.type === 'Column') {
        schema.filterOperators = BaseDummyCollection.supportedOperators;
        schema.isSortable = true;
      }
    }
  }

  async create(recipient: QueryRecipient, data: RecordData[]): Promise<RecordData[]> {
    const records = [];

    for (const datum of data) {
      const maxId = this.records.reduce((id, r) => (id < r.id ? (r.id as number) : id), 1);
      const record = { id: null, ...datum };
      if (!record.id) record.id = maxId + 1;

      this.records.push(record);
      records.push(record);
    }

    return records;
  }

  async list(
    recipient: QueryRecipient,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    let result: RecordData[] = this.records.slice();
    if (filter?.conditionTree)
      result = filter.conditionTree.apply(result, this, recipient.timezone);
    if (filter?.sort) result = filter.sort.apply(result);
    if (filter?.page) result = filter.page.apply(result);

    return projection.apply(result);
  }

  async update(recipient: QueryRecipient, filter: Filter, patch: RecordData): Promise<void> {
    let target: RecordData[] = this.records.slice();
    if (filter?.conditionTree)
      target = filter.conditionTree.apply(target, this, recipient.timezone);

    for (const record of target) Object.assign(record, patch);
  }

  async delete(recipient: QueryRecipient, filter: Filter): Promise<void> {
    let target: RecordData[] = this.records.slice();
    if (filter?.conditionTree)
      target = filter.conditionTree.apply(target, this, recipient.timezone);

    for (const record of target) this.records.splice(this.records.indexOf(record), 1);
  }

  async aggregate(
    recipient: QueryRecipient,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    return aggregation.apply(
      await this.list(recipient, filter, aggregation.projection),
      recipient.timezone,
      limit,
    );
  }

  override async execute(): Promise<ActionResult> {
    return {
      type: 'Success',
      message: 'Record set as active',
      format: 'text',
      invalidated: new Set(),
    };
  }
}
