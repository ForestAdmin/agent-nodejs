import {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ConditionTree,
  ConditionTreeLeaf,
  FieldSchema,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import FileType from 'file-type';

import { BinaryMode } from './types';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

/**
 * As the transport layer between the forest admin agent and the frontend is JSON-API, binary data
 * is not supported.
 *
 * This decorator implement binary to string translation for binary fields and back.
 * Binary fields can either by represented in the frontend as:
 * - data-uris (so that the current file widgets can be used)
 * - hex strings (for primarykeys, foreign keys, etc...)
 */
export default class BinaryCollectionDecorator extends CollectionDecorator {
  // For those operators, we need to replace hex string/datauri by Buffers instances (depending
  // on what is actually supported by the underlying connector).
  private static readonly operatorsWithValueReplacement = [
    ...['After', 'Before', 'Contains', 'EndsWith', 'Equal', 'GreaterThan', 'IContains', 'NotIn'],
    ...['IEndsWith', 'IStartsWith', 'LessThan', 'NotContains', 'NotEqual', 'StartsWith', 'In'],
  ];

  override dataSource: DataSourceDecorator<BinaryCollectionDecorator>;
  private useHexConversion: Map<string, boolean> = new Map();

  setBinaryMode(name: string, type: BinaryMode): void {
    const field = this.childCollection.schema.fields[name];

    if (type !== 'datauri' && type !== 'hex') {
      throw new Error('Invalid binary mode');
    }

    if (field?.type === 'Column' && field?.columnType === 'Binary') {
      this.useHexConversion.set(name, type === 'hex');
      this.markSchemaAsDirty();
    } else {
      throw new Error('Expected a binary field');
    }
  }

  private shouldUseHex(name: string): boolean {
    if (this.useHexConversion.has(name)) {
      return this.useHexConversion.get(name);
    }

    return (
      SchemaUtils.isPrimaryKey(this.childCollection.schema, name) ||
      SchemaUtils.isForeignKey(this.childCollection.schema, name)
    );
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const records = await super.list(caller, filter, projection);
    const promises = records.map(r => this.convertRecord(false, r));

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
      const entries = Object.entries(row.group).map(async ([path, value]) => [
        path,
        await this.convertValue(false, path, value),
      ]);

      return { value: row.value, group: Object.fromEntries(await Promise.all(entries)) };
    });

    return Promise.all(promises);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const dataWithBinary = data.map(record => this.convertRecord(true, record));
    const records = await super.create(caller, await Promise.all(dataWithBinary));
    const recordsWithoutBinary = records.map(record => this.convertRecord(false, record));

    return Promise.all(recordsWithoutBinary);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const newPatch = await this.convertRecord(true, patch);

    return super.update(caller, filter, newPatch);
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: await filter?.conditionTree?.replaceLeafsAsync(leaf =>
        this.convertConditionTreeLeaf(leaf),
      ),
    });
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(subSchema.fields)) {
      if (schema.type === 'Column') {
        const columnType = this.replaceColumnType(schema.columnType);
        const validation = this.replaceValidation(name, schema);

        fields[name] = { ...schema, columnType, validation };
      } else {
        fields[name] = schema;
      }
    }

    return { ...subSchema, fields };
  }

  private async convertRecord(toBackend: boolean, record: RecordData): Promise<RecordData> {
    if (record) {
      const entries = Object.entries(record).map(async ([path, value]) => [
        path,
        await this.convertValue(toBackend, path, value),
      ]);

      return Object.fromEntries(await Promise.all(entries));
    }

    return record;
  }

  private async convertConditionTreeLeaf(leaf: ConditionTreeLeaf): Promise<ConditionTree> {
    const [prefix, suffix] = leaf.field.split(/:(.*)/);
    const schema = this.childCollection.schema.fields[prefix];

    if (schema.type !== 'Column') {
      const conditionTree = await this.dataSource
        .getCollection(schema.foreignCollection)
        .convertConditionTreeLeaf(leaf.override({ field: suffix }));

      return conditionTree.nest(prefix);
    }

    if (BinaryCollectionDecorator.operatorsWithValueReplacement.includes(leaf.operator)) {
      const useHex = this.shouldUseHex(prefix);
      const columnType: ColumnType =
        leaf.operator === 'In' || leaf.operator === 'NotIn'
          ? [schema.columnType]
          : schema.columnType;

      return leaf.override({
        value: await this.convertValueHelper(true, columnType, useHex, leaf.value),
      });
    }

    return leaf;
  }

  private async convertValue(toBackend: boolean, path: string, value: unknown): Promise<unknown> {
    const [prefix, suffix] = path.split(/:(.*)/);
    const schema = this.childCollection.schema.fields[prefix];

    if (schema.type !== 'Column') {
      const foreignCollection = this.dataSource.getCollection(schema.foreignCollection);

      return suffix
        ? foreignCollection.convertValue(toBackend, suffix, value)
        : foreignCollection.convertRecord(toBackend, value as RecordData);
    }

    const binaryMode = this.shouldUseHex(path);

    return this.convertValueHelper(toBackend, schema.columnType, binaryMode, value);
  }

  private async convertValueHelper(
    toBackend: boolean,
    columnType: ColumnType,
    useHex: boolean,
    value: unknown,
  ): Promise<unknown> {
    if (value) {
      if (columnType === 'Binary') {
        return this.convertScalar(toBackend, useHex, value);
      }

      if (Array.isArray(columnType)) {
        const newValues = (value as unknown[]).map(v =>
          this.convertValueHelper(toBackend, columnType[0], useHex, v),
        );

        return Promise.all(newValues);
      }

      if (typeof columnType !== 'string') {
        const entries = Object.entries(columnType).map(async ([key, type]) => [
          key,
          await this.convertValueHelper(toBackend, type, useHex, value[key]),
        ]);

        return Object.fromEntries(await Promise.all(entries));
      }
    }

    return value;
  }

  private async convertScalar(
    toBackend: boolean,
    useHex: boolean,
    value: unknown,
  ): Promise<unknown> {
    if (toBackend) {
      const string = value as string;

      return useHex ? Buffer.from(string, 'hex') : Buffer.from(string.split(',')[1], 'base64');
    }

    const buffer = value as Buffer;
    if (useHex) return buffer.toString('hex');

    const mime = (await FileType.fromBuffer(buffer))?.mime ?? 'application/octet-stream';
    const data = buffer.toString('base64');

    return `data:${mime};base64,${data}`;
  }

  private replaceColumnType(columnType: ColumnType): ColumnType {
    if (typeof columnType === 'string') {
      return columnType === 'Binary' ? 'String' : columnType;
    }

    if (Array.isArray(columnType)) {
      return [this.replaceColumnType(columnType[0])];
    }

    const entries = Object.entries(columnType).map(([key, type]) => [
      key,
      this.replaceColumnType(type),
    ]);

    return Object.fromEntries(entries);
  }

  private replaceValidation(name: string, schema: ColumnSchema): ColumnSchema['validation'] {
    if (schema.columnType === 'Binary') {
      const validation: ColumnSchema['validation'] = [];

      const minLength = schema.validation?.find(v => v.operator === 'LongerThan')?.value as number;
      const maxLength = schema.validation?.find(v => v.operator === 'ShorterThan')?.value as number;

      if (this.shouldUseHex(name)) {
        validation.push({ operator: 'Match', value: /^[0-9a-f]+$/ });
        if (minLength) validation.push({ operator: 'LongerThan', value: minLength * 2 + 1 });
        if (maxLength) validation.push({ operator: 'ShorterThan', value: maxLength * 2 - 1 });
      } else {
        validation.push({ operator: 'Match', value: /^data:.*;base64,.*/ });
      }

      if (schema.validation?.find(v => v.operator === 'Present')) {
        validation.push({ operator: 'Present' });
      }

      return validation;
    }

    return schema.validation;
  }
}
