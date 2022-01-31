import {
  ActionSchemaScope,
  AggregateResultGenerator,
  Aggregation,
  BaseCollection,
  CompositeId,
  DataSource,
  FieldTypes,
  Filter,
  Operator,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
  RecordData,
  RecordDataGenerator,
} from '@forestadmin/datasource-toolkit';
import MarkAsLiveAction from '../actions/mark-as-live';

// TODO handle segments
// const SCHEMA = {
//   segments: ['Active', 'Inactive'],
// };

export default class BookCollection extends BaseCollection {
  constructor(datasource: DataSource) {
    super('books', datasource);

    this.enableSearch();

    this.addAction('Mark as Live', { scope: ActionSchemaScope.Bulk }, new MarkAsLiveAction());

    this.addFields({
      id: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.Number,
        filterOperators: new Set<Operator>([]),
        isPrimaryKey: true,
      },
      title: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.String,
        filterOperators: new Set<Operator>([]),
        defaultValue: 'Le rouge et le noir',
      },
      authorId: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.Number,
        filterOperators: new Set<Operator>([]),
        defaultValue: 34,
      },
      publication: {
        type: FieldTypes.Column,
        columnType: PrimitiveTypes.Date,
        filterOperators: new Set([]),
      },
    });
  }

  override async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    void id;

    return this.makeRecord(projection);
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return data;
  }

  async *list(filter: PaginatedFilter, projection: Projection): RecordDataGenerator {
    void filter;

    const numRecords = filter?.page?.limit ?? 10;

    for (let i = 0; i < numRecords; i += 1) {
      yield this.makeRecord(projection);
    }
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    void filter;
    void patch;
  }

  async delete(filter: Filter): Promise<void> {
    void filter;
  }

  async *aggregate(filter: PaginatedFilter, aggregation: Aggregation): AggregateResultGenerator {
    void filter;

    const numRows = filter?.page?.limit ?? 10;

    for (let i = 0; i < numRows; i += 1) {
      const row = { value: Math.floor(Math.random() * 1000), group: {} };

      for (const { field } of aggregation.groups ?? []) {
        row.group[field] = this.makeRandomString(6);
      }

      yield row;
    }
  }

  private makeRecord(projection: Projection): RecordData {
    const record = {};

    for (const field of projection) {
      const schema = this.schema.fields[field];
      if (schema === undefined) throw new Error(`No such field "${field}" in schema`);

      if (schema.type === FieldTypes.Column) {
        if (schema.columnType === PrimitiveTypes.Number) {
          record[field] = Math.floor(Math.random() * 10000);
        } else if (schema.columnType === PrimitiveTypes.String) {
          record[field] = this.makeRandomString(10);
        } else if (schema.columnType === PrimitiveTypes.Date) {
          record[field] = new Date().toISOString();
        } else {
          throw new Error(`Unsupported primitive: ${schema.columnType}`);
        }
      } else {
        throw new Error(`Unsupported field type: ${schema.type}`);
      }
    }

    return record;
  }

  /** @see https://stackoverflow.com/questions/1349404 */
  private makeRandomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
  }
}
