import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionSchema,
  ColumnType,
  ConditionTreeLeaf,
  FieldSchema,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import FileType from 'file-type';

import { ConvertionType } from './types';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

type Direction = 'toFrontend' | 'toBackend';

/**
 * Implement binary to string type conversion.
 * (neither the frontend nor the transport layer support binary data)
 */
export default class BinaryCollectionDecorator extends CollectionDecorator {
  override dataSource: DataSourceDecorator<BinaryCollectionDecorator>;

  convertionTypes: Map<string, ConvertionType> = new Map();

  setConvertionType(name: string, type: ConvertionType): void {
    this.convertionTypes.set(name, type);
    this.markSchemaAsDirty();
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const records = await super.list(caller, filter, projection);
    const promises = records.map(r => this.convertRecord('toFrontend', r));

    return Promise.all(promises);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const rows = await super.aggregate(caller, filter, aggregation, limit);
    const promises = rows.map(async row => {
      const newRow = { value: row.value, group: {} };

      await Promise.all(
        Object.entries(row.group).map(async ([path, value]) => {
          newRow.group[path] = this.convertValue('toFrontend', path, value);
        }),
      );

      return newRow;
    });

    return Promise.all(promises);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const promises = data.map(record => this.convertRecord('toBackend', record));

    return super.create(caller, await Promise.all(promises));
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const newPatch = await this.convertRecord('toBackend', patch);

    return super.update(caller, filter, newPatch);
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    const promise = filter.conditionTree
      ? filter.conditionTree.replaceLeafsAsync(leaf => this.convertConditionTreeLeaf(leaf))
      : null;

    return filter.override({ conditionTree: await promise });
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(subSchema.fields)) {
      if (schema.type === 'Column') {
        fields[name] = { ...schema, columnType: this.replaceColumnType(schema.columnType) };
      } else {
        fields[name] = schema;
      }
    }

    return { ...subSchema, fields };
  }

  private async convertRecord(direction: Direction, record: RecordData): Promise<RecordData> {
    const newRecord = {};

    await Promise.all(
      Object.entries(record).map(async ([key, value]) => {
        newRecord[key] = await this.convertValue(direction, key, value);
      }),
    );

    return newRecord;
  }

  private async convertConditionTreeLeaf(leaf: ConditionTreeLeaf): Promise<ConditionTreeLeaf> {
    // fixme add other operators here
    if (leaf.operator === 'Equal')
      return leaf.override({
        value: await this.convertValue('toBackend', leaf.field, leaf.value),
      });

    if (leaf.operator === 'In') {
      return leaf.override({
        value: await Promise.all(
          (leaf.value as unknown[]).map(v => this.convertValue('toBackend', leaf.field, v)),
        ),
      });
    }

    return leaf;
  }

  private async convertValue(direction: Direction, path: string, value: unknown): Promise<unknown> {
    const [prefix, suffix] = path.split(/:(.*)/);
    const schema = this.childCollection.schema.fields[prefix];

    let result: unknown;

    if (schema.type === 'Column') {
      const { isPrimaryKey, isForeignKey } = SchemaUtils;
      const conversionType =
        this.convertionTypes.get(path) ??
        (isPrimaryKey(this.schema, path) || isForeignKey(this.schema, path) ? 'hex' : 'datauri');

      result = this.convertValueHelper(direction, schema.columnType, conversionType, value);
    } else {
      const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);

      result = suffix
        ? foreignCollection.convertValue(direction, suffix, value)
        : foreignCollection.convertRecord(direction, value as RecordData);
    }

    return result;
  }

  private async convertValueHelper(
    direction: Direction,
    columnType: ColumnType,
    conversionType: ConvertionType,
    value: unknown,
  ): Promise<unknown> {
    if (value) {
      if (columnType === 'Binary') {
        return this.convertScalar(direction, conversionType, value);
      }

      if (Array.isArray(columnType)) {
        return Promise.all(
          (value as unknown[]).map(v =>
            this.convertValueHelper(direction, columnType[0], conversionType, v),
          ),
        );
      }

      if (typeof columnType !== 'string') {
        const result = {};
        const promises = Object.entries(columnType).map(async ([key, type]) => {
          result[key] = await this.convertValueHelper(direction, type, conversionType, value[key]);
        });

        await Promise.all(promises);

        return result;
      }
    }

    return value;
  }

  private async convertScalar(
    direction: Direction,
    convertionType: ConvertionType,
    value: unknown,
  ): Promise<unknown> {
    if (direction === 'toFrontend') {
      const buffer = value as Buffer;
      if (convertionType === 'hex') return buffer.toString('hex');

      if (convertionType === 'datauri') {
        const { mime } = await FileType.fromBuffer(buffer);

        return `data:${mime ?? 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      }
    }

    if (direction === 'toBackend') {
      const string = value as string;
      if (convertionType === 'hex') return Buffer.from(string, 'hex');
      if (convertionType === 'datauri') return Buffer.from(string.split(',')[1], 'base64');
    }

    throw new Error(`Unsupported convertion type: ${convertionType}`);
  }

  private replaceColumnType(columnType: ColumnType): ColumnType {
    if (typeof columnType === 'string') {
      return columnType === 'Binary' ? 'String' : columnType;
    }

    if (Array.isArray(columnType)) {
      return [this.replaceColumnType(columnType[0])];
    }

    const newColumnType = {};

    for (const [key, type] of Object.entries(columnType))
      newColumnType[key] = this.replaceColumnType(type);

    return newColumnType;
  }
}
