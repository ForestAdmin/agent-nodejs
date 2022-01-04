import {
  Action,
  AggregateResult,
  Aggregation,
  Collection,
  CollectionSchema,
  CollectionSchemaScope,
  CompositeId,
  DataSource,
  FieldTypes,
  Filter,
  Operator,
  PaginatedFilter,
  PrimitiveTypes,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import MarkAsLiveAction from '../actions/mark-as-live';

export default class BookCollection implements Collection {
  readonly dataSource: DataSource;
  readonly name: string = 'book';
  readonly schema: CollectionSchema = {
    actions: [
      {
        name: 'Mark as Live',
        scope: CollectionSchemaScope.bulk,
      },
    ],
    fields: {
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
      publisher: {
        type: FieldTypes.ManyToOne,
        foreignCollection: null,
        foreignKey: null,
      },
    },
    searchable: true,
    segments: ['Active', 'Inactive'],
  };

  constructor(datasource: DataSource) {
    this.dataSource = datasource;
  }

  getAction(name: string): Action {
    if (name === 'Mark as Live') return new MarkAsLiveAction();
    throw new Error('Action not found.');
  }

  async getById(id: CompositeId, projection: Projection): Promise<RecordData> {
    void id;

    return this.makeRecord(projection);
  }

  async create(data: RecordData[]): Promise<RecordData[]> {
    return data;
  }

  async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    void filter;

    const numRecords = filter?.page?.limit ?? 10;
    const records = [];

    for (let i = 0; i < numRecords; i += 1) {
      records.push(this.makeRecord(projection));
    }

    return records;
  }

  async update(filter: Filter, patch: RecordData): Promise<void> {
    void filter;
    void patch;
  }

  async delete(filter: Filter): Promise<void> {
    void filter;
  }

  async aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
    void filter;

    const numRows = filter?.page?.limit ?? 10;
    const rows = [];

    for (let i = 0; i < numRows; i += 1) {
      const row = { value: Math.floor(Math.random() * 1000), group: {} };

      for (const { field } of aggregation.groups) {
        row.group[field] = this.makeRandomString(6);
      }

      rows.push(row);
    }

    return rows;
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
  private makeRandomString(length = 10) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
  }
}
